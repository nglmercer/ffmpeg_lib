import { FFmpegManager } from './FFmpegManager.js';
import { FFmpegCommand, FFmpegOptions, VideoOptions, AudioOptions, ProgressInfo, ScreenshotOptions, ProbeData } from './FFmpegCommand.js';
import { TestMediaGenerator, MediaFile, VideoOptions as TestVideoOptions, AudioOptions as TestAudioOptions, ImageOptions } from './TestMediaGenerator.js';
import { MediaMetadataExtractor, MediaMetadata, MediaType, StreamInfo, FormatInfo, MetadataOptions } from './MediaMetadataExtractor.js';
import { ResolutionUtils,type AspectRatio,type Resolution } from './utils/ResolutionUtils.js';
// Import HLS module
import { 
  VideoProcessingOrchestrator,
  AudioTrackProcessor,
  SubtitleProcessor,
  HLSSegmentationManager,
  createDefaultAudioConfig,
  createMultiLanguageAudioConfig,
  isMultiChannelAudio,
  getChannelLayoutDescription,
  createDefaultSubtitleConfig,
  getSubtitleStrategy
} from './hls/index.js';

// Import HLS types
import type * as HLSTypes from './hls/types.js';

// Export main classes
export { 
  FFmpegManager,
  FFmpegCommand,
  TestMediaGenerator,
  MediaMetadataExtractor,
  
  // HLS classes
  VideoProcessingOrchestrator,
  AudioTrackProcessor,
  SubtitleProcessor,
  HLSSegmentationManager,
  
  // HLS utility functions
  createDefaultAudioConfig,
  createMultiLanguageAudioConfig,
  isMultiChannelAudio,
  getChannelLayoutDescription,
  createDefaultSubtitleConfig,
  getSubtitleStrategy
};

// Export all interfaces and types
export type {
  // FFmpegCommand interfaces
  FFmpegOptions,
  VideoOptions,
  AudioOptions,
  ProgressInfo,
  ScreenshotOptions,
  ProbeData,
  
  // TestMediaGenerator interfaces
  MediaFile,
  TestVideoOptions,
  TestAudioOptions,
  ImageOptions,
  
  // MediaMetadataExtractor interfaces
  MediaMetadata,
  MediaType,
  StreamInfo,
  FormatInfo,
  MetadataOptions,
  
  // HLS types namespace
  HLSTypes
};
// Export ResolutionUtils types
export type {
  AspectRatio,
  Resolution
};
import { 
    HLSPlaylistGenerator, 
    HLSVariantBuilder,
    HLSAudioTrack,
    HLSSubtitle,
    HLSVariant,
    HLSGeneratorConfig,
    HLSPlaylistParser,
    HLSPlaylistValidator,
    ParsedAudioTrack,
    ParsedSubtitle,
} from './m3u8/index';
export { 
    HLSPlaylistGenerator, 
    HLSVariantBuilder,
    HLSAudioTrack,
    HLSSubtitle,
    HLSVariant,
    HLSGeneratorConfig,
    HLSPlaylistParser,
    HLSPlaylistValidator,
    ParsedAudioTrack,
    ParsedSubtitle,
}
export { ResolutionUtils };