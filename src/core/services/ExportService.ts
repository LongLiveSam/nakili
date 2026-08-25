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

export async function exportTranscript(articleId: string): Promise<void> {
  const { getArticle } = await import('../db/repositories');
  const article = await getArticle(articleId);
  if (!article) throw new Error(`article not found: ${articleId}`);
  const blob = new Blob([article.transcriptText], { type: 'text/plain;charset=utf-8' });
  await shareOrDownload(blob, `${slugify(article.title)}.txt`);
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
      await shareOrDownload(await encodeMp3(pcm, sampleRate, 128), `${slugify(article.title)}.mp3`);
    }
    return;
  }

  // Original container — keep whatever the recorder produced.
  const firstType = blobs[0]?.type ?? 'audio/webm';
  const ext = firstType.includes('mp4') ? 'm4a' : 'webm';
  const full = new Blob(blobs, { type: firstType });
  await shareOrDownload(full, `${slugify(article.title)}.${ext}`);
}
