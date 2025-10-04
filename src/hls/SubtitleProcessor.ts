import { FFmpegCommand } from '../FFmpegCommand';
import fs from 'fs-extra';
import path from 'path';
import { EventEmitter } from 'events';
import { convert,detectFormatSimple } from 'subs-converter';
// ==================== INTERFACES ====================

/**
 * Formatos de subtítulos soportados
 */
export enum SubtitleFormat {
    SRT = 'srt',
    ASS = 'ass',
    SSA = 'ssa',
    WEBVTT = 'webvtt',
    TTML = 'ttml',
    VTT = 'vtt',
    SUB = 'sub',
    UNKNOWN = 'unknown'
}

/**
 * Información de subtítulo extraído
 */
export interface ExtractedSubtitle {
    index: number;
    language: string;
    languageName: string;
    codec: string;
    format: SubtitleFormat;
    isDefault: boolean;
    isForced: boolean;
    title?: string;
}

/**
 * Subtítulo procesado
 */
export interface ProcessedSubtitle {
    originalPath: string;
    originalFormat: SubtitleFormat;
    language: string;
    languageName: string;
    
    // Custom format (sin convertir - para player personalizado)
    customPath?: string;            // Guardado en formato original
    customFormat?: SubtitleFormat;
    
    // WEBVTT (fallback - conversión opcional)
    webvttPath?: string;            // Convertido a WEBVTT
    webvttPlaylistPath?: string;    // Playlist HLS para WEBVTT
    
    metadata: {
        isDefault: boolean;
        isForced: boolean;
        title?: string;
        fileSize: number;
    };
}

/**
 * Configuración del procesador
 */
export interface SubtitleProcessorConfig {
    outputDir: string;
    
    // Guardar formato original (para custom player)
    saveOriginal: boolean;          // Default: true
    
    // Generar WEBVTT como fallback
    generateWebVTT: boolean;        // Default: false (mock por ahora)
    
    // Naming
    filenamePattern?: string;       // Default: "subtitle_{lang}.{ext}"
}

/**
 * Opciones de extracción
 */
export interface ExtractionOptions {
    extractAll?: boolean;           // Extraer todos los subtítulos
    languages?: string[];           // Filtrar por idiomas específicos
    includeForced?: boolean;        // Incluir subtítulos forzados
}

// ==================== CLASE PRINCIPAL ====================

export class SubtitleProcessor extends EventEmitter {
    private ffmpegPath: string;
    private ffprobePath: string;

    constructor(ffmpegPath: string, ffprobePath: string) {
        super();
        this.ffmpegPath = ffmpegPath;
        this.ffprobePath = ffprobePath;
    }

    // ==================== DETECCIÓN ====================

    /**
     * Detecta subtítulos embebidos en el video
     */
    async detectEmbeddedSubtitles(inputPath: string): Promise<ExtractedSubtitle[]> {
        const probeData = await FFmpegCommand.probe(inputPath, {
            ffprobePath: this.ffprobePath
        });

        const subtitles: ExtractedSubtitle[] = [];

        for (const stream of probeData.streams) {
            if (stream.codec_type === 'subtitle') {
                const format = this.detectFormat(stream.codec_name);
                const language = stream.tags?.language || 'und';

                subtitles.push({
                    index: stream.index,
                    language,
                    languageName: this.getLanguageName(language),
                    codec: stream.codec_name,
                    format,
                    isDefault: stream.disposition?.default === 1,
                    isForced: stream.disposition?.forced === 1,
                    title: stream.tags?.title
                });
            }
        }

        return subtitles;
    }

    /**
     * Detecta formato de subtítulo por codec
     */
    private detectFormat(codec: string): SubtitleFormat {
        const codecMap: Record<string, SubtitleFormat> = {
            'subrip': SubtitleFormat.SRT,
            'srt': SubtitleFormat.SRT,
            'ass': SubtitleFormat.ASS,
            'ssa': SubtitleFormat.SSA,
            'webvtt': SubtitleFormat.WEBVTT,
            'mov_text': SubtitleFormat.SRT,
            'ttml': SubtitleFormat.TTML,
            'dvd_subtitle': SubtitleFormat.SUB,
            'hdmv_pgs_subtitle': SubtitleFormat.SUB
        };

        return codecMap[codec.toLowerCase()] || SubtitleFormat.UNKNOWN;
    }

    /**
     * Detecta formato por extensión de archivo
     */
    detectFormatByExtension(filePath: string): SubtitleFormat {
        const ext = path.extname(filePath).toLowerCase().replace('.', '');
        
        const extMap: Record<string, SubtitleFormat> = {
            'srt': SubtitleFormat.SRT,
            'ass': SubtitleFormat.ASS,
            'ssa': SubtitleFormat.SSA,
            'vtt': SubtitleFormat.WEBVTT,
            'webvtt': SubtitleFormat.WEBVTT,
            'ttml': SubtitleFormat.TTML,
            'sub': SubtitleFormat.SUB
        };

        return extMap[ext] || SubtitleFormat.UNKNOWN;
    }

    // ==================== EXTRACCIÓN ====================

    /**
     * Extrae subtítulos embebidos del video
     */
    async extractEmbeddedSubtitles(
        inputPath: string,
        config: SubtitleProcessorConfig,
        options: ExtractionOptions = {}
    ): Promise<ProcessedSubtitle[]> {
        const embeddedSubs = await this.detectEmbeddedSubtitles(inputPath);
        
        if (embeddedSubs.length === 0) {
            this.emit('info', 'No embedded subtitles found');
            return [];
        }

        // Filtrar según opciones
        let subsToExtract = embeddedSubs;

        if (options.languages && options.languages.length > 0) {
            subsToExtract = subsToExtract.filter(sub => 
                options.languages!.includes(sub.language)
            );
        }

        if (!options.includeForced) {
            subsToExtract = subsToExtract.filter(sub => !sub.isForced);
        }

        // Extraer cada subtítulo
        const results: ProcessedSubtitle[] = [];

        for (const sub of subsToExtract) {
            try {
                this.emit('extracting', sub.language, sub.format);
                
                const result = await this.extractSingleSubtitle(
                    inputPath,
                    sub,
                    config
                );

                results.push(result);
                
                this.emit('extracted', sub.language, result);
            } catch (error: any) {
                this.emit('error', sub.language, error.message);
            }
        }

        return results;
    }

    /**
     * Extrae un subtítulo individual
     */
    private async extractSingleSubtitle(
        inputPath: string,
        subtitle: ExtractedSubtitle,
        config: SubtitleProcessorConfig
    ): Promise<ProcessedSubtitle> {
        await fs.ensureDir(config.outputDir);

        // Determinar extensión según formato
        const extension = this.getExtensionForFormat(subtitle.format);
        const baseFilename = this.generateFilename(subtitle.language, config);
        
        // Ruta para guardar en formato original (custom)
        const customPath = path.join(
            config.outputDir,
            `${baseFilename}.${extension}`
        );

        // Extraer subtítulo en formato original
        if (config.saveOriginal) {
            await this.extractToFile(inputPath, subtitle.index, customPath);
        }

        const stats = await fs.stat(customPath);

        const result: ProcessedSubtitle = {
            originalPath: customPath,
            originalFormat: subtitle.format,
            language: subtitle.language,
            languageName: subtitle.languageName,
            customPath: config.saveOriginal ? customPath : undefined,
            customFormat: config.saveOriginal ? subtitle.format : undefined,
            metadata: {
                isDefault: subtitle.isDefault,
                isForced: subtitle.isForced,
                title: subtitle.title,
                fileSize: stats.size
            }
        };

        // Generar WEBVTT si está habilitado (MOCK por ahora)
        if (config.generateWebVTT) {
            const webvttResult = await this.convertToWebVTTMock(
                customPath,
                subtitle,
                config.outputDir
            );
            
            result.webvttPath = webvttResult.path;
            result.webvttPlaylistPath = webvttResult.playlistPath;
        }

        return result;
    }

    /**
     * Extrae subtítulo a archivo usando FFmpeg
     */
    private async extractToFile(
        inputPath: string,
        streamIndex: number,
        outputPath: string
    ): Promise<void> {
        const cmd = new FFmpegCommand({
            ffmpegPath: this.ffmpegPath,
            ffprobePath: this.ffprobePath
        });

        cmd.input(inputPath)
           .outputOptions([
               '-map', `0:${streamIndex}`,
               '-c:s', 'copy'  // Copiar sin recodificar
           ])
           .output(outputPath);

        await cmd.run();
    }

    // ==================== PROCESAMIENTO DE SUBTÍTULOS EXTERNOS ====================

    /**
     * Procesa un archivo de subtítulos externo
     */
    async processExternalSubtitle(
        subtitlePath: string,
        language: string,
        config: SubtitleProcessorConfig
    ): Promise<ProcessedSubtitle> {
        if (!await fs.pathExists(subtitlePath)) {
            throw new Error(`Subtitle file not found: ${subtitlePath}`);
        }

        const format = this.detectFormatByExtension(subtitlePath);
        const baseFilename = this.generateFilename(language, config);
        const extension = path.extname(subtitlePath);

        // Copiar a directorio de salida (custom format)
        const customPath = path.join(
            config.outputDir,
            `${baseFilename}${extension}`
        );

        if (config.saveOriginal) {
            await fs.copy(subtitlePath, customPath);
        }

        const stats = await fs.stat(customPath);

        const result: ProcessedSubtitle = {
            originalPath: subtitlePath,
            originalFormat: format,
            language,
            languageName: this.getLanguageName(language),
            customPath: config.saveOriginal ? customPath : undefined,
            customFormat: config.saveOriginal ? format : undefined,
            metadata: {
                isDefault: false,
                isForced: false,
                fileSize: stats.size
            }
        };

        // Mock WEBVTT si está habilitado
        if (config.generateWebVTT) {
            const webvttResult = await this.convertToWebVTTMock(
                customPath,
                { language, format } as any,
                config.outputDir
            );
            
            result.webvttPath = webvttResult.path;
            result.webvttPlaylistPath = webvttResult.playlistPath;
        }

        return result;
    }

    // ==================== CONVERSIÓN A WEBVTT (MOCK) ====================

    /**
     * Mock de conversión a WEBVTT
     * NOTA: Implementación real requiere librería externa
     */
    private async convertToWebVTTMock(
        inputPath: string,
        subtitle: { language: string; format: SubtitleFormat },
        outputDir: string
    ): Promise<{ path: string; playlistPath: string }> {
        const webvttPath = path.join(
            outputDir,
            `subtitle_${subtitle.language}.vtt`
        );

        const playlistPath = path.join(
            outputDir,
            `subtitle_${subtitle.language}.m3u8`
        );

        // MOCK: Por ahora solo crear archivo placeholder
        const mockContent = this.generateWebVTT(inputPath,subtitle.language);
        await fs.writeFile(webvttPath, mockContent, 'utf8');

        // MOCK: Crear playlist placeholder
        const mockPlaylist = this.generateMockWebVTTPlaylist(
            path.basename(webvttPath)
        );
        await fs.writeFile(playlistPath, mockPlaylist, 'utf8');

        this.emit('webvtt-mock', subtitle.language, 'Mock WEBVTT generated (requires external library for real conversion)');

        return { path: webvttPath, playlistPath };
    }

    /**
     * Genera contenido mock de WEBVTT
     */
    private generateWebVTT(inputPath: string,language: string): string {
        const subData = fs.readFileSync(inputPath, 'utf8');
        const format = detectFormatSimple(subData);
        return convert(subData, format||SubtitleFormat.VTT, SubtitleFormat.VTT);
    }

    /**
     * Genera playlist mock para WEBVTT
     */
    private generateMockWebVTTPlaylist(vttFilename: string): string {
        return `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:3600
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:3600.000000,
${vttFilename}
#EXT-X-ENDLIST
`;
    }

    // ==================== UTILIDADES ====================

    /**
     * Obtiene extensión para un formato
     */
    private getExtensionForFormat(format: SubtitleFormat): string {
        const extMap: Record<SubtitleFormat, string> = {
            [SubtitleFormat.SRT]: 'srt',
            [SubtitleFormat.ASS]: 'ass',
            [SubtitleFormat.SSA]: 'ssa',
            [SubtitleFormat.WEBVTT]: 'vtt',
            [SubtitleFormat.VTT]: 'vtt',
            [SubtitleFormat.TTML]: 'ttml',
            [SubtitleFormat.SUB]: 'sub',
            [SubtitleFormat.UNKNOWN]: 'txt'
        };

        return extMap[format] || 'txt';
    }

    /**
     * Genera nombre de archivo
     */
    private generateFilename(language: string, config: SubtitleProcessorConfig): string {
        const pattern = config.filenamePattern || 'subtitle_{lang}';
        return pattern.replace('{lang}', language);
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
            'ar': 'العربية',
            'und': 'Unknown'
        };
        
        return languages[code] || code.toUpperCase();
    }

    /**
     * Valida si un formato necesita conversión para HLS
     */
    needsConversionForHLS(format: SubtitleFormat): boolean {
        // Solo WEBVTT es soportado nativamente por HLS
        return format !== SubtitleFormat.WEBVTT && format !== SubtitleFormat.VTT;
    }

    /**
     * Valida si un formato es custom (requiere player personalizado)
     */
    isCustomFormat(format: SubtitleFormat): boolean {
        return [
            SubtitleFormat.TTML,
            SubtitleFormat.ASS,
            SubtitleFormat.SSA
        ].includes(format);
    }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Crea configuración por defecto
 */
export function createDefaultSubtitleConfig(outputDir: string): SubtitleProcessorConfig {
    return {
        outputDir,
        saveOriginal: true,         // Guardar formato original
        generateWebVTT: false       // No generar WEBVTT por ahora (mock)
    };
}

/**
 * Determina estrategia de subtítulos según formato
 */
export function getSubtitleStrategy(format: SubtitleFormat): {
    requiresCustomPlayer: boolean;
    hlsCompatible: boolean;
    recommendedAction: string;
} {
    const isCustom = [SubtitleFormat.TTML, SubtitleFormat.ASS, SubtitleFormat.SSA].includes(format);
    const isHLSNative = format === SubtitleFormat.WEBVTT || format === SubtitleFormat.VTT;

    return {
        requiresCustomPlayer: isCustom,
        hlsCompatible: isHLSNative,
        recommendedAction: isCustom 
            ? 'Use custom player to preserve styling and features'
            : isHLSNative 
                ? 'Use standard HLS player'
                : 'Convert to WEBVTT for HLS compatibility or use custom player'
    };
}

export default SubtitleProcessor;