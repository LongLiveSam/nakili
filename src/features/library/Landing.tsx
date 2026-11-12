import { MicIcon, PlayIcon, SearchIcon } from '../../ui/icons';
import { ImportAudio } from './ImportAudio';

/**
 * Broadcast Desk welcome page. Home is always this surface; the recordings
 * list lives behind the Recordings tab.
 */
export function Landing({
  onStart,
  onViewRecordings,
  onImported,
  onStatus,
  status,
}: {
  onStart: () => void;
  onViewRecordings: () => void;
  onImported: (articleId: string) => void;
  onStatus: (message: string) => void;
  status: string | null;
}) {
  return (
    <div className="landing">
      <div className="wrap">
      <section className="hero" aria-label="Introduction" data-enter>
        <div className="hero-copy">
          <h1 className="hero-title">
            Nakili
            <span className="hero-title-category">Local-first dictation</span>
          </h1>
          <p className="tagline">
            Dictate a draft, edit the words in place, and keep the audio on your device.
          </p>
          <div className="hero-actions">
            <button className="cta" onClick={onStart}>
              Start dictating
            </button>
            <ImportAudio onStatus={onStatus} onImported={onImported} className="ghost">
              Import an audio file
            </ImportAudio>
            <button className="ghost" onClick={onViewRecordings}>
              View recordings
            </button>
          </div>
          {status && (
            <p
              className={status.startsWith('Error') ? 'status-line error' : 'status-line'}
              role={status.startsWith('Error') ? 'alert' : 'status'}
            >
              {status}
            </p>
          )}
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
            <h2>Transcript</h2>
            <p>
              Words appear as you talk. Say “new paragraph” and Nakili
              writes the structure.
            </p>
          </div>
          <div>
            <SearchIcon size={20} />
            <h2>Cue sheet</h2>
            <p>
              Click a sentence to hear its clip, then fix the words in place.
            </p>
          </div>
          <div>
            <PlayIcon size={20} />
            <h2>Exports</h2>
            <p>
              Download text, Markdown, MP3, WAV, or the original audio.
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
          Privacy: all audio and text stay on your device. Nothing is uploaded.
        </p>
        <div className="hero-actions">
          <button className="cta" onClick={onStart}>Start dictating</button>
          <button className="ghost" onClick={onViewRecordings}>View recordings</button>
        </div>
      </section>
      </div>
    </div>
  );
}
