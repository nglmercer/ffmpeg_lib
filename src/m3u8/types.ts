/**
 * TypeScript type definitions for HLS/M3U8 playlist generator and parser
 */

// ==================== CORE TYPES ====================

export interface HLSVariant {
  name: string;
  width: number;
  height: number;
  bandwidth: number;
  videoBitrate: string;
  audioBitrate: string;
  codec: string;
  playlistPath: string;
  frameRate?: number;
  audioGroup?: string;
  subtitleGroup?: string;
}

export interface HLSAudioTrack {
  groupId: string;
  name: string;
  language: string;
  isDefault: boolean;
  channels: string;
  playlistPath: string;
}

export interface HLSSubtitle {
  groupId: string;
  name: string;
  language: string;
  isDefault: boolean;
  isForced: boolean;
  playlistPath: string;
}

export interface HLSSegment {
  duration: number;
  uri: string;
  byteRange?: string;
}

export interface HLSGeneratorConfig {
  targetDuration: number;
  version: number;
  playlistType: 'VOD' | 'EVENT';
  allowCache: boolean;
}

// ==================== PARSER TYPES ====================

export interface ParsedPlaylist {
  type: 'master' | 'media';
  version: number;
  targetDuration?: number;
  mediaSequence?: number;
  playlistType?: 'VOD' | 'EVENT';
  allowCache?: boolean;
  endList?: boolean;
  segments?: HLSSegment[];
  variants?: ParsedVariant[];
  audioTracks?: ParsedAudioTrack[];
  subtitles?: ParsedSubtitle[];
  rawTags: RawTag[];
  metadata: PlaylistMetadata;
}

export interface ParsedVariant {
  bandwidth: number;
  resolution?: { width: number; height: number };
  codecs?: string;
  frameRate?: number;
  audioGroup?: string;
  subtitleGroup?: string;
  uri: string;
  rawAttributes: Record<string, string>;
}

export interface ParsedAudioTrack {
  type: 'AUDIO';
  groupId: string;
  name: string;
  language: string;
  default: boolean;
  autoSelect: boolean;
  channels?: string;
  uri: string;
  rawAttributes: Record<string, string>;
}

export interface ParsedSubtitle {
  type: 'SUBTITLES';
  groupId: string;
  name: string;
  language: string;
  default: boolean;
  autoSelect: boolean;
  forced: boolean;
  uri: string;
  rawAttributes: Record<string, string>;
}

export interface RawTag {
  tag: string;
  value?: string;
  attributes?: Record<string, string>;
  line: number;
}

export interface PlaylistMetadata {
  totalDuration: number;
  segmentCount: number;
  byteRangeSupport: boolean;
  discontinuitySupport: boolean;
  encryptionSupport: boolean;
  hasEndList: boolean;
}

// ==================== VALIDATOR TYPES ====================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  info: ValidationInfo[];
  compatibility?: CompatibilityReport;
}

export interface ValidationError {
  code: string;
  message: string;
  line?: number;
  severity: 'error' | 'warning' | 'info';
  category: 'syntax' | 'structure' | 'compatibility' | 'performance' | 'best-practice';
}

export interface ValidationWarning extends ValidationError {}
export interface ValidationInfo extends ValidationError {}

export interface CompatibilityReport {
  minVersion: number;
  recommendedVersion: number;
  features: string[];
  incompatibleFeatures: string[];
  clientCompatibility: {
    safari: boolean;
    chrome: boolean;
    firefox: boolean;
    edge: boolean;
    hlsJs: boolean;
    videoJs: boolean;
  };
}

// ==================== UTILITY TYPES ====================

export interface ComparisonResult {
  identical: boolean;
  differences: string[];
  structuralDifferences: string[];
  compatibilityDifferences: string[];
}