// HLS Module - Centralized Type Exports
import type { Resolution } from '@/utils/ResolutionUtils.js';
import { MediaMetadata } from '../MediaMetadataExtractor';
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
} from '../m3u8/index';
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

/**
 * Unified, detailed information for an audio track, sourced from ffprobe.
 * This is the single source of truth for audio track information.
 */
export interface AudioTrackInfo {
    index: number;                  // Original index of the stream in the media file
    streamIndex: number;            // Audio-specific index (0, 1, 2...)
    codec: string;                  // Original codec (e.g., 'aac', 'ac3')
    codecLongName: string;          // Full codec name (e.g., 'AAC (Advanced Audio Coding)')
    profile?: string;
    
    // Audio characteristics
    sampleRate: number;             // e.g., 44100, 48000
    channels: number;               // e.g., 1 (mono), 2 (stereo), 6 (5.1)
    channelLayout: string;          // e.g., "stereo", "5.1"
    bitrate?: number;               // Bitrate in bits per second
    bit_rate?: number;              // Bitrate in bits per second (alternative)
    // Metadata
    language: string;               // ISO language code (e.g., 'en', 'es')
    languageName: string;           // Full language name
    title?: string;                 // Custom title from metadata
    isDefault: boolean;             // Is this the default audio track?
    codec_long_name?: string;       // Full codec name (e.g., 'AAC (Advanced Audio Coding)')
    // Additional tags
    tags?: Record<string, string>;
    disposition?: Record<string, number>;
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
// ==================== INTERFACES ====================

/**
 * Configuración de procesamiento de audio
 */
export interface AudioProcessingConfig {
    outputDir: string;
    
    // Extracción
    extractAll: boolean;            // Extraer todas las pistas
    languages?: string[];           // Filtrar por idiomas específicos
    
    // Conversión
    targetCodec: string;            // "aac", "mp3", etc.
    targetBitrate: string;          // "128k", "192k", etc.
    targetSampleRate?: number;      // 48000, etc.
    targetChannels?: number;        // 2 (convertir a stereo), etc.
    
    // Naming
    filenamePattern?: string;       // "audio_{lang}_{quality}"
    
    // HLS
    generateHLS: boolean;           // Generar segmentos HLS
    segmentDuration?: number;       // Duración de segmentos
}

/**
 * Pista de audio procesada
 */
export interface ProcessedAudioTrack {
    original: AudioTrackInfo;
    
    // Audio extraído/convertido
    audioPath: string;              // Ruta del archivo de audio
    format: string;                 // Formato del archivo procesado
    size: number;                   // Tamaño en bytes
    
    // HLS (si está habilitado)
    hlsPlaylistPath?: string;       // Ruta del playlist HLS
    hlsSegmentPaths?: string[];     // Rutas de segmentos
    hlsSegmentCount?: number;
    
    metadata: {
        processingTime: number;     // Tiempo de procesamiento en ms
        originalCodec: string;
        targetCodec: string;
        originalBitrate?: number;
        targetBitrate: string;
    };
}

/**
 * Resultado del procesamiento de múltiples pistas
 */
export interface AudioProcessingResult {
    success: boolean;
    tracks: ProcessedAudioTrack[];
    defaultTrack?: ProcessedAudioTrack;
    errors: AudioProcessingError[];
    totalSize: number;
    totalProcessingTime: number;
}

/**
 * Error de procesamiento de audio
 */
export interface AudioProcessingError {
    trackIndex: number;
    language: string;
    error: string;
    timestamp: Date;
}

/**
 * Opciones de calidad de audio
 */
export interface AudioQualityPreset {
    name: string;
    bitrate: string;
    sampleRate: number;
    codec: string;
    profile?: string;
}



// SubtitleProcessor types
export type {
  ExtractedSubtitle,
  ProcessedSubtitle,
  SubtitleProcessorConfig,
  ExtractionOptions
} from './SubtitleProcessor.js';

// HLSSegmentationManager types
// ==================== INTERFACES ====================

/**
 * Configuración de segmentación HLS
 */
export interface HLSSegmentationConfig {
    segmentDuration: number;        // Duración de cada segmento en segundos (default: 6)
    segmentPattern: string;         // Patrón de nombre: "segment_%03d.ts"
    playlistName: string;           // Nombre del playlist: "quality_720p.m3u8"
    outputDir: string;              // Directorio de salida
    hlsFlags?: string[];            // Flags adicionales de HLS
    deleteThreshold?: number;       // Número de segmentos a mantener (para live)
}

/**
 * Configuración de video para segmentación
 */
export interface VideoSegmentConfig {
    codec: string;                  // "libx264"
    preset: string;                 // "fast", "medium", "slow"
    profile: string;                // "baseline", "main", "high"
    level?: string;                 // "3.0", "3.1", "4.0"
    bitrate: string;                // "2800k"
    maxBitrate?: string;            // "3000k"
    bufferSize?: string;            // "4200k"
    gopSize?: number;               // Keyframe interval (default: 2 * fps)
    bFrames?: number;               // B-frames (default: 0 para baseline)
    pixelFormat?: string;           // "yuv420p"
}

/**
 * Configuración de audio para segmentación
 */
export interface AudioSegmentConfig {
    codec: string;                  // "aac"
    bitrate: string;                // "128k"
    sampleRate: number;             // 44100, 48000
    channels: number;               // 1 (mono), 2 (stereo)
    profile?: string;               // "aac_low"
}

/**
 * Opciones de segmentación
 */
export interface SegmentationOptions {
    video?: VideoSegmentConfig;
    audio?: AudioSegmentConfig;
    subtitle?: {
        enabled: boolean;
        burnIn: boolean;            // Quemar subtítulos en video
    };
    startTime?: number;             // Tiempo de inicio (para clips)
    duration?: number;              // Duración (para clips)
    resolution?: Resolution;        // Resolución target
    frameRate?: number;             // FPS target
    twoPass?: boolean;              // Usar encoding de 2 pasadas
}

/**
 * Resultado de segmentación
 */
export interface SegmentationResult {
    playlistPath: string;           // Ruta del playlist generado
    segmentPaths: string[];         // Rutas de todos los segmentos
    segments: HLSSegment[];         // Información de segmentos para playlist
    duration: number;               // Duración total
    fileSize: number;               // Tamaño total en bytes
    segmentCount: number;           // Número de segmentos generados
}

/**
 * Progreso de segmentación
 */
export interface SegmentationProgress {
    percent: number;                // Porcentaje completado (0-100)
    currentSegment: number;         // Segmento actual
    totalSegments: number;          // Total estimado de segmentos
    fps: number;                    // FPS actual de encoding
    speed: string;                  // Velocidad (ej: "2.5x")
    bitrate: string;                // Bitrate actual
    timeProcessed: string;          // Tiempo procesado (HH:MM:SS)
    eta: string;                    // Tiempo estimado restante
}

// ==================== CLASE PRINCIPAL ====================


// HLSPlaylistGenerator types
// ==================== INTERFACES ====================


/**
 * Segmento de video/audio
 */
export interface HLSSegment {
    duration: number;          // Duración en segundos
    uri: string;               // "segment_000.ts"
}