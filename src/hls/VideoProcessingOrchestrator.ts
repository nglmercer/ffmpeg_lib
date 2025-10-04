// VideoProcessingOrchestrator.ts - Con TypedVideoEventEmitter integrado

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
import { SubtitleProcessor, createDefaultSubtitleConfig } from './SubtitleProcessor';

// ⭐ IMPORTAR SISTEMA DE EVENTOS TIPADOS
import {
    TypedVideoEventEmitter,
    VideoProcessingEvent,
    ProcessingPhase,
    ProcessingProgressTracker,
    EventLogger,
    // Tipos de eventos
    ProcessingStartedEvent,
    ProcessingCompletedEvent,
    VariantStartedEvent,
    VariantProgressEvent,
    VariantCompletedEvent
} from './EventTypes';
import type{
    ProcessingConfig,
    ProcessingPlan,
    ProcessingResult,
    ProcessingError,
    VariantResult,
    AudioTrackResult,
    SubtitleResult,
    SubtitleInfo,
    AudioTrackInfo,
} from './types'


export class VideoProcessingOrchestrator extends TypedVideoEventEmitter {
    private ffmpegManager: FFmpegManager;
    private metadataExtractor: MediaMetadataExtractor;
    private segmentationManager: HLSSegmentationManager;
    private playlistGenerator: HLSPlaylistGenerator;
    private subtitleProcessor: SubtitleProcessor;
    
    // ⭐ Progress tracker integrado
    private progressTracker?: ProcessingProgressTracker;
    private eventLogger?: EventLogger;

    constructor(dir?: string, options?: { enableLogger?: boolean }) {
        super();
        
        this.ffmpegManager = new FFmpegManager(dir);
        const ffmpegPath = this.ffmpegManager.getFFmpegPath();
        const ffprobePath = this.ffmpegManager.getFFprobePath();
        
        this.metadataExtractor = new MediaMetadataExtractor(ffprobePath);
        this.segmentationManager = new HLSSegmentationManager(ffmpegPath, ffprobePath);
        this.playlistGenerator = new HLSPlaylistGenerator();
        this.subtitleProcessor = new SubtitleProcessor(ffmpegPath, ffprobePath);
        
        // Habilitar logger opcional
        if (options?.enableLogger) {
            this.eventLogger = new EventLogger(this);
        }
    }
    /**
     * Procesa un video completo con eventos tipados
     */
    async processVideo(
        inputPath: string,
        config: ProcessingConfig
    ): Promise<ProcessingResult> {
        const startTime = Date.now();
        const videoId = this.generateVideoId();
        const processId = videoId;
        const errors: ProcessingError[] = [];

        // Inicializar progress tracker
        this.progressTracker = new ProcessingProgressTracker(processId);

        try {
            // ==================== FASE 1: ANÁLISIS ====================
            this.emitPhaseStart(processId, ProcessingPhase.ANALYZING);
            
            const metadata = await this.analyzeVideo(inputPath);
            
            if (metadata.mediaType !== MediaType.VIDEO) {
                throw new Error('Input file is not a valid video');
            }

            this.emit(VideoProcessingEvent.ANALYSIS_COMPLETED, {
                processId,
                timestamp: new Date(),
                phase: ProcessingPhase.ANALYZING,
                metadata
            });

            // ==================== FASE 2: PLANIFICACIÓN ====================
            this.emitPhaseStart(processId, ProcessingPhase.PLANNING);
            
            const plan = await this.createProcessingPlan(inputPath, metadata, config);
            
            this.emit(VideoProcessingEvent.PLANNING_COMPLETED, {
                processId,
                timestamp: new Date(),
                phase: ProcessingPhase.PLANNING,
                plan
            });

            // ==================== FASE 3: PREPARAR DIRECTORIOS ====================
            const outputDir = path.join(config.outputBaseDir, videoId);
            await this.setupDirectories(outputDir);

            // ==================== FASE 4: PROCESAR SUBTÍTULOS ====================
            let subtitleResults: SubtitleResult[] = [];
            if (config.extractSubtitles || plan.subtitles.length > 0) {
                this.emitPhaseStart(processId, ProcessingPhase.PROCESSING_SUBTITLES);
                
                subtitleResults = await this.processSubtitles(
                    inputPath,
                    outputDir,
                    plan.subtitles,
                    processId,
                    errors
                );
                
                this.emitPhaseComplete(processId, ProcessingPhase.PROCESSING_SUBTITLES);
            }

            // ==================== FASE 5: PROCESAR VARIANTES DE VIDEO ====================
            this.emitPhaseStart(processId, ProcessingPhase.PROCESSING_VIDEO);
            
            const variantResults = await this.processVideoVariants(
                inputPath,
                outputDir,
                plan,
                config,
                processId,
                errors
            );
            
            this.emitPhaseComplete(processId, ProcessingPhase.PROCESSING_VIDEO);

            // ==================== FASE 6: PROCESAR AUDIO ====================
            let audioResults: AudioTrackResult[] = [];
            if (config.extractAudioTracks && plan.audioTracks.length > 1) {
                this.emitPhaseStart(processId, ProcessingPhase.PROCESSING_AUDIO);
                
                audioResults = await this.processAudioTracks(
                    inputPath,
                    outputDir,
                    plan.audioTracks,
                    metadata.duration,
                    processId,
                    errors
                );
                
                this.emitPhaseComplete(processId, ProcessingPhase.PROCESSING_AUDIO);
            }

            // ==================== FASE 7: GENERAR PLAYLISTS ====================
            this.emitPhaseStart(processId, ProcessingPhase.GENERATING_PLAYLISTS);
            
            let hlsSubtitles: HLSSubtitle[] = [];
            if (subtitleResults.length > 0) {
                const subtitleDir = path.join(outputDir, 'subtitles');
                hlsSubtitles = await this.generateSubtitlePlaylists(
                    subtitleResults,
                    plan.subtitles,
                    subtitleDir,
                    metadata.duration
                );
            }

            const masterPlaylistPath = await this.generateMasterPlaylist(
                outputDir,
                plan.variants,
                audioResults.length > 0 ? this.convertToHLSAudioTracks(audioResults, plan.audioTracks) : undefined,
                hlsSubtitles.length > 0 ? hlsSubtitles : undefined
            );
            
            this.emitPhaseComplete(processId, ProcessingPhase.GENERATING_PLAYLISTS);

            // ==================== FASE 8: CLEANUP ====================
            if (config.cleanupTemp) {
                this.emitPhaseStart(processId, ProcessingPhase.CLEANUP);
                await this.cleanup(config.tempDir);
                this.emitPhaseComplete(processId, ProcessingPhase.CLEANUP);
            }

            // ==================== COMPLETADO ====================
            const processedSize = await this.calculateTotalSize(outputDir);
            const processingTime = (Date.now() - startTime) / 1000;

            this.emit(VideoProcessingEvent.PROCESSING_COMPLETED, {
                processId,
                timestamp: new Date(),
                phase: ProcessingPhase.COMPLETE,
                videoId,
                totalDuration: processingTime,
                variantsProcessed: variantResults.length,
                audioTracksProcessed: audioResults.length,
                subtitlesProcessed: subtitleResults.length,
                totalSize: processedSize,
                masterPlaylistPath
            } as ProcessingCompletedEvent);

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
            this.emit(VideoProcessingEvent.PROCESSING_FAILED, {
                processId,
                timestamp: new Date(),
                phase: this.progressTracker?.getStatus().phase || ProcessingPhase.ANALYZING,
                stage: 'orchestration',
                error,
                details: { videoId, inputPath }
            });

            throw error;
        }
    }
    private emitPhaseStart(processId: string, phase: ProcessingPhase): void {
        this.progressTracker?.updatePhase(phase, 0);
        
        this.emit(VideoProcessingEvent.PHASE_STARTED, {
            processId,
            timestamp: new Date(),
            phase
        });
    }

    private emitPhaseComplete(processId: string, phase: ProcessingPhase): void {
        this.progressTracker?.updatePhase(phase, 100);
        
        this.emit(VideoProcessingEvent.PHASE_COMPLETED, {
            processId,
            timestamp: new Date(),
            phase
        });
    }

    private emitVariantProgress(
        processId: string,
        variantName: string,
        percent: number,
        progressInfo?: any
    ): void {
        this.progressTracker?.updateVariant(variantName, percent);
        
        this.emit(VideoProcessingEvent.VARIANT_PROGRESS, {
            processId,
            timestamp: new Date(),
            phase: ProcessingPhase.PROCESSING_VIDEO,
            variantName,
            percent,
            fps: progressInfo?.currentFps,
            speed: progressInfo?.speed,
            bitrate: progressInfo?.bitrate,
            timeProcessed: progressInfo?.timemark,
            eta: progressInfo?.eta
        } as VariantProgressEvent);
    }
        /**
     * Obtiene el estado actual del progreso
     */
    getProgressStatus() {
        return this.progressTracker?.getStatus();
    }
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

    private async createProcessingPlan(
        inputPath: string,
        metadata: MediaMetadata,
        config: ProcessingConfig
    ): Promise<ProcessingPlan> {
        const primaryVideo = metadata.primaryVideo;
        if (!primaryVideo) {
            throw new Error('No video stream found');
        }

        const targetResolutions = this.determineTargetResolutions(
            primaryVideo.width,
            primaryVideo.height,
            config
        );

        const variants = this.createHLSVariants(targetResolutions, config);
        const audioTracks = this.detectAudioTracks(metadata);
        const subtitles = this.detectSubtitles(metadata);

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
    private createHLSVariants(resolutions: Resolution[], config: ProcessingConfig): HLSVariant[] {
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
        processId: string,
        errors: ProcessingError[]
    ): Promise<VariantResult[]> {
        const results: VariantResult[] = [];
        const videoDir = path.join(outputDir, 'video');
        
        const processTasks = plan.targetResolutions.map(async (resolution, index) => {
            try {
                // Emitir evento de inicio de variante
                this.emit(VideoProcessingEvent.VARIANT_STARTED, {
                    processId,
                    timestamp: new Date(),
                    phase: ProcessingPhase.PROCESSING_VIDEO,
                    variantName: resolution.name,
                    resolution: `${resolution.width}x${resolution.height}`,
                    index,
                    total: plan.targetResolutions.length
                } as VariantStartedEvent);
                
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

                // Suscribirse a progreso de segmentación
               this.segmentationManager.on('progress', (progress) => {
                    this.emitVariantProgress(processId, resolution.name, progress.percent, progress);
                    
                    // También emitir progreso de fase
                    const baseProgress = 20; // PROCESSING_VIDEO comienza en 20%
                    const variantWeight = 50 / plan.targetResolutions.length; // 50% para todas las variantes
                    const phasePercent = baseProgress + (index * variantWeight) + ((progress.percent / 100) * variantWeight);
                    
                    this.emitPhaseProgress(
                        processId,
                        ProcessingPhase.PROCESSING_VIDEO,
                        phasePercent,
                        `Processing ${resolution.name}: ${progress.percent}%`,
                        { 
                            variant: resolution.name,
                            variantIndex: index,
                            totalVariants: plan.targetResolutions.length
                        }
                    );
                });

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

                // Emitir evento de completado
                this.emit(VideoProcessingEvent.VARIANT_COMPLETED, {
                    processId,
                    timestamp: new Date(),
                    phase: ProcessingPhase.PROCESSING_VIDEO,
                    variantName: resolution.name,
                    resolution: `${resolution.width}x${resolution.height}`,
                    playlistPath: result.playlistPath,
                    segmentCount: result.segmentCount,
                    fileSize: result.fileSize,
                    duration: result.duration
                } as VariantCompletedEvent);

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
        processId: string,
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
        processId: string,
        errors: ProcessingError[]
    ): Promise<SubtitleResult[]> {
        const subtitleDir = path.join(outputDir, 'subtitles');
        await fs.ensureDir(subtitleDir);

        const subtitleConfig = createDefaultSubtitleConfig(subtitleDir);
        subtitleConfig.generateWebVTT = true;

        try {
            const processedSubs = await this.subtitleProcessor.extractEmbeddedSubtitles(
                inputPath,
                subtitleConfig,
                { extractAll: true }
            );

            return processedSubs.map(sub => {
                const finalPath = sub.webvttPath || sub.customPath!;
                const finalFormat = sub.webvttPath ? 'vtt' : sub.customFormat!.toString();
                return {
                    language: sub.language,
                    format: finalFormat,
                    path: finalPath
                };
            });
        } catch (error: any) {
            errors.push({
                stage: 'subtitle-processing',
                error: error.message,
                timestamp: new Date()
            });
            return [];
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
        return `video_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
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

            const vttFilename = `subtitle_${result.language}.vtt`;
            const playlistFilename = `subtitle_${result.language}.m3u8`;
            const playlistPath = path.join(subtitleDir, playlistFilename);

            const standardVttPath = path.join(subtitleDir, vttFilename);
            if (result.path !== standardVttPath) {
                await fs.copy(result.path, standardVttPath);
            }

            await this.playlistGenerator.writeSubtitlePlaylist(
                playlistPath,
                vttFilename,
                duration
            );

            hlsSubtitles.push({
                id: `sub_${result.language}`,
                name: info.name,
                language: result.language,
                isDefault: info.isDefault,
                isForced: info.isForced,
                playlistPath: `subtitles/${playlistFilename}`,
                vttPath: `subtitles/${vttFilename}`,
                groupId: 'subs'
            });
        }
        return hlsSubtitles;
    }
    private emitPhaseProgress(
        processId: string,
        phase: ProcessingPhase,
        percent: number,
        message: string,
        details?: Record<string, any>
    ): void {
        this.progressTracker?.updatePhase(phase, percent);
        
        this.emit(VideoProcessingEvent.PHASE_PROGRESS, {
            processId,
            timestamp: new Date(),
            phase,
            percent,
            message,
            details
        });
    }
}

export default VideoProcessingOrchestrator;