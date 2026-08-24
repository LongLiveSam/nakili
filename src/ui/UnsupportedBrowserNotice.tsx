export function UnsupportedBrowserNotice() {
  return (
    <main style={{ maxWidth: 480, margin: '80px auto', padding: 24 }}>
      <h1>Dictation requires Chrome or Edge</h1>
      <p>
        This app uses the Web Speech API for live transcription, which is currently
        supported in Google Chrome and Microsoft Edge. Please open this page in one
        of those browsers.
      </p>
    </main>
  );
}
