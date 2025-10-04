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
export class HLSSegmentationManager extends EventEmitter {
    private ffmpegPath: string;
    private ffprobePath: string;

    constructor(ffmpegPath: string, ffprobePath: string) {
        super();
        this.ffmpegPath = ffmpegPath;
        this.ffprobePath = ffprobePath;
    }

    // ==================== SEGMENTACIÓN PRINCIPAL ====================

    /**
     * Segmenta un video en formato HLS
     */
    async segmentVideo(
        inputPath: string,
        config: HLSSegmentationConfig,
        options: SegmentationOptions = {}
    ): Promise<SegmentationResult> {
        // Validar entrada
        if (!await fs.pathExists(inputPath)) {
            throw new Error(`Input file not found: ${inputPath}`);
        }

        // Crear directorio de salida
        await fs.ensureDir(config.outputDir);

        // Construir rutas
        const playlistPath = path.join(config.outputDir, config.playlistName);
        const segmentPath = path.join(config.outputDir, config.segmentPattern);

        // Crear comando FFmpeg
        const cmd = new FFmpegCommand({
            ffmpegPath: this.ffmpegPath,
            ffprobePath: this.ffprobePath
        });

        cmd.input(inputPath);
        cmd.outputOptions(['-sn']);
        // Aplicar opciones de tiempo
        if (options.startTime !== undefined) {
            cmd.seekInput(options.startTime);
        }

        if (options.duration !== undefined) {
            cmd.duration(options.duration);
        }

        // Configurar video
        if (options.video) {
            this.applyVideoConfig(cmd, options.video);
        }

        // Configurar audio
        if (options.audio) {
            this.applyAudioConfig(cmd, options.audio);
        } else {
            // Audio por defecto
            cmd.audioCodec('aac')
               .audioBitrate('128k')
               .audioChannels(2);
        }

        // Aplicar resolución
        if (options.resolution) {
            cmd.size(`${options.resolution.width}x${options.resolution.height}`);
        }

        // Aplicar framerate
        if (options.frameRate) {
            cmd.fps(options.frameRate);
        }

        // Configurar HLS
        this.configureHLS(cmd, config, segmentPath);

        // Output
        cmd.output(playlistPath);

        // Eventos de progreso
        cmd.on('progress', (progress) => {
            this.emit('progress', this.parseProgress(progress, config));
        });

        cmd.on('start', (command) => {
            this.emit('start', command);
        });

        // Ejecutar
        await cmd.run();

        // Recopilar resultado
        return await this.collectSegmentationResult(config, playlistPath);
    }

    /**
     * Aplica configuración de video
     */
    private applyVideoConfig(cmd: FFmpegCommand, config: VideoSegmentConfig): void {
        cmd.videoCodec(config.codec);
        cmd.videoBitrate(config.bitrate);
        
        const outputOpts: string[] = [];

        // Preset
        outputOpts.push('-preset', config.preset);

        // Profile y level
        outputOpts.push('-profile:v', config.profile);
        if (config.level) {
            outputOpts.push('-level:v', config.level);
        }

        // GOP size (keyframe interval)
        if (config.gopSize) {
            outputOpts.push('-g', config.gopSize.toString());
        }

        // B-frames
        if (config.bFrames !== undefined) {
            outputOpts.push('-bf', config.bFrames.toString());
        }

        // Pixel format
        if (config.pixelFormat) {
            outputOpts.push('-pix_fmt', config.pixelFormat);
        }

        // Rate control
        if (config.maxBitrate) {
            outputOpts.push('-maxrate', config.maxBitrate);
        }

        if (config.bufferSize) {
            outputOpts.push('-bufsize', config.bufferSize);
        }

        // Flags para streaming
        outputOpts.push('-movflags', '+faststart');
        outputOpts.push('-sc_threshold', '0'); // Deshabilitar scene change detection

        cmd.outputOptions(outputOpts);
    }

    /**
     * Aplica configuración de audio
     */
    private applyAudioConfig(cmd: FFmpegCommand, config: AudioSegmentConfig): void {
        cmd.audioCodec(config.codec);
        cmd.audioBitrate(config.bitrate);
        cmd.audioChannels(config.channels);
        cmd.audioFrequency(config.sampleRate);

        if (config.profile) {
            cmd.outputOptions(['-profile:a', config.profile]);
        }
    }

    /**
     * Configura opciones de HLS
     */
    private configureHLS(
        cmd: FFmpegCommand,
        config: HLSSegmentationConfig,
        segmentPath: string
    ): void {
        const hlsOpts: string[] = [
            '-f', 'hls',
            '-hls_time', config.segmentDuration.toString(),
            '-hls_list_size', '0',  // Incluir todos los segmentos
            '-hls_segment_type', 'mpegts',
            '-hls_segment_filename', segmentPath
        ];

        // Flags adicionales
        const flags = config.hlsFlags || ['delete_segments'];
        hlsOpts.push('-hls_flags', flags.join('+'));

        cmd.outputOptions(hlsOpts);
    }

    // ==================== SEGMENTACIÓN DE AUDIO SEPARADO ====================

    /**
     * Segmenta solo audio (para pistas alternativas)
     */
    async segmentAudio(
        inputPath: string,
        config: HLSSegmentationConfig,
        audioConfig: AudioSegmentConfig,
        streamIndex?: number
    ): Promise<SegmentationResult> {
        await fs.ensureDir(config.outputDir);

        const playlistPath = path.join(config.outputDir, config.playlistName);
        const segmentPath = path.join(config.outputDir, config.segmentPattern);

        const cmd = new FFmpegCommand({
            ffmpegPath: this.ffmpegPath,
            ffprobePath: this.ffprobePath
        });

        cmd.input(inputPath);

        // Seleccionar stream de audio específico
        if (streamIndex !== undefined) {
            cmd.outputOptions(['-map', `0:a:${streamIndex}`]);
        }

        // Sin video
        cmd.noVideo();

        // Configurar audio
        this.applyAudioConfig(cmd, audioConfig);

        // Configurar HLS
        this.configureHLS(cmd, config, segmentPath);

        cmd.output(playlistPath);

        // Eventos
        cmd.on('progress', (progress) => {
            this.emit('progress', this.parseProgress(progress, config));
        });

        await cmd.run();

        return await this.collectSegmentationResult(config, playlistPath);
    }

    // ==================== UTILIDADES ====================

    /**
     * Recopila información del resultado de segmentación
     */
    private async collectSegmentationResult(
        config: HLSSegmentationConfig,
        playlistPath: string
    ): Promise<SegmentationResult> {
        // Leer playlist para obtener segmentos
        const playlistContent = await fs.readFile(playlistPath, 'utf8');
        const segments = this.parsePlaylistSegments(playlistContent);

        // Recopilar rutas de segmentos
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

        // Calcular duración total
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

    /**
     * Parsea segmentos del playlist
     */
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
     * Parsea progreso para emitir eventos más informativos
     */
    private parseProgress(progress: any, config: HLSSegmentationConfig): SegmentationProgress {
        const percent = progress.percent || 0;
        const estimatedSegments = Math.ceil(progress.targetSize / config.segmentDuration);
        const currentSegment = Math.floor((percent / 100) * estimatedSegments);

        return {
            percent: Math.min(100, Math.max(0, percent)),
            currentSegment,
            totalSegments: estimatedSegments,
            fps: progress.currentFps || 0,
            speed: `${(progress.currentFps / 30).toFixed(1)}x`,
            bitrate: `${progress.currentKbps}kbps`,
            timeProcessed: progress.timemark || '00:00:00',
            eta: this.calculateETA(percent, progress.timemark)
        };
    }

    /**
     * Calcula tiempo estimado restante
     */
    private calculateETA(percent: number, timemark: string): string {
        if (percent <= 0 || !timemark) return 'unknown';
        
        const parts = timemark.split(':');
        const seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
        const totalSeconds = (seconds / percent) * 100;
        const remaining = totalSeconds - seconds;

        const hours = Math.floor(remaining / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);
        const secs = Math.floor(remaining % 60);

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // ==================== MÉTODOS DE CONVENIENCIA ====================

    /**
     * Crea configuración de video según calidad
     */
    static createVideoConfig(
        resolution: Resolution,
        preset: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' = 'fast'
    ): VideoSegmentConfig {
        const height = resolution.height;
        
        // Detectar profile
        let profile: 'baseline' | 'main' | 'high';
        if (height >= 1080) profile = 'high';
        else if (height >= 720) profile = 'main';
        else profile = 'baseline';

        // GOP size: 2 segundos a 30fps = 60 frames
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

    /**
     * Crea configuración de audio según calidad
     */
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
     * Segmenta múltiples calidades en paralelo
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

        const tasks = resolutions.map(async (resolution) => {
            const outputDir = path.join(outputBaseDir, 'video');
            
            const config: HLSSegmentationConfig = {
                segmentDuration: 6,
                segmentPattern: `${resolution.name}_segment_%03d.ts`,
                playlistName: `quality_${resolution.name}.m3u8`,
                outputDir
            };

            const videoConfig = HLSSegmentationManager.createVideoConfig(resolution, preset);
            const audioConfig = HLSSegmentationManager.createAudioConfig(audioQuality);

            this.emit('quality-start', resolution.name);

            const result = await this.segmentVideo(inputPath, config, {
                video: videoConfig,
                audio: audioConfig,
                resolution
            });

            this.emit('quality-complete', resolution.name, result);

            return result;
        });

        if (options?.parallel) {
            results.push(...await Promise.all(tasks));
        } else {
            for (const task of tasks) {
                results.push(await task);
            }
        }

        return results;
    }
}

export default HLSSegmentationManager;