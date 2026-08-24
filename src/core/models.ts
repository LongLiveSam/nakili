export interface Article {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  durationSec: number;
  transcriptText: string;
}

export interface AudioChunk {
  id: string;
  articleId: string;
  index: number;
  startTimeSec: number;
  endTimeSec: number;
  blobKey: string;
  durationSec: number;
}

export interface TranscriptSegment {
  id: string;
  articleId: string;
  startTimeSec: number;
  endTimeSec: number;
  startCharOffset: number;
  endCharOffset: number; // inclusive index of last character
  text: string;
  audioChunkIndex: number;
  approximate: boolean;
}
