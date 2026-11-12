/**
 * Ordered transcription pipeline.
 *
 * Mirrors Handy's post-ASR chain (`audio_toolkit/text.rs`, `transcription.rs`):
 * every stage is deterministic, independently toggleable, and counted so the UI
 * can report what actually changed. The user-script hook is a separate, async
 * step (`userScript.ts`) exactly as Handy keeps its hook outside the pure text
 * passes.
 *
 * Stage order is fixed and load-bearing:
 *   1. voiceCommands — inserts punctuation/paragraph breaks
 *   2. fillers       — removes "um"/"uh" left by the recogniser
 *   3. vocabulary    — fuzzy-corrects terms toward the user's spelling
 *   4. typography    — curls quotes, dashes, ellipses
 */

import { applyVoiceCommands, removeFillers, smartTypography } from './formatting';
import { applyVocabulary } from './vocabCorrection';

export const PIPELINE_STAGES = ['voiceCommands', 'fillers', 'vocabulary', 'typography'] as const;

export type PipelineStageId = (typeof PIPELINE_STAGES)[number];

export interface PipelineOptions {
  voiceCommands?: boolean;
  fillers?: boolean;
  vocabularyTerms?: string[];
  vocabularyThreshold?: number;
  typography?: boolean;
}

export interface PipelineResult {
  text: string;
  /** Replacements per stage; typography reports 0 or 1 (it is not itemised). */
  applied: Record<PipelineStageId, number>;
}

export function runPipeline(input: string, options: PipelineOptions = {}): PipelineResult {
  const applied: Record<PipelineStageId, number> = {
    voiceCommands: 0,
    fillers: 0,
    vocabulary: 0,
    typography: 0,
  };
  let text = input;

  if (options.voiceCommands) {
    const result = applyVoiceCommands(text);
    text = result.text;
    applied.voiceCommands = result.applied;
  }
  if (options.fillers) {
    const result = removeFillers(text);
    text = result.text;
    applied.fillers = result.removed;
  }
  if (options.vocabularyTerms && options.vocabularyTerms.length > 0) {
    const result = applyVocabulary(text, options.vocabularyTerms, {
      threshold: options.vocabularyThreshold,
    });
    text = result.text;
    applied.vocabulary = result.corrections.length;
  }
  if (options.typography) {
    const before = text;
    text = smartTypography(text);
    applied.typography = text === before ? 0 : 1;
  }

  return { text, applied };
}
