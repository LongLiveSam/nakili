export const CHUNK_SECONDS = 30;

export function chunkIndexForElapsed(seconds: number): number {
  return Math.floor(seconds / CHUNK_SECONDS);
}

/**
 * Character-level diff via longest common prefix/suffix.
 * Returns the replaced region: old[start..oldEnd) -> new[start..newEnd).
 */
export function computeEditRange(
  oldText: string,
  newText: string,
): { start: number; oldEnd: number; newEnd: number } {
  let start = 0;
  const maxPrefix = Math.min(oldText.length, newText.length);
  while (start < maxPrefix && oldText[start] === newText[start]) start++;

  let oldEnd = oldText.length;
  let newEnd = newText.length;
  while (oldEnd > start && newEnd > start && oldText[oldEnd - 1] === newText[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  return { start, oldEnd, newEnd };
}
