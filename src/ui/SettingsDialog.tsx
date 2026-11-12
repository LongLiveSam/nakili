import { useEffect, useRef, useState } from 'react';
import { exportAllBackup } from '../core/services/ExportService';
import { storageUsage } from '../core/db/repositories';
import { db } from '../core/db/db';
import {
  PIPELINE_KEYS, loadTransformScript, readVocabularyThreshold, storageFlag,
} from '../core/services/pipelineSettings';
import { getLastSalvageReport } from '../core/services/settingsMigration';
import {
  RETENTION_KEY, pressureLevel, pressurePercent, readRetentionChoice,
  type RetentionChoice,
} from '../core/services/retention';
import { preloadWhisperModel } from '../core/services/localWhisper';
import {
  WHISPER_KEYS, WHISPER_MODELS, cachedModelBytes, clearModelCache,
  formatModelBytes, readWhisperSettings, whisperModelInfo, writeWhisperSettings,
  type WhisperModelId,
} from '../core/services/whisperModels';
import { Toggle } from './Toggle';
import { MODES, MODE_LABELS, useThemeStore, type Mode } from './theme';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const RECOGNITION_LANGUAGES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'es-ES', label: 'Español' },
  { code: 'fr-FR', label: 'Français' },
  { code: 'de-DE', label: 'Deutsch' },
  { code: 'it-IT', label: 'Italiano' },
  { code: 'pt-BR', label: 'Português (BR)' },
  { code: 'nl-NL', label: 'Nederlands' },
  { code: 'pl-PL', label: 'Polski' },
  { code: 'sv-SE', label: 'Svenska' },
  { code: 'da-DK', label: 'Dansk' },
  { code: 'nb-NO', label: 'Norsk' },
  { code: 'fi-FI', label: 'Suomi' },
  { code: 'cs-CZ', label: 'Čeština' },
  { code: 'el-GR', label: 'Ελληνικά' },
  { code: 'ru-RU', label: 'Русский' },
  { code: 'uk-UA', label: 'Українська' },
  { code: 'tr-TR', label: 'Türkçe' },
  { code: 'he-IL', label: 'עברית' },
  { code: 'ar-SA', label: 'العربية' },
  { code: 'hi-IN', label: 'हिन्दी' },
  { code: 'id-ID', label: 'Bahasa Indonesia' },
  { code: 'vi-VN', label: 'Tiếng Việt' },
  { code: 'th-TH', label: 'ไทย' },
  { code: 'ja-JP', label: '日本語' },
  { code: 'ko-KR', label: '한국어' },
  { code: 'zh-CN', label: '中文 (简体)' },
  { code: 'zh-TW', label: '中文 (繁體)' },
  { code: 'sw-KE', label: 'Kiswahili' },
  { code: 'am-ET', label: 'አማርኛ' },
  { code: 'ha-NG', label: 'Hausa' },
  { code: 'yo-NG', label: 'Yorùbá' },
  { code: 'ig-NG', label: 'Igbo' },
  { code: 'zu-ZA', label: 'isiZulu' },
  { code: 'xh-ZA', label: 'isiXhosa' },
  { code: 'af-ZA', label: 'Afrikaans' },
  { code: 'so-SO', label: 'Soomaali' },
  { code: 'ln-CD', label: 'Lingála' },
  { code: 'mg-MG', label: 'Malagasy' },
  { code: 'sn-ZW', label: 'chiShona' },
];

/** Languages Whisper can transcribe; 'auto' lets the model detect it. */
export const WHISPER_LANGUAGES = [
  { code: 'auto', label: 'Detect automatically' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'ru', label: 'Russian' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'tr', label: 'Turkish' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'id', label: 'Indonesian' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'th', label: 'Thai' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'am', label: 'Amharic' },
  { code: 'ha', label: 'Hausa' },
  { code: 'so', label: 'Somali' },
  { code: 'yo', label: 'Yoruba' },
  { code: 'ln', label: 'Lingala' },
  { code: 'mg', label: 'Malagasy' },
  { code: 'sn', label: 'Shona' },
  { code: 'af', label: 'Afrikaans' },
];

function loadStored(key: string, fallback = ''): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

export function SettingsDialog({ open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState(loadStored('nakili-vocab'));
  const [lang, setLang] = useState(loadStored('nakili-lang', 'en-US'));
  const [micId, setMicId] = useState(loadStored('nakili-mic'));
  const [fontSize, setFontSize] = useState(loadStored('nakili-fontsize', '18'));
  const [threshold, setThreshold] = useState(String(readVocabularyThreshold()));
  const [script, setScript] = useState(loadTransformScript());
  const [retention, setRetention] = useState<RetentionChoice>(readRetentionChoice());
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [clearArmed, setClearArmed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [whisperOn, setWhisperOn] = useState(() => storageFlag(WHISPER_KEYS.enabled, false));
  const [whisperModel, setWhisperModel] = useState<WhisperModelId>(() => readWhisperSettings().model);
  const [whisperQuantized, setWhisperQuantized] = useState(() => readWhisperSettings().quantized);
  const [whisperLang, setWhisperLang] = useState(() => readWhisperSettings().language);
  const [modelBytes, setModelBytes] = useState<number | null>(null);
  const [modelStatus, setModelStatus] = useState<string | null>(null);
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setText(loadStored('nakili-vocab'));
      setLang(loadStored('nakili-lang', 'en-US'));
      setMicId(loadStored('nakili-mic'));
      setFontSize(loadStored('nakili-fontsize', '18'));
      setThreshold(String(readVocabularyThreshold()));
      setScript(loadTransformScript());
      setRetention(readRetentionChoice());
      setSaved(false);
      setBackupStatus(null);
      setClearArmed(false);
      setWhisperOn(storageFlag(WHISPER_KEYS.enabled, false));
      const whisper = readWhisperSettings();
      setWhisperModel(whisper.model);
      setWhisperQuantized(whisper.quantized);
      setWhisperLang(whisper.language);
      setModelStatus(null);
      setModelProgress(null);
      setModelBytes(null);
      void cachedModelBytes(whisper.model).then(setModelBytes);
      void storageUsage().then(setUsage);
      void navigator.mediaDevices
        ?.enumerateDevices()
        .then((devs) => setMics(devs.filter((d) => d.kind === 'audioinput')))
        .catch(() => {});
      el.showModal();
    }
    if (!open && el.open) el.close();
  }, [open]);

  const save = () => {
    saveStored('nakili-vocab', text);
    saveStored('nakili-lang', lang);
    saveStored(PIPELINE_KEYS.script, script);
    writeWhisperSettings({ model: whisperModel, quantized: whisperQuantized, language: whisperLang });
    if (micId) saveStored('nakili-mic', micId);
    else saveStored('nakili-mic', '');
    setSaved(true);
    setTimeout(() => onClose(), 600);
  };

  const refreshModelBytes = async (model: WhisperModelId) => {
    setModelBytes(await cachedModelBytes(model));
  };

  const downloadModel = async () => {
    writeWhisperSettings({ model: whisperModel, quantized: whisperQuantized, language: whisperLang });
    setModelStatus('[DOWNLOADING MODEL…]');
    setModelProgress(0);
    try {
      await preloadWhisperModel((fraction) => {
        setModelProgress(fraction);
        setModelStatus(`[DOWNLOADING MODEL ${Math.round(fraction * 100)}%]`);
      });
      setModelStatus('[MODEL READY]');
      await refreshModelBytes(whisperModel);
    } catch (err) {
      setModelStatus(`[ERROR: ${err instanceof Error ? err.message : 'DOWNLOAD FAILED'}]`);
    } finally {
      setModelProgress(null);
    }
  };

  const removeModel = async () => {
    const removed = await clearModelCache(whisperModel);
    setModelStatus(removed > 0 ? '[MODEL REMOVED FROM CACHE]' : '[MODEL WAS NOT CACHED]');
    await refreshModelBytes(whisperModel);
  };

  const clearAll = async () => {
    await db.delete();
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('nakili-'))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
    location.reload();
  };

  const runBackup = async () => {
    try {
      await exportAllBackup();
      setBackupStatus('[BACKUP DOWNLOADED]');
    } catch {
      setBackupStatus('[ERROR: BACKUP FAILED]');
    }
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label="Settings"
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      <button className="ghost dialog-close" aria-label="Close" onClick={onClose}>[ X ]</button>
      <h2 style={{ marginTop: 0 }}>Settings</h2>

      <h3>Appearance</h3>
      <label className="label" htmlFor="color-mode">Color mode</label>
      <select
        id="color-mode"
        value={mode}
        onChange={(e) => setMode(e.target.value as Mode)}
        className="field"
      >
        {MODES.map((m) => (
          <option key={m} value={m}>{MODE_LABELS[m]}</option>
        ))}
      </select>
      <p style={{ color: 'var(--text-disabled)', fontSize: 12 }}>
        System follows your device’s light or dark setting and updates when it changes.
      </p>

      <h3>Recognition language</h3>
      <label className="visually-hidden" htmlFor="lang">Recognition language</label>
      <select
        id="lang"
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        className="field"
      >
        {RECOGNITION_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
      <p style={{ color: 'var(--text-disabled)', fontSize: 12 }}>
        Browser recognition depends on Chrome or Edge. The local engine below
        covers more languages, including Kiswahili, Amharic, Hausa, Somali,
        Yoruba, Lingala, Malagasy, Shona and Afrikaans.
      </p>

      <h3>Local engine (beta)</h3>
      <Toggle
        label="Transcribe on this device with Whisper"
        storageKey={WHISPER_KEYS.enabled}
        defaultOn={false}
        onChange={setWhisperOn}
      />
      {whisperOn && (
        <>
          <p>
            Used for clip re-transcription and audio import. The model downloads
            once, then runs offline. Nothing is uploaded.
          </p>
          <label className="label" htmlFor="whisper-model">Model</label>
          <select
            id="whisper-model"
            value={whisperModel}
            onChange={(e) => {
              const model = e.target.value as WhisperModelId;
              setWhisperModel(model);
              setModelStatus(null);
              setModelBytes(null);
              void refreshModelBytes(model);
            }}
            className="field"
          >
            {WHISPER_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} · {m.params} params · ≈{m.downloadMB} MB
              </option>
            ))}
          </select>

          <label className="label" htmlFor="whisper-precision">Precision</label>
          <select
            id="whisper-precision"
            value={whisperQuantized ? 'on' : 'off'}
            onChange={(e) => {
              setWhisperQuantized(e.target.value === 'on');
              setModelStatus(null);
            }}
            className="field"
          >
            <option value="on">8-bit quantized — smaller, faster</option>
            <option value="off">Full precision — larger, slightly more accurate</option>
          </select>

          <label className="label" htmlFor="whisper-lang">Spoken language</label>
          <select
            id="whisper-lang"
            value={whisperLang}
            onChange={(e) => setWhisperLang(e.target.value)}
            className="field"
          >
            {WHISPER_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>

          <p className="status-line" role="status">
            {modelStatus ??
              (modelBytes && modelBytes > 0
                ? `[MODEL CACHED · ${formatModelBytes(modelBytes)}]`
                : `[MODEL NOT DOWNLOADED · ≈${whisperModelInfo(whisperModel).downloadMB} MB ON FIRST USE]`)}
          </p>
          <div className="dialog-actions" style={{ justifyContent: 'flex-start' }}>
            <button onClick={() => void downloadModel()} disabled={modelProgress !== null}>
              Download model
            </button>
            <button
              className="ghost"
              onClick={() => void removeModel()}
              disabled={modelProgress !== null}
            >
              Remove from cache
            </button>
          </div>
        </>
      )}

      <h3>Vocabulary</h3>
      <p>
        One term per line — names, jargon, product words the recognizer should watch for.
        Chrome passes these to the speech engine as a hint; support is best-effort.
      </p>
      <label className="visually-hidden" htmlFor="vocab">Custom terms</label>
      <textarea
        id="vocab"
        value={text}
        onChange={(e) => { setText(e.target.value); setSaved(false); }}
        rows={6}
        className="field-area"
        placeholder={'Kubernetes\nSchwarzschild\nNakili'}
      />

      <h3>Microphone</h3>
      <label className="visually-hidden" htmlFor="mic">Input device</label>
      <select
        id="mic"
        value={micId}
        onChange={(e) => setMicId(e.target.value)}
        className="field"
      >
        <option value="">System default</option>
        {mics.map((m, i) => (
          <option key={m.deviceId || i} value={m.deviceId}>
            {m.label || `Microphone ${i + 1}`}
          </option>
        ))}
      </select>
      <p style={{ color: 'var(--text-disabled)', fontSize: 12 }}>
        Applies to the next recording.
      </p>

      <h3>Dictation</h3>
      <Toggle label="Voice commands" storageKey="nakili-voice-cmds" defaultOn />
      <Toggle
        label="Show live interim text"
        storageKey="nakili-interim"
        defaultOn
      />
      <Toggle label="Auto-paragraph on silence" storageKey="nakili-autopara" defaultOn />
      <Toggle
        label="Auto-correct to vocabulary"
        storageKey={PIPELINE_KEYS.vocabulary}
        defaultOn
      />
      <Toggle
        label="Remove filler words (um, uh)"
        storageKey={PIPELINE_KEYS.fillers}
        defaultOn={false}
      />
      <Toggle
        label="Smart typography while dictating"
        storageKey={PIPELINE_KEYS.typography}
        defaultOn={false}
      />
      <label className="label" htmlFor="vocab-threshold">Vocabulary strictness</label>
      <select
        id="vocab-threshold"
        value={threshold}
        onChange={(e) => {
          setThreshold(e.target.value);
          saveStored(PIPELINE_KEYS.threshold, e.target.value);
        }}
        className="field"
      >
        <option value="0.12">Strict — only close spellings</option>
        <option value="0.18">Balanced — recommended</option>
        <option value="0.3">Loose — catch heavier mishearings</option>
      </select>

      <h3>Playback</h3>
      <Toggle label="Auto-play next clip" storageKey="nakili-autonext" defaultOn={false} />
      <Toggle label="Skip silence during playback" storageKey="nakili-skipsilence" defaultOn={false} />

      <h3>Hands-free</h3>
      <Toggle label="Voice-activated pause (auto-pause after 3s silence, resume on voice)" storageKey="nakili-vad" defaultOn={false} />

      <h3>Editor</h3>
      <label className="label" htmlFor="fontsize">Font size</label>
      <select
        id="fontsize"
        value={fontSize}
        onChange={(e) => {
          setFontSize(e.target.value);
          saveStored('nakili-fontsize', e.target.value);
        }}
        className="field"
      >
        <option value="16">Small</option>
        <option value="18">Medium</option>
        <option value="20">Large</option>
      </select>

      <label className="label" htmlFor="transform-script">Transform script (JavaScript)</label>
      <p style={{ color: 'var(--text-disabled)', fontSize: 12 }}>
        Receives the transcript as <code>text</code>; return the text to keep.
        Runs in a throwaway worker with a 30 s limit — on error or timeout the
        original text survives. Applies only when you press “Run script” in the editor.
      </p>
      <textarea
        id="transform-script"
        value={script}
        onChange={(e) => { setScript(e.target.value); setSaved(false); }}
        rows={6}
        spellCheck={false}
        className="field-area field-area-mono"
        placeholder={'// one sentence per line\nreturn text.split(/(?<=[.!?])\\s+/).join("\\n");'}
      />

      <h3>Data safety</h3>
      <p>
        Recordings live only in this browser and can be evicted under storage pressure.
        Download a full backup (JSON + audio) regularly.
      </p>
      {getLastSalvageReport().issues.length > 0 && (
        <p role="status" className="status-line">
          [SETTINGS REPAIRED: {getLastSalvageReport().issues.length}]
        </p>
      )}
      <label className="label" htmlFor="audio-retention">Keep audio for</label>
      <select
        id="audio-retention"
        value={retention}
        onChange={(e) => {
          const choice = e.target.value as RetentionChoice;
          setRetention(choice);
          saveStored(RETENTION_KEY, choice);
        }}
        className="field"
      >
        <option value="forever">Forever</option>
        <option value="365">1 year</option>
        <option value="90">90 days</option>
        <option value="30">30 days</option>
      </select>
      <p style={{ color: 'var(--text-disabled)', fontSize: 12 }}>
        Transcripts are never deleted. Expired clips are removed at startup, and
        affected text is marked approximate.
      </p>
      <button onClick={() => void runBackup()}>Export all data</button>
      {backupStatus && (
        <span className={backupStatus.startsWith('[ERROR') ? 'status-line error' : 'status-line'}
          style={{ marginLeft: 12 }}>
          {backupStatus}
        </span>
      )}
      {usage && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
          Storage used: {(usage.usage / (1024 * 1024)).toFixed(1)} MB
          {usage.quota > 0 && ` of ~${(usage.quota / (1024 * 1024 * 1024)).toFixed(1)} GB`}
        </p>
      )}
      {usage && pressureLevel(usage.usage, usage.quota) !== 'ok' && (
        <p role="status" className="status-line error">
          [STORAGE {pressurePercent(usage.usage, usage.quota)}% FULL — EXPORT A BACKUP OR SHORTEN AUDIO RETENTION]
        </p>
      )}
      <div style={{ marginTop: 12 }}>
        <button
          className={clearArmed ? 'danger' : 'ghost'}
          onClick={() => {
            if (clearArmed) void clearAll();
            else setClearArmed(true);
          }}
          onBlur={() => setClearArmed(false)}
        >
          {clearArmed ? 'Confirm: erase everything' : 'Clear all data'}
        </button>
        {clearArmed && (
          <span className="status-line error" style={{ marginLeft: 12 }}>
            This permanently deletes every recording.
          </span>
        )}
      </div>

      <div className="dialog-actions sticky">
        <button onClick={onClose}>Cancel</button>
        <button className="primary" onClick={save}>{saved ? '[Saved]' : 'Save'}</button>
      </div>
    </dialog>
  );
}
