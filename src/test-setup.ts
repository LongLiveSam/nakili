/// <reference types="node" />
import { Blob as NodeBlob } from 'node:buffer';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

globalThis.Blob = NodeBlob as unknown as typeof Blob;

(window as { SpeechRecognition?: unknown }).SpeechRecognition =
  (window as { SpeechRecognition?: unknown }).SpeechRecognition ??
  class {};

(globalThis as { jest?: unknown }).jest ??= {
  advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms),
};

afterEach(() => cleanup());
