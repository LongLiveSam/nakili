import { useRef, useState, type ReactNode } from 'react';
import { importAudioFile } from '../../core/services/importAudio';
import { isWhisperBetaEnabled } from '../../core/services/localWhisper';

interface Props {
  onStatus: (message: string) => void;
  onImported: (articleId: string) => void;
  className?: string;
  children?: ReactNode;
}

/**
 * Import button + hidden file input. Shared by the landing and the library so
 * the import path behaves the same wherever it starts.
 */
export function ImportAudio({ onStatus, onImported, className, children = 'Import audio' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const open = () => {
    if (!isWhisperBetaEnabled()) {
      onStatus('Enable the local engine in Settings to import audio');
      return;
    }
    inputRef.current?.click();
  };

  const handleFile = async (file: File) => {
    setImporting(true);
    onStatus('Decoding audio…');
    try {
      const result = await importAudioFile(file, {
        onStatus,
        onProgress: (fraction) => onStatus(`Transcribing ${Math.round(fraction * 100)}%`),
      });
      onStatus(
        result.failedClips > 0
          ? `Imported with ${result.failedClips} failed clip${result.failedClips === 1 ? '' : 's'}`
          : `Imported ${result.clipCount} clip${result.clipCount === 1 ? '' : 's'}`,
      );
      onImported(result.articleId);
    } catch (err) {
      onStatus(`Error: ${err instanceof Error ? err.message : 'import failed'}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <button className={className} onClick={open} disabled={importing}>
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="visually-hidden"
        tabIndex={-1}
        aria-label="Import an audio file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handleFile(file);
        }}
      />
    </>
  );
}
