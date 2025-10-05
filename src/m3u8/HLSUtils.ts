/**
 * Utilidades para HLS/M3U8 playlists
 * Proporciona funciones auxiliares para manipulación y análisis de playlists
 */

// Bun provides crypto utilities globally

export class HLSUtils {
  /**
   * Compara dos playlists para verificar compatibilidad
   */
  static comparePlaylists(content1: string, content2: string): {
    compatible: boolean;
    differences: string[];
    warnings: string[];
  } {
    const differences: string[] = [];
    const warnings: string[] = [];

    // Handle empty content
    if (!content1 || content1.trim().length === 0) {
      differences.push('First playlist is empty');
    }
    if (!content2 || content2.trim().length === 0) {
      differences.push('Second playlist is empty');
    }
    if (differences.length > 0) {
      return {
        compatible: false,
        differences,
        warnings
      };
    }

    const lines1 = content1.split('\n').map(line => line.trim());
    const lines2 = content2.split('\n').map(line => line.trim());

    // Check headers
    const header1 = lines1[0];
    const header2 = lines2[0];
    
    if (header1 !== header2) {
      differences.push(`Header mismatch: ${header1} vs ${header2}`);
    }

    // Check if headers are missing
    if (!header1?.startsWith('#EXTM3U')) {
      differences.push('First playlist missing #EXTM3U header');
    }
    if (!header2?.startsWith('#EXTM3U')) {
      differences.push('Second playlist missing #EXTM3U header');
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
      differences.push(`Playlist type mismatch: master vs media`);
    }

    // For media playlists, check segment differences
    if (!isMaster1 && !isMaster2) {
      const segments1 = lines1.filter(line => line.endsWith('.ts') || line.endsWith('.m3u8'));
      const segments2 = lines2.filter(line => line.endsWith('.ts') || line.endsWith('.m3u8'));
      
      if (segments1.length !== segments2.length) {
        differences.push(`Segment count mismatch: ${segments1.length} vs ${segments2.length}`);
      } else {
        // Check for different segments
        for (let i = 0; i < segments1.length; i++) {
          if (segments1[i] !== segments2[i]) {
            differences.push(`Segment difference at position ${i}: ${segments1[i]} vs ${segments2[i]}`);
            break; // Only report first difference
          }
        }
      }
    }

    return {
      compatible: differences.length === 0,
      differences,
      warnings
    };
  }

  /**
   * Genera un hash único para un playlist (para detección de cambios)
   */
  static generatePlaylistHash(content: string): string {
    const crypto = require('node:crypto');
    return crypto.hash('sha256', content, 'hex');
  }

  /**
   * Normaliza un playlist para mejor compatibilidad entre reproductores
   */
  static normalizePlaylist(content: string): string {
    const lines = content.split('\n').map(line => line.trim());
    const normalizedLines: string[] = [];
    
    // Ensure proper header
    if (!lines[0]?.startsWith('#EXTM3U')) {
      normalizedLines.push('#EXTM3U');
    }

    // Ensure version tag is present
    const hasVersion = lines.some(line => line.startsWith('#EXT-X-VERSION:'));
    if (!hasVersion) {
      normalizedLines.push('#EXT-X-VERSION:3');
    }

    // Add all original lines
    normalizedLines.push(...lines.filter(line => line.length > 0));

    // Ensure proper line endings
    return normalizedLines.join('\n') + '\n';
  }

  /**
   * Extrae la duración total de un playlist de medios
   */
  static extractDuration(content: string): number {
    const lines = content.split('\n').map(line => line.trim());
    let totalDuration = 0;

    for (const line of lines) {
      if (line.startsWith('#EXTINF:')) {
        const parts = line.split(':');
        if (parts.length > 1 && parts[1]) {
          const durationParts = parts[1].split(',');
          if (durationParts.length > 0 && durationParts[0]) {
            const duration = parseFloat(durationParts[0]);
            if (!isNaN(duration)) {
              totalDuration += duration;
            }
          }
        }
      }
    }

    return totalDuration;
  }

  /**
   * Verifica si un playlist es maestro o de medios
   */
  static isMasterPlaylist(content: string): boolean {
    if (!content || content.trim().length === 0) {
      return false;
    }
    return content.includes('#EXT-X-STREAM-INF:');
  }

  /**
   * Verifica si un playlist es VOD (Video On Demand)
   */
  static isVODPlaylist(content: string): boolean {
    return content.includes('#EXT-X-PLAYLIST-TYPE:VOD') || content.includes('#EXT-X-ENDLIST');
  }

  /**
   * Verifica si un playlist es en vivo (LIVE)
   */
  static isLivePlaylist(content: string): boolean {
    // Master playlists are not considered live
    if (this.isMasterPlaylist(content)) {
      return false;
    }
    return !content.includes('#EXT-X-ENDLIST');
  }

  /**
   * Obtiene la versión del playlist
   */
  static getVersion(content: string): number {
    const versionMatch = content.match(/#EXT-X-VERSION:(\d+)/);
    return versionMatch && versionMatch[1] ? parseInt(versionMatch[1], 10) : 1;
  }

  /**
   * Obtiene el target duration del playlist
   */
  static getTargetDuration(content: string): number {
    const targetDurationMatch = content.match(/#EXT-X-TARGETDURATION:(\d+)/);
    return targetDurationMatch && targetDurationMatch[1] ? parseInt(targetDurationMatch[1], 10) : 0;
  }
}