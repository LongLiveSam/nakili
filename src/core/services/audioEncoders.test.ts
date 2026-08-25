import { describe, it, expect } from 'vitest';
import { encodeWav, encodeMp3 } from './audioEncoders';

function sine(n: number): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.sin((2 * Math.PI * 440 * i) / 44100);
  return out;
}

describe('encodeWav', () => {
  it('emits a valid 16-bit mono PCM WAV', async () => {
    const pcm = sine(1000);
    const blob = encodeWav([pcm], 44100);
    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBe(44 + 1000 * 2);

    const buf = new DataView(await blob.arrayBuffer());
    expect(String.fromCharCode(buf.getUint8(0), buf.getUint8(1), buf.getUint8(2), buf.getUint8(3))).toBe('RIFF');
    expect(String.fromCharCode(buf.getUint8(8), buf.getUint8(9), buf.getUint8(10), buf.getUint8(11))).toBe('WAVE');
    expect(buf.getUint16(22, true)).toBe(1); // mono
    expect(buf.getUint32(24, true)).toBe(44100);
  });

  it('clamps out-of-range samples', () => {
    const pcm = new Float32Array([2, -2, 0.5]);
    const blob = encodeWav([pcm], 8000);
    expect(blob.size).toBe(44 + 3 * 2);
  });
});

describe('encodeMp3', () => {
  it('produces a non-empty audio/mpeg stream', async () => {
    // ~0.5 s at 44.1 kHz gives lame enough frames.
    const blob = await encodeMp3(sine(22050), 44100, 128);
    expect(blob.type).toBe('audio/mpeg');
    expect(blob.size).toBeGreaterThan(1000);
  });
});
