// HLS Module - Centralized Type Exports
import type { Resolution } from '@/utils/ResolutionUtils.js';
import type { HLSVariant } from './HLSPlaylistGenerator.js';
import { MediaMetadata } from '../MediaMetadataExtractor';

export interface ProcessingConfig {
    outputBaseDir: string;
    tempDir?: string;
    qualityPreset?: 'low' | 'medium' | 'high';
    targetResolutions?: string[];
    minResolution?: { width: number; height: number };
    videoPreset?: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium';
    audioQuality?: 'low' | 'medium' | 'high';
    segmentDuration?: number;
    parallel?: boolean;
    extractAudioTracks?: boolean;
    extractSubtitles?: boolean;
    cleanupTemp?: boolean;
    keepOriginal?: boolean;
}

export interface ProcessingPlan {
    inputFile: string;
    metadata: MediaMetadata;
    targetResolutions: Resolution[];
    variants: HLSVariant[];
    audioTracks: AudioTrackInfo[];
    subtitles: SubtitleInfo[];
    estimatedDuration: number;
    estimatedSize: number;
}

export interface AudioTrackInfo {
    index: number;
    language: string;
    name: string;
    codec: string;
    channels: number;
    isDefault: boolean;
}

export interface SubtitleInfo {
    index: number;
    language: string;
    name: string;
    codec: string;
    isDefault: boolean;
    isForced: boolean;
}

export interface ProcessingResult {
    success: boolean;
    videoId: string;
    masterPlaylist: string;
    variants: VariantResult[];
    audioTracks: AudioTrackResult[];
    subtitles: SubtitleResult[];
    metadata: {
        originalFile: string;
        duration: number;
        originalSize: number;
        processedSize: number;
        compressionRatio: number;
        processingTime: number;
    };
    errors: ProcessingError[];
}

export interface VariantResult {
    name: string;
    resolution: string;
    playlistPath: string;
    segmentCount: number;
    size: number;
    bitrate: string;
}

export interface AudioTrackResult {
    language: string;
    playlistPath: string;
    size: number;
}

export interface SubtitleResult {
    language: string;
    format: string;
    path: string;
}

export interface ProcessingError {
    stage: string;
    variant?: string;
    error: string;
    timestamp: Date;
}

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