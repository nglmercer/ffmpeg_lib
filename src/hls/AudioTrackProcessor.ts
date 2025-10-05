import { FFmpegCommand } from '../FFmpegCommand';
import { HLSSegmentationManager } from './HLSSegmentationManager';
import type { AudioSegmentConfig } from './types';
import fs from 'fs-extra';
import path from 'path';
import { EventEmitter } from 'events';
import type {
  AudioTrackInfo,
  AudioProcessingConfig,
  ProcessedAudioTrack,
  AudioProcessingResult,
  AudioProcessingError,
  AudioQualityPreset
} from './types';

// ==================== TIPOS DE EVENTOS ====================

export interface AudioProcessingProgress {
    type: 'audio-processing';
    percent: number;
    currentTrack: number;
    totalTracks: number;
    trackLanguage: string;
    phase: 'extraction' | 'conversion' | 'segmentation';
    timeProcessed?: string;
    eta?: string;
}

export interface AudioProcessingStartEvent {
    type: 'audio-processing';
    totalTracks: number;
    config: AudioProcessingConfig;
}

export interface AudioProcessingCompleteEvent {
    type: 'audio-processing';
    success: boolean;
    result: AudioProcessingResult;
    duration: number;
}

// ==================== CLASE PRINCIPAL ====================

export class AudioTrackProcessor extends EventEmitter {
    private ffmpegPath: string;
    private ffprobePath: string;
    private segmentationManager: HLSSegmentationManager;
    private startTime: number = 0;

    constructor(ffmpegPath: string, ffprobePath: string) {
        super();
        this.ffmpegPath = ffmpegPath;
        this.ffprobePath = ffprobePath;
        this.segmentationManager = new HLSSegmentationManager(ffmpegPath, ffprobePath);
        
        // Propagar eventos de segmentación con prefijo
        this.segmentationManager.on('progress', (data) => {
            this.emit('hls-progress', data);
        });
    }

    // ==================== DETECCIÓN ====================

    /**
     * Detecta todas las pistas de audio en un video
     */
    async detectAudioTracks(inputPath: string): Promise<AudioTrackInfo[]> {
        const probeData = await FFmpegCommand.probe(inputPath, {
            ffprobePath: this.ffprobePath
        });

        const audioTracks: AudioTrackInfo[] = [];
        let audioStreamIndex = 0;

        for (const stream of probeData.streams) {
            if (stream.codec_type === 'audio') {
                const language = stream.tags?.language || 'und';
                
                audioTracks.push({
                    index: stream.index,
                    streamIndex: audioStreamIndex++,
                    codec: stream.codec_name,
                    codecLongName: stream.codec_long_name || stream.codec_name,
                    profile: stream.profile,
                    sampleRate: Number(stream.sample_rate) || 48000,
                    channels: stream.channels || 2,
                    channelLayout: stream.channel_layout || 'stereo',
                    bitrate: stream.bit_rate ? Number(stream.bit_rate) : undefined,
                    language,
                    languageName: this.getLanguageName(language),
                    title: stream.tags?.title,
                    isDefault: stream.disposition?.default === 1,
                    tags: stream.tags
                });
            }
        }

        return audioTracks;
    }

    /**
     * Obtiene información de la pista de audio por defecto
     */
    async getDefaultAudioTrack(inputPath: string): Promise<AudioTrackInfo | null> {
        const tracks = await this.detectAudioTracks(inputPath);
        
        // Buscar pista marcada como default
        const defaultTrack = tracks.find(t => t.isDefault);
        if (defaultTrack) return defaultTrack;
        
        // Si no hay default, retornar la primera
        return tracks.length > 0 ? tracks[0] : null;
    }

    // ==================== EXTRACCIÓN Y PROCESAMIENTO ====================

    /**
     * Procesa todas las pistas de audio según configuración
     */
    async processAudioTracks(
        inputPath: string,
        config: AudioProcessingConfig
    ): Promise<AudioProcessingResult> {
        this.startTime = Date.now();
        const errors: AudioProcessingError[] = [];

        // Detectar pistas
        const allTracks = await this.detectAudioTracks(inputPath);
        
        if (allTracks.length === 0) {
            this.emit('info', 'No audio tracks found');
            const result: AudioProcessingResult = {
                success: true,
                tracks: [],
                errors: [],
                totalSize: 0,
                totalProcessingTime: 0
            };
            this.emit('complete', this.createCompleteEvent(result, true));
            return result;
        }

        // Filtrar pistas según configuración
        let tracksToProcess = allTracks;

        if (!config.extractAll) {
            const defaultTrack = allTracks.find(t => t.isDefault) || allTracks[0];
            tracksToProcess = [defaultTrack];
        } else if (config.languages && config.languages.length > 0) {
            tracksToProcess = allTracks.filter(t => 
                config.languages!.includes(t.language)
            );
        }

        // Emitir evento de inicio
        const startEvent: AudioProcessingStartEvent = {
            type: 'audio-processing',
            totalTracks: tracksToProcess.length,
            config
        };
        this.emit('start', startEvent);
        this.emit('tracks-detected', tracksToProcess.length, allTracks.length);

        // Procesar cada pista
        const processedTracks: ProcessedAudioTrack[] = [];

        for (let i = 0; i < tracksToProcess.length; i++) {
            const track = tracksToProcess[i];
            
            try {
                this.emit('track-start', track.language, track.streamIndex);
                
                const processed = await this.processSingleTrack(
                    inputPath,
                    track,
                    config,
                    i,
                    tracksToProcess.length
                );

                processedTracks.push(processed);
                
                this.emit('track-complete', track.language, processed);
                
                // Emitir progreso de track completado
                const trackProgress: AudioProcessingProgress = {
                    type: 'audio-processing',
                    percent: ((i + 1) / tracksToProcess.length) * 100,
                    currentTrack: i + 1,
                    totalTracks: tracksToProcess.length,
                    trackLanguage: track.language,
                    phase: 'conversion'
                };
                this.emit('progress', trackProgress);
                
            } catch (error: any) {
                errors.push({
                    trackIndex: track.index,
                    language: track.language,
                    error: error.message,
                    timestamp: new Date()
                });
                
                this.emit('track-error', track.language, error.message);
            }
        }

        // Identificar pista por defecto
        const defaultTrack = processedTracks.find(t => t.original.isDefault) || processedTracks[0];

        // Calcular tamaño total
        const totalSize = processedTracks.reduce((sum, t) => sum + t.size, 0);
        const totalProcessingTime = Date.now() - this.startTime;

        const result: AudioProcessingResult = {
            success: errors.length === 0,
            tracks: processedTracks,
            defaultTrack,
            errors,
            totalSize,
            totalProcessingTime
        };

        // Emitir evento de completado
        this.emit('complete', this.createCompleteEvent(result, errors.length === 0));

        return result;
    }

    /**
     * Procesa una pista de audio individual
     */
    private async processSingleTrack(
        inputPath: string,
        track: AudioTrackInfo,
        config: AudioProcessingConfig,
        currentIndex: number,
        totalTracks: number
    ): Promise<ProcessedAudioTrack> {
        const trackStartTime = Date.now();
        
        await fs.ensureDir(config.outputDir);

        // Generar nombre de archivo
        const filename = this.generateFilename(track, config);
        const audioPath = path.join(config.outputDir, filename);

        // Emitir progreso: extracción
        this.emitTrackProgress(currentIndex, totalTracks, track.language, 'extraction', 0);

        // Extraer y convertir audio
        await this.extractAndConvertAudio(
            inputPath,
            track,
            audioPath,
            config,
            (percent) => {
                this.emitTrackProgress(
                    currentIndex,
                    totalTracks,
                    track.language,
                    'conversion',
                    percent
                );
            }
        );

        const stats = await fs.stat(audioPath);

        const result: ProcessedAudioTrack = {
            original: track,
            audioPath,
            format: config.targetCodec,
            size: stats.size,
            metadata: {
                processingTime: Date.now() - trackStartTime,
                originalCodec: track.codec,
                targetCodec: config.targetCodec,
                originalBitrate: track.bitrate,
                targetBitrate: config.targetBitrate
            }
        };

        // Generar segmentos HLS si está habilitado
        if (config.generateHLS) {
            this.emitTrackProgress(currentIndex, totalTracks, track.language, 'segmentation', 0);
            
            const hlsResult = await this.generateHLSForTrack(
                audioPath,
                track,
                config
            );
            
            result.hlsPlaylistPath = hlsResult.playlistPath;
            result.hlsSegmentPaths = hlsResult.segmentPaths;
            result.hlsSegmentCount = hlsResult.segmentCount;
        }

        return result;
    }

    /**
     * Extrae y convierte audio con progreso
     */
    private async extractAndConvertAudio(
        inputPath: string,
        track: AudioTrackInfo,
        outputPath: string,
        config: AudioProcessingConfig,
        onProgress?: (percent: number) => void
    ): Promise<void> {
        const cmd = new FFmpegCommand({
            ffmpegPath: this.ffmpegPath,
            ffprobePath: this.ffprobePath
        });

        cmd.input(inputPath);

        // Seleccionar stream de audio específico
        cmd.outputOptions(['-map', `0:a:${track.streamIndex}`]);

        // Sin video
        cmd.noVideo();

        // Configurar audio
        cmd.audioCodec(config.targetCodec);
        cmd.audioBitrate(config.targetBitrate);

        if (config.targetSampleRate) {
            cmd.audioFrequency(config.targetSampleRate);
        }

        if (config.targetChannels) {
            cmd.audioChannels(config.targetChannels);
        }

        // Metadata
        const metadata: string[] = [];
        metadata.push('-metadata', `language=${track.language}`);
        if (track.title) {
            metadata.push('-metadata', `title=${track.title}`);
        }
        
        cmd.outputOptions(metadata);
        cmd.output(outputPath);

        // Capturar progreso
        if (onProgress) {
            cmd.on('progress', (progress) => {
                if (progress.percent) {
                    onProgress(progress.percent);
                }
            });
        }

        await cmd.run();
    }

    /**
     * Genera segmentos HLS para una pista de audio
     */
    private async generateHLSForTrack(
        audioPath: string,
        track: AudioTrackInfo,
        config: AudioProcessingConfig
    ): Promise<{ playlistPath: string; segmentPaths: string[]; segmentCount: number }> {
        const hlsConfig = {
            segmentDuration: config.segmentDuration || 6,
            segmentPattern: `audio_${track.language}_segment_%03d.ts`,
            playlistName: `audio_${track.language}.m3u8`,
            outputDir: config.outputDir
        };

        const audioConfig: AudioSegmentConfig = {
            codec: config.targetCodec,
            bitrate: config.targetBitrate,
            sampleRate: config.targetSampleRate || track.sampleRate,
            channels: config.targetChannels || track.channels
        };

        const result = await this.segmentationManager.segmentAudio(
            audioPath,
            hlsConfig,
            audioConfig
        );

        return {
            playlistPath: result.playlistPath,
            segmentPaths: result.segmentPaths,
            segmentCount: result.segmentCount
        };
    }

    // ==================== EXTRACCIÓN SIMPLE ====================

    /**
     * Extrae audio completo sin segmentar
     */
    async extractFullAudio(
        inputPath: string,
        outputPath: string,
        options?: {
            trackIndex?: number;
            codec?: string;
            bitrate?: string;
            sampleRate?: number;
            channels?: number;
        }
    ): Promise<void> {
        const cmd = new FFmpegCommand({
            ffmpegPath: this.ffmpegPath,
            ffprobePath: this.ffprobePath
        });

        cmd.input(inputPath);

        if (options?.trackIndex !== undefined) {
            cmd.outputOptions(['-map', `0:a:${options.trackIndex}`]);
        } else {
            cmd.outputOptions(['-map', '0:a:0']);
        }

        cmd.noVideo();
        cmd.audioCodec(options?.codec || 'aac');
        
        if (options?.bitrate) {
            cmd.audioBitrate(options.bitrate);
        }

        if (options?.sampleRate) {
            cmd.audioFrequency(options.sampleRate);
        }

        if (options?.channels) {
            cmd.audioChannels(options.channels);
        }

        cmd.output(outputPath);
        await cmd.run();
    }

    // ==================== UTILIDADES DE EVENTOS ====================

    /**
     * Emite progreso de track individual
     */
    private emitTrackProgress(
        currentTrack: number,
        totalTracks: number,
        language: string,
        phase: 'extraction' | 'conversion' | 'segmentation',
        phasePercent: number
    ): void {
        const trackBasePercent = (currentTrack / totalTracks) * 100;
        const trackRangePercent = (1 / totalTracks) * 100;
        const totalPercent = trackBasePercent + (phasePercent / 100) * trackRangePercent;

        const progress: AudioProcessingProgress = {
            type: 'audio-processing',
            percent: Math.min(100, totalPercent),
            currentTrack: currentTrack + 1,
            totalTracks,
            trackLanguage: language,
            phase
        };

        this.emit('progress', progress);
    }

    /**
     * Crea evento de completado
     */
    private createCompleteEvent(
        result: AudioProcessingResult,
        success: boolean
    ): AudioProcessingCompleteEvent {
        return {
            type: 'audio-processing',
            success,
            result,
            duration: Date.now() - this.startTime
        };
    }

    // ==================== UTILIDADES ====================

    private generateFilename(track: AudioTrackInfo, config: AudioProcessingConfig): string {
        const pattern = config.filenamePattern || 'audio_{lang}';
        const extension = this.getExtensionForCodec(config.targetCodec);
        
        let filename = pattern
            .replace('{lang}', track.language)
            .replace('{language}', track.languageName.toLowerCase())
            .replace('{index}', track.streamIndex.toString());

        return `${filename}.${extension}`;
    }

    private getExtensionForCodec(codec: string): string {
        const extMap: Record<string, string> = {
            'aac': 'm4a',
            'mp3': 'mp3',
            'opus': 'opus',
            'vorbis': 'ogg',
            'flac': 'flac',
            'ac3': 'ac3',
            'eac3': 'eac3'
        };
        return extMap[codec.toLowerCase()] || 'm4a';
    }

    private getLanguageName(code: string): string {
        const languages: Record<string, string> = {
            'en': 'English', 'es': 'Español', 'fr': 'Français',
            'de': 'Deutsch', 'it': 'Italiano', 'pt': 'Português',
            'ja': '日本語', 'zh': '中文', 'ko': '한국어',
            'ru': 'Русский', 'ar': 'العربية', 'hi': 'हिन्दी',
            'tr': 'Türkçe', 'pl': 'Polski', 'nl': 'Nederlands',
            'sv': 'Svenska', 'da': 'Dansk', 'no': 'Norsk',
            'fi': 'Suomi', 'und': 'Unknown'
        };
        return languages[code] || code.toUpperCase();
    }

    needsConversion(sourceCodec: string, targetCodec: string): boolean {
        return sourceCodec.toLowerCase() !== targetCodec.toLowerCase();
    }

    estimateAudioSize(duration: number, bitrate: string): number {
        const bitrateKbps = parseInt(bitrate.replace('k', ''));
        return (duration * bitrateKbps * 1000) / 8;
    }
}

// ==================== PRESETS DE CALIDAD ====================

export const AUDIO_QUALITY_PRESETS: Record<string, AudioQualityPreset> = {
    low: {
        name: 'Low Quality',
        bitrate: '64k',
        sampleRate: 44100,
        codec: 'aac',
        profile: 'aac_low'
    },
    medium: {
        name: 'Medium Quality',
        bitrate: '128k',
        sampleRate: 48000,
        codec: 'aac',
        profile: 'aac_low'
    },
    high: {
        name: 'High Quality',
        bitrate: '192k',
        sampleRate: 48000,
        codec: 'aac',
        profile: 'aac_low'
    },
    premium: {
        name: 'Premium Quality',
        bitrate: '256k',
        sampleRate: 48000,
        codec: 'aac',
        profile: 'aac_low'
    }
};

// ==================== HELPER FUNCTIONS ====================

export function createDefaultAudioConfig(outputDir: string): AudioProcessingConfig {
    return {
        outputDir,
        extractAll: false,
        targetCodec: 'aac',
        targetBitrate: '128k',
        targetSampleRate: 48000,
        targetChannels: 2,
        generateHLS: true,
        segmentDuration: 6
    };
}

export function createMultiLanguageAudioConfig(
    outputDir: string,
    languages: string[]
): AudioProcessingConfig {
    return {
        outputDir,
        extractAll: true,
        languages,
        targetCodec: 'aac',
        targetBitrate: '128k',
        targetSampleRate: 48000,
        targetChannels: 2,
        generateHLS: true,
        segmentDuration: 6
    };
}

export function isMultiChannelAudio(channels: number): boolean {
    return channels > 2;
}

export function getChannelLayoutDescription(layout: string): string {
    const descriptions: Record<string, string> = {
        'mono': '1.0 Mono',
        'stereo': '2.0 Stereo',
        '2.1': '2.1 Stereo + LFE',
        '5.1': '5.1 Surround',
        '5.1(side)': '5.1 Surround (Side)',
        '7.1': '7.1 Surround',
        '7.1(wide)': '7.1 Surround (Wide)'
    };
    return descriptions[layout] || layout;
}

export default AudioTrackProcessor;