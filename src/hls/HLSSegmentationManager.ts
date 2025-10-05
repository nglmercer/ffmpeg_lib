import { FFmpegCommand } from '../FFmpegCommand';
import { Resolution } from '../utils/ResolutionUtils';
import { HLSSegment } from './types';
import fs from 'fs-extra';
import path from 'path';
import { EventEmitter } from 'events';
import type {
  HLSSegmentationConfig,
  VideoSegmentConfig,
  AudioSegmentConfig,
  SegmentationOptions,
  SegmentationResult,
  SegmentationProgress
} from './types';

// ==================== TIPOS DE EVENTOS ESTANDARIZADOS ====================

export interface HLSSegmentationStartEvent {
    type: 'hls-segmentation';
    inputPath: string;
    config: HLSSegmentationConfig;
    options: SegmentationOptions;
    estimatedSegments: number;
}

export interface HLSSegmentationProgressEvent {
    type: 'hls-segmentation';
    percent: number;
    currentSegment: number;
    totalSegments: number;
    fps: number;
    speed: string;
    bitrate: string;
    timeProcessed: string;
    eta: string;
    phase: 'segmenting' | 'finalizing';
}

export interface HLSSegmentationCompleteEvent {
    type: 'hls-segmentation';
    success: boolean;
    result: SegmentationResult;
    duration: number;
}

export class HLSSegmentationManager extends EventEmitter {
    private ffmpegPath: string;
    private ffprobePath: string;
    private startTime: number = 0;
    private videoDuration: number = 0;
    private lastEmittedPercent: number = -1;
    private progressThrottle: number = 100; // ms entre emisiones

    constructor(ffmpegPath: string, ffprobePath: string) {
        super();
        this.ffmpegPath = ffmpegPath;
        this.ffprobePath = ffprobePath;
    }

    // ==================== SEGMENTACIÓN PRINCIPAL ====================

    async segmentVideo(
        inputPath: string,
        config: HLSSegmentationConfig,
        options: SegmentationOptions = {}
    ): Promise<SegmentationResult> {
        this.startTime = Date.now();
        this.lastEmittedPercent = -1;

        if (!await fs.pathExists(inputPath)) {
            throw new Error(`Input file not found: ${inputPath}`);
        }

        const probeData = await FFmpegCommand.probe(inputPath, {
            ffprobePath: this.ffprobePath
        });
        this.videoDuration = probeData.format.duration || 0;

        await fs.ensureDir(config.outputDir);

        const playlistPath = path.join(config.outputDir, config.playlistName);
        const segmentPath = path.join(config.outputDir, config.segmentPattern);
        const estimatedSegments = Math.ceil(this.videoDuration / config.segmentDuration);

        const startEvent: HLSSegmentationStartEvent = {
            type: 'hls-segmentation',
            inputPath,
            config,
            options,
            estimatedSegments
        };
        this.emit('start', startEvent);

        const cmd = new FFmpegCommand({
            ffmpegPath: this.ffmpegPath,
            ffprobePath: this.ffprobePath
        });

        cmd.input(inputPath);
        cmd.outputOptions(['-sn']);

        if (options.startTime !== undefined) {
            cmd.seekInput(options.startTime);
        }

        if (options.duration !== undefined) {
            cmd.duration(options.duration);
        }

        if (options.video) {
            this.applyVideoConfig(cmd, options.video);
        }

        if (options.audio) {
            this.applyAudioConfig(cmd, options.audio);
        } else {
            cmd.audioCodec('aac')
               .audioBitrate('128k')
               .audioChannels(2);
        }

        if (options.resolution) {
            cmd.size(`${options.resolution.width}x${options.resolution.height}`);
        }

        if (options.frameRate) {
            cmd.fps(options.frameRate);
        }

        this.configureHLS(cmd, config, segmentPath);
        cmd.output(playlistPath);

        let lastProgressTime = 0;

        cmd.on('progress', (progress) => {
            const now = Date.now();
            // Throttle: solo emitir si ha pasado suficiente tiempo
            if (now - lastProgressTime < this.progressThrottle) {
                return;
            }
            lastProgressTime = now;

            const progressEvent = this.parseProgress(progress, config, estimatedSegments);
            
            // Solo emitir si el porcentaje cambió significativamente (>0.5%)
            this.lastEmittedPercent = progressEvent.percent;
            this.emit('progress', progressEvent);
            
        });

        cmd.on('start', (command) => {
            this.emit('ffmpeg-start', command);
        });

        try {
            await cmd.run();

            // Emitir finalización solo una vez
            this.emit('progress', {
                type: 'hls-segmentation',
                percent: 100,
                currentSegment: estimatedSegments,
                totalSegments: estimatedSegments,
                fps: 0,
                speed: '1.0x',
                bitrate: '0kbps',
                timeProcessed: this.formatTime(this.videoDuration),
                eta: '00:00:00',
                phase: 'finalizing'
            } as HLSSegmentationProgressEvent);

            const result = await this.collectSegmentationResult(config, playlistPath);

            const completeEvent: HLSSegmentationCompleteEvent = {
                type: 'hls-segmentation',
                success: true,
                result,
                duration: Date.now() - this.startTime
            };
            this.emit('complete', completeEvent);

            return result;
        } catch (error: any) {
            const errorEvent: HLSSegmentationCompleteEvent = {
                type: 'hls-segmentation',
                success: false,
                result: {} as any,
                duration: Date.now() - this.startTime
            };
            this.emit('complete', errorEvent);
            throw error;
        }
    }

    private applyVideoConfig(cmd: FFmpegCommand, config: VideoSegmentConfig): void {
        cmd.videoCodec(config.codec);
        cmd.videoBitrate(config.bitrate);
        
        const outputOpts: string[] = [];
        outputOpts.push('-preset', config.preset);
        outputOpts.push('-profile:v', config.profile);
        
        if (config.level) {
            outputOpts.push('-level:v', config.level);
        }

        if (config.gopSize) {
            outputOpts.push('-g', config.gopSize.toString());
        }

        if (config.bFrames !== undefined) {
            outputOpts.push('-bf', config.bFrames.toString());
        }

        if (config.pixelFormat) {
            outputOpts.push('-pix_fmt', config.pixelFormat);
        }

        if (config.maxBitrate) {
            outputOpts.push('-maxrate', config.maxBitrate);
        }

        if (config.bufferSize) {
            outputOpts.push('-bufsize', config.bufferSize);
        }

        outputOpts.push('-movflags', '+faststart');
        outputOpts.push('-sc_threshold', '0');

        cmd.outputOptions(outputOpts);
    }

    private applyAudioConfig(cmd: FFmpegCommand, config: AudioSegmentConfig): void {
        cmd.audioCodec(config.codec);
        cmd.audioBitrate(config.bitrate);
        cmd.audioChannels(config.channels);
        cmd.audioFrequency(config.sampleRate);

        if (config.profile) {
            cmd.outputOptions(['-profile:a', config.profile]);
        }
    }

    private configureHLS(
        cmd: FFmpegCommand,
        config: HLSSegmentationConfig,
        segmentPath: string
    ): void {
        const hlsOpts: string[] = [
            '-f', 'hls',
            '-hls_time', config.segmentDuration.toString(),
            '-hls_list_size', '0',
            '-hls_segment_type', 'mpegts',
            '-hls_segment_filename', segmentPath
        ];

        const flags = config.hlsFlags || ['delete_segments'];
        hlsOpts.push('-hls_flags', flags.join('+'));

        cmd.outputOptions(hlsOpts);
    }

    // ==================== SEGMENTACIÓN DE AUDIO ====================

    async segmentAudio(
        inputPath: string,
        config: HLSSegmentationConfig,
        audioConfig: AudioSegmentConfig,
        streamIndex?: number
    ): Promise<SegmentationResult> {
        this.startTime = Date.now();
        this.lastEmittedPercent = -1;

        await fs.ensureDir(config.outputDir);

        const playlistPath = path.join(config.outputDir, config.playlistName);
        const segmentPath = path.join(config.outputDir, config.segmentPattern);

        const probeData = await FFmpegCommand.probe(inputPath, {
            ffprobePath: this.ffprobePath
        });
        this.videoDuration = probeData.format.duration || 0;
        const estimatedSegments = Math.ceil(this.videoDuration / config.segmentDuration);

        const startEvent: HLSSegmentationStartEvent = {
            type: 'hls-segmentation',
            inputPath,
            config,
            options: {},
            estimatedSegments
        };
        this.emit('start', startEvent);

        const cmd = new FFmpegCommand({
            ffmpegPath: this.ffmpegPath,
            ffprobePath: this.ffprobePath
        });

        cmd.input(inputPath);

        if (streamIndex !== undefined) {
            cmd.outputOptions(['-map', `0:a:${streamIndex}`]);
        }

        cmd.noVideo();
        this.applyAudioConfig(cmd, audioConfig);
        this.configureHLS(cmd, config, segmentPath);
        cmd.output(playlistPath);

        let lastProgressTime = 0;

        cmd.on('progress', (progress) => {
            const now = Date.now();
            if (now - lastProgressTime < this.progressThrottle) {
                return;
            }
            lastProgressTime = now;

            const progressEvent = this.parseProgress(progress, config, estimatedSegments);
            
            if (Math.abs(progressEvent.percent - this.lastEmittedPercent) > 0.5) {
                this.lastEmittedPercent = progressEvent.percent;
                this.emit('progress', progressEvent);
            }
        });

        try {
            await cmd.run();

            const result = await this.collectSegmentationResult(config, playlistPath);

            const completeEvent: HLSSegmentationCompleteEvent = {
                type: 'hls-segmentation',
                success: true,
                result,
                duration: Date.now() - this.startTime
            };
            this.emit('complete', completeEvent);

            return result;
        } catch (error: any) {
            const errorEvent: HLSSegmentationCompleteEvent = {
                type: 'hls-segmentation',
                success: false,
                result: {} as any,
                duration: Date.now() - this.startTime
            };
            this.emit('complete', errorEvent);
            throw error;
        }
    }

    // ==================== UTILIDADES ====================

    private async collectSegmentationResult(
        config: HLSSegmentationConfig,
        playlistPath: string
    ): Promise<SegmentationResult> {
        const playlistContent = await fs.readFile(playlistPath, 'utf8');
        const segments = this.parsePlaylistSegments(playlistContent);

        const segmentPaths: string[] = [];
        let totalSize = 0;

        for (const segment of segments) {
            const segmentPath = path.join(config.outputDir, segment.uri);
            if (await fs.pathExists(segmentPath)) {
                segmentPaths.push(segmentPath);
                const stats = await fs.stat(segmentPath);
                totalSize += stats.size;
            }
        }

        const duration = segments.reduce((sum, seg) => sum + seg.duration, 0);

        return {
            playlistPath,
            segmentPaths,
            segments,
            duration,
            fileSize: totalSize,
            segmentCount: segments.length
        };
    }

    private parsePlaylistSegments(content: string): HLSSegment[] {
        const segments: HLSSegment[] = [];
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('#EXTINF:')) {
                const duration = parseFloat(line.split(':')[1].split(',')[0]);
                const uri = lines[i + 1]?.trim();
                
                if (uri && !uri.startsWith('#')) {
                    segments.push({ duration, uri });
                }
            }
        }

        return segments;
    }

    /**
     * MEJORADO: Parseo más preciso y sin duplicaciones
     */
    private parseProgress(
        progress: any,
        config: HLSSegmentationConfig,
        estimatedSegments: number
    ): HLSSegmentationProgressEvent {
        // Usar el porcentaje que ya viene calculado de FFmpegCommand
        const percent = Math.min(100, Math.max(0, progress.percent || 0));
        const currentSegment = Math.floor((percent / 100) * estimatedSegments);
        
        // Calcular velocidad de forma más robusta
        const fps = progress.currentFps || 0;
        const speed = fps > 0 ? `${(fps / 30).toFixed(1)}x` : '0.0x';

        return {
            type: 'hls-segmentation',
            percent: Math.round(percent * 100) / 100, // Redondear a 2 decimales
            currentSegment,
            totalSegments: estimatedSegments,
            fps,
            speed,
            bitrate: `${Math.round(progress.currentKbps || 0)}kbps`,
            timeProcessed: progress.timemark || '00:00:00',
            eta: this.calculateETA(percent, this.startTime),
            phase: 'segmenting'
        };
    }

    /**
     * MEJORADO: Cálculo de ETA basado en tiempo transcurrido real
     */
    private calculateETA(percent: number, startTime: number): string {
        if (percent <= 0 || percent >= 100) {
            return '00:00:00';
        }
        
        const elapsed = (Date.now() - startTime) / 1000; // segundos
        const totalEstimated = (elapsed / percent) * 100;
        const remaining = Math.max(0, totalEstimated - elapsed);

        return this.formatTime(remaining);
    }

    /**
     * Formatea segundos a HH:MM:SS
     */
    private formatTime(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);

        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    // ==================== MÉTODOS DE CONVENIENCIA ====================

    static createVideoConfig(
        resolution: Resolution,
        preset: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' = 'fast'
    ): VideoSegmentConfig {
        const height = resolution.height;
        
        let profile: 'baseline' | 'main' | 'high';
        if (height >= 1080) profile = 'high';
        else if (height >= 720) profile = 'main';
        else profile = 'baseline';

        const gopSize = 60;

        return {
            codec: 'libx264',
            preset,
            profile,
            bitrate: resolution.bitrate,
            gopSize,
            bFrames: profile === 'baseline' ? 0 : 3,
            pixelFormat: 'yuv420p'
        };
    }

    static createAudioConfig(
        quality: 'low' | 'medium' | 'high' = 'medium'
    ): AudioSegmentConfig {
        const configs = {
            low: { bitrate: '64k', sampleRate: 44100 },
            medium: { bitrate: '128k', sampleRate: 48000 },
            high: { bitrate: '192k', sampleRate: 48000 }
        };

        const config = configs[quality];

        return {
            codec: 'aac',
            bitrate: config.bitrate,
            sampleRate: config.sampleRate,
            channels: 2,
            profile: 'aac_low'
        };
    }

    /**
     * MEJORADO: Tracking de progreso global sin duplicaciones
     */
    async segmentMultipleQualities(
        inputPath: string,
        outputBaseDir: string,
        resolutions: Resolution[],
        options?: {
            preset?: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium';
            audioQuality?: 'low' | 'medium' | 'high';
            parallel?: boolean;
        }
    ): Promise<SegmentationResult[]> {
        const results: SegmentationResult[] = [];
        const preset = options?.preset || 'fast';
        const audioQuality = options?.audioQuality || 'medium';
        const totalQualities = resolutions.length;

        const processQuality = async (resolution: Resolution, index: number) => {
            const outputDir = path.join(outputBaseDir, resolution.name);
            
            const config: HLSSegmentationConfig = {
                segmentDuration: 6,
                segmentPattern: `${resolution.name}_segment_%03d.ts`,
                playlistName: `quality_${resolution.name}.m3u8`,
                outputDir
            };

            const videoConfig = HLSSegmentationManager.createVideoConfig(resolution, preset);
            const audioConfig = HLSSegmentationManager.createAudioConfig(audioQuality);

            this.emit('quality-start', resolution.name, index + 1, totalQualities);

            // Crear un manager independiente para cada calidad
            const qualityManager = new HLSSegmentationManager(this.ffmpegPath, this.ffprobePath);

            // Propagar eventos de esta calidad específica
            qualityManager.on('progress', (progress: HLSSegmentationProgressEvent) => {
                const qualityBasePercent = (index / totalQualities) * 100;
                const qualityRangePercent = (1 / totalQualities) * 100;
                const globalPercent = qualityBasePercent + (progress.percent / 100) * qualityRangePercent;

                this.emit('quality-progress', {
                    quality: resolution.name,
                    qualityIndex: index + 1,
                    totalQualities,
                    qualityPercent: progress.percent,
                    globalPercent: Math.round(globalPercent * 100) / 100,
                    ...progress
                });
            });

            const result = await qualityManager.segmentVideo(inputPath, config, {
                video: videoConfig,
                audio: audioConfig,
                resolution
            });

            this.emit('quality-complete', resolution.name, index + 1, totalQualities, result);

            return result;
        };

        if (options?.parallel) {
            const tasks = resolutions.map((res, idx) => processQuality(res, idx));
            results.push(...await Promise.all(tasks));
        } else {
            for (let i = 0; i < resolutions.length; i++) {
                results.push(await processQuality(resolutions[i], i));
            }
        }

        return results;
    }
}

export default HLSSegmentationManager;