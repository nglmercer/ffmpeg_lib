// HLS Module - Re-export all HLS-related classes and interfaces

// Main HLS classes


export { 
  AudioTrackProcessor,
  createDefaultAudioConfig,
  createMultiLanguageAudioConfig,
  isMultiChannelAudio,
  getChannelLayoutDescription
} from './AudioTrackProcessor.js';

export { 
  SubtitleProcessor,
  createDefaultSubtitleConfig,
  getSubtitleStrategy
} from './SubtitleProcessor.js';

export { 
  HLSSegmentationManager 
} from './HLSSegmentationManager.js';

// Re-export all types from centralized types file
export type * from './types.js';