# Borrowed from Handy: transcription pipeline

Date: 2026-11-12
Source studied: cjpais/Handy @ `main` (v0.10.0), MIT.

## Why

Nakili's post-ASR text handling was three unrelated helpers called from three
places (`applyVoiceCommands` inside the recording store, `findFillers` in the
editor, `smartTypography` behind a button). The vocabulary list was only handed
to `SpeechGrammarList`, which Chrome ignores, so user terms rarely survived
recognition intact.

Handy runs a single ordered chain over every transcript and lets the user attach
an executable hook. That structure is what this change adopts.

## What was ported

| Handy source | Nakili counterpart | Notes |
|---|---|---|
| `audio_toolkit/text.rs::apply_custom_words` | `src/core/services/vocabCorrection.ts` | Levenshtein + Soundex, 1–3 word n-grams, case and punctuation preserved |
| `settings.rs::word_correction_threshold` (default 0.18) | `DEFAULT_VOCAB_THRESHOLD` | Exposed as Strict / Balanced / Loose |
| `transcription.rs` post-ASR chain | `src/core/services/pipeline.ts` | Voice commands → fillers → vocabulary → typography |
| `transcription_hook.rs` | `src/core/services/userScript.ts` | Worker instead of a process; 30 s timeout, failure keeps the original, one trailing newline stripped |
| `settings.rs` `custom_words` | existing `nakili-vocab` | Same list, now applied post-ASR as well as hinted pre-ASR |

## Deliberate departures

- **Whitespace is preserved.** The Rust version tokenises with
  `split_whitespace` and rejoins with single spaces, which would flatten the
  paragraph breaks Nakili's voice commands insert.
- **Multi-word n-grams must lead into the term.** Without this, "on Kubernetes"
  matches "Kubernetes" at 0.167 and eats the preposition. The rule is
  `term.startsWith(firstWordKey)` for candidates longer than one word.
- **Exact matches are not reported** as corrections, so the pipeline's counts
  reflect real edits.
- **The hook is on demand**, not on every phrase: it runs from the editor
  ("Run script") over the whole transcript. Per-phrase async transforms would
  reorder finals and break the character-offset mapping that ties text to audio.

## Test coverage

- `vocabCorrection.test.ts` — Soundex vectors, near misses, phonetic-only
  matches, punctuation/case/whitespace preservation, over-matching guards.
- `pipeline.test.ts` — stage order, per-stage counts, paragraph survival.
- `pipelineSettings.test.ts` — defaults, opt-outs, invalid thresholds.
- `userScript.test.ts` — success, error, timeout + `terminate`, newline trim,
  empty script passthrough.
- `formatting.test.ts` — `removeFillers` removal, sentence capital, ambiguity.

## Still on the table

Ordered by value per effort, from the same study:

1. Pause-aligned chunking (`audio_toolkit/chunking.rs`) to replace the fixed
   30 s rollover and stop clipping words at boundaries.
2. Real VAD (`audio_toolkit/vad/mod.rs`) in place of the RMS threshold.
3. Model catalog + downloader (`catalog/catalog.json`, `stores/modelStore.ts`).
4. Versioned settings with salvage (`settings.rs` schema version).
5. Retention policy (`history_limit`, `recording_retention_period`).
