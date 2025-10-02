import { FFmpegManager } from './FFmpegManager.js';
import { FFmpegCommand, FFmpegOptions, VideoOptions, AudioOptions, ProgressInfo, ScreenshotOptions, ProbeData } from './FFmpegCommand.js';
import { TestMediaGenerator, MediaFile, VideoOptions as TestVideoOptions, AudioOptions as TestAudioOptions, ImageOptions } from './TestMediaGenerator.js';
import { MediaMetadataExtractor, MediaMetadata, MediaType, StreamInfo, FormatInfo, MetadataOptions } from './MediaMetadataExtractor.js';

// Export main classes
export { 
  FFmpegManager,
  FFmpegCommand,
  TestMediaGenerator,
  MediaMetadataExtractor
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
  MetadataOptions
};