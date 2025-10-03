import fs from 'fs-extra';
import path from 'path';

// ==================== INTERFACES ====================

/**
 * Información de una variante de calidad
 */
export interface HLSVariant {
    name: string;              // "1080p", "720p", etc.
    width: number;
    height: number;
    bandwidth: number;         // bits por segundo
    videoBitrate: string;      // "5000k"
    audioBitrate: string;      // "128k"
    codec: string;             // "avc1.64001f,mp4a.40.2"
    playlistPath: string;      // "video/quality_1080p.m3u8"
    frameRate?: number;
    audioGroup?: string;       // Para audio alternativo
    subtitleGroup?: string;    // Para subtítulos
}

/**
 * Información de una pista de audio
 */
export interface HLSAudioTrack {
    id: string;                // "audio_es", "audio_en"
    name: string;              // "Español", "English"
    language: string;          // "es", "en"
    isDefault: boolean;
    channels: number;          // 2 (stereo), 1 (mono)
    bitrate: string;           // "128k"
    playlistPath: string;      // "audio/audio_es.m3u8"
    groupId: string;           // "audio"
}

/**
 * Información de un subtítulo
 */
export interface HLSSubtitle {
    id: string;                // "sub_es", "sub_en"
    name: string;              // "Español", "English"
    language: string;          // "es", "en"
    isDefault: boolean;
    isForced: boolean;         // Para subtítulos forzados
    playlistPath: string;      // "subtitles/subtitles_es.m3u8"
    vttPath: string;           // "subtitles/subtitles_es.vtt"
    groupId: string;           // "subs"
}

/**
 * Segmento de video/audio
 */
export interface HLSSegment {
    duration: number;          // Duración en segundos
    uri: string;               // "segment_000.ts"
}

/**
 * Configuración del generador
 */
export interface HLSGeneratorConfig {
    targetDuration: number;    // Duración target de segmentos (default: 6)
    version: number;           // HLS version (default: 3)
    playlistType: 'VOD' | 'EVENT';  // Tipo de playlist
    allowCache: boolean;       // Permitir cache
}

// ==================== CLASE PRINCIPAL ====================

export class HLSPlaylistGenerator {
    private config: HLSGeneratorConfig;

    constructor(config?: Partial<HLSGeneratorConfig>) {
        this.config = {
            targetDuration: config?.targetDuration || 6,
            version: config?.version || 3,
            playlistType: config?.playlistType || 'VOD',
            allowCache: config?.allowCache ?? true
        };
    }

    // ==================== MASTER PLAYLIST ====================

    /**
     * Genera el master playlist (punto de entrada principal)
     */
    generateMasterPlaylist(
        variants: HLSVariant[],
        audioTracks?: HLSAudioTrack[],
        subtitles?: HLSSubtitle[]
    ): string {
        const lines: string[] = [];

        // Header
        lines.push('#EXTM3U');
        lines.push(`#EXT-X-VERSION:${this.config.version}`);
        lines.push('');

        // Audio tracks (si existen múltiples)
        if (audioTracks && audioTracks.length > 0) {
            lines.push('# Audio tracks');
            for (const audio of audioTracks) {
                lines.push(this.generateAudioEntry(audio));
            }
            lines.push('');
        }

        // Subtítulos (si existen)
        if (subtitles && subtitles.length > 0) {
            lines.push('# Subtitles');
            for (const subtitle of subtitles) {
                lines.push(this.generateSubtitleEntry(subtitle));
            }
            lines.push('');
        }

        // Variantes de video
        lines.push('# Video variants');
        for (const variant of variants) {
            lines.push(this.generateVariantEntry(variant, audioTracks, subtitles));
            lines.push(variant.playlistPath);
            lines.push('');
        }

        return lines.join('\n');
    }

    /**
     * Genera entrada de audio en master playlist
     */
    private generateAudioEntry(audio: HLSAudioTrack): string {
        const attrs: string[] = [
            'TYPE=AUDIO',
            `GROUP-ID="${audio.groupId}"`,
            `NAME="${audio.name}"`,
            `LANGUAGE="${audio.language}"`,
            `DEFAULT=${audio.isDefault ? 'YES' : 'NO'}`,
            'AUTOSELECT=YES',
            `CHANNELS="${audio.channels}"`,
            `URI="${audio.playlistPath}"`
        ];

        return `#EXT-X-MEDIA:${attrs.join(',')}}`;
    }

    /**
     * Genera entrada de subtítulo en master playlist
     */
    private generateSubtitleEntry(subtitle: HLSSubtitle): string {
        const attrs: string[] = [
            'TYPE=SUBTITLES',
            `GROUP-ID="${subtitle.groupId}"`,
            `NAME="${subtitle.name}"`,
            `LANGUAGE="${subtitle.language}"`,
            `DEFAULT=${subtitle.isDefault ? 'YES' : 'NO'}`,
            'AUTOSELECT=YES',
            `URI="${subtitle.playlistPath}"`
        ];

        if (subtitle.isForced) {
            attrs.push('FORCED=YES');
        }

        return `#EXT-X-MEDIA:${attrs.join(',')}`;
    }

    /**
     * Genera entrada de variante de video
     */
    private generateVariantEntry(
        variant: HLSVariant,
        audioTracks?: HLSAudioTrack[],
        subtitles?: HLSSubtitle[]
    ): string {
        const attrs: string[] = [
            `BANDWIDTH=${variant.bandwidth}`,
            `RESOLUTION=${variant.width}x${variant.height}`,
            `CODECS="${variant.codec}"`
        ];

        if (variant.frameRate) {
            attrs.push(`FRAME-RATE=${variant.frameRate.toFixed(3)}`);
        }

        // Vincular audio group si hay múltiples pistas
        if (audioTracks && audioTracks.length > 0 && variant.audioGroup) {
            attrs.push(`AUDIO="${variant.audioGroup}"`);
        }

        // Vincular subtitle group
        if (subtitles && subtitles.length > 0 && variant.subtitleGroup) {
            attrs.push(`SUBTITLES="${variant.subtitleGroup}"`);
        }

        return `#EXT-X-STREAM-INF:${attrs.join(',')}`;
    }

    // ==================== VARIANT PLAYLIST ====================

    /**
     * Genera playlist de una variante específica (quality_1080p.m3u8)
     */
    generateVariantPlaylist(segments: HLSSegment[]): string {
        const lines: string[] = [];

        // Header
        lines.push('#EXTM3U');
        lines.push(`#EXT-X-VERSION:${this.config.version}`);
        lines.push(`#EXT-X-TARGETDURATION:${this.config.targetDuration}`);
        lines.push(`#EXT-X-MEDIA-SEQUENCE:0`);
        
        if (this.config.playlistType) {
            lines.push(`#EXT-X-PLAYLIST-TYPE:${this.config.playlistType}`);
        }

        lines.push('');

        // Segmentos
        for (const segment of segments) {
            lines.push(`#EXTINF:${segment.duration.toFixed(6)},`);
            lines.push(segment.uri);
        }

        // End marker (solo para VOD)
        if (this.config.playlistType === 'VOD') {
            lines.push('#EXT-X-ENDLIST');
        }

        return lines.join('\n');
    }

    // ==================== AUDIO PLAYLIST ====================

    /**
     * Genera playlist de audio (audio_es.m3u8)
     */
    generateAudioPlaylist(segments: HLSSegment[]): string {
        // Mismo formato que variant playlist
        return this.generateVariantPlaylist(segments);
    }

    // ==================== SUBTITLE PLAYLIST ====================

    /**
     * Genera playlist de subtítulos (subtitles_es.m3u8)
     * Apunta a un archivo WEBVTT
     */
    generateSubtitlePlaylist(vttPath: string, duration: number): string {
        const lines: string[] = [];

        // Headers obligatorios
        lines.push('#EXTM3U');
        lines.push(`#EXT-X-VERSION:${this.config.version}`);
        lines.push(`#EXT-X-TARGETDURATION:${Math.ceil(duration)}`);
        lines.push('#EXT-X-MEDIA-SEQUENCE:0');
        lines.push('#EXT-X-PLAYLIST-TYPE:VOD');
        lines.push('');
        
        // Segmento único con duración total
        lines.push(`#EXTINF:${duration.toFixed(6)},`);
        lines.push(vttPath);
        
        // End marker
        lines.push('#EXT-X-ENDLIST');

        return lines.join('\n');
    }

    // ==================== UTILITIES ====================

    /**
     * Calcula el bandwidth total de una variante
     */
    static calculateBandwidth(videoBitrate: string, audioBitrate: string = '128k'): number {
        const videoKbps = parseInt(videoBitrate.replace('k', ''));
        const audioKbps = parseInt(audioBitrate.replace('k', ''));
        return (videoKbps + audioKbps) * 1000; // Convertir a bps
    }

    /**
     * Genera codec string para H.264 + AAC
     */
    static generateCodecString(profile: 'baseline' | 'main' | 'high' = 'main'): string {
        const videoCodec = this.getH264Codec(profile);
        const audioCodec = 'mp4a.40.2'; // AAC-LC
        return `${videoCodec},${audioCodec}`;
    }

    /**
     * Obtiene codec H.264 según profile
     */
    private static getH264Codec(profile: 'baseline' | 'main' | 'high'): string {
        const codecs = {
            baseline: 'avc1.42001e',  // Baseline Profile Level 3.0
            main: 'avc1.4d001f',      // Main Profile Level 3.1
            high: 'avc1.64001f'       // High Profile Level 3.1
        };
        return codecs[profile];
    }

    /**
     * Detecta profile según resolución
     */
    static detectProfile(height: number): 'baseline' | 'main' | 'high' {
        if (height >= 1080) return 'high';
        if (height >= 720) return 'main';
        return 'baseline';
    }

    /**
     * Valida que un playlist sea válido
     */
    static validatePlaylist(content: string): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!content.startsWith('#EXTM3U')) {
            errors.push('Playlist must start with #EXTM3U');
        }

        if (!content.includes('#EXT-X-VERSION')) {
            errors.push('Missing #EXT-X-VERSION tag');
        }

        if (content.includes('#EXT-X-PLAYLIST-TYPE:VOD') && !content.includes('#EXT-X-ENDLIST')) {
            errors.push('VOD playlist must end with #EXT-X-ENDLIST');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    // ==================== FILE WRITING ====================

    /**
     * Escribe master playlist a disco
     */
    async writeMasterPlaylist(
        outputPath: string,
        variants: HLSVariant[],
        audioTracks?: HLSAudioTrack[],
        subtitles?: HLSSubtitle[]
    ): Promise<void> {
        const content = this.generateMasterPlaylist(variants, audioTracks, subtitles);
        await fs.ensureDir(path.dirname(outputPath));
        await fs.writeFile(outputPath, content, 'utf8');
    }

    /**
     * Escribe variant playlist a disco
     */
    async writeVariantPlaylist(
        outputPath: string,
        segments: HLSSegment[]
    ): Promise<void> {
        const content = this.generateVariantPlaylist(segments);
        await fs.ensureDir(path.dirname(outputPath));
        await fs.writeFile(outputPath, content, 'utf8');
    }

    /**
     * Escribe subtitle playlist a disco
     */
    async writeSubtitlePlaylist(
        outputPath: string,
        vttPath: string,
        duration: number
    ): Promise<void> {
        const content = this.generateSubtitlePlaylist(vttPath, duration);
        await fs.ensureDir(path.dirname(outputPath));
        await fs.writeFile(outputPath, content, 'utf8');
    }
}

// ==================== BUILDER HELPER ====================

/**
 * Helper para construir variantes más fácilmente
 */
export class HLSVariantBuilder {
    private variants: HLSVariant[] = [];

    addVariant(
        name: string,
        width: number,
        height: number,
        videoBitrate: string,
        audioBitrate: string = '128k',
        options?: {
            frameRate?: number;
            audioGroup?: string;
            subtitleGroup?: string;
            profile?: 'baseline' | 'main' | 'high';
        }
    ): this {
        const profile = options?.profile || HLSPlaylistGenerator.detectProfile(height);
        const codec = HLSPlaylistGenerator.generateCodecString(profile);
        const bandwidth = HLSPlaylistGenerator.calculateBandwidth(videoBitrate, audioBitrate);

        this.variants.push({
            name,
            width,
            height,
            bandwidth,
            videoBitrate,
            audioBitrate,
            codec,
            playlistPath: `video/quality_${name}.m3u8`,
            frameRate: options?.frameRate,
            audioGroup: options?.audioGroup,
            subtitleGroup: options?.subtitleGroup
        });

        return this;
    }

    build(): HLSVariant[] {
        return this.variants;
    }
}

// ==================== EXPORT ====================

export default HLSPlaylistGenerator;