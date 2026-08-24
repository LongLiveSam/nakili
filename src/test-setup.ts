/// <reference types="node" />
import { Blob as NodeBlob } from 'node:buffer';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

globalThis.Blob = NodeBlob as unknown as typeof Blob;

afterEach(() => cleanup());
