import { MicIcon, PlayIcon, SearchIcon } from '../../ui/icons';

/**
 * Nothing-style landing: shown on Home until the first recording exists.
 * Three-layer hierarchy — Doto display, Space Grotesk body, mono caps labels.
 * One expressive moment: the oversized dot-matrix wordmark, paired with a
 * plain preview of the real editor.
 */
export function Landing({ onStart, onImport }: { onStart: () => void; onImport?: () => void }) {
  return (
    <div className="landing">
      <section className="hero" aria-label="Introduction">
        <div className="hero-copy">
          <div className="dot-block hero-dots" aria-hidden="true" />
          <h1 className="hero-title">
            Nakili
            <span className="hero-title-category">Local-first dictation</span>
          </h1>
          <p className="tagline">
            Dictate a draft, edit the words in place, and keep the audio on your device.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={onStart}>
              Start dictating
            </button>
            {onImport && (
              <button className="ghost" onClick={onImport}>
                Import an audio file
              </button>
            )}
          </div>
        </div>

        <div className="hero-preview" aria-hidden="true">
          <div className="preview-bar">
            <span className="label">Recording</span>
            <span className="preview-time">0:42</span>
          </div>
          <p className="preview-text">
            Quiet software does not compete for attention.
          </p>
          <div className="preview-clips">
            <span className="preview-clip on"><span>Clip 1</span><span>0:00–0:30</span></span>
            <span className="preview-clip"><span>Clip 2</span><span>0:30–1:00</span></span>
            <span className="preview-clip"><span>Clip 3</span><span>1:00–1:30</span></span>
          </div>
        </div>
      </section>

      <section aria-label="How it works" className="landing-section">
        <p className="label">How it works</p>
        <div className="steps">
          <div>
            <MicIcon size={20} />
            <h2>Live transcript while you speak</h2>
            <p>
              Words appear as you talk. Say “new paragraph” or “period” and
              Nakili writes the structure for you.
            </p>
          </div>
          <div>
            <SearchIcon size={20} />
            <h2>Clip playback beside the text</h2>
            <p>
              Click any sentence to highlight its 30-second clip, listen to the
              exact moment, and fix it in place.
            </p>
          </div>
          <div>
            <PlayIcon size={20} />
            <h2>Text, Markdown, and audio exports</h2>
            <p>
              Download the transcript as text or Markdown, and the audio as MP3,
              WAV, or the original recording.
            </p>
          </div>
        </div>
      </section>

      <section aria-label="Features" className="landing-section">
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

      <section aria-label="Get started" className="landing-section landing-close">
        <p className="status-line">
          [PRIVACY: ALL AUDIO AND TEXT STAY ON YOUR DEVICE. NOTHING IS UPLOADED.]
        </p>
        <button className="primary" onClick={onStart}>Start dictating</button>
      </section>
    </div>
  );
}
