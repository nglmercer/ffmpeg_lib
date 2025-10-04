import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs-extra';

// ==================== INTERFACES ====================

/**
 * Tipo de medio detectado
 */
export enum MediaType {
    VIDEO = 'video',    
    AUDIO = 'audio',
    IMAGE = 'image',
    SUBTITLE = 'subtitle',
    UNKNOWN = 'unknown'
}

/**
 * Información de un stream individual
 */
export interface StreamInfo {
    index: number;
    codecName: string;
    codecLongName: string;
    codecType: MediaType;
    profile?: string;
    width?: number;
    height?: number;
    pixelFormat?: string;
    sampleRate?: number;
    channels?: number;
    channelLayout?: string;
    bitrate?: number;
    duration?: number;
    frameRate?: string;
    bitDepth?: number;
    colorSpace?: string;
    language?: string;
    tags?: Record<string, string>;
    disposition?: Record<string, number>;
}

/**
 * Información del formato del archivo
 */
export interface FormatInfo {
    filename: string;
    formatName: string;
    formatLongName: string;
    duration: number;
    size: number;
    bitrate: number;
    probeScore: number;
    tags?: Record<string, string>;
}

/**
 * Metadatos completos del archivo multimedia
 */
export interface MediaMetadata {
    // Información básica
    filePath: string;
    fileName: string;
    fileSize: number;
    fileExtension: string;
    
    // Tipo detectado
    mediaType: MediaType;
    
    // Formato
    format: FormatInfo;
    
    // Streams
    streams: StreamInfo[];
    videoStreams: StreamInfo[];
    audioStreams: StreamInfo[];
    subtitleStreams: StreamInfo[];
    
    // Información consolidada (del stream principal)
    primaryVideo?: {
        codec: string;
        resolution: string;
        width: number;
        height: number;
        aspectRatio: string;
        frameRate: string;
        bitrate?: number;
        pixelFormat?: string;
        colorSpace?: string;
    };
    
    primaryAudio?: {
        codec: string;
        sampleRate: number;
        channels: number;
        channelLayout: string;
        bitrate?: number;
        language?: string;
    };
    
    // Duración y tamaño
    duration: number;
    durationFormatted: string;
    
    // Metadatos adicionales (tags)
    metadata: Record<string, string>;
    
    // Timestamps
    createdAt?: Date;
    modifiedAt?: Date;
}

/**
 * Opciones para la extracción de metadatos
 */
export interface MetadataOptions {
    includeThumbnail?: boolean;
    includeChapters?: boolean;
    timeout?: number; // Timeout en milisegundos
}

// ==================== CLASE PRINCIPAL ====================

export class MediaMetadataExtractor {
    private ffprobePath: string;

    constructor(ffprobePath: string) {
        if (!ffprobePath) {
            throw new Error('FFprobe path is required');
        }
        this.ffprobePath = ffprobePath;
    }

    /**
     * Extrae metadatos completos de un archivo multimedia
     */
    async extractMetadata(
        filePath: string, 
        options: MetadataOptions = {}
    ): Promise<MediaMetadata> {
        // Validar que el archivo existe
        if (!await fs.pathExists(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        // Obtener información del archivo
        const stats = await fs.stat(filePath);
        const fileName = path.basename(filePath);
        const fileExtension = path.extname(filePath).toLowerCase().slice(1);

        // Ejecutar ffprobe
        const probeData = await this.runFFprobe(filePath, options.timeout);

        // Procesar streams
        const streams = this.parseStreams(probeData.streams || []);
        const videoStreams = streams.filter(s => s.codecType === MediaType.VIDEO);
        const audioStreams = streams.filter(s => s.codecType === MediaType.AUDIO);
        const subtitleStreams = streams.filter(s => s.codecType === MediaType.SUBTITLE);

        // Detectar tipo de medio principal
        const mediaType = this.detectMediaType(videoStreams, audioStreams, fileExtension);

        // Parsear formato
        const format = this.parseFormat(probeData.format, filePath);

        // Construir metadata
        const metadata: MediaMetadata = {
            filePath,
            fileName,
            fileSize: stats.size,
            fileExtension,
            mediaType,
            format,
            streams,
            videoStreams,
            audioStreams,
            subtitleStreams,
            duration: format.duration,
            durationFormatted: this.formatDuration(format.duration),
            metadata: format.tags || {},
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime
        };

        // Agregar información del video principal
        if (videoStreams.length > 0) {
            metadata.primaryVideo = this.extractPrimaryVideoInfo(videoStreams[0]);
        }

        // Agregar información del audio principal
        if (audioStreams.length > 0) {
            metadata.primaryAudio = this.extractPrimaryAudioInfo(audioStreams[0]);
        }

        return metadata;
    }

    /**
     * Ejecuta ffprobe y retorna el JSON parseado
     */
    private async runFFprobe(filePath: string, timeout: number = 30000): Promise<any> {
        const args = ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filePath];

        return await new Promise((resolve, reject) => {
            const child = spawn(this.ffprobePath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
            let stdout = '';
            let stderr = '';

            const timer = setTimeout(() => {
                // Kill the process on timeout (cross-platform safe)
                try { child.kill(); } catch {}
                reject(new Error('FFprobe failed'));
            }, Math.max(1, timeout));

            child.stdout.setEncoding('utf8');
            child.stdout.on('data', (chunk) => { stdout += chunk; });
            child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

            child.on('error', (err) => {
                clearTimeout(timer);
                reject(new Error(`FFprobe failed: ${err.message}`));
            });

            child.on('close', (code) => {
                clearTimeout(timer);
                if (code === 0) {
                    try {
                        resolve(JSON.parse(stdout || '{}'));
                    } catch (e: any) {
                        reject(new Error(`FFprobe failed: Invalid JSON output`));
                    }
                } else {
                    reject(new Error(`FFprobe failed: ${stderr || 'Unknown error'}`));
                }
            });
        });
    }

    /**
     * Parsea los streams de FFprobe
     */
    private parseStreams(streams: any[]): StreamInfo[] {
        return streams.map((stream, index) => {
            const streamInfo: StreamInfo = {
                index: stream.index ?? index,
                codecName: stream.codec_name || 'unknown',
                codecLongName: stream.codec_long_name || 'Unknown Codec',
                codecType: this.mapCodecType(stream.codec_type),
                profile: stream.profile,
                bitrate: stream.bit_rate ? parseInt(stream.bit_rate) : undefined,
                duration: stream.duration ? parseFloat(stream.duration) : undefined,
                language: stream.tags?.language,
                tags: stream.tags
            };

            // Información específica de video
            if (stream.codec_type === 'video') {
                streamInfo.width = stream.width;
                streamInfo.height = stream.height;
                streamInfo.pixelFormat = stream.pix_fmt;
                streamInfo.frameRate = stream.r_frame_rate || stream.avg_frame_rate;
                streamInfo.bitDepth = stream.bits_per_raw_sample 
                    ? parseInt(stream.bits_per_raw_sample) 
                    : undefined;
                streamInfo.colorSpace = stream.color_space;
            }

            // Información específica de audio
            if (stream.codec_type === 'audio') {
                streamInfo.sampleRate = stream.sample_rate 
                    ? parseInt(stream.sample_rate) 
                    : undefined;
                streamInfo.channels = stream.channels;
                streamInfo.channelLayout = stream.channel_layout;
            }

            return streamInfo;
        });
    }

    /**
     * Parsea información del formato
     */
    private parseFormat(format: any, filePath: string): FormatInfo {
        return {
            filename: format.filename || filePath,
            formatName: format.format_name || 'unknown',
            formatLongName: format.format_long_name || 'Unknown Format',
            duration: format.duration ? parseFloat(format.duration) : 0,
            size: format.size ? parseInt(format.size) : 0,
            bitrate: format.bit_rate ? parseInt(format.bit_rate) : 0,
            probeScore: format.probe_score || 0,
            tags: format.tags
        };
    }

    /**
     * Detecta el tipo de medio principal
     */
    private detectMediaType(
        videoStreams: StreamInfo[], 
        audioStreams: StreamInfo[],
        extension: string
    ): MediaType {
        // Detectar por extensión primero (para imágenes)
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'svg'];
        if (imageExtensions.includes(extension)) {
            return MediaType.IMAGE;
        }

        // Detectar por streams
        if (videoStreams.length > 0) {
            // Si hay video pero no es una imagen estática de alta resolución
            return MediaType.VIDEO;
        }

        if (audioStreams.length > 0) {
            return MediaType.AUDIO;
        }

        return MediaType.UNKNOWN;
    }

    /**
     * Mapea el tipo de codec de FFprobe a MediaType
     */
    private mapCodecType(codecType: string): MediaType {
        switch (codecType?.toLowerCase()) {
            case 'video': return MediaType.VIDEO;
            case 'audio': return MediaType.AUDIO;
            case 'subtitle': return MediaType.SUBTITLE;
            default: return MediaType.UNKNOWN;
        }
    }

    /**
     * Extrae información del video principal
     */
    private extractPrimaryVideoInfo(stream: StreamInfo) {
        const width = stream.width || 0;
        const height = stream.height || 0;
        const aspectRatio = width && height 
            ? this.calculateAspectRatio(width, height) 
            : 'unknown';

        return {
            codec: stream.codecName,
            resolution: `${width}x${height}`,
            width,
            height,
            aspectRatio,
            frameRate: stream.frameRate || 'unknown',
            bitrate: stream.bitrate,
            pixelFormat: stream.pixelFormat,
            colorSpace: stream.colorSpace
        };
    }

    /**
     * Extrae información del audio principal
     */
    private extractPrimaryAudioInfo(stream: StreamInfo) {
        return {
            codec: stream.codecName,
            sampleRate: stream.sampleRate || 0,
            channels: stream.channels || 0,
            channelLayout: stream.channelLayout || 'unknown',
            bitrate: stream.bitrate,
            language: stream.language
        };
    }

    /**
     * Calcula el aspect ratio
     */
    private calculateAspectRatio(width: number, height: number): string {
        const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
        const divisor = gcd(width, height);
        return `${width / divisor}:${height / divisor}`;
    }

    /**
     * Formatea la duración en HH:MM:SS
     */
    private formatDuration(seconds: number): string {
        if (!seconds || seconds < 0) return '00:00:00';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        return [hours, minutes, secs]
            .map(v => v.toString().padStart(2, '0'))
            .join(':');
    }

    /**
     * Método rápido para solo obtener el tipo de archivo
     */
    async getMediaType(filePath: string): Promise<MediaType> {
        const extension = path.extname(filePath).toLowerCase().slice(1);
        
        // Check rápido por extensión
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff'];
        if (imageExtensions.includes(extension)) {
            return MediaType.IMAGE;
        }

        try {
            const probeData = await this.runFFprobe(filePath, 5000);
            const streams = probeData.streams || [];
            
            const hasVideo = streams.some((s: any) => s.codec_type === 'video');
            const hasAudio = streams.some((s: any) => s.codec_type === 'audio');
            
            if (hasVideo) return MediaType.VIDEO;
            if (hasAudio) return MediaType.AUDIO;
            
            return MediaType.UNKNOWN;
        } catch {
            return MediaType.UNKNOWN;
        }
    }

    /**
     * Verifica si un archivo es un video válido
     */
    async isVideo(filePath: string): Promise<boolean> {
        const type = await this.getMediaType(filePath);
        return type === MediaType.VIDEO;
    }

    /**
     * Verifica si un archivo es un audio válido
     */
    async isAudio(filePath: string): Promise<boolean> {
        const type = await this.getMediaType(filePath);
        return type === MediaType.AUDIO;
    }

    /**
     * Verifica si un archivo es una imagen válida
     */
    async isImage(filePath: string): Promise<boolean> {
        const type = await this.getMediaType(filePath);
        return type === MediaType.IMAGE;
    }

    /**
     * Obtiene solo información básica (más rápido)
     */
    async getBasicInfo(filePath: string): Promise<{
        type: MediaType;
        duration: number;
        size: number;
        format: string;
    }> {
        const probeData = await this.runFFprobe(filePath, 5000);
        const format = probeData.format || {};
        
        const streams = probeData.streams || [];
        const hasVideo = streams.some((s: any) => s.codec_type === 'video');
        const hasAudio = streams.some((s: any) => s.codec_type === 'audio');
        
        let type = MediaType.UNKNOWN;
        if (hasVideo) type = MediaType.VIDEO;
        else if (hasAudio) type = MediaType.AUDIO;
        
        return {
            type,
            duration: format.duration ? parseFloat(format.duration) : 0,
            size: format.size ? parseInt(format.size) : 0,
            format: format.format_name || 'unknown'
        };
    }
}

// ==================== UTILIDADES ====================

/**
 * Formatea el tamaño del archivo en formato legible
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Formatea el bitrate en formato legible
 */
export function formatBitrate(bps: number): string {
    if (bps === 0) return '0 bps';
    
    const k = 1000;
    const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps'];
    const i = Math.floor(Math.log(bps) / Math.log(k));
    
    return parseFloat((bps / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default MediaMetadataExtractor;