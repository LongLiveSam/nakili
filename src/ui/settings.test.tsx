import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { SettingsDialog, RECOGNITION_LANGUAGES } from './SettingsDialog';
import { WHISPER_KEYS } from '../core/services/whisperModels';

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
}

describe('settings — local engine', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the local engine off until asked', () => {
    render(<SettingsDialog open onClose={() => {}} />);
    expect(screen.getByRole('switch', { name: /transcribe on this device/i }))
      .toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByLabelText(/^model$/i)).not.toBeInTheDocument();
  });

  it('reveals model, precision and language controls when enabled', async () => {
    render(<SettingsDialog open onClose={() => {}} />);
    await userEvent.click(screen.getByRole('switch', { name: /transcribe on this device/i }));

    expect(screen.getByLabelText(/^model$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/precision/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/spoken language/i)).toBeInTheDocument();
    expect(screen.getByText(/model not downloaded/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download model/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove from cache/i })).toBeInTheDocument();
  });

  it('saves the chosen model and precision', async () => {
    render(<SettingsDialog open onClose={() => {}} />);
    await userEvent.click(screen.getByRole('switch', { name: /transcribe on this device/i }));
    await userEvent.selectOptions(screen.getByLabelText(/^model$/i), 'Xenova/whisper-base');
    await userEvent.selectOptions(screen.getByLabelText(/precision/i), 'off');
    await userEvent.selectOptions(screen.getByLabelText(/spoken language/i), 'de');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(localStorage.getItem(WHISPER_KEYS.model)).toBe('Xenova/whisper-base');
    expect(localStorage.getItem(WHISPER_KEYS.quantized)).toBe('off');
    expect(localStorage.getItem(WHISPER_KEYS.language)).toBe('de');
  });

  it('offers a broad recognition language list', () => {
    const codes = RECOGNITION_LANGUAGES.map((l) => l.code);
    expect(codes).toContain('ja-JP');
    expect(codes).toContain('zh-CN');
    expect(codes).toContain('ar-SA');
    expect(codes).toContain('sw-KE');
    expect(codes).toContain('am-ET');
    expect(codes).toContain('yo-NG');
    expect(new Set(codes).size).toBe(codes.length);
  });
});
