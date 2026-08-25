import { MicIcon, PlayIcon, SearchIcon } from '../../ui/icons';

/**
 * Nothing-style landing: shown on Home until the first recording exists.
 * Three-layer hierarchy — Doto display, Space Grotesk body, mono caps labels.
 * One expressive moment: the oversized dot-matrix wordmark.
 */
export function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="landing">
      <section className="hero" aria-label="Introduction">
        <div className="dot-block hero-dots" aria-hidden="true" />
        <h1 className="hero-title">Nakili</h1>
        <p className="tagline">Turn your voice into polished articles.</p>
        <button className="primary" onClick={onStart}>
          Start dictating
        </button>
      </section>

      <section aria-label="How it works" style={{ marginTop: 'var(--space-3xl)' }}>
        <p className="label">How it works</p>
        <div className="steps">
          <div>
            <MicIcon size={20} />
            <h2>Speak naturally</h2>
            <p>
              Words appear as you talk. Say “new paragraph” or “period” and
              Nakili writes the structure for you.
            </p>
          </div>
          <div>
            <SearchIcon size={20} />
            <h2>Edit with confidence</h2>
            <p>
              Click any sentence to highlight its 30-second clip, listen to the
              exact moment, and fix it in place.
            </p>
          </div>
          <div>
            <PlayIcon size={20} />
            <h2>Export and publish</h2>
            <p>
              Download the transcript as text or Markdown, and the audio as MP3,
              WAV, or the original recording.
            </p>
          </div>
        </div>
      </section>

      <section aria-label="Features" style={{ marginTop: 'var(--space-3xl)' }}>
        <p className="label">What you get</p>
        <ul role="list" className="feat-list">
          <li><span>Streaming transcription</span><span>LIVE</span></li>
          <li><span>Clip-accurate playback</span><span>30 SEC</span></li>
          <li><span>Voice commands + auto paragraphs</span><span>BUILT-IN</span></li>
          <li><span>Works offline after first visit</span><span>PWA</span></li>
          <li><span>Local-only storage</span><span>PRIVATE</span></li>
          <li><span>Free forever</span><span>NO ACCOUNT</span></li>
        </ul>
      </section>

      <section aria-label="Privacy" style={{ marginTop: 'var(--space-3xl)' }}>
        <p className="status-line">
          [PRIVACY: ALL AUDIO AND TEXT STAY ON YOUR DEVICE. NOTHING IS UPLOADED.]
        </p>
      </section>
    </div>
  );
}
