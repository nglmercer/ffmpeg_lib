/**
 * Validador avanzado para archivos M3U8/HLS
 * Proporciona validación exhaustiva según especificaciones HLS
 */

import type { ParsedPlaylist, ParsedVariant,ValidationError, ValidationWarning,ValidationResult, ValidationInfo } from './types';

export class HLSPlaylistValidator {
  /**
   * Valida un playlist completo
   */
  static validate(content: string): ValidationResult {
    // For now, we'll do basic validation without the parser
    // The parser can be added later when the circular dependency is resolved
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const info: ValidationInfo[] = [];

    // Basic validation
    const lines = content.split('\n').map(line => line.trim());
    
    if (!lines[0]?.startsWith('#EXTM3U')) {
      errors.push({
        code: 'INVALID_HEADER',
        message: 'Playlist must start with #EXTM3U',
        severity: 'error',
        category: 'syntax'
      });
    }

    const hasVersion = lines.some(line => line.startsWith('#EXT-X-VERSION:'));
    if (!hasVersion) {
      errors.push({
        code: 'MISSING_VERSION',
        message: 'Missing #EXT-X-VERSION tag (required for proper playlist parsing)',
        severity: 'error',
        category: 'syntax'
      });
    }

    // Check for required tags based on playlist type
    const hasTargetDuration = lines.some(line => line.startsWith('#EXT-X-TARGETDURATION:'));
    const hasStreamInf = lines.some(line => line.startsWith('#EXT-X-STREAM-INF:'));
    const hasExtInf = lines.some(line => line.startsWith('#EXTINF:'));
    
    // If it's a media playlist (has segments), it needs target duration
    if (hasExtInf && !hasTargetDuration) {
      errors.push({
        code: 'MISSING_TARGET_DURATION',
        message: 'Media playlist must specify #EXT-X-TARGETDURATION',
        severity: 'error',
        category: 'structure'
      });
    }
    
    // If it's a master playlist (has stream-inf), it needs at least one variant
    if (hasStreamInf) {
      const streamInfCount = lines.filter(line => line.startsWith('#EXT-X-STREAM-INF:')).length;
      if (streamInfCount === 0) {
        errors.push({
          code: 'NO_VARIANTS',
          message: 'Master playlist must contain at least one variant stream',
          severity: 'error',
          category: 'structure'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      info,
    };
  }

  /**
   * Valida un playlist ya parseado
   */
  static validateParsedPlaylist(parsed: ParsedPlaylist, _originalContent?: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const info: ValidationInfo[] = [];

    // Validaciones básicas
    this.validateBasicStructure(parsed, errors, warnings);
    
    // Validaciones según tipo
    if (parsed.type === 'master') {
      this.validateMasterPlaylist(parsed, errors, warnings, info);
    } else {
      this.validateMediaPlaylist(parsed, errors, warnings, info);
    }

    // Validaciones de compatibilidad

    // Validaciones de rendimiento
    this.validatePerformance(parsed, warnings, info);

    return {
      valid: errors.filter(e => e.severity === 'error').length === 0,
      errors,
      warnings,
      info
    };
  }

  /**
   * Valida y repara un playlist si es posible
   */
  static validateAndRepair(content: string): {
    valid: boolean;
    repairedContent: string;
    issues: ValidationError[];
  } {
    const validation = this.validate(content);
    
    if (validation.valid) {
      return {
        valid: true,
        repairedContent: content,
        issues: []
      };
    }

    let repairedContent = content;
    const repairableIssues = validation.errors.filter(error => 
      this.isRepairableIssue(error.code)
    );

    // Aplicar reparaciones
    for (const issue of repairableIssues) {
      repairedContent = this.applyRepair(repairedContent, issue);
    }

    // Re-validar después de reparaciones
    const reValidation = this.validate(repairedContent);

    return {
      valid: reValidation.valid,
      repairedContent,
      issues: reValidation.errors
    };
  }

  /**
   * Compara dos playlists para detectar diferencias
   */
  static comparePlaylists(content1: string, content2: string): {
    identical: boolean;
    differences: string[];
    structuralDifferences: string[];
    compatibilityDifferences: string[];
  } {
    const lines1 = content1.split('\n').map(line => line.trim()).filter(line => line);
    const lines2 = content2.split('\n').map(line => line.trim()).filter(line => line);
    
    const differences: string[] = [];
    const structuralDifferences: string[] = [];
    const compatibilityDifferences: string[] = [];

    // Check headers
    const header1 = lines1[0];
    const header2 = lines2[0];
    
    if (header1 !== header2) {
      structuralDifferences.push(`Header mismatch: ${header1} vs ${header2}`);
    }

    // Check versions
    const version1 = lines1.find(line => line.startsWith('#EXT-X-VERSION:'));
    const version2 = lines2.find(line => line.startsWith('#EXT-X-VERSION:'));
    
    if (version1 !== version2) {
      differences.push(`Version difference: ${version1} vs ${version2}`);
    }

    // Check if both are master or media playlists
    const isMaster1 = lines1.some(line => line.startsWith('#EXT-X-STREAM-INF:'));
    const isMaster2 = lines2.some(line => line.startsWith('#EXT-X-STREAM-INF:'));
    
    if (isMaster1 !== isMaster2) {
      structuralDifferences.push(`Playlist type mismatch: master vs media`);
    }

    // Compare segments for media playlists
    if (!isMaster1 && !isMaster2) {
      const segments1 = this.extractSegments(lines1);
      const segments2 = this.extractSegments(lines2);
      
      if (segments1.length !== segments2.length) {
        differences.push(`Segment count difference: ${segments1.length} vs ${segments2.length}`);
      }
      
      const minLength = Math.min(segments1.length, segments2.length);
      for (let i = 0; i < minLength; i++) {
        const seg1 = segments1[i];
        const seg2 = segments2[i];
        if (seg1 && seg2) {
          if (seg1.duration !== seg2.duration) {
            differences.push(`Segment ${i + 1} duration difference: ${seg1.duration}s vs ${seg2.duration}s`);
          }
          if (seg1.uri !== seg2.uri) {
            differences.push(`Segment ${i + 1} URI difference: ${seg1.uri} vs ${seg2.uri}`);
          }
        }
      }
    }

    return {
      identical: differences.length === 0 && structuralDifferences.length === 0 && compatibilityDifferences.length === 0,
      differences,
      structuralDifferences,
      compatibilityDifferences
    };
  }

  /**
   * Extract segments from playlist lines
   */
  private static extractSegments(lines: string[]): Array<{duration: number; uri: string}> {
    const segments: Array<{duration: number; uri: string}> = [];
    let currentDuration = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line && line.startsWith('#EXTINF:')) {
        const durationMatch = line.match(/#EXTINF:([\d.]+)/);
        if (durationMatch && durationMatch[1]) {
          currentDuration = parseFloat(durationMatch[1]);
        }
      } else if (line && !line.startsWith('#') && i > 0) {
        // This is a segment URI (not a comment and not empty)
        segments.push({
          duration: currentDuration,
          uri: line
        });
        currentDuration = 0; // Reset for next segment
      }
    }
    
    return segments;
  }

  private static validateBasicStructure(
    parsed: ParsedPlaylist,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    // Validar versión mínima
    if (parsed.version < 1) {
      errors.push({
        code: 'INVALID_VERSION',
        message: 'Playlist version must be at least 1',
        severity: 'error',
        category: 'syntax'
      });
    }

    // Validar tags requeridos
    if (parsed.type === 'media' && !parsed.targetDuration) {
      errors.push({
        code: 'MISSING_TARGET_DURATION',
        message: 'Media playlist must specify #EXT-X-TARGETDURATION',
        severity: 'error',
        category: 'structure'
      });
    }

    // Advertencias de compatibilidad
    if (parsed.version < 3) {
      warnings.push({
        code: 'LOW_VERSION',
        message: 'Version 3 or higher recommended for better compatibility',
        severity: 'warning',
        category: 'compatibility'
      });
    }
  }

  private static validateMasterPlaylist(
    parsed: ParsedPlaylist,
    errors: ValidationError[],
    warnings: ValidationError[],
    info: ValidationInfo[]
  ): void {
    if (!parsed.variants || parsed.variants.length === 0) {
      errors.push({
        code: 'NO_VARIANTS',
        message: 'Master playlist must contain at least one variant stream',
        severity: 'error',
        category: 'structure'
      });
      return;
    }

    // Validar cada variante
    parsed.variants.forEach((variant, index) => {
      this.validateVariant(variant, index, errors, warnings);
    });

    // Validar grupos de medios
    this.validateMediaGroups(parsed, errors, warnings);

    // Validar consistencia de grupos
    const audioGroups = new Set(parsed.variants.map(v => v.audioGroup).filter(Boolean));
    const subtitleGroups = new Set(parsed.variants.map(v => v.subtitleGroup).filter(Boolean));

    info.push({
      code: 'MASTER_INFO',
      message: `Found ${parsed.variants.length} variants, ${audioGroups.size} audio groups, ${subtitleGroups.size} subtitle groups`,
      severity: 'info',
      category: 'best-practice'
    });
  }

  private static validateMediaPlaylist(
    parsed: ParsedPlaylist,
    errors: ValidationError[],
    warnings: ValidationError[],
    info: ValidationInfo[]
  ): void {
    if (!parsed.segments || parsed.segments.length === 0) {
      errors.push({
        code: 'NO_SEGMENTS',
        message: 'Media playlist must contain at least one segment',
        severity: 'error',
        category: 'structure'
      });
      return;
    }

    // Validar duraciones de segmentos
    const maxDuration = Math.max(...parsed.segments.map(s => s.duration));
    if (parsed.targetDuration && maxDuration > parsed.targetDuration) {
      warnings.push({
        code: 'SEGMENT_TOO_LONG',
        message: `Segment duration (${maxDuration.toFixed(2)}s) exceeds target duration (${parsed.targetDuration}s)`,
        severity: 'warning',
        category: 'structure'
      });
    }

    // Validar consistencia de secuencia
    if (parsed.mediaSequence !== undefined && parsed.mediaSequence < 0) {
      errors.push({
        code: 'INVALID_MEDIA_SEQUENCE',
        message: 'Media sequence number must be non-negative',
        severity: 'error',
        category: 'structure'
      });
    }

    // Advertencias de rendimiento
    if (parsed.segments.length > 1000) {
      warnings.push({
        code: 'TOO_MANY_SEGMENTS',
        message: `Large number of segments (${parsed.segments.length}) may impact performance`,
        severity: 'warning',
        category: 'performance'
      });
    }

    const totalDuration = parsed.segments.reduce((sum, seg) => sum + seg.duration, 0);
    info.push({
      code: 'MEDIA_INFO',
      message: `Playlist contains ${parsed.segments.length} segments with total duration ${totalDuration.toFixed(2)}s`,
      severity: 'info',
      category: 'best-practice'
    });
  }

  private static validateVariant(
    variant: ParsedVariant,
    index: number,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    if (!variant.bandwidth || variant.bandwidth <= 0) {
      errors.push({
        code: 'INVALID_BANDWIDTH',
        message: `Variant ${index + 1}: Invalid bandwidth value`,
        severity: 'error',
        category: 'structure'
      });
    }

    if (variant.bandwidth && variant.bandwidth > 50000000) {
      warnings.push({
        code: 'HIGH_BANDWIDTH',
        message: `Variant ${index + 1}: Very high bandwidth (${(variant.bandwidth / 1000000).toFixed(1)} Mbps) may cause issues`,
        severity: 'warning',
        category: 'compatibility'
      });
    }

    if (variant.codecs) {
      this.validateCodecs(variant.codecs, index, warnings);
    }
  }

  private static validateCodecs(
    codecs: string,
    variantIndex: number,
    warnings: ValidationError[]
  ): void {
    const codecList = codecs.split(',').map(c => c.trim());
    
    for (const codec of codecList) {
      if (codec.startsWith('avc1.')) {
        const profile = codec.substring(4);
        if (!this.isValidH264Profile(profile)) {
          warnings.push({
            code: 'INVALID_H264_PROFILE',
            message: `Variant ${variantIndex + 1}: H.264 profile "${profile}" may have compatibility issues`,
            severity: 'warning',
            category: 'compatibility'
          });
        }
      } else if (codec.startsWith('mp4a.')) {
        const audioProfile = codec.substring(4);
        if (!this.isValidAACProfile(audioProfile)) {
          warnings.push({
            code: 'INVALID_AAC_PROFILE',
            message: `Variant ${variantIndex + 1}: AAC profile "${audioProfile}" may have compatibility issues`,
            severity: 'warning',
            category: 'compatibility'
          });
        }
      }
    }
  }

  private static validateMediaGroups(
    parsed: ParsedPlaylist,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    const referencedAudioGroups = new Set(
      parsed.variants?.map(v => v.audioGroup).filter(Boolean) || []
    );
    const referencedSubtitleGroups = new Set(
      parsed.variants?.map(v => v.subtitleGroup).filter(Boolean) || []
    );

    // Validar que los grupos referenciados existen
    const existingAudioGroups = new Set(
      parsed.audioTracks?.map(t => t.groupId) || []
    );
    const existingSubtitleGroups = new Set(
      parsed.subtitles?.map(s => s.groupId) || []
    );

    for (const group of referencedAudioGroups) {
      if (group && !existingAudioGroups.has(group)) {
        errors.push({
          code: 'MISSING_AUDIO_GROUP',
          message: `Referenced audio group "${group}" not found`,
          severity: 'error',
          category: 'structure'
        });
      }
    }

    for (const group of referencedSubtitleGroups) {
      if (group && !existingSubtitleGroups.has(group)) {
        warnings.push({
          code: 'MISSING_SUBTITLE_GROUP',
          message: `Referenced subtitle group "${group}" not found`,
          severity: 'warning',
          category: 'structure'
        });
      }
    }
  }

  private static validatePerformance(
    parsed: ParsedPlaylist,
    warnings: ValidationError[],
    info: ValidationInfo[]
  ): void {
    // Validar tamaño de segmentos
    if (parsed.type === 'media' && parsed.segments) {
      const avgDuration = parsed.segments.reduce((sum, seg) => sum + seg.duration, 0) / parsed.segments.length;
      
      if (avgDuration < 2) {
        warnings.push({
          code: 'SHORT_SEGMENTS',
          message: `Average segment duration (${avgDuration.toFixed(2)}s) is very short, may cause overhead`,
          severity: 'warning',
          category: 'performance'
        });
      } else if (avgDuration > 10) {
        warnings.push({
          code: 'LONG_SEGMENTS',
          message: `Average segment duration (${avgDuration.toFixed(2)}s) is long, may impact ABR performance`,
          severity: 'warning',
          category: 'performance'
        });
      }

      if (avgDuration >= 2 && avgDuration <= 10) {
        info.push({
          code: 'GOOD_SEGMENT_DURATION',
          message: `Segment duration (${avgDuration.toFixed(2)}s) is within recommended range`,
          severity: 'info',
          category: 'best-practice'
        });
      }
    }

    // Validar número de variantes
    if (parsed.type === 'master' && parsed.variants) {
      if (parsed.variants.length > 10) {
        warnings.push({
          code: 'TOO_MANY_VARIANTS',
          message: `Large number of variants (${parsed.variants.length}) may impact performance`,
          severity: 'warning',
          category: 'performance'
        });
      }
    }
  }



  // These methods are reserved for future comparison functionality
  // private static compareMasterPlaylists(...)
  // private static compareMediaPlaylists(...)

  private static isRepairableIssue(code: string): boolean {
    const repairableCodes = [
      'MISSING_VERSION',
      'MISSING_TARGET_DURATION',
      'INVALID_MEDIA_SEQUENCE'
    ];
    return repairableCodes.includes(code);
  }

  private static applyRepair(content: string, issue: ValidationError): string {
    switch (issue.code) {
      case 'MISSING_VERSION':
        return '#EXT-X-VERSION:3\n' + content;
      
      case 'MISSING_TARGET_DURATION':
        // Intentar detectar duración máxima de segmentos
        const lines = content.split('\n');
        const durations = lines
          .filter(line => line.startsWith('#EXTINF:'))
          .map(line => {
            const parts = line.split(':');
            return parts.length > 1 && parts[1] ? parseFloat(parts[1]) : 0;
          })
          .filter(d => !isNaN(d));
        const maxDuration = durations.length > 0 ? Math.max(...durations) : 6;
        
        const insertIndex = lines.findIndex(line => line.startsWith('#EXT-X-VERSION:')) + 1;
        lines.splice(insertIndex, 0, `#EXT-X-TARGETDURATION:${Math.ceil(maxDuration)}`);
        return lines.join('\n');

      case 'INVALID_MEDIA_SEQUENCE':
        // Reemplazar secuencia negativa con 0
        return content.replace(/#EXT-X-MEDIA-SEQUENCE:-\d+/, '#EXT-X-MEDIA-SEQUENCE:0');

      default:
        return content;
    }
  }

  private static isValidH264Profile(profile: string): boolean {
    const validProfiles = [
      '420000', '42000d', '42000e', '42000f', // Baseline
      '4d0000', '4d000d', '4d000e', '4d000f', // Main
      '640000', '64000d', '64000e', '64000f'  // High
    ];
    return validProfiles.some(p => profile.toLowerCase().startsWith(p));
  }

  private static isValidAACProfile(profile: string): boolean {
    const validProfiles = ['40', '41', '42', '43'];
    return validProfiles.includes(profile);
  }
}

export default HLSPlaylistValidator;