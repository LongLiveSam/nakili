import { describe, it, expect } from 'vitest';
import {
  IMPORT_CHUNK_SECONDS,
  buildImportedTranscript,
  splitPcmIntoClips,
  titleFromFilename,
} from './importAudio';

function tone(seconds: number, rate = 16000): Float32Array {
  const pcm = new Float32Array(Math.round(seconds * rate));
  for (let i = 0; i < pcm.length; i++) pcm[i] = Math.sin((2 * Math.PI * 220 * i) / rate) * 0.4;
  return pcm;
}

describe('splitPcmIntoClips', () => {
  it('splits audio on the 30-second grid', () => {
    const clips = splitPcmIntoClips(tone(65), 16000);
    expect(clips).toHaveLength(3);
    expect(clips[0].startTimeSec).toBe(0);
    expect(clips[1].startTimeSec).toBe(IMPORT_CHUNK_SECONDS);
    expect(clips[2].startTimeSec).toBe(IMPORT_CHUNK_SECONDS * 2);
    expect(clips[2].durationSec).toBeCloseTo(5, 1);
  });

  it('encodes each clip as a WAV blob', async () => {
    const [clip] = splitPcmIntoClips(tone(1), 16000);
    expect(clip.blob.type).toBe('audio/wav');
    const header = new TextDecoder().decode(await clip.blob.slice(0, 4).arrayBuffer());
    expect(header).toBe('RIFF');
  });

  it('returns nothing for empty audio', () => {
    expect(splitPcmIntoClips(new Float32Array(0), 16000)).toEqual([]);
  });
});

describe('buildImportedTranscript', () => {
  it('joins clip text with paragraph breaks and maps offsets', () => {
    const { text, segments } = buildImportedTranscript(['First part.', 'Second part.']);
    expect(text).toBe('First part.\n\nSecond part.');
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({
      startCharOffset: 0,
      endCharOffset: 10,
      audioChunkIndex: 0,
      startTimeSec: 0,
      approximate: false,
    });
    expect(segments[1].startCharOffset).toBe(13);
    expect(text.slice(segments[1].startCharOffset, segments[1].endCharOffset + 1)).toBe('Second part.');
  });

  it('skips empty clips without shifting the audio index', () => {
    const { text, segments } = buildImportedTranscript(['One.', '', 'Three.']);
    expect(text).toBe('One.\n\nThree.');
    expect(segments).toHaveLength(2);
    expect(segments[1].audioChunkIndex).toBe(2);
    expect(segments[1].startTimeSec).toBe(IMPORT_CHUNK_SECONDS * 2);
  });

  it('returns an empty transcript when every clip failed', () => {
    expect(buildImportedTranscript(['', '  '])).toEqual({ text: '', segments: [] });
  });
});

describe('titleFromFilename', () => {
  it('strips the extension and turns separators into spaces', () => {
    expect(titleFromFilename('team_standup-2026.webm')).toBe('team standup 2026');
  });

  it('falls back when the name has no usable stem', () => {
    expect(titleFromFilename('.wav')).toBe('Imported recording');
  });
});
