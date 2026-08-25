import { useEffect, useRef } from 'react';

/**
 * Instrument-style level meter driven by the live mic analyser.
 * Respects prefers-reduced-motion by throttling to ~7 fps.
 */
export function LevelMeter({ getAnalyser }: { getAnalyser: () => AnalyserNode | null }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let stopped = false;
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const draw = () => {
      const an = getAnalyser();
      if (an && ref.current) {
        const data = new Uint8Array(an.frequencyBinCount);
        an.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const level = Math.min(1, sum / data.length / 140);
        const bars = ref.current.children;
        for (let i = 0; i < bars.length; i++) {
          const on = (i + 1) / bars.length <= level;
          (bars[i] as HTMLElement).style.opacity = on ? '1' : '0.25';
        }
      }
      if (!stopped) {
        if (reduced) timer = setTimeout(draw, 150);
        else raf = requestAnimationFrame(draw);
      }
    };
    draw();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      if (timer !== null) clearTimeout(timer);
    };
  }, [getAnalyser]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{ display: 'flex', gap: 2, height: 14, width: 140 }}
    >
      {Array.from({ length: 14 }, (_, i) => (
        <i key={i} style={{ flex: 1, background: 'var(--text-display)', opacity: 0.25 }} />
      ))}
    </div>
  );
}
