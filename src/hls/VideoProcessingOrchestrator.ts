import { EventEmitter } from 'events';
import { HLSSegmentationManager } from './HLSSegmentationManager';
import { AudioTrackProcessor } from './AudioTrackProcessor';
import { SubtitleProcessor } from './SubtitleProcessor';
import type { Resolution } from '../utils/ResolutionUtils';
import type {
    ProcessedAudioTrack,
    AudioProcessingConfig
} from './types';
import type {
    ProcessedSubtitle,
    SubtitleProcessorConfig
} from './SubtitleProcessor';
import type {
    SegmentationResult
} from './types';
import fs from 'fs-extra';
import path from 'path';

// ==================== INTERFACES ====================

/**
 * Configuración completa del orquestador
 */
export interface OrchestratorConfig {
    inputPath: string;
    outputBaseDir: string;
    
    // Configuración de video
    video: {
        enabled: boolean;
        resolutions: Resolution[];
        preset?: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium';
        segmentDuration?: number;
        parallel?: boolean;
    };
    
    // Configuración de audio
    audio: {
        enabled: boolean;
        extractAll?: boolean;
        languages?: string[];
        quality?: 'low' | 'medium' | 'high';
        generateHLS?: boolean;
    };
    
    // Configuración de subtítulos
    subtitles: {
        enabled: boolean;
        extractEmbedded?: boolean;
        externalFiles?: Array<{
            path: string;
            language: string;
        }>;
        languages?: string[];
        generateWebVTT?: boolean;
    };
}

/**
 * Resultado del procesamiento completo
 */
export interface OrchestratorResult {
    success: boolean;
    
    // Resultados de video
    video?: {
        qualities: SegmentationResult[];
        masterPlaylistPath?: string;
    };
    
    // Resultados de audio
    audio?: {
        tracks: ProcessedAudioTrack[];
        defaultTrack?: ProcessedAudioTrack;
    };
    
    // Resultados de subtítulos
    subtitles?: {
        tracks: ProcessedSubtitle[];
        defaultTrack?: ProcessedSubtitle;
    };
    
    // Metadata
    metadata: {
        totalSize: number;
        totalProcessingTime: number;
        startTime: Date;
        endTime: Date;
    };
    
    errors: OrchestratorError[];
}

/**
 * Error del orquestador
 */
export interface OrchestratorError {
    phase: 'video' | 'audio' | 'subtitles' | 'general';
    message: string;
    timestamp: Date;
    critical: boolean;
}

/**
 * Progreso global del orquestador
 */
export interface OrchestratorProgress {
    phase: 'video' | 'audio' | 'subtitles' | 'finalizing';
    phasePercent: number;
    globalPercent: number;
    currentItem?: string;
    totalItems?: number;
    eta?: string;
}

// ==================== CLASE PRINCIPAL ====================

export class VideoProcessingOrchestrator extends EventEmitter {
    private ffmpegPath: string;
    private ffprobePath: string;
    
    private segmentationManager: HLSSegmentationManager;
    private audioProcessor: AudioTrackProcessor;
    private subtitleProcessor: SubtitleProcessor;
    
    private startTime: number = 0;
    private phaseWeights = {
        video: 0.70,    // 70% del tiempo
        audio: 0.20,    // 20% del tiempo
        subtitles: 0.10 // 10% del tiempo
    };

    constructor(ffmpegPath: string, ffprobePath: string) {
        super();
        this.ffmpegPath = ffmpegPath;
        this.ffprobePath = ffprobePath;
        
        this.segmentationManager = new HLSSegmentationManager(ffmpegPath, ffprobePath);
        this.audioProcessor = new AudioTrackProcessor(ffmpegPath, ffprobePath);
        this.subtitleProcessor = new SubtitleProcessor(ffmpegPath, ffprobePath);
        
        this.setupEventForwarding();
    }

    // ==================== PROCESAMIENTO PRINCIPAL ====================

    /**
     * Procesa video completo con todas las opciones
     */
    async process(config: OrchestratorConfig): Promise<OrchestratorResult> {
        this.startTime = Date.now();
        const errors: OrchestratorError[] = [];
        
        // Validar input
        if (!await fs.pathExists(config.inputPath)) {
            throw new Error(`Input file not found: ${config.inputPath}`);
        }

        await fs.ensureDir(config.outputBaseDir);

        this.emit('start', {
            config,
            timestamp: new Date()
        });

        const result: OrchestratorResult = {
            success: true,
            metadata: {
                totalSize: 0,
                totalProcessingTime: 0,
                startTime: new Date(),
                endTime: new Date()
            },
            errors: []
        };

        // Fase 1: Procesar video
        if (config.video.enabled) {
            try {
                result.video = await this.processVideo(config);
            } catch (error: any) {
                errors.push({
                    phase: 'video',
                    message: error.message,
                    timestamp: new Date(),
                    critical: true
                });
                result.success = false;
            }
        }

        // Fase 2: Procesar audio
        if (config.audio.enabled) {
            try {
                result.audio = await this.processAudio(config);
            } catch (error: any) {
                errors.push({
                    phase: 'audio',
                    message: error.message,
                    timestamp: new Date(),
                    critical: false
                });
            }
        }

        // Fase 3: Procesar subtítulos
        if (config.subtitles.enabled) {
            try {
                result.subtitles = await this.processSubtitles(config);
            } catch (error: any) {
                errors.push({
                    phase: 'subtitles',
                    message: error.message,
                    timestamp: new Date(),
                    critical: false
                });
            }
        }

        // Fase 4: Generar master playlist
        if (result.video && result.audio) {
            try {
                result.video.masterPlaylistPath = await this.generateMasterPlaylist(
                    config,
                    result
                );
            } catch (error: any) {
                errors.push({
                    phase: 'general',
                    message: `Master playlist generation failed: ${error.message}`,
                    timestamp: new Date(),
                    critical: false
                });
            }
        }

        // Calcular metadata final
        result.metadata.endTime = new Date();
        result.metadata.totalProcessingTime = Date.now() - this.startTime;
        result.metadata.totalSize = await this.calculateTotalSize(config.outputBaseDir);
        result.errors = errors;

        this.emit('complete', result);

        return result;
    }

    // ==================== PROCESAMIENTO POR FASE ====================

    /**
     * Procesa video en múltiples calidades
     */
    private async processVideo(
        config: OrchestratorConfig
    ): Promise<{ qualities: SegmentationResult[]; masterPlaylistPath?: string }> {
        this.emit('phase-start', 'video', config.video.resolutions.length);

        const videoDir = path.join(config.outputBaseDir, 'video');
        await fs.ensureDir(videoDir);

        const qualities = await this.segmentationManager.segmentMultipleQualities(
            config.inputPath,
            videoDir,
            config.video.resolutions,
            {
                preset: config.video.preset || 'fast',
                audioQuality: config.audio.quality || 'medium',
                parallel: config.video.parallel || false
            }
        );

        this.emit('phase-complete', 'video', qualities.length);

        return { qualities };
    }

    /**
     * Procesa pistas de audio
     */
    private async processAudio(
        config: OrchestratorConfig
    ): Promise<{ tracks: ProcessedAudioTrack[]; defaultTrack?: ProcessedAudioTrack }> {
        this.emit('phase-start', 'audio');

        const audioDir = path.join(config.outputBaseDir, 'audio');
        await fs.ensureDir(audioDir);

        const audioConfig: AudioProcessingConfig = {
            outputDir: audioDir,
            extractAll: config.audio.extractAll || false,
            languages: config.audio.languages,
            targetCodec: 'aac',
            targetBitrate: this.getAudioBitrate(config.audio.quality),
            targetSampleRate: 48000,
            targetChannels: 2,
            generateHLS: config.audio.generateHLS !== false,
            segmentDuration: config.video.segmentDuration || 6
        };

        const result = await this.audioProcessor.processAudioTracks(
            config.inputPath,
            audioConfig
        );

        this.emit('phase-complete', 'audio', result.tracks.length);

        return {
            tracks: result.tracks,
            defaultTrack: result.defaultTrack
        };
    }

    /**
     * Procesa subtítulos
     */
    private async processSubtitles(
        config: OrchestratorConfig
    ): Promise<{ tracks: ProcessedSubtitle[]; defaultTrack?: ProcessedSubtitle }> {
        this.emit('phase-start', 'subtitles');

        const subtitlesDir = path.join(config.outputBaseDir, 'subtitles');
        await fs.ensureDir(subtitlesDir);

        const subtitleConfig: SubtitleProcessorConfig = {
            outputDir: subtitlesDir,
            saveOriginal: true,
            generateWebVTT: config.subtitles.generateWebVTT || false
        };

        const tracks: ProcessedSubtitle[] = [];

        // Extraer subtítulos embebidos
        if (config.subtitles.extractEmbedded) {
            const embedded = await this.subtitleProcessor.extractEmbeddedSubtitles(
                config.inputPath,
                subtitleConfig,
                {
                    extractAll: true,
                    languages: config.subtitles.languages,
                    includeForced: true
                }
            );
            tracks.push(...embedded);
        }

        // Procesar subtítulos externos
        if (config.subtitles.externalFiles) {
            for (const external of config.subtitles.externalFiles) {
                const processed = await this.subtitleProcessor.processExternalSubtitle(
                    external.path,
                    external.language,
                    subtitleConfig
                );
                tracks.push(processed);
            }
        }

        const defaultTrack = tracks.find(t => t.metadata.isDefault) || tracks[0];

        this.emit('phase-complete', 'subtitles', tracks.length);

        return { tracks, defaultTrack };
    }

    // ==================== MASTER PLAYLIST ====================

    /**
     * Genera master playlist que incluye todas las calidades, audios y subtítulos
     */
    private async generateMasterPlaylist(
        config: OrchestratorConfig,
        result: OrchestratorResult
    ): Promise<string> {
        const masterPath = path.join(config.outputBaseDir, 'master.m3u8');
        
        let content = '#EXTM3U\n';
        content += '#EXT-X-VERSION:4\n\n';

        // Agregar variantes de video
        if (result.video) {
            for (const quality of result.video.qualities) {
                const resolution = config.video.resolutions.find(r => 
                    quality.playlistPath.includes(r.name)
                );
                
                if (resolution) {
                    const bitrate = parseInt(resolution.bitrate.replace('k', '')) * 1000;
                    const relativePath = path.relative(
                        config.outputBaseDir,
                        quality.playlistPath
                    ).replace(/\\/g, '/');

                    content += `#EXT-X-STREAM-INF:BANDWIDTH=${bitrate},RESOLUTION=${resolution.width}x${resolution.height}\n`;
                    content += `${relativePath}\n\n`;
                }
            }
        }

        // Agregar pistas de audio alternativas
        if (result.audio && result.audio.tracks.length > 1) {
            content += '# Audio tracks\n';
            for (const track of result.audio.tracks) {
                if (track.hlsPlaylistPath) {
                    const relativePath = path.relative(
                        config.outputBaseDir,
                        track.hlsPlaylistPath
                    ).replace(/\\/g, '/');

                    const isDefault = track === result.audio.defaultTrack;
                    content += `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="${track.original.languageName}",LANGUAGE="${track.original.language}",${isDefault ? 'DEFAULT=YES,' : ''}URI="${relativePath}"\n`;
                }
            }
            content += '\n';
        }

        // Agregar subtítulos
        if (result.subtitles && result.subtitles.tracks.length > 0) {
            content += '# Subtitles\n';
            for (const track of result.subtitles.tracks) {
                // Use either webvtt playlist or direct .vtt file
                const subtitlePath = track.webvttPlaylistPath || track.webvttPath;
                
                if (subtitlePath) {
                    const relativePath = path.relative(
                        config.outputBaseDir,
                        subtitlePath
                    ).replace(/\\/g, '/');

                    const isDefault = track === result.subtitles.defaultTrack;
                    content += `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="${track.languageName}",LANGUAGE="${track.language}",${isDefault ? 'DEFAULT=YES,' : ''}URI="${relativePath}"\n`;
                }
            }
        }

        await fs.writeFile(masterPath, content, 'utf8');
        
        return masterPath;
    }

    // ==================== EVENT FORWARDING ====================

    /**
     * Configura reenvío de eventos de procesadores internos
     */
    private setupEventForwarding(): void {
        // Eventos de video
        this.segmentationManager.on('quality-progress', (data) => {
            const globalPercent = data.globalPercent * this.phaseWeights.video;
            
            this.emit('progress', {
                phase: 'video',
                phasePercent: data.qualityPercent,
                globalPercent,
                currentItem: data.quality,
                totalItems: data.totalQualities
            } as OrchestratorProgress);
        });

        // Eventos de audio
        this.audioProcessor.on('progress', (data) => {
            const basePercent = this.phaseWeights.video * 100;
            const phasePercent = data.percent;
            const globalPercent = basePercent + (phasePercent * this.phaseWeights.audio);
            
            this.emit('progress', {
                phase: 'audio',
                phasePercent,
                globalPercent,
                currentItem: data.trackLanguage
            } as OrchestratorProgress);
        });

        // Eventos de subtítulos
        this.subtitleProcessor.on('extracting', (language) => {
            const basePercent = (this.phaseWeights.video + this.phaseWeights.audio) * 100;
            
            this.emit('progress', {
                phase: 'subtitles',
                phasePercent: 0,
                globalPercent: basePercent,
                currentItem: language
            } as OrchestratorProgress);
        });
    }

    // ==================== UTILIDADES ====================

    private getAudioBitrate(quality?: 'low' | 'medium' | 'high' | 'premium'): string {
        const bitrates = {
            low: '64k',
            medium: '128k',
            high: '192k',
            premium: '256k'
        };
        return bitrates[quality || 'medium'];
    }

    private async calculateTotalSize(directory: string): Promise<number> {
        let totalSize = 0;
        
        const walk = async (dir: string) => {
            const files = await fs.readdir(dir);
            
            for (const file of files) {
                const filePath = path.join(dir, file);
                const stat = await fs.stat(filePath);
                
                if (stat.isDirectory()) {
                    await walk(filePath);
                } else {
                    totalSize += stat.size;
                }
            }
        };
        
        await walk(directory);
        return totalSize;
    }

    /**
     * Calcula tiempo estimado total basado en duración del video
     */
    async estimateProcessingTime(
        inputPath: string,
        config: OrchestratorConfig
    ): Promise<number> {
        const { FFmpegCommand } = await import('../FFmpegCommand');
        const probeData = await FFmpegCommand.probe(inputPath, {
            ffprobePath: this.ffprobePath
        });
        
        const duration = probeData.format.duration || 0;
        const qualityCount = config.video.resolutions.length;
        
        // Estimación muy aproximada: 0.5x realtime por calidad
        const estimatedSeconds = duration * qualityCount * 0.5;
        
        return estimatedSeconds * 1000; // ms
    }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Crea configuración por defecto
 */
export function createDefaultOrchestratorConfig(
    inputPath: string,
    outputBaseDir: string,
    resolutions: Resolution[]
): OrchestratorConfig {
    return {
        inputPath,
        outputBaseDir,
        video: {
            enabled: true,
            resolutions,
            preset: 'fast',
            segmentDuration: 6,
            parallel: false
        },
        audio: {
            enabled: true,
            extractAll: false,
            quality: 'medium',
            generateHLS: true
        },
        subtitles: {
            enabled: true,
            extractEmbedded: true,
            generateWebVTT: false
        }
    };
}

/**
 * Crea configuración para streaming adaptativo completo
 */
export function createStreamingConfig(
    inputPath: string,
    outputBaseDir: string,
    resolutions: Resolution[],
    options?: {
        multiAudio?: boolean;
        languages?: string[];
        preset?: 'fast' | 'medium';
    }
): OrchestratorConfig {
    return {
        inputPath,
        outputBaseDir,
        video: {
            enabled: true,
            resolutions,
            preset: options?.preset || 'fast',
            segmentDuration: 6,
            parallel: false
        },
        audio: {
            enabled: true,
            extractAll: options?.multiAudio || false,
            languages: options?.languages,
            quality: 'high',
            generateHLS: true
        },
        subtitles: {
            enabled: true,
            extractEmbedded: true,
            languages: options?.languages,
            generateWebVTT: true
        }
    };
}

export default VideoProcessingOrchestrator;