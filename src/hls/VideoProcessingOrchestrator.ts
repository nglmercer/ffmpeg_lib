import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs-extra';
import { MediaMetadataExtractor, MediaMetadata, MediaType } from '../MediaMetadataExtractor';
import { ResolutionUtils, Resolution } from '../utils/ResolutionUtils';
import { HLSSegmentationManager, SegmentationResult } from './HLSSegmentationManager';
import { 
    HLSPlaylistGenerator, 
    HLSVariant, 
    HLSVariantBuilder,
    HLSAudioTrack,
    HLSSubtitle 
} from './HLSPlaylistGenerator';
import { FFmpegManager } from '../FFmpegManager';
import { SubtitleProcessor,createDefaultSubtitleConfig } from './SubtitleProcessor.js';
// ==================== INTERFACES ====================

/**
 * Configuración del procesamiento
 */
export interface ProcessingConfig {
    // Directorios
    outputBaseDir: string;              // Directorio base de salida
    tempDir?: string;                   // Directorio temporal
    
    // Calidad
    qualityPreset?: 'low' | 'medium' | 'high';
    targetResolutions?: string[];       // ["1080p", "720p", "480p"] o auto
    minResolution?: { width: number; height: number };
    
    // Encoding
    videoPreset?: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium';
    audioQuality?: 'low' | 'medium' | 'high';
    
    // HLS
    segmentDuration?: number;           // Duración de segmentos (default: 6)
    
    // Procesamiento
    parallel?: boolean;                 // Procesar calidades en paralelo
    extractAudioTracks?: boolean;       // Extraer pistas de audio alternativas
    extractSubtitles?: boolean;         // Extraer subtítulos embebidos
    
    // Limpieza
    cleanupTemp?: boolean;              // Limpiar archivos temporales
    keepOriginal?: boolean;             // Mantener video original
}

/**
 * Plan de procesamiento generado
 */
export interface ProcessingPlan {
    inputFile: string;
    metadata: MediaMetadata;
    targetResolutions: Resolution[];
    variants: HLSVariant[];
    audioTracks: AudioTrackInfo[];
    subtitles: SubtitleInfo[];
    estimatedDuration: number;          // Tiempo estimado en segundos
    estimatedSize: number;              // Tamaño estimado en bytes
}

/**
 * Información de pista de audio
 */
export interface AudioTrackInfo {
    index: number;
    language: string;
    name: string;
    codec: string;
    channels: number;
    isDefault: boolean;
}

/**
 * Información de subtítulo
 */
export interface SubtitleInfo {
    index: number;
    language: string;
    name: string;
    codec: string;
    isDefault: boolean;
    isForced: boolean;
}

/**
 * Resultado del procesamiento
 */
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

/**
 * Resultado de una variante
 */
export interface VariantResult {
    name: string;
    resolution: string;
    playlistPath: string;
    segmentCount: number;
    size: number;
    bitrate: string;
}

/**
 * Resultado de audio
 */
export interface AudioTrackResult {
    language: string;
    playlistPath: string;
    size: number;
}

/**
 * Resultado de subtítulo
 */
export interface SubtitleResult {
    language: string;
    format: string;
    path: string;
}

/**
 * Error de procesamiento
 */
export interface ProcessingError {
    stage: string;
    variant?: string;
    error: string;
    timestamp: Date;
}

/**
 * Progreso global
 */
export interface ProcessingProgress {
    stage: 'analyzing' | 'planning' | 'processing-video' | 'processing-audio' | 'processing-subtitles' | 'generating-playlists' | 'cleanup' | 'complete';
    percent: number;
    currentVariant?: string;
    variantsCompleted: number;
    variantsTotal: number;
    message: string;
}

// ==================== CLASE PRINCIPAL ====================

export class VideoProcessingOrchestrator extends EventEmitter {
    private ffmpegManager: FFmpegManager;
    private metadataExtractor: MediaMetadataExtractor;
    private segmentationManager: HLSSegmentationManager;
    private playlistGenerator: HLSPlaylistGenerator;
    private subtitleProcessor: SubtitleProcessor;

    constructor(dir?: string) {
        super();
        this.ffmpegManager = new FFmpegManager(dir);
        
        const ffmpegPath = this.ffmpegManager.getFFmpegPath();
        const ffprobePath = this.ffmpegManager.getFFprobePath();
        
        this.metadataExtractor = new MediaMetadataExtractor(ffprobePath);
        this.segmentationManager = new HLSSegmentationManager(ffmpegPath, ffprobePath);
        this.playlistGenerator = new HLSPlaylistGenerator();
        this.subtitleProcessor = new SubtitleProcessor(ffmpegPath, ffprobePath);
    }

    // ==================== PROCESAMIENTO PRINCIPAL ====================

    /**
     * Procesa un video completo para streaming HLS
     */
    async processVideo(
        inputPath: string,
        config: ProcessingConfig
    ): Promise<ProcessingResult> {
        const startTime = Date.now();
        const videoId = this.generateVideoId();
        const errors: ProcessingError[] = [];

        try {
            // FASE 1: Análisis
            this.emitProgress('analyzing', 0, 'Analyzing video...');
            const metadata = await this.analyzeVideo(inputPath);

            if (metadata.mediaType !== MediaType.VIDEO) {
                throw new Error('Input file is not a valid video');
            }

            // FASE 2: Planificación
            this.emitProgress('planning', 10, 'Planning processing...');
            const plan = await this.createProcessingPlan(inputPath, metadata, config);

            // FASE 3: Preparar estructura de directorios
            const outputDir = path.join(config.outputBaseDir, videoId);
            await this.setupDirectories(outputDir);

            // ⭐ FASE 3.5: Procesar subtítulos UNA SOLA VEZ (ANTES de las variantes)
            let subtitleResults: SubtitleResult[] = [];
            if (config.extractSubtitles || plan.subtitles.length > 0) {
                this.emitProgress('processing-subtitles', 15, 'Processing subtitles...');
                subtitleResults = await this.processSubtitles(
                    inputPath,
                    outputDir,
                    plan.subtitles,
                    errors
                );
            }

            // FASE 4: Procesar variantes de video
            this.emitProgress('processing-video', 20, 'Processing video variants...');
            const variantResults = await this.processVideoVariants(
                inputPath,
                outputDir,
                plan,
                config,
                errors
            );

            // FASE 5: Procesar audio (si hay múltiples pistas)
            let audioResults: AudioTrackResult[] = [];
            if (config.extractAudioTracks && plan.audioTracks.length > 1) {
                this.emitProgress('processing-audio', 70, 'Processing audio tracks...');
                audioResults = await this.processAudioTracks(
                    inputPath,
                    outputDir,
                    plan.audioTracks,
                    metadata.duration,
                    errors
                );
            }

            // ⭐ FASE 6: Generar playlists de subtítulos (reutilizar archivos ya extraídos)
            let hlsSubtitles: HLSSubtitle[] = [];
            if (subtitleResults.length > 0) {
                this.emitProgress('generating-playlists', 85, 'Generating subtitle playlists...');
                const subtitleDir = path.join(outputDir, 'subtitles');
                hlsSubtitles = await this.generateSubtitlePlaylists(
                    subtitleResults,
                    plan.subtitles,
                    subtitleDir,
                    metadata.duration
                );
            }

            // FASE 7: Generar master playlist
            this.emitProgress('generating-playlists', 90, 'Generating playlists...');
            const masterPlaylistPath = await this.generateMasterPlaylist(
                outputDir,
                plan.variants,
                audioResults.length > 0 ? this.convertToHLSAudioTracks(audioResults, plan.audioTracks) : undefined,
                hlsSubtitles.length > 0 ? hlsSubtitles : undefined
            );

            // FASE 8: Cleanup
            if (config.cleanupTemp) {
                this.emitProgress('cleanup', 95, 'Cleaning up...');
                await this.cleanup(config.tempDir);
            }

            // FASE 9: Calcular estadísticas
            const processedSize = await this.calculateTotalSize(outputDir);
            const processingTime = (Date.now() - startTime) / 1000;

            this.emitProgress('complete', 100, 'Processing complete!');

            return {
                success: errors.length === 0,
                videoId,
                masterPlaylist: masterPlaylistPath,
                variants: variantResults,
                audioTracks: audioResults,
                subtitles: subtitleResults,
                metadata: {
                    originalFile: inputPath,
                    duration: metadata.duration,
                    originalSize: metadata.fileSize,
                    processedSize,
                    compressionRatio: metadata.fileSize / processedSize,
                    processingTime
                },
                errors
            };

        } catch (error: any) {
            errors.push({
                stage: 'orchestration',
                error: error.message,
                timestamp: new Date()
            });

            throw error;
        }
    }

    // ==================== ANÁLISIS ====================

    /**
     * Analiza el video de entrada
     */
    private async analyzeVideo(inputPath: string): Promise<MediaMetadata> {
        if (!await fs.pathExists(inputPath)) {
            throw new Error(`Input file not found: ${inputPath}`);
        }

        return await this.metadataExtractor.extractMetadata(inputPath);
    }

    // ==================== PLANIFICACIÓN ====================

    /**
     * Crea el plan de procesamiento
     */
    private async createProcessingPlan(
        inputPath: string,
        metadata: MediaMetadata,
        config: ProcessingConfig
    ): Promise<ProcessingPlan> {
        const primaryVideo = metadata.primaryVideo;
        if (!primaryVideo) {
            throw new Error('No video stream found');
        }

        // Determinar resoluciones target
        const targetResolutions = this.determineTargetResolutions(
            primaryVideo.width,
            primaryVideo.height,
            config
        );

        // Crear variantes HLS
        const variants = this.createHLSVariants(targetResolutions, config);

        // Detectar pistas de audio
        const audioTracks = this.detectAudioTracks(metadata);

        // Detectar subtítulos
        const subtitles = this.detectSubtitles(metadata);

        // Estimar duración y tamaño
        const estimatedDuration = this.estimateProcessingDuration(
            metadata.duration,
            targetResolutions.length,
            config.parallel || false
        );

        const estimatedSize = this.estimateProcessedSize(
            metadata.fileSize,
            targetResolutions.length
        );

        return {
            inputFile: inputPath,
            metadata,
            targetResolutions,
            variants,
            audioTracks,
            subtitles,
            estimatedDuration,
            estimatedSize
        };
    }

    /**
     * Determina las resoluciones objetivo
     */
    private determineTargetResolutions(
        originalWidth: number,
        originalHeight: number,
        config: ProcessingConfig
    ): Resolution[] {
        if (config.targetResolutions && config.targetResolutions.length > 0) {
            // Usar resoluciones específicas
            const allResolutions = ResolutionUtils.generateLowerResolutions(
                originalWidth,
                originalHeight,
                {
                    minWidth: config.minResolution?.width,
                    minHeight: config.minResolution?.height
                }
            );

            return allResolutions.filter(r => 
                config.targetResolutions!.includes(r.name)
            );
        }

        // Generar resoluciones adaptativas
        return ResolutionUtils.generateAdaptiveResolutions(
            originalWidth,
            originalHeight,
            {
                qualityPreset: config.qualityPreset || 'medium',
                minWidth: config.minResolution?.width,
                minHeight: config.minResolution?.height
            }
        );
    }

    /**
     * Crea variantes HLS
     */
    private createHLSVariants(
        resolutions: Resolution[],
        config: ProcessingConfig
    ): HLSVariant[] {
        const builder = new HLSVariantBuilder();
        const audioQuality = config.audioQuality || 'medium';
        const audioBitrate = audioQuality === 'high' ? '192k' : audioQuality === 'low' ? '64k' : '128k';

        for (const resolution of resolutions) {
            builder.addVariant(
                resolution.name,
                resolution.width,
                resolution.height,
                resolution.bitrate,
                audioBitrate,
                {
                    frameRate: 30,
                    audioGroup: 'audio',
                    subtitleGroup: 'subs'
                }
            );
        }

        return builder.build();
    }

    /**
     * Detecta pistas de audio
     */
    private detectAudioTracks(metadata: MediaMetadata): AudioTrackInfo[] {
        return metadata.audioStreams.map((stream, index) => ({
            index: stream.index,
            language: stream.language || 'und',
            name: stream.language ? this.getLanguageName(stream.language) : `Audio ${index + 1}`,
            codec: stream.codecName,
            channels: stream.channels || 2,
            isDefault: index === 0
        }));
    }

    /**
     * Detecta subtítulos
     */
    private detectSubtitles(metadata: MediaMetadata): SubtitleInfo[] {
        return metadata.subtitleStreams.map((stream, index) => ({
            index: stream.index,
            language: stream.language || 'und',
            name: stream.language ? this.getLanguageName(stream.language) : `Subtitle ${index + 1}`,
            codec: stream.codecName,
            isDefault: index === 0,
            isForced: false
        }));
    }

    // ==================== PROCESAMIENTO DE VARIANTES ====================

    /**
     * Procesa todas las variantes de video
     */
    private async processVideoVariants(
        inputPath: string,
        outputDir: string,
        plan: ProcessingPlan,
        config: ProcessingConfig,
        errors: ProcessingError[]
    ): Promise<VariantResult[]> {
        const results: VariantResult[] = [];
        const videoDir = path.join(outputDir, 'video');
        
        const processTasks = plan.targetResolutions.map(async (resolution, index) => {
            try {
                this.emit('variant-start', resolution.name);
                
                const segmentationConfig = {
                    segmentDuration: config.segmentDuration || 6,
                    segmentPattern: `${resolution.name}_segment_%03d.ts`,
                    playlistName: `quality_${resolution.name}.m3u8`,
                    outputDir: videoDir
                };

                const videoConfig = HLSSegmentationManager.createVideoConfig(
                    resolution,
                    config.videoPreset || 'fast'
                );

                const audioConfig = HLSSegmentationManager.createAudioConfig(
                    config.audioQuality || 'medium'
                );

                const result = await this.segmentationManager.segmentVideo(
                    inputPath,
                    segmentationConfig,
                    {
                        video: videoConfig,
                        audio: audioConfig,
                        resolution
                    }
                );

                const variantResult: VariantResult = {
                    name: resolution.name,
                    resolution: `${resolution.width}x${resolution.height}`,
                    playlistPath: result.playlistPath,
                    segmentCount: result.segmentCount,
                    size: result.fileSize,
                    bitrate: resolution.bitrate
                };

                this.emit('variant-complete', resolution.name, variantResult);
                
                const progressPercent = 20 + ((index + 1) / plan.targetResolutions.length) * 50;
                this.emitProgress(
                    'processing-video',
                    progressPercent,
                    `Processed ${resolution.name} (${index + 1}/${plan.targetResolutions.length})`
                );

                return variantResult;

            } catch (error: any) {
                errors.push({
                    stage: 'video-processing',
                    variant: resolution.name,
                    error: error.message,
                    timestamp: new Date()
                });
                throw error;
            }
        });

        if (config.parallel) {
            results.push(...await Promise.all(processTasks));
        } else {
            for (const task of processTasks) {
                results.push(await task);
            }
        }

        return results;
    }

    // ==================== PROCESAMIENTO DE AUDIO ====================

    /**
     * Procesa pistas de audio alternativas
     */
    private async processAudioTracks(
        inputPath: string,
        outputDir: string,
        audioTracks: AudioTrackInfo[],
        duration: number,
        errors: ProcessingError[]
    ): Promise<AudioTrackResult[]> {
        const results: AudioTrackResult[] = [];
        const audioDir = path.join(outputDir, 'audio');

        for (const track of audioTracks) {
            try {
                const segmentationConfig = {
                    segmentDuration: 6,
                    segmentPattern: `audio_${track.language}_segment_%03d.ts`,
                    playlistName: `audio_${track.language}.m3u8`,
                    outputDir: audioDir
                };

                const audioConfig = HLSSegmentationManager.createAudioConfig('medium');

                const result = await this.segmentationManager.segmentAudio(
                    inputPath,
                    segmentationConfig,
                    audioConfig,
                    track.index
                );

                results.push({
                    language: track.language,
                    playlistPath: result.playlistPath,
                    size: result.fileSize
                });

            } catch (error: any) {
                errors.push({
                    stage: 'audio-processing',
                    variant: track.language,
                    error: error.message,
                    timestamp: new Date()
                });
            }
        }

        return results;
    }

    // ==================== PROCESAMIENTO DE SUBTÍTULOS ====================

    /**
     * Procesa subtítulos (placeholder - requiere SubtitleProcessor)
     */
    private async processSubtitles(
        inputPath: string,
        outputDir: string,
        subtitles: SubtitleInfo[],
        errors: ProcessingError[]
    ): Promise<SubtitleResult[]> {
        
        const subtitleDir = path.join(outputDir, 'subtitles');
        await fs.ensureDir(subtitleDir);

        // Usar la configuración por defecto que creaste
        const subtitleConfig = createDefaultSubtitleConfig(subtitleDir);
        // NOTA: Habilita la conversión a WebVTT si la implementas
        subtitleConfig.generateWebVTT = true; 

        try {
            this.emit('subtitles-start', 'Extracting embedded subtitles...');

            const processedSubs = await this.subtitleProcessor.extractEmbeddedSubtitles(
                inputPath,
                subtitleConfig,
                { extractAll: true } // Extraer todos los idiomas detectados
            );

            this.emit('subtitles-complete', processedSubs.length);

            // Mapear el resultado de SubtitleProcessor al formato que espera el Orquestador
            const results: SubtitleResult[] = processedSubs.map(sub => {
                
                // HLS necesita un playlist que apunte al archivo VTT
                // Si tienes un VTT, usa su playlist. Si no, usa la ruta del formato original.
                const finalPath = sub.webvttPath || sub.customPath!;
                const finalFormat = sub.webvttPath ? 'vtt' : sub.customFormat!.toString();

                return {
                    language: sub.language,
                    format: finalFormat,
                    path: finalPath, // La ruta del archivo .vtt o .srt/.ass
                    // El playlist HLS de subtítulos se genera después
                };
            });

            return results;

        } catch (error: any) {
            errors.push({
                stage: 'subtitle-processing',
                error: error.message,
                timestamp: new Date()
            });
            this.emit('error', 'Subtitle processing failed', error);
            return []; // Retorna vacío en caso de error
        }
    }

    // ==================== GENERACIÓN DE PLAYLISTS ====================

    /**
     * Genera master playlist
     */
    private async generateMasterPlaylist(
        outputDir: string,
        variants: HLSVariant[],
        audioTracks?: HLSAudioTrack[],
        subtitles?: HLSSubtitle[]
    ): Promise<string> {
        const masterPath = path.join(outputDir, 'master.m3u8');

        await this.playlistGenerator.writeMasterPlaylist(
            masterPath,
            variants,
            audioTracks,
            subtitles
        );

        return masterPath;
    }

    // ==================== UTILIDADES ====================

    /**
     * Configura estructura de directorios
     */
    private async setupDirectories(baseDir: string): Promise<void> {
        await fs.ensureDir(path.join(baseDir, 'video'));
        await fs.ensureDir(path.join(baseDir, 'audio'));
        await fs.ensureDir(path.join(baseDir, 'subtitles'));
        await fs.ensureDir(path.join(baseDir, 'custom'));
    }

    /**
     * Genera ID único para el video
     */
    private generateVideoId(): string {
        return `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Convierte a formato HLS audio tracks
     */
    private convertToHLSAudioTracks(
        results: AudioTrackResult[],
        trackInfo: AudioTrackInfo[]
    ): HLSAudioTrack[] {
        return results.map((result, index) => {
            const info = trackInfo.find(t => t.language === result.language) || trackInfo[index];
            return {
                id: `audio_${result.language}`,
                name: info.name,
                language: result.language,
                isDefault: info.isDefault,
                channels: info.channels,
                bitrate: '128k',
                playlistPath: path.relative(path.dirname(result.playlistPath), result.playlistPath),
                groupId: 'audio'
            };
        });
    }

    /**
     * Convierte a formato HLS subtitles
     */
    private convertToHLSSubtitles(
        results: SubtitleResult[],
        subtitleInfo: SubtitleInfo[]
    ): HLSSubtitle[] {
        return results.map((result, index) => {
            const info = subtitleInfo[index];
            return {
                id: `sub_${result.language}`,
                name: info.name,
                language: result.language,
                isDefault: info.isDefault,
                isForced: info.isForced,
                playlistPath: `subtitles/subtitles_${result.language}.m3u8`,
                vttPath: result.path,
                groupId: 'subs'
            };
        });
    }

    /**
     * Calcula tamaño total de salida
     */
    private async calculateTotalSize(dir: string): Promise<number> {
        let totalSize = 0;
        
        const processDir = async (dirPath: string) => {
            const items = await fs.readdir(dirPath);
            
            for (const item of items) {
                const fullPath = path.join(dirPath, item);
                const stat = await fs.stat(fullPath);
                
                if (stat.isDirectory()) {
                    await processDir(fullPath);
                } else {
                    totalSize += stat.size;
                }
            }
        };

        await processDir(dir);
        return totalSize;
    }

    /**
     * Limpia archivos temporales
     */
    private async cleanup(tempDir?: string): Promise<void> {
        if (tempDir && await fs.pathExists(tempDir)) {
            await fs.remove(tempDir);
        }
    }

    /**
     * Estima duración del procesamiento
     */
    private estimateProcessingDuration(
        videoDuration: number,
        variantCount: number,
        parallel: boolean
    ): number {
        // Asumiendo encoding a 1x velocidad real
        const baseTime = videoDuration;
        
        if (parallel) {
            return baseTime * 1.2; // Overhead paralelo
        }
        
        return baseTime * variantCount * 1.1; // Overhead secuencial
    }

    /**
     * Estima tamaño procesado
     */
    private estimateProcessedSize(originalSize: number, variantCount: number): number {
        // Estimación aproximada: cada variante es ~30% del tamaño original
        return originalSize * variantCount * 0.3;
    }

    /**
     * Obtiene nombre de idioma
     */
    private getLanguageName(code: string): string {
        const languages: Record<string, string> = {
            'en': 'English',
            'es': 'Español',
            'fr': 'Français',
            'de': 'Deutsch',
            'it': 'Italiano',
            'pt': 'Português',
            'ja': '日本語',
            'zh': '中文',
            'ko': '한국어',
            'ru': 'Русский',
            'ar': 'العربية'
        };
        
        return languages[code] || code.toUpperCase();
    }
    private async generateSubtitlePlaylists(
        results: SubtitleResult[],
        subtitleInfo: SubtitleInfo[],
        subtitleDir: string,
        duration: number
    ): Promise<HLSSubtitle[]> {
        const hlsSubtitles: HLSSubtitle[] = [];

        for (const result of results) {
            const info = subtitleInfo.find(s => s.language === result.language);
            if (!info) continue;

            // UN SOLO archivo VTT por idioma
            const vttFilename = `subtitle_${result.language}.vtt`;
            const playlistFilename = `subtitle_${result.language}.m3u8`;
            const playlistPath = path.join(subtitleDir, playlistFilename);

            // Copiar el VTT al directorio de subtítulos (si no está ya allí)
            const standardVttPath = path.join(subtitleDir, vttFilename);
            if (result.path !== standardVttPath) {
                await fs.copy(result.path, standardVttPath);
            }

            // Generar playlist que apunta al VTT completo
            await this.playlistGenerator.writeSubtitlePlaylist(
                playlistPath,
                vttFilename,  // Solo el nombre del archivo
                duration
            );

            hlsSubtitles.push({
                id: `sub_${result.language}`,
                name: info.name,
                language: result.language,
                isDefault: info.isDefault,
                isForced: info.isForced,
                playlistPath: `subtitles/${playlistFilename}`,
                vttPath: `subtitles/${vttFilename}`,  // Ruta relativa
                groupId: 'subs'
            });
        }
        
        return hlsSubtitles;
    }
    /**
     * Emite progreso
     */
    private emitProgress(
        stage: ProcessingProgress['stage'],
        percent: number,
        message: string
    ): void {
        this.emit('progress', {
            stage,
            percent: Math.min(100, Math.max(0, percent)),
            message,
            variantsCompleted: 0,
            variantsTotal: 0
        } as ProcessingProgress);
    }
}

export default VideoProcessingOrchestrator;