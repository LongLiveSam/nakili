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

async function shareOrDownload(blob: Blob, filename: string, title: string): Promise<void> {
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string }) => Promise<void>;
  };
  const file = new File([blob], filename, { type: blob.type });
  if (nav.share && nav.canShare?.({ files: [file] })) {
    await nav.share({ files: [file], title });
    return;
  }
  downloadBlob(blob, filename);
}

export async function exportTranscript(articleId: string): Promise<void> {
  const { getArticle } = await import('../db/repositories');
  const article = await getArticle(articleId);
  if (!article) throw new Error(`article not found: ${articleId}`);
  const blob = new Blob([article.transcriptText], { type: 'text/plain;charset=utf-8' });
  await shareOrDownload(blob, `${slugify(article.title)}.txt`, article.title);
}

export async function exportFullRecording(articleId: string): Promise<void> {
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
  const full = new Blob(blobs, { type: 'audio/webm' });
  await shareOrDownload(full, `${slugify(article.title)}.webm`, article.title);
}
