export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 64);
  return slug || 'untitled';
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function shareOrDownload(blob: Blob, filename: string): Promise<void> {
  // Always download. The Web Share API on desktop hijacks exports into the OS
  // share sheet whose cancel path looks identical to a failure; a download is
  // unambiguous on every platform.
  downloadBlob(blob, filename);
}
export async function exportTranscript(articleId: string, format: 'txt' | 'md' = 'txt'): Promise<void> {
  const { getArticle } = await import('../db/repositories');
  const article = await getArticle(articleId);
  if (!article) throw new Error(`article not found: ${articleId}`);
  const body =
    format === 'md'
      ? `# ${article.title}\n\n${article.transcriptText.replace(/\n{3,}/g, '\n\n')}\n`
      : article.transcriptText;
  const type = format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
  const blob = new Blob([body], { type });
  await shareOrDownload(blob, `${slugify(article.title)}.${format}`);
}

export async function exportDocx(articleId: string): Promise<void> {
  const { getArticle } = await import('../db/repositories');
  const article = await getArticle(articleId);
  if (!article) throw new Error(`article not found: ${articleId}`);
  const paragraphs = article.transcriptText.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  if (paragraphs.length === 0) paragraphs.push('(empty)');
  const { buildDocxBlob } = await import('./docx');
  await shareOrDownload(buildDocxBlob(article.title, paragraphs), `${slugify(article.title)}.docx`);
}

export type AudioExportFormat = 'mp3' | 'wav' | 'webm';

/** Decode every chunk and concatenate as mono PCM for re-encoding. */
async function decodeConcat(blobs: Blob[]): Promise<{ pcm: Float32Array; sampleRate: number }> {
  const Ctx = window.AudioContext;
  if (!Ctx) throw new Error('AUDIO DECODE UNAVAILABLE');
  const ctx = new Ctx();
  try {
    let total = 0;
    const buffers: AudioBuffer[] = [];
    for (const b of blobs) {
      const buf = await ctx.decodeAudioData(await b.arrayBuffer());
      buffers.push(buf);
      total += buf.length;
    }
    const sampleRate = buffers[0].sampleRate;
    const pcm = new Float32Array(total);
    let off = 0;
    for (const b of buffers) {
      pcm.set(b.getChannelData(0), off);
      off += b.length;
    }
    return { pcm, sampleRate };
  } finally {
    void ctx.close().catch(() => {});
  }
}

export async function exportFullRecording(
  articleId: string,
  format: AudioExportFormat = 'webm',
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const { getChunks, getAudioBlob } = await import('../db/repositories');
  const [{ getArticle }, chunks] = await Promise.all([
    import('../db/repositories').then((m) => ({ getArticle: m.getArticle })),
    getChunks(articleId),
  ]);
  const article = await getArticle(articleId);
  if (!article) throw new Error(`article not found: ${articleId}`);
  if (chunks.length === 0) throw new Error('no audio recorded for this article');
  const blobs: Blob[] = [];
  for (const c of chunks) {
    const b = await getAudioBlob(c.blobKey);
    if (b) blobs.push(b);
  }

  if (format === 'mp3' || format === 'wav') {
    // Re-encode locally: decode WebM/Opus (or MP4/AAC) → mono PCM → encoder.
    const { pcm, sampleRate } = await decodeConcat(blobs);
    const { encodeWav, encodeMp3 } = await import('./audioEncoders');
    if (format === 'wav') {
      await shareOrDownload(encodeWav([pcm], sampleRate), `${slugify(article.title)}.wav`);
    } else {
      await shareOrDownload(await encodeMp3(pcm, sampleRate, 128, onProgress), `${slugify(article.title)}.mp3`);
    }
    return;
  }

  // Original container — keep whatever the recorder produced.
  const firstType = blobs[0]?.type ?? 'audio/webm';
  const ext = firstType.includes('mp4') ? 'm4a' : 'webm';
  const full = new Blob(blobs, { type: firstType });
  await shareOrDownload(full, `${slugify(article.title)}.${ext}`);
}

/** Full-data safety net: every article, segment, and audio blob as one JSON file. */
export async function exportAllBackup(): Promise<void> {
  const { listArticles, getSegments, getChunks, getAudioBlob } = await import('../db/repositories');
  const articles = await listArticles();
  const payload = {
    app: 'nakili',
    version: 1,
    exportedAt: new Date().toISOString(),
    articles: [] as unknown[],
  };
  for (const a of articles) {
    const [segments, chunks] = await Promise.all([getSegments(a.id), getChunks(a.id)]);
    const audio: Record<string, string> = {};
    for (const c of chunks) {
      const b = await getAudioBlob(c.blobKey);
      if (b) audio[c.blobKey] = await blobToDataURL(b);
    }
    (payload.articles as unknown[]).push({ article: a, segments, chunks, audio });
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const json = JSON.stringify(payload, null, 2);
  downloadBlob(new Blob([json], { type: 'application/json' }), `nakili-backup-${stamp}.json`);
  try {
    localStorage.setItem('nakili-last-backup', String(Date.now()));
  } catch {
    /* ignore */
  }
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error('read failed'));
    r.readAsDataURL(blob);
  });
}
