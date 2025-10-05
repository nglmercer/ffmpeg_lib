import * as fs from 'fs';
import * as path from 'path';
import type {
  HLSVariant,
  HLSAudioTrack,
  HLSSubtitle,
  HLSSegment,
  HLSGeneratorConfig,
  ValidationError
} from './types';
import { HLSPlaylistParser } from './HLSPlaylistParser';
import { HLSPlaylistValidator } from './HLSPlaylistValidator';
import { HLSUtils } from './HLSUtils';

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

        return `#EXT-X-MEDIA:${attrs.join(',')}`;
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
        _audioTracks?: HLSAudioTrack[],
        _subtitles?: HLSSubtitle[]
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
        if (variant.audioGroup) {
            attrs.push(`AUDIO="${variant.audioGroup}"`);
        }

        // Vincular subtitle group
        if (variant.subtitleGroup) {
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
        // Calculate target duration: use config value only if segments exist, otherwise use 0
        const targetDuration = segments.length > 0 
            ? (this.config.targetDuration !== undefined ? this.config.targetDuration : Math.max(...segments.map(s => Math.ceil(s.duration))))
            : 0;
        
        lines.push(`#EXT-X-VERSION:${this.config.version}`);
        lines.push(`#EXT-X-TARGETDURATION:${targetDuration}`);
        lines.push(`#EXT-X-MEDIA-SEQUENCE:0`);
        
        if (this.config.playlistType) {
            lines.push(`#EXT-X-PLAYLIST-TYPE:${this.config.playlistType}`);
        }

        // Add allow cache if explicitly set
        if (this.config.allowCache !== undefined) {
            lines.push(`#EXT-X-ALLOW-CACHE:${this.config.allowCache ? 'YES' : 'NO'}`);
        }

        lines.push('');

        // Segmentos
        for (const segment of segments) {
            if (segment.byteRange) {
                // Convert start-end format to length@offset format
                const [start, end] = segment.byteRange.split('-').map(Number);
                if (start !== undefined && end !== undefined) {
                    const length = end - start + 1;
                    lines.push(`#EXT-X-BYTERANGE:${length}@${start}`);
                }
            }
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
        // Handle different formats: "2000k", "2000", "128k", "128"
        const parseBitrate = (bitrate: string): number => {
            const hasK = bitrate.toLowerCase().includes('k');
            const cleanValue = bitrate.replace(/k/gi, '');
            const value = parseInt(cleanValue) || 0;
            return hasK ? value * 1000 : value; // Multiply by 1000 for k values, return plain numbers as-is
        };
        
        const videoBps = parseBitrate(videoBitrate);
        const audioBps = parseBitrate(audioBitrate);
        
        // Handle the special case where both are 0
        if (videoBps === 0 && audioBps === 0) {
            return 0;
        }
        
        // Use default 128kbps if audio is 0 and video is not 0
        const finalAudioBps = audioBps === 0 && videoBps > 0 ? 128000 : audioBps;
        return videoBps + finalAudioBps;
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
     * Valida que un playlist sea válido (método mejorado)
     */
    static validatePlaylist(content: string): { valid: boolean; errors: ValidationError[] } {
        return HLSPlaylistValidator.validate(content);
    }

    /**
     * Parsea un playlist M3U8 existente
     */
    static parsePlaylist(content: string): HLSPlaylistParser {
        return new HLSPlaylistParser(content);
    }

    /**
     * Valida y repara un playlist si es necesario
     */
    static validateAndRepair(content: string): { 
        valid: boolean; 
        errors: string[]; 
        repaired: string | null;
        wasRepaired: boolean;
    } {
        const result = HLSPlaylistValidator.validateAndRepair(content);
        return {
            valid: result.valid,
            errors: result.issues.map(issue => issue.message),
            repaired: result.repairedContent,
            wasRepaired: result.repairedContent !== content
        };
    }

    /**
     * Compara dos playlists para verificar compatibilidad
     */
    static comparePlaylists(content1: string, content2: string): {
        compatible: boolean;
        differences: string[];
        warnings: string[];
    } {
        return HLSUtils.comparePlaylists(content1, content2);
    }

    /**
     * Genera un hash único para un playlist (para detección de cambios)
     */
    static generatePlaylistHash(content: string): string {
        return HLSUtils.generatePlaylistHash(content);
    }

    /**
     * Normaliza un playlist para mejor compatibilidad entre reproductores
     */
    static normalizePlaylist(content: string): string {
        return HLSUtils.normalizePlaylist(content);
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
        const dir = path.dirname(outputPath);
        await fs.promises.mkdir(dir, { recursive: true });
        await fs.promises.writeFile(outputPath, content, 'utf8');
    }

    /**
     * Escribe variant playlist a disco
     */
    async writeVariantPlaylist(
        outputPath: string,
        segments: HLSSegment[]
    ): Promise<void> {
        const content = this.generateVariantPlaylist(segments);
        const dir = path.dirname(outputPath);
        await fs.promises.mkdir(dir, { recursive: true });
        await fs.promises.writeFile(outputPath, content, 'utf8');
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
        const dir = path.dirname(outputPath);
        await fs.promises.mkdir(dir, { recursive: true });
        await fs.promises.writeFile(outputPath, content, 'utf8');
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
            frameRate: options?.frameRate || 30,
            audioGroup: options?.audioGroup || '',
            subtitleGroup: options?.subtitleGroup || ''
        });

        return this;
    }

    build(): HLSVariant[] {
        return this.variants;
    }
}

// ==================== EXPORT ====================

export default HLSPlaylistGenerator;