import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readAloud, speechSynthesisAvailable } from './readAloud';

class FakeUtterance {
  text: string;
  rate = 1;
  pitch = 1;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

describe('readAloud', () => {
  const originalSynth = (window as { speechSynthesis?: unknown }).speechSynthesis;
  const originalUtterance = (window as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance;
  let spoken: FakeUtterance[];
  let cancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    spoken = [];
    cancel = vi.fn();
    (window as { speechSynthesis?: unknown }).speechSynthesis = {
      speak: (u: FakeUtterance) => spoken.push(u),
      cancel,
    };
    (window as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = FakeUtterance;
  });

  afterEach(() => {
    if (originalSynth === undefined) delete (window as { speechSynthesis?: unknown }).speechSynthesis;
    else (window as { speechSynthesis?: unknown }).speechSynthesis = originalSynth;
    if (originalUtterance === undefined) delete (window as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance;
    else (window as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = originalUtterance;
  });

  it('reports availability when the API exists', () => {
    expect(speechSynthesisAvailable()).toBe(true);
  });

  it('speaks the transcript and reports the end', () => {
    const onEnd = vi.fn();
    readAloud('Hello there.', { onEnd });
    expect(spoken).toHaveLength(1);
    expect(spoken[0].text).toBe('Hello there.');
    spoken[0].onend?.();
    expect(onEnd).toHaveBeenCalled();
  });

  it('cancels the previous utterance before speaking again', () => {
    readAloud('One.');
    readAloud('Two.');
    expect(cancel).toHaveBeenCalled();
    expect(spoken[1].text).toBe('Two.');
  });

  it('treats a cancel as a normal end, not an error', () => {
    const onEnd = vi.fn();
    const onError = vi.fn();
    readAloud('Text.', { onEnd, onError });
    spoken[0].onerror?.({ error: 'canceled' });
    expect(onEnd).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports a real synthesis failure', () => {
    const onError = vi.fn();
    readAloud('Text.', { onError });
    spoken[0].onerror?.({ error: 'synthesis-failed' });
    expect(onError).toHaveBeenCalledWith('synthesis-failed');
  });

  it('stops on demand', () => {
    const handle = readAloud('Text.');
    handle.stop();
    expect(cancel).toHaveBeenCalled();
  });

  it('reports unavailable when the API is missing', () => {
    delete (window as { speechSynthesis?: unknown }).speechSynthesis;
    const onError = vi.fn();
    expect(speechSynthesisAvailable()).toBe(false);
    readAloud('Text.', { onError });
    expect(onError).toHaveBeenCalledWith('SPEECH UNAVAILABLE');
  });
});
