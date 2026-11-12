import { formatDuration } from './libraryStore';
import { ImportAudio } from './ImportAudio';
import type { Article } from '../../core/models';

function formatDate(ms: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(ms);
}

/**
 * Broadcast Desk welcome page. Home is always this surface; the recordings
 * list lives behind the Recordings tab.
 */
export function Landing({
  recent,
  onStart,
  onOpen,
  onViewRecordings,
  onImported,
  onStatus,
  status,
}: {
  recent: Article[];
  onStart: () => void;
  onOpen: (articleId: string) => void;
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
            <h1 className="hero-title">A dictation desk for long-form writing.</h1>
            <p className="hero-lede">
              Speak a draft into being, then shape it with your hands. Built for
              African languages.
            </p>
            <div className="hero-actions">
              <button className="cta" onClick={onStart}>
                Start a recording
              </button>
              <ImportAudio onStatus={onStatus} onImported={onImported} className="ghost">
                Import an audio file
              </ImportAudio>
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

          <aside className="hero-note" aria-label="A note">
            <p className="label">A note</p>
            <p>
              Nakili is Swahili for transcribe: a quiet place to speak a draft
              into being, then shape it with your hands. Your voice stays in
              this browser.
            </p>
          </aside>
        </section>

        {recent.length > 0 && (
          <section className="recent" aria-label="Recent recordings">
            <div className="section-head">
              <div>
                <h2>Recent recordings</h2>
                <p className="section-lede">Pick up where you left off.</p>
              </div>
              <button className="ghost" onClick={onViewRecordings}>View all</button>
            </div>
            <ul className="recent-list">
              {recent.map((a) => (
                <li key={a.id}>
                  <button className="recent-item" onClick={() => onOpen(a.id)}>
                    <span className="recent-title">{a.title}</span>
                    <span className="recent-meta">
                      {formatDate(a.updatedAt)} · {formatDuration(a.durationSec)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="how" aria-label="How it works">
          <div className="section-head">
            <div>
              <h2>How it works</h2>
              <p className="section-lede">From voice to a page you can edit.</p>
            </div>
          </div>
          <ol className="steps">
            <li>
              <span className="step-number">01</span>
              <h3>Speak</h3>
              <p>
                Words appear as you talk. Say “new paragraph” and Nakili writes
                the structure.
              </p>
            </li>
            <li>
              <span className="step-number">02</span>
              <h3>Listen</h3>
              <p>
                Click a sentence to hear its clip, then fix the words in place.
              </p>
            </li>
            <li>
              <span className="step-number">03</span>
              <h3>Publish</h3>
              <p>
                Download text, Markdown, MP3, WAV, or the original audio.
              </p>
            </li>
          </ol>
        </section>

        <section className="built-for" aria-label="Languages">
          <div className="section-head">
            <div>
              <h2>Languages</h2>
              <p className="section-lede">African languages, starting with Kiswahili.</p>
            </div>
          </div>
          <div className="built-for-body">
            <p className="language-list">
              Kiswahili · Amharic · Hausa · Somali · Yoruba · Lingala ·
              Malagasy · Shona · Afrikaans
            </p>
            <p className="language-note">
              The local engine works offline. More languages are coming.
            </p>
          </div>
        </section>

        <section className="what" aria-label="What you get">
          <div className="section-head">
            <div>
              <h2>What you get</h2>
              <p className="section-lede">A quiet tool that keeps the audio.</p>
            </div>
          </div>
          <ul className="feature-grid">
            <li>
              <h3>Streaming transcription</h3>
              <p>Words appear as you speak.</p>
            </li>
            <li>
              <h3>Clip-accurate playback</h3>
              <p>Every phrase maps to its 30-second clip.</p>
            </li>
            <li>
              <h3>Voice commands</h3>
              <p>Paragraphs and punctuation by voice.</p>
            </li>
            <li>
              <h3>Works offline</h3>
              <p>Install it once; the shell stays available.</p>
            </li>
            <li>
              <h3>Local-only storage</h3>
              <p>Recordings live in this browser.</p>
            </li>
            <li>
              <h3>Free forever</h3>
              <p>No account, no subscription.</p>
            </li>
          </ul>
        </section>

        <section className="closing" aria-label="Privacy">
          <p>
            Your voice stays on your device. Nakili is Swahili for transcribe.
          </p>
        </section>
      </div>
    </div>
  );
}
