import { useEffect, useRef, useState } from 'react';
import { exportAllBackup } from '../core/services/ExportService';
import { storageUsage } from '../core/db/repositories';
import { db } from '../core/db/db';
import {
  PIPELINE_KEYS, loadTransformScript, readVocabularyThreshold,
} from '../core/services/pipelineSettings';
import { getLastSalvageReport } from '../core/services/settingsMigration';
import {
  RETENTION_KEY, pressureLevel, pressurePercent, readRetentionChoice,
  type RetentionChoice,
} from '../core/services/retention';
import { Toggle } from './Toggle';

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
  { code: 'pt-BR', label: 'Português (BR)' },
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
    if (micId) saveStored('nakili-mic', micId);
    else saveStored('nakili-mic', '');
    setSaved(true);
    setTimeout(() => onClose(), 600);
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

      <h3>Recognition language</h3>
      <label className="visually-hidden" htmlFor="lang">Recognition language</label>
      <select
        id="lang"
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        style={{
          font: 'inherit',
          background: 'var(--surface)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-visible)',
          borderRadius: 8,
          minHeight: 44,
          padding: '0 12px',
          width: '100%',
        }}
      >
        {RECOGNITION_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>

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
        style={{ width: '100%', minHeight: 120 }}
        placeholder={'Kubernetes\nSchwarzschild\nNakili'}
      />

      <h3>Microphone</h3>
      <label className="visually-hidden" htmlFor="mic">Input device</label>
      <select
        id="mic"
        value={micId}
        onChange={(e) => setMicId(e.target.value)}
        style={{
          font: 'inherit',
          background: 'var(--surface)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-visible)',
          borderRadius: 8,
          minHeight: 44,
          padding: '0 12px',
          width: '100%',
        }}
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
        style={{
          font: 'inherit',
          background: 'var(--surface)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-visible)',
          borderRadius: 8,
          minHeight: 44,
          padding: '0 12px',
          width: '100%',
        }}
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
        style={{
          font: 'inherit',
          background: 'var(--surface)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-visible)',
          borderRadius: 8,
          minHeight: 44,
          padding: '0 12px',
          width: '100%',
        }}
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
        style={{ width: '100%', minHeight: 120, fontFamily: 'var(--font-mono)', fontSize: 13 }}
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
        style={{
          font: 'inherit',
          background: 'var(--surface)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-visible)',
          borderRadius: 8,
          minHeight: 44,
          padding: '0 12px',
          width: '100%',
        }}
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

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={onClose}>Cancel</button>
        <button className="primary" onClick={save}>{saved ? '[Saved]' : 'Save'}</button>
      </div>
    </dialog>
  );
}
