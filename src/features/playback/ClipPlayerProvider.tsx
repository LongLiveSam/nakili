import type { ReactNode } from 'react';

/**
 * Lifetime seam for the editor screen's shared audio element.
 * The element itself lives module-level inside playbackStore; this provider
 * marks the subtree where playback is active so future teardown hooks have a home.
 */
export function ClipPlayerProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
