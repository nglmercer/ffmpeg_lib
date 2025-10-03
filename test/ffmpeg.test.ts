import { describe, test, expect, beforeEach, afterEach, beforeAll, mock } from 'bun:test';
import { FFmpegManager } from '../src/FFmpegManager';
import { FFmpegCommand } from '../src/FFmpegCommand';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('FFmpeg Library Tests', () => {
  let manager: FFmpegManager;
  let testBinariesDir: string;

  beforeAll(() => {
    // Crear directorio temporal para tests
    testBinariesDir = path.join(os.tmpdir(), 'ffmpeg-test-' + Date.now());
  });

  beforeEach(() => {
    manager = new FFmpegManager(testBinariesDir);
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
      const isAvailable = await manager.isFFmpegAvailable();
      if (!isAvailable){
        await manager.downloadFFmpegBinaries(true);
      }      
      const { ffmpegPath, ffprobePath } = await manager.verifyBinaries();
      
      expect(await fs.pathExists(ffmpegPath)).toBe(true);
      expect(await fs.pathExists(ffprobePath)).toBe(true);
    }, 120000); // 2 minutos timeout

    test('should create manifest after successful installation', async () => {
      const isAvailable = await manager.isFFmpegAvailable();
      if (!isAvailable){
        await manager.downloadFFmpegBinaries(true);
      }    
      
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

  describe('Integration Tests', () => {
    test('should be able to create workflow', async () => {
      const workflow = {
        manager: new FFmpegManager(testBinariesDir),
      };
      
      expect(workflow.manager).toBeInstanceOf(FFmpegManager);
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

  describe('FFmpegManager Integration with FFmpegCommand', () => {
    test('should create FFmpegCommand with manager paths', async () => {
      const isAvailable = await manager.isFFmpegAvailable();
      if (!isAvailable){
        await manager.downloadFFmpegBinaries(true);
      }    
      const { ffmpegPath, ffprobePath } = await manager.verifyBinaries();
      
      const command = new FFmpegCommand({ ffmpegPath, ffprobePath });
      expect(command).toBeDefined();
    }, 120000);

    test('should verify binaries work with FFmpegCommand', async () => {
      const isAvailable = await manager.isFFmpegAvailable();
      if (!isAvailable){
        await manager.downloadFFmpegBinaries(true);
      }    
      const { ffmpegPath, ffprobePath } = await manager.verifyBinaries();
      
      // Test that FFmpegCommand can be created and basic operations work
      const command = new FFmpegCommand({ ffmpegPath, ffprobePath });
      expect(() => {
        command.input('test.mp4').output('output.mp4');
      }).not.toThrow();
    }, 120000);
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