---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/features/editor/EditorView.tsx","src/features/library/LibraryView.tsx","src/styles/global.css"]
---

## Direction contract

THESIS: Nakili is a broadcast desk for the voice: the transcript is the program, the clips are the cue sheet, and the tally light is the only saturated red on the page. It refuses the generic dark audio app (neon glow, waveform wallpaper) and the Nothing dot-matrix.

OWN-WORLD: Warm near-black (#12100e) and cool studio wall (#eef0ec), brand teal (#2aa2a4, lifting to #4cc4c6 in dark mode), amber (#d9a441), graphite rules. Source Serif 4 for the transcript and long-form copy; Archivo Narrow for UI labels, navigation and the wordmark; IBM Plex Mono for timecode and status. Flat surfaces, hairline rules, 2px corners, no gradients or shadows. Signature move: the cue sheet, with a teal tally state on the active clip.

STORY: The writer sees the transcript as the program, the clips as a cue sheet, and the recording state as a tally light. They understand that the audio is the source and the text is the work.

FIRST VIEWPORT: A top bar with the NAKILI wordmark and Recordings / Settings / Help. The editor header carries the title, word count, read time and WPM, with Download and Rename (both with icons) on the right. The main split is a serif transcript on the left and a cue sheet on the right: clip number, timecode, play, and a waveform-like seek strip. The active clip is a red-tinted card. A mono status line sits at the bottom.

FORM: Broadcast desk, position 3 of the grounded list. seed: none (unavailable).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Constraints

- Light, dark and system color modes; system follows the device and updates live.
- Download and Rename carry icons.
- Standard web controls; no custom navigation model.
- No gradients, no shadows, no toast popups; inline `[STATUS]` text.
- The transcript is the reading surface; the cue sheet is the audio surface.
