import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BOOLEAN_SETTINGS,
  SCHEMA_VERSION_KEY,
  SETTINGS_SCHEMA_VERSION,
  getLastSalvageReport,
  salvageSettings,
  type StorageLike,
} from './settingsMigration';

/** In-memory Storage with optional failure injection. */
function makeStorage(initial: Record<string, string> = {}, opts: { failWrites?: boolean } = {}) {
  const data = new Map(Object.entries(initial));
  const storage: StorageLike = {
    getItem: (key) => (data.has(key) ? data.get(key)! : null),
    setItem: (key, value) => {
      if (opts.failWrites) throw new Error('quota exceeded');
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
  return { storage, data };
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('salvageSettings', () => {
  it('stamps the schema version on a fresh install without inventing values', () => {
    const { storage, data } = makeStorage();
    const report = salvageSettings(storage);
    expect(report.issues).toEqual([]);
    expect(report.version).toBe(SETTINGS_SCHEMA_VERSION);
    expect(data.get(SCHEMA_VERSION_KEY)).toBe(String(SETTINGS_SCHEMA_VERSION));
    expect([...data.keys()]).toEqual([SCHEMA_VERSION_KEY]);
  });

  it.each([
    ['true', 'on'],
    ['TRUE', 'on'],
    ['yes', 'on'],
    ['1', 'on'],
    ['false', 'off'],
    ['FALSE', 'off'],
    ['no', 'off'],
    ['0', 'off'],
    ['on', 'on'],
    ['off', 'off'],
  ])('normalises the boolean spelling %s to %s', (raw, expected) => {
    const { storage, data } = makeStorage({ 'nakili-voice-cmds': raw });
    const report = salvageSettings(storage);
    expect(data.get('nakili-voice-cmds')).toBe(expected);
    if (raw === expected) {
      expect(report.issues).toEqual([]);
    } else {
      expect(report.issues[0]).toMatchObject({ key: 'nakili-voice-cmds', action: 'normalized' });
    }
  });

  it('removes a nonsense boolean so the shipped default applies', () => {
    const { storage, data } = makeStorage({ 'nakili-vad': 'maybe' });
    const report = salvageSettings(storage);
    expect(data.has('nakili-vad')).toBe(false);
    expect(report.issues[0]).toMatchObject({ key: 'nakili-vad', action: 'removed' });
  });

  it('covers every key in the boolean registry', () => {
    const initial = Object.fromEntries(Object.keys(BOOLEAN_SETTINGS).map((key) => [key, 'true']));
    const { storage, data } = makeStorage(initial);
    salvageSettings(storage);
    for (const key of Object.keys(BOOLEAN_SETTINGS)) expect(data.get(key)).toBe('on');
  });

  it('migrates the legacy theme key into nakili-mode once', () => {
    const { storage, data } = makeStorage({ 'nakili-theme': 'light' });
    const report = salvageSettings(storage);
    expect(data.get('nakili-mode')).toBe('light');
    expect(data.has('nakili-theme')).toBe(false);
    expect(report.issues[0]).toMatchObject({ key: 'nakili-theme', action: 'normalized' });
  });

  it('does not overwrite an explicit mode with the legacy theme', () => {
    const { storage, data } = makeStorage({ 'nakili-theme': 'light', 'nakili-mode': 'dark' });
    salvageSettings(storage);
    expect(data.get('nakili-mode')).toBe('dark');
    expect(data.has('nakili-theme')).toBe(false);
  });

  it('drops an unknown skin and an unknown mode', () => {
    const { storage, data } = makeStorage({ 'nakili-skin': 'solarized', 'nakili-mode': 'sepia' });
    const report = salvageSettings(storage);
    expect(data.has('nakili-skin')).toBe(false);
    expect(data.has('nakili-mode')).toBe(false);
    expect(report.issues.map((issue) => issue.key).sort()).toEqual(['nakili-mode', 'nakili-skin']);
  });

  it('keeps valid theme values untouched', () => {
    const { storage, data } = makeStorage({ 'nakili-skin': 'nothing', 'nakili-mode': 'light' });
    const report = salvageSettings(storage);
    expect(data.get('nakili-skin')).toBe('nothing');
    expect(data.get('nakili-mode')).toBe('light');
    expect(report.issues).toEqual([]);
  });

  it('keeps the system color mode', () => {
    const { storage, data } = makeStorage({ 'nakili-mode': 'system' });
    const report = salvageSettings(storage);
    expect(data.get('nakili-mode')).toBe('system');
    expect(report.issues).toEqual([]);
  });

  it('repairs an out-of-range editor font size', () => {
    const { storage, data } = makeStorage({ 'nakili-fontsize': '999' });
    const report = salvageSettings(storage);
    expect(data.has('nakili-fontsize')).toBe(false);
    expect(report.issues[0]).toMatchObject({ key: 'nakili-fontsize', action: 'removed' });
  });

  it('keeps an in-range editor font size', () => {
    const { storage, data } = makeStorage({ 'nakili-fontsize': '20' });
    salvageSettings(storage);
    expect(data.get('nakili-fontsize')).toBe('20');
  });

  it('rejects a vocabulary threshold outside (0, 1]', () => {
    const { storage, data } = makeStorage({ 'nakili-vocab-threshold': '0' });
    const report = salvageSettings(storage);
    expect(data.has('nakili-vocab-threshold')).toBe(false);
    expect(report.issues[0]).toMatchObject({ key: 'nakili-vocab-threshold', action: 'removed' });
  });

  it('keeps a valid vocabulary threshold', () => {
    const { storage, data } = makeStorage({ 'nakili-vocab-threshold': '0.3' });
    salvageSettings(storage);
    expect(data.get('nakili-vocab-threshold')).toBe('0.3');
  });

  it('drops a recognition language that is not a BCP-47 style tag', () => {
    const { storage, data } = makeStorage({ 'nakili-lang': 'klingon' });
    const report = salvageSettings(storage);
    expect(data.has('nakili-lang')).toBe(false);
    expect(report.issues[0]).toMatchObject({ key: 'nakili-lang', action: 'removed' });
  });

  it('keeps a valid recognition language', () => {
    const { storage, data } = makeStorage({ 'nakili-lang': 'pt-BR' });
    salvageSettings(storage);
    expect(data.get('nakili-lang')).toBe('pt-BR');
  });

  it('preserves keys it does not own', () => {
    const { storage, data } = makeStorage({ 'unrelated-app': 'keep me' });
    salvageSettings(storage);
    expect(data.get('unrelated-app')).toBe('keep me');
  });

  it('is idempotent — a second pass reports nothing and changes nothing', () => {
    const { storage, data } = makeStorage({ 'nakili-voice-cmds': 'YES', 'nakili-skin': 'solarized' });
    salvageSettings(storage);
    const snapshot = [...data.entries()].sort();
    const second = salvageSettings(storage);
    expect(second.issues).toEqual([]);
    expect([...data.entries()].sort()).toEqual(snapshot);
  });

  it('never throws when the storage backend rejects writes', () => {
    const { storage } = makeStorage({ 'nakili-voice-cmds': 'maybe' }, { failWrites: true });
    expect(() => salvageSettings(storage)).not.toThrow();
    expect(salvageSettings(storage).version).toBe(SETTINGS_SCHEMA_VERSION);
  });

  it('records the last report for inline display', () => {
    const { storage } = makeStorage({ 'nakili-vad': 'maybe' });
    salvageSettings(storage);
    expect(getLastSalvageReport().issues).toHaveLength(1);
  });
});
