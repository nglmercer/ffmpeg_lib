/**
 * Parser avanzado para archivos M3U8/HLS
 * Proporciona capacidades de análisis y extracción de información detallada
 */

import type {
  ParsedPlaylist,
  ParsedVariant,
  ParsedAudioTrack,
  ParsedSubtitle,
  RawTag,
  PlaylistMetadata,
  HLSSegment
} from './types';

// Interfaces moved to types.ts

export class HLSPlaylistParser {
  private content: string;
  private lines: string[];
  private parsed: ParsedPlaylist | null = null;

  constructor(content: string) {
    this.content = content.trim();
    this.lines = this.content.split('\n').map(line => line.trim());
  }

  /**
   * Parsea el contenido del playlist
   */
  parse(): ParsedPlaylist {
    if (this.parsed) {
      return this.parsed;
    }

    // Validate basic requirements
    if (!this.content || this.content.trim().length === 0) {
      throw new Error('Empty playlist content');
    }

    if (!this.lines.length || !this.lines[0]?.startsWith('#EXTM3U')) {
      throw new Error('Playlist must start with #EXTM3U header');
    }

    const rawTags = this.parseRawTags();
    const type = this.detectPlaylistType(rawTags);
    const version = this.getVersion(rawTags) || 1;

    const baseInfo = {
      type,
      version,
      rawTags,
      metadata: this.calculateMetadata(rawTags)
    };

    if (type === 'master') {
      this.parsed = {
        ...baseInfo,
        variants: this.parseVariants(rawTags),
        audioTracks: this.parseMediaTracks(rawTags, 'AUDIO') as ParsedAudioTrack[],
        subtitles: this.parseMediaTracks(rawTags, 'SUBTITLES') as ParsedSubtitle[]
      };
    } else {
      this.parsed = {
        ...baseInfo,
        targetDuration: this.getTargetDuration(rawTags) || 0,
        mediaSequence: this.getMediaSequence(rawTags) || 0,
        playlistType: this.getPlaylistType(rawTags) || 'VOD',
        allowCache: this.getAllowCache(rawTags) || false,
        endList: this.hasEndList(rawTags),
        segments: this.parseSegments(rawTags)
      };
    }

    return this.parsed;
  }

  private calculateMetadata(tags: RawTag[]): PlaylistMetadata {
    const segments = this.parseSegments(tags);
    const totalDuration = segments.reduce((sum, seg) => sum + seg.duration, 0);

    return {
      totalDuration,
      segmentCount: segments.length,
      byteRangeSupport: tags.some(tag => tag.tag === '#EXT-X-BYTERANGE'),
      discontinuitySupport: tags.some(tag => tag.tag === '#EXT-X-DISCONTINUITY'),
      encryptionSupport: tags.some(tag => tag.tag === '#EXT-X-KEY'),
      hasEndList: this.hasEndList(tags)
    };
  }

  /**
   * Obtiene información básica sin parseo completo
   */
  getBasicInfo(): { type: 'master' | 'media'; version: number } {
    const rawTags = this.parseRawTags();
    return {
      type: this.detectPlaylistType(rawTags),
      version: this.getVersion(rawTags) || 1
    };
  }

  /**
   * Extrae todos los segmentos del playlist
   */
  extractSegments(): HLSSegment[] {
    const segments: HLSSegment[] = [];
    
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      
      if (line && line.startsWith('#EXTINF:')) {
        const durationStr = line.split(':')[1]?.split(',')[0];
        if (durationStr) {
          const duration = parseFloat(durationStr);
          const uri = this.lines[i + 1];
          
          if (uri && !uri.startsWith('#')) {
            segments.push({ duration, uri: uri.trim() });
          }
        }
      }
    }
    
    return segments;
  }

  /**
   * Valida la sintaxis básica del playlist
   */
  validateSyntax(): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validar header
    if (!this.lines.length || !this.lines[0]?.startsWith('#EXTM3U')) {
      errors.push('Playlist must start with #EXTM3U');
    }

    // Validar versión
    const hasVersion = this.lines.some(line => line.startsWith('#EXT-X-VERSION:'));
    if (!hasVersion) {
      warnings.push('Missing #EXT-X-VERSION tag (recommended for compatibility)');
    }

    // Validar estructura de segmentos
    let lastWasExtInf = false;
    let segmentCount = 0;

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];

      if (line && line.startsWith('#EXTINF:')) {
        if (lastWasExtInf) {
          errors.push(`Missing URI after EXTINF at line ${i + 1}`);
        }
        lastWasExtInf = true;
        segmentCount++;
      } else if (lastWasExtInf && line && !line.startsWith('#')) {
        lastWasExtInf = false;
      } else if (lastWasExtInf && line && line.startsWith('#')) {
        errors.push(`Missing URI after EXTINF at line ${i}`);
        lastWasExtInf = false;
      }
    }

    // Validar consistencia de duraciones
    const targetDuration = this.getTargetDuration(this.parseRawTags());
    if (targetDuration && segmentCount > 0) {
      const segments = this.extractSegments();
      if (segments.length > 0) {
        const maxDuration = Math.max(...segments.map(s => s.duration));
        
        if (maxDuration > targetDuration + 1) {
          warnings.push(`Segment duration (${maxDuration.toFixed(2)}s) exceeds target duration (${targetDuration}s)`);
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Detecta características avanzadas del playlist
   */
  detectFeatures(): {
    byteRanges: boolean;
    discontinuities: boolean;
    encryption: boolean;
    programDateTime: boolean;
    gap: boolean;
  } {
    return {
      byteRanges: this.lines.some(line => line && line.startsWith('#EXT-X-BYTERANGE:')),
      discontinuities: this.lines.some(line => line && line.startsWith('#EXT-X-DISCONTINUITY')),
      encryption: this.lines.some(line => line && line.startsWith('#EXT-X-KEY:')),
      programDateTime: this.lines.some(line => line && line.startsWith('#EXT-X-PROGRAM-DATE-TIME:')),
      gap: this.lines.some(line => line && line.startsWith('#EXT-X-GAP'))
    };
  }

  /**
   * Extrae información de codecs de las variantes
   */
  extractCodecInfo(): Array<{
    video: string | null;
    audio: string | null;
    resolution: string | null;
    bandwidth: number | null;
  }> {
    const codecInfo = [];
    const rawTags = this.parseRawTags();

    for (const tag of rawTags) {
      if (tag.tag === 'EXT-X-STREAM-INF' && tag.attributes) {
        codecInfo.push({
          video: tag.attributes['CODECS']?.split(',')[0] || null,
          audio: tag.attributes['CODECS']?.split(',')[1] || null,
          resolution: tag.attributes['RESOLUTION'] || null,
          bandwidth: tag.attributes['BANDWIDTH'] ? parseInt(tag.attributes['BANDWIDTH']) : null
        });
      }
    }

    return codecInfo;
  }

  private parseRawTags(): RawTag[] {
    const tags: RawTag[] = [];

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      
      if (line && line.startsWith('#EXT')) {
        const tag = this.parseTag(line, i + 1);
        if (tag) {
          tags.push(tag);
        }
      }
    }

    return tags;
  }

  private parseTag(line: string, lineNumber: number = 0): RawTag | null {
    if (!line.startsWith('#EXT')) return null;

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      return { tag: line, line: lineNumber };
    }

    const tag = line.substring(0, colonIndex);
    const value = line.substring(colonIndex + 1);

    // Parsear atributos para tags específicos
    if (tag === '#EXT-X-STREAM-INF' || tag === '#EXT-X-MEDIA') {
      return {
        tag,
        value,
        attributes: this.parseAttributes(value),
        line: lineNumber
      };
    }

    return { tag, value, line: lineNumber };
  }

  private parseAttributes(value: string): Record<string, string> {
    const attributes: Record<string, string> = {};
    
    // Parsear atributos en formato KEY=VALUE,KEY2="VALUE2"
    const regex = /([A-Z\-]+)=(?:"([^"]*)"|([^,]*))/g;
    let match;
    
    while ((match = regex.exec(value)) !== null) {
      const key = match[1];
      const val = match[2] || match[3] || '';
      if (key) {
        attributes[key] = val;
      }
    }
    
    return attributes;
  }

  private detectPlaylistType(tags: RawTag[]): 'master' | 'media' {
    return tags.some(tag => tag.tag === '#EXT-X-STREAM-INF') ? 'master' : 'media';
  }

  private getVersion(tags: RawTag[]): number {
    const versionTag = tags.find(tag => tag.tag === '#EXT-X-VERSION');
    if (versionTag?.value) {
      const version = parseInt(versionTag.value);
      return isNaN(version) ? 1 : version;
    }
    return 1;
  }

  private getTargetDuration(tags: RawTag[]): number | undefined {
    const tag = tags.find(tag => tag.tag === '#EXT-X-TARGETDURATION');
    if (tag?.value) {
      const duration = parseInt(tag.value);
      return isNaN(duration) ? undefined : duration;
    }
    return undefined;
  }

  private getMediaSequence(tags: RawTag[]): number | undefined {
    const tag = tags.find(tag => tag.tag === '#EXT-X-MEDIA-SEQUENCE');
    if (tag?.value) {
      const sequence = parseInt(tag.value);
      return isNaN(sequence) ? undefined : sequence;
    }
    return undefined;
  }

  private getPlaylistType(tags: RawTag[]): 'VOD' | 'EVENT' | undefined {
    const tag = tags.find(tag => tag.tag === '#EXT-X-PLAYLIST-TYPE');
    return tag?.value === 'VOD' || tag?.value === 'EVENT' ? tag.value : undefined;
  }

  private getAllowCache(tags: RawTag[]): boolean | undefined {
    const tag = tags.find(tag => tag.tag === '#EXT-X-ALLOW-CACHE');
    return tag?.value ? tag.value === 'YES' : undefined;
  }

  private hasEndList(tags: RawTag[]): boolean {
    return tags.some(tag => tag.tag === '#EXT-X-ENDLIST');
  }

  private parseVariants(tags: RawTag[]): ParsedVariant[] {
    const variants: ParsedVariant[] = [];

    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      
      if (tag && tag.tag === '#EXT-X-STREAM-INF' && tag.attributes) {
        const nextLine = tag.line < this.lines.length ? this.lines[tag.line] : undefined; // URI está en la siguiente línea
        
        if (nextLine && !nextLine.startsWith('#')) {
          const resolution = tag.attributes['RESOLUTION'];
          const [width, height] = resolution ? resolution.split('x').map(Number) : [undefined, undefined];

          const bandwidth = tag.attributes['BANDWIDTH'] ? parseInt(tag.attributes['BANDWIDTH']) : 0;
          const frameRate = tag.attributes['FRAME-RATE'] ? parseFloat(tag.attributes['FRAME-RATE']) : undefined;
          
          const variant: ParsedVariant = {
            bandwidth: isNaN(bandwidth) ? 0 : bandwidth,
            uri: nextLine.trim(),
            rawAttributes: tag.attributes
          };

          if (width && height) {
            variant.resolution = { width, height };
          }
          if (tag.attributes['CODECS']) {
            variant.codecs = tag.attributes['CODECS'];
          }
          if (frameRate && !isNaN(frameRate)) {
            variant.frameRate = frameRate;
          }
          if (tag.attributes['AUDIO']) {
            variant.audioGroup = tag.attributes['AUDIO'];
          }
          if (tag.attributes['SUBTITLES']) {
            variant.subtitleGroup = tag.attributes['SUBTITLES'];
          }

          variants.push(variant);
        }
      }
    }

    return variants;
  }

  private parseMediaTracks(tags: RawTag[], type: 'AUDIO' | 'SUBTITLES'): ParsedAudioTrack[] | ParsedSubtitle[] {
    const tracks: any[] = [];

    for (const tag of tags) {
      if (tag && tag.tag === '#EXT-X-MEDIA' && tag.attributes?.['TYPE'] === type) {
        const track: any = {
          type,
          groupId: tag.attributes['GROUP-ID'] || tag.attributes['GROUP'] || '',
          name: tag.attributes['NAME'] || '',
          language: tag.attributes['LANGUAGE'] || '',
          default: tag.attributes['DEFAULT'] === 'YES',
          autoSelect: tag.attributes['AUTOSELECT'] === 'YES',
          uri: tag.attributes['URI'] || '',
          rawAttributes: tag.attributes
        };

        if (type === 'AUDIO') {
          track.channels = tag.attributes['CHANNELS'];
        } else {
          track.forced = tag.attributes['FORCED'] === 'YES';
        }

        tracks.push(track);
      }
    }

    return tracks;
  }

  private parseSegments(tags: RawTag[]): HLSSegment[] {
    const segments: HLSSegment[] = [];
    
    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      
      if (tag && tag.tag === '#EXTINF' && tag.value) {
        const durationStr = tag.value.split(',')[0];
        const duration = durationStr ? parseFloat(durationStr) : 0;
        const nextLine = tag.line < this.lines.length ? this.lines[tag.line] : undefined; // URI está en la siguiente línea
        
        if (nextLine && !nextLine.startsWith('#')) {
          segments.push({ duration: duration && !isNaN(duration) ? duration : 0, uri: nextLine.trim() });
        }
      }
    }
    
    return segments;
  }

}

export default HLSPlaylistParser;