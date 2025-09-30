import { describe, test, expect, beforeEach, afterEach, beforeAll, mock } from 'bun:test';
import { FFmpegManager } from '../src/FFmpegManager';
import { FFmpegCtrl } from '../src/FFmpegCtrl';
import { VideoProcessor } from '../src/VideoProcessor';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('FFmpeg Library Tests', () => {
  let manager: FFmpegManager;
  let processor: VideoProcessor;
  let testBinariesDir: string;

  beforeAll(() => {
    // Crear directorio temporal para tests
    testBinariesDir = path.join(os.tmpdir(), 'ffmpeg-test-' + Date.now());
  });

  beforeEach(() => {
    manager = new FFmpegManager(testBinariesDir);
    processor = new VideoProcessor();
  });

  afterEach(async () => {
    // Limpiar después de cada test
    try {
      if (await fs.pathExists(testBinariesDir)) {
        await fs.remove(testBinariesDir);
      }
    } catch (error) {
      console.warn('Cleanup warning:', error);
    }
  });

  describe('FFmpegManager - Initialization', () => {
    test('should initialize with correct platform', () => {
      expect(manager.platform).toBeDefined();
      expect(['win32', 'linux', 'darwin']).toContain(manager.platform);
    });

    test('should use custom binaries directory when provided', () => {
      const customDir = '/custom/path';
      const customManager = new FFmpegManager(customDir);
      expect(customManager.binariesDir).toBe(customDir);
    });

    test('should have correct URLs for each platform', () => {
      const urls = manager.ffmpegUrls;
      
      expect(urls.win32).toContain('ffmpeg');
      expect(urls.win32).toContain('zip');
      
      expect(urls.linux).toContain('ffmpeg');
      expect(urls.linux).toContain('tar');
      
      expect(urls.darwin).toContain('ffmpeg');
    });

    test('should create binaries directory structure', async () => {
      await fs.ensureDir(manager.binariesDir);
      const exists = await fs.pathExists(manager.binariesDir);
      expect(exists).toBe(true);
    });
  });

  describe('FFmpegManager - Binary Paths', () => {
    test('should return correct FFmpeg path for current platform', () => {
      const ffmpegPath = manager.getFFmpegPath();
      const expectedName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
      
      expect(ffmpegPath).toContain(expectedName);
      expect(ffmpegPath).toContain(manager.binariesDir);
    });

    test('should return correct FFprobe path for current platform', () => {
      const ffprobePath = manager.getFFprobePath();
      const expectedName = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
      
      expect(ffprobePath).toContain(expectedName);
      expect(ffprobePath).toContain(manager.binariesDir);
    });

    test('paths should be different', () => {
      const ffmpegPath = manager.getFFmpegPath();
      const ffprobePath = manager.getFFprobePath();
      
      expect(ffmpegPath).not.toBe(ffprobePath);
    });
  });

  describe('FFmpegManager - Version and Cache', () => {
    test('should check for updates when no binaries exist', async () => {
      const needsUpdate = await manager.checkForUpdates();
      expect(needsUpdate).toBe(true);
    });

    test('should return null when no manifest exists', async () => {
      const info = await manager.getInstallationInfo();
      expect(info).toBeNull();
    });

    test('isFFmpegAvailable should return false when not installed', async () => {
      const available = await manager.isFFmpegAvailable();
      expect(available).toBe(false);
    });

    test('verifyBinaries should throw when binaries not found', async () => {
      expect(async () => {
        await manager.verifyBinaries();
      }).toThrow();
    });
  });

  describe('FFmpegManager - Download and Installation', () => {
    test('should create necessary directories for download', async () => {
      await fs.ensureDir(manager.binariesDir);
      const exists = await fs.pathExists(manager.binariesDir);
      expect(exists).toBe(true);
    });

    // Test de integración (puede tardar, considera skipear en CI)
    test('should download and install FFmpeg binaries', async () => {
      await manager.downloadFFmpegBinaries(true);
      
      const { ffmpegPath, ffprobePath } = await manager.verifyBinaries();
      
      expect(await fs.pathExists(ffmpegPath)).toBe(true);
      expect(await fs.pathExists(ffprobePath)).toBe(true);
    }, 120000); // 2 minutos timeout

    test('should create manifest after successful installation', async () => {
      await manager.downloadFFmpegBinaries(true);
      
      const info = await manager.getInstallationInfo();
      
      expect(info).not.toBeNull();
      expect(info?.version).toBeDefined();
      expect(info?.platform).toBe(manager.platform);
      expect(info?.checksum).toBeDefined();
    }, 120000);
  });

  describe('FFmpegManager - Cleanup', () => {
    test('should have cleanBinaries method', () => {
      expect(typeof manager.cleanBinaries).toBe('function');
    });

    test('cleanBinaries should not throw on empty directory', async () => {
      let error = null;
      try {
        await manager.cleanBinaries();
      } catch (e) {
        error = e;
      }
      expect(error).toBeNull();
    });
  });


  describe('FFmpegCtrl - Initialization', () => {
    test('should initialize with paths', () => {
      const ctrl = new FFmpegCtrl('/path/to/ffmpeg', '/path/to/ffprobe');
      expect(ctrl.ffmpegPath).toBe('/path/to/ffmpeg');
      expect(ctrl.ffprobePath).toBe('/path/to/ffprobe');
    });

    test('should store paths correctly', () => {
      const ffmpegPath = '/custom/ffmpeg';
      const ffprobePath = '/custom/ffprobe';
      const ctrl = new FFmpegCtrl(ffmpegPath, ffprobePath);
      
      expect(ctrl.ffmpegPath).toBe(ffmpegPath);
      expect(ctrl.ffprobePath).toBe(ffprobePath);
    });
  });

  describe('FFmpegCtrl - Methods', () => {
    let ctrl: FFmpegCtrl;

    beforeEach(() => {
      ctrl = new FFmpegCtrl('/path/to/ffmpeg', '/path/to/ffprobe');
    });

    test('should have processVideo method', () => {
      expect(typeof ctrl.processVideo).toBe('function');
    });

    test('should have getVideoInfo method', () => {
      expect(typeof ctrl.getVideoInfo).toBe('function');
    });

    test('should have createThumbnail method', () => {
      expect(typeof ctrl.createThumbnail).toBe('function');
    });

    test('should have extractAudio method', () => {
      expect(typeof ctrl.extractAudio).toBe('function');
    });

    test('all methods should be defined', () => {
      const methods = ['processVideo', 'getVideoInfo', 'createThumbnail', 'extractAudio'];
      
      methods.forEach(method => {
        expect(ctrl[method as keyof FFmpegCtrl]).toBeDefined();
        expect(typeof ctrl[method as keyof FFmpegCtrl]).toBe('function');
      });
    });
  });

  describe('VideoProcessor - Quality Profiles', () => {
    test('should initialize with default quality profiles', () => {
      expect(processor.qualityProfiles).toBeDefined();
      expect(Object.keys(processor.qualityProfiles).length).toBeGreaterThan(0);
    });

    test('should have standard quality profiles', () => {
      const standardProfiles = ['1080p', '720p', '480p', '360p'];
      
      standardProfiles.forEach(profile => {
        expect(processor.qualityProfiles[profile]).toBeDefined();
      });
    });

    test('should have correct 1080p profile structure', () => {
      const profile = processor.qualityProfiles['1080p'];
      
      expect(profile.resolution).toBe('1920x1080');
      expect(profile.videoBitrate).toBeDefined();
      expect(profile.audioBitrate).toBeDefined();
      expect(profile.suffix).toBe('_1080p');
    });

    test('should have correct 720p profile structure', () => {
      const profile = processor.qualityProfiles['720p'];
      
      expect(profile.resolution).toBe('1280x720');
      expect(profile.videoBitrate).toBeDefined();
      expect(profile.audioBitrate).toBeDefined();
      expect(profile.suffix).toBe('_720p');
    });

    test('all profiles should have required fields', () => {
      const profiles = Object.values(processor.qualityProfiles);
      
      profiles.forEach(profile => {
        expect(profile.resolution).toBeDefined();
        expect(profile.videoBitrate).toBeDefined();
        expect(profile.audioBitrate).toBeDefined();
        expect(profile.suffix).toBeDefined();
      });
    });
  });

  describe('VideoProcessor - Custom Profiles', () => {
    test('should allow setting custom quality profiles', () => {
      const customProfile = {
        resolution: '2560x1440',
        videoBitrate: '6000k',
        audioBitrate: '256k',
        suffix: '_1440p'
      };
      
      processor.setCustomQualityProfile('1440p', customProfile);
      expect(processor.qualityProfiles['1440p']).toEqual(customProfile);
    });

    test('should override existing quality profiles', () => {
      const originalProfile = processor.qualityProfiles['1080p'];
      
      const newProfile = {
        resolution: '1920x1080',
        videoBitrate: '8000k',
        audioBitrate: '320k',
        suffix: '_1080p_hq'
      };
      
      processor.setCustomQualityProfile('1080p', newProfile);
      expect(processor.qualityProfiles['1080p']).toEqual(newProfile);
      expect(processor.qualityProfiles['1080p']).not.toEqual(originalProfile);
    });

    test('should preserve other profiles when setting custom profile', () => {
      const profile720p = processor.qualityProfiles['720p'];
      
      processor.setCustomQualityProfile('custom', {
        resolution: '1024x576',
        videoBitrate: '2500k',
        audioBitrate: '128k',
        suffix: '_custom'
      });
      
      expect(processor.qualityProfiles['720p']).toEqual(profile720p);
    });

    test('custom profile should be accessible', () => {
      const customKey = 'ultraHD';
      const customProfile = {
        resolution: '3840x2160',
        videoBitrate: '16000k',
        audioBitrate: '320k',
        suffix: '_4k'
      };
      
      processor.setCustomQualityProfile(customKey, customProfile);
      
      expect(processor.qualityProfiles[customKey]).toBeDefined();
      expect(processor.qualityProfiles[customKey]).toEqual(customProfile);
    });
  });

  describe('VideoProcessor - Profile Validation', () => {
    test('should validate profile structure', () => {
      const validProfile = processor.qualityProfiles['1080p'];
      
      expect(validProfile).toHaveProperty('resolution');
      expect(validProfile).toHaveProperty('videoBitrate');
      expect(validProfile).toHaveProperty('audioBitrate');
      expect(validProfile).toHaveProperty('suffix');
    });

    test('bitrate values should be strings with k suffix', () => {
      const profiles = Object.values(processor.qualityProfiles);
      
      profiles.forEach(profile => {
        expect(typeof profile.videoBitrate).toBe('string');
        expect(typeof profile.audioBitrate).toBe('string');
        expect(profile.videoBitrate).toMatch(/\d+k/);
        expect(profile.audioBitrate).toMatch(/\d+k/);
      });
    });

    test('resolution should be in WxH format', () => {
      const profiles = Object.values(processor.qualityProfiles);
      
      profiles.forEach(profile => {
        expect(profile.resolution).toMatch(/^\d+x\d+$/);
      });
    });

    test('suffix should start with underscore', () => {
      const profiles = Object.values(processor.qualityProfiles);
      
      profiles.forEach(profile => {
        expect(profile.suffix).toMatch(/^_/);
      });
    });
  });

  describe('Integration Tests', () => {
    test('FFmpegManager and FFmpegCtrl should work together', () => {
      const ffmpegPath = manager.getFFmpegPath();
      const ffprobePath = manager.getFFprobePath();
      
      const ctrl = new FFmpegCtrl(ffmpegPath, ffprobePath);
      
      expect(ctrl.ffmpegPath).toBe(ffmpegPath);
      expect(ctrl.ffprobePath).toBe(ffprobePath);
    });

    test('should be able to create workflow', async () => {
      const workflow = {
        manager: new FFmpegManager(testBinariesDir),
        processor: new VideoProcessor()
      };
      
      expect(workflow.manager).toBeInstanceOf(FFmpegManager);
      expect(workflow.processor).toBeInstanceOf(VideoProcessor);
      expect(workflow.processor.qualityProfiles).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should throw error for unsupported platform', () => {
      // Mock process.platform
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'unsupported',
        configurable: true
      });
      
      expect(() => {
        new FFmpegManager();
      }).toThrow('Unsupported platform');
      
      // Restore
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true
      });
    });

    test('verifyBinaries should provide helpful error message', async () => {
      try {
        await manager.verifyBinaries();
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain('not found');
        expect((error as Error).message).toContain('downloadFFmpegBinaries');
      }
    });
  });

  describe('Performance Tests', () => {
    test('getFFmpegPath should be fast', () => {
      const start = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        manager.getFFmpegPath();
      }
      
      const end = performance.now();
      const duration = end - start;
      
      expect(duration).toBeLessThan(100); // Should take less than 100ms for 1000 calls
    });

    test('multiple manager instances should not conflict', () => {
      const manager1 = new FFmpegManager(testBinariesDir + '/instance1');
      const manager2 = new FFmpegManager(testBinariesDir + '/instance2');
      
      expect(manager1.binariesDir).not.toBe(manager2.binariesDir);
      expect(manager1.getFFmpegPath()).not.toBe(manager2.getFFmpegPath());
    });
  });
});

describe('Edge Cases and Security', () => {
  test('should handle paths with special characters', () => {
    const specialPath = '/path/with spaces/and-dashes/under_scores';
    const manager = new FFmpegManager(specialPath);
    
    expect(manager.binariesDir).toBe(specialPath);
  });

  test('should sanitize file paths', () => {
    const manager = new FFmpegManager();
    const ffmpegPath = manager.getFFmpegPath();
    
    // Should not contain path traversal
    expect(ffmpegPath).not.toContain('..');
    expect(ffmpegPath).not.toContain('//');
  });
});