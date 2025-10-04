import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { TestMediaGenerator } from '../src/TestMediaGenerator';
import { FFmpegManager } from '../src/FFmpegManager';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('TestMediaGenerator Tests', () => {
  let generator: TestMediaGenerator;
  let ffmpegPath: string;
  let testOutputDir: string;

  beforeAll(async () => {
    // Configurar FFmpeg
    const manager = new FFmpegManager();
    const isAvailable = await manager.isFFmpegAvailable();
    if (!isAvailable){
      await manager.downloadFFmpegBinaries();
    }
    const { ffmpegPath: ffmpeg } = await manager.verifyBinaries();
    ffmpegPath = ffmpeg;

    // Crear directorio temporal
    testOutputDir = path.join(os.tmpdir(), 'test-media-' + Date.now());
    await fs.ensureDir(testOutputDir);

    generator = new TestMediaGenerator(ffmpegPath, testOutputDir);
  });

  afterAll(async () => {
    await generator.cleanup();
    if (await fs.pathExists(testOutputDir)) {
      await fs.remove(testOutputDir);
    }
  });

  describe('Initialization', () => {
    test('should initialize with paths', () => {
      expect(generator).toBeDefined();
    });

    test('should create output directory', async () => {
      const exists = await fs.pathExists(testOutputDir);
      expect(exists).toBe(true);
    });
  });

  describe('Video Generation', () => {
    test('should generate basic test video', async () => {
      const result = await generator.generateTestVideo('test_basic.mp4', {
        duration: 5,
        width: 640,
        height: 480
      });

      expect(result.path).toContain('test_basic.mp4');
      expect(result.type).toBe('video');
      expect(result.size).toBeGreaterThan(0);
      expect(await fs.pathExists(result.path)).toBe(true);
    }, 30000);

    test('should generate HD video', async () => {
      const result = await generator.generateTestVideo('test_hd.mp4', {
        duration: 5,
        width: 1920,
        height: 1080,
        fps: 30
      });

      expect(result.metadata.width).toBe(1920);
      expect(result.metadata.height).toBe(1080);
      expect(result.size).toBeGreaterThan(0);
    }, 30000);

    test('should generate video with custom bitrate', async () => {
      const result = await generator.generateTestVideo('test_bitrate.mp4', {
        duration: 5,
        bitrate: '2000k'
      });

      expect(result.metadata.bitrate).toBe('2000k');
    }, 30000);

    test('should validate generated video', async () => {
      const result = await generator.generateTestVideo('test_validate.mp4', {
        duration: 3
      });

      const isValid = await generator.validateMediaFile(result.path);
      expect(isValid).toBe(true);
    }, 30000);
  });

  describe('Video with Audio Generation', () => {
    test('should generate video with audio', async () => {
      const result = await generator.generateVideoWithAudio('test_audio_video.mp4', {
        duration: 5,
        width: 1280,
        height: 720,
        frequency: 440
      });

      expect(result.type).toBe('video');
      expect(result.metadata.hasAudio).toBe(true);
      expect(result.metadata.audioFrequency).toBe(440);
    }, 30000);

    test('should generate video with different audio frequency', async () => {
      const result = await generator.generateVideoWithAudio('test_audio_880.mp4', {
        duration: 5,
        frequency: 880
      });

      expect(result.metadata.audioFrequency).toBe(880);
    }, 30000);
  });

  describe('Audio Generation', () => {
    test('should generate basic audio file', async () => {
      const result = await generator.generateTestAudio('test_audio.mp3', {
        duration: 5,
        frequency: 440
      });

      expect(result.type).toBe('audio');
      expect(result.size).toBeGreaterThan(0);
      expect(await fs.pathExists(result.path)).toBe(true);
    }, 30000);

    test('should generate stereo audio', async () => {
      const result = await generator.generateTestAudio('test_stereo.mp3', {
        duration: 5,
        channels: 2
      });

      expect(result.metadata.channels).toBe(2);
    }, 30000);

    test('should generate audio with custom bitrate', async () => {
      const result = await generator.generateTestAudio('test_audio_bitrate.mp3', {
        duration: 5,
        bitrate: '192k'
      });

      expect(result.metadata.bitrate).toBe('192k');
    }, 30000);
  });

  describe('Image Generation', () => {
    test('should generate basic image', async () => {
      const result = await generator.generateTestImage('test_image.jpg', {
        width: 1920,
        height: 1080
      });

      expect(result.type).toBe('image');
      expect(result.size).toBeGreaterThan(0);
      expect(await fs.pathExists(result.path)).toBe(true);
    }, 30000);

    test('should generate image with custom color', async () => {
      const result = await generator.generateTestImage('test_red.jpg', {
        width: 1280,
        height: 720,
        color: 'red'
      });

      expect(result.metadata.color).toBe('red');
    }, 30000);

    test('should generate different image formats', async () => {
      const jpg = await generator.generateTestImage('test.jpg', { format: 'jpg' });
      const png = await generator.generateTestImage('test.png', { format: 'png' });

      expect(jpg.path).toContain('.jpg');
      expect(png.path).toContain('.png');
    }, 30000);
  });

  describe('Corrupted Media', () => {
    test('should generate corrupted video', async () => {
      const result = await generator.generateCorruptedVideo('test_corrupted.mp4');

      expect(result.type).toBe('video');
      expect(result.metadata.corrupted).toBe(true);
      expect(await fs.pathExists(result.path)).toBe(true);
    });

    test('corrupted video should fail validation', async () => {
      const result = await generator.generateCorruptedVideo('test_invalid.mp4');
      const isValid = await generator.validateMediaFile(result.path);

      expect(isValid).toBe(false);
    });
  });

  describe('Test Suite Generation', () => {
    test('should generate complete test suite', async () => {
      const files = await generator.generateTestSuite();

      expect(files.length).toBeGreaterThan(0);
      expect(files.some(f => f.type === 'video')).toBe(true);
      expect(files.some(f => f.type === 'audio')).toBe(true);
      expect(files.some(f => f.type === 'image')).toBe(true);
    }, 120000);

    test('all suite files should exist', async () => {
      const files = await generator.generateTestSuite();

      for (const file of files) {
        const exists = await fs.pathExists(file.path);
        expect(exists).toBe(true);
      }
    }, 120000);
  });

  describe('Media Info', () => {
    test('should get media info from video', async () => {
      const video = await generator.generateTestVideo('test_info.mp4', {
        duration: 5
      });

      const info = await generator.getMediaInfo(video.path);

      expect(info).toBeDefined();
      expect(info.format).toBeDefined();
      expect(info.streams).toBeDefined();
    }, 30000);

    test('media info should contain duration', async () => {
      const video = await generator.generateTestVideo('test_duration.mp4', {
        duration: 10
      });

      const info = await generator.getMediaInfo(video.path);
      const duration = parseFloat(info.format.duration);

      expect(duration).toBeGreaterThan(9);
      expect(duration).toBeLessThan(11);
    }, 30000);
  });
  describe('mkv with audio and subtitles', () => {
    test('should generate mkv with audio and subtitles', async () => {
      const video = await generator.generateVideoWithSubtitles('test_mkv.mkv', {
        duration: 10
      });

      const info = await generator.getMediaInfo(video.path);
      
      expect(video.type).toBe('video');
      expect(video.metadata.hasSubtitles).toBe(true);
      expect(video.path).toContain('.mkv');
      expect(info.streams).toBeDefined();
      expect(info.streams.some((stream: any) => stream.codec_type === 'subtitle')).toBe(true);
    }, 30000);
  })
  describe('Cleanup', () => {
    test('should cleanup generated files', async () => {
      await generator.generateTestVideo('cleanup_test.mp4', { duration: 2 });
      
      const filesBefore = await fs.readdir(testOutputDir);
      expect(filesBefore.length).toBeGreaterThan(0);

      await generator.cleanup();

      const filesAfter = await fs.readdir(testOutputDir);
      expect(filesAfter.length).toBe(0);
    }, 30000);
  });
});