/**
 * Read the transcript aloud with the system voice (VoiceStudio's "narrate").
 * Uses the browser's own speech synthesis: no network, no model download.
 */

export interface ReadAloudHandle {
  stop: () => void;
}

export function speechSynthesisAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance !== 'undefined'
  );
}

export function readAloud(
  text: string,
  opts: { onEnd?: () => void; onError?: (message: string) => void } = {},
): ReadAloudHandle {
  if (!speechSynthesisAvailable()) {
    opts.onError?.('SPEECH UNAVAILABLE');
    return { stop: () => {} };
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.onend = () => opts.onEnd?.();
  utterance.onerror = (event) => {
    // Cancelling is a normal stop, not a failure.
    if (event.error === 'canceled' || event.error === 'interrupted') opts.onEnd?.();
    else opts.onError?.(event.error || 'SPEECH FAILED');
  };
  synth.speak(utterance);
  return { stop: () => synth.cancel() };
}
