// HLS Module - Centralized Type Exports

// VideoProcessingOrchestrator types
export type {
  ProcessingConfig,
  ProcessingPlan,
  AudioTrackInfo,
  SubtitleInfo,
  ProcessingResult,
  VariantResult,
  AudioTrackResult,
  SubtitleResult,
  ProcessingError,
  ProcessingProgress
} from './VideoProcessingOrchestrator.js';

// AudioTrackProcessor types
export type {
  AudioTrackInfo as AudioTrackProcessorAudioTrackInfo,
  AudioProcessingConfig,
  ProcessedAudioTrack,
  AudioProcessingResult,
  AudioProcessingError,
  AudioQualityPreset
} from './AudioTrackProcessor.js';

// SubtitleProcessor types
export type {
  ExtractedSubtitle,
  ProcessedSubtitle,
  SubtitleProcessorConfig,
  ExtractionOptions
} from './SubtitleProcessor.js';

// HLSSegmentationManager types
export type {
  HLSSegmentationConfig,
  VideoSegmentConfig,
  AudioSegmentConfig,
  SegmentationOptions,
  SegmentationResult,
  SegmentationProgress
} from './HLSSegmentationManager.js';

// HLSPlaylistGenerator types
export type {
  HLSVariant,
  HLSAudioTrack,
  HLSSubtitle,
  HLSSegment,
  HLSGeneratorConfig
} from './HLSPlaylistGenerator.js';