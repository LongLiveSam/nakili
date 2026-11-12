/**
 * Settings salvage — the web counterpart of Handy's recover-instead-of-crash
 * settings loader (`settings.rs`: `settings_schema_version` plus a best-effort
 * repair pass over malformed fields).
 *
 * Nakili keeps its preferences as flat `nakili-*` localStorage strings, and
 * several readers disagree about what "on" means (`!== 'off'` in one place,
 * `=== 'on'` in another). One stray write from an older build could silently
 * flip a feature or hide it forever. This module normalises the known keys in
 * place, drops values that cannot be interpreted, and stamps a schema version
 * so later migrations have something to branch on.
 *
 * Rules:
 * - Never invent a value. An unreadable key is removed so the shipped default
 *   applies.
 * - Never touch keys we do not own.
 * - Never throw: a full or blocked localStorage must not stop the app booting.
 */

export const SETTINGS_SCHEMA_VERSION = 1;
export const SCHEMA_VERSION_KEY = 'nakili-settings-version';

/** Every on/off preference and the default used when the key is absent. */
export const BOOLEAN_SETTINGS = {
  'nakili-voice-cmds': true,
  'nakili-interim': true,
  'nakili-autopara': true,
  'nakili-autonext': false,
  'nakili-skipsilence': false,
  'nakili-vad': false,
  'nakili-whisper-beta': false,
  'nakili-vocab-correct': true,
  'nakili-remove-fillers': false,
  'nakili-typography-auto': false,
} as const;

const TRUTHY = new Set(['on', 'true', 'yes', '1']);
const FALSY = new Set(['off', 'false', 'no', '0']);
const SKINS = new Set(['paper', 'primer', 'neutral', 'nothing']);
const MODES = new Set(['system', 'light', 'dark']);
const LANG_TAG = /^[a-z]{2,3}(-[A-Z]{2})?$/;
const FONT_MIN = 14;
const FONT_MAX = 24;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type SalvageAction = 'normalized' | 'removed';

export interface SettingsIssue {
  key: string;
  action: SalvageAction;
  detail: string;
}

export interface SalvageReport {
  version: number;
  issues: SettingsIssue[];
}

let lastReport: SalvageReport = { version: SETTINGS_SCHEMA_VERSION, issues: [] };

/** The most recent repair pass, for inline `[STATUS]` display. */
export function getLastSalvageReport(): SalvageReport {
  return lastReport;
}

export function salvageSettings(storage: StorageLike = localStorage): SalvageReport {
  const issues: SettingsIssue[] = [];

  const read = (key: string): string | null => {
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  };
  const write = (key: string, value: string): void => {
    try {
      storage.setItem(key, value);
    } catch {
      /* storage unavailable — leave the value alone */
    }
  };
  const drop = (key: string): void => {
    try {
      storage.removeItem(key);
    } catch {
      /* ignore */
    }
  };

  // 1. Boolean spellings drift between `on`/`off` and `true`/`1`/`yes`.
  for (const key of Object.keys(BOOLEAN_SETTINGS)) {
    const raw = read(key);
    if (raw === null) continue;
    const value = raw.trim().toLowerCase();
    if (TRUTHY.has(value)) {
      if (raw !== 'on') {
        write(key, 'on');
        issues.push({ key, action: 'normalized', detail: `"${raw}" → "on"` });
      }
      continue;
    }
    if (FALSY.has(value)) {
      if (raw !== 'off') {
        write(key, 'off');
        issues.push({ key, action: 'normalized', detail: `"${raw}" → "off"` });
      }
      continue;
    }
    drop(key);
    issues.push({ key, action: 'removed', detail: `unreadable boolean "${raw}"` });
  }

  // 2. The pre-skin theme key became nakili-mode.
  const legacyTheme = read('nakili-theme');
  if (legacyTheme !== null) {
    if (read('nakili-mode') === null && MODES.has(legacyTheme)) {
      write('nakili-mode', legacyTheme);
      issues.push({ key: 'nakili-theme', action: 'normalized', detail: 'migrated to nakili-mode' });
    } else {
      issues.push({ key: 'nakili-theme', action: 'removed', detail: 'superseded by nakili-mode' });
    }
    drop('nakili-theme');
  }

  // 3. Enumerated values.
  const skin = read('nakili-skin');
  if (skin !== null && !SKINS.has(skin)) {
    drop('nakili-skin');
    issues.push({ key: 'nakili-skin', action: 'removed', detail: `unknown skin "${skin}"` });
  }
  const mode = read('nakili-mode');
  if (mode !== null && !MODES.has(mode)) {
    drop('nakili-mode');
    issues.push({ key: 'nakili-mode', action: 'removed', detail: `unknown mode "${mode}"` });
  }

  // 4. Numeric ranges.
  const fontSize = read('nakili-fontsize');
  if (fontSize !== null) {
    const size = Number(fontSize);
    const valid = Number.isInteger(size) && size >= FONT_MIN && size <= FONT_MAX;
    if (!valid) {
      drop('nakili-fontsize');
      issues.push({ key: 'nakili-fontsize', action: 'removed', detail: `out of range "${fontSize}"` });
    } else if (fontSize !== String(size)) {
      write('nakili-fontsize', String(size));
      issues.push({ key: 'nakili-fontsize', action: 'normalized', detail: `"${fontSize}" → "${size}"` });
    }
  }

  const threshold = read('nakili-vocab-threshold');
  if (threshold !== null) {
    const value = Number(threshold);
    if (!Number.isFinite(value) || value <= 0 || value > 1) {
      drop('nakili-vocab-threshold');
      issues.push({ key: 'nakili-vocab-threshold', action: 'removed', detail: `out of range "${threshold}"` });
    }
  }

  // 5. Recognition language must stay a BCP-47 style tag; SpeechService feeds
  //    it straight into the recogniser.
  const lang = read('nakili-lang');
  if (lang !== null && !LANG_TAG.test(lang)) {
    drop('nakili-lang');
    issues.push({ key: 'nakili-lang', action: 'removed', detail: `not a language tag "${lang}"` });
  }

  // 6. Stamp the version last, so a partial pass can be retried next boot.
  if (read(SCHEMA_VERSION_KEY) !== String(SETTINGS_SCHEMA_VERSION)) {
    write(SCHEMA_VERSION_KEY, String(SETTINGS_SCHEMA_VERSION));
  }

  lastReport = { version: SETTINGS_SCHEMA_VERSION, issues };
  return lastReport;
}
