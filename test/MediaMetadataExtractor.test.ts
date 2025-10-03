import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { 
  MediaMetadataExtractor, 
  MediaType, 
  MediaMetadata,
  formatFileSize,
  formatBitrate
} from '../src/MediaMetadataExtractor';
import { FFmpegManager } from '../src/FFmpegManager';
import { TestMediaGenerator } from '../src/TestMediaGenerator';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('MediaMetadataExtractor Tests', () => {
  let extractor: MediaMetadataExtractor;
  let testMediaGenerator: TestMediaGenerator;
  let testOutputDir: string;
  let ffmpegPath: string;
  let ffprobePath: string;

  beforeAll(async () => {
    // Setup FFmpeg binaries
    const manager = new FFmpegManager();
    const isAvailable = await manager.isFFmpegAvailable();
    if (!isAvailable){
      await manager.downloadFFmpegBinaries();
    }
    const binaries = await manager.verifyBinaries();
    ffmpegPath = binaries.ffmpegPath;
    ffprobePath = binaries.ffprobePath;

    // Create test output directory
    testOutputDir = path.join(os.tmpdir(), 'metadata-test-' + Date.now());
    await fs.ensureDir(testOutputDir);

    // Initialize metadata extractor
    extractor = new MediaMetadataExtractor(ffprobePath);

    // Initialize test media generator
    testMediaGenerator = new TestMediaGenerator(ffmpegPath, testOutputDir);
  });

  afterAll(async () => {
    // Cleanup test files
    await testMediaGenerator.cleanup();
    if (await fs.pathExists(testOutputDir)) {
      await fs.remove(testOutputDir);
    }
  });

  describe('MediaMetadataExtractor - Initialization', () => {
    test('should initialize with ffprobe path', () => {
      const instance = new MediaMetadataExtractor(ffprobePath);
      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(MediaMetadataExtractor);
    });

    test('should throw error when ffprobe path is empty', () => {
      expect(() => new MediaMetadataExtractor('')).toThrow('FFprobe path is required');
    });

    test('should throw error when ffprobe path is null', () => {
      expect(() => new MediaMetadataExtractor(null as any)).toThrow('FFprobe path is required');
    });
  });

  describe('MediaMetadataExtractor - Video Metadata', () => {
    test('should extract complete metadata from video file', async () => {
      const testVideo = await testMediaGenerator.generateTestVideo('metadata_video.mp4', {
        duration: 5,
        width: 1280,
        height: 720,
        fps: 30
      });

      const metadata = await extractor.extractMetadata(testVideo.path);

      expect(metadata).toBeDefined();
      expect(metadata.mediaType).toBe(MediaType.VIDEO);
      expect(metadata.fileName).toBe('metadata_video.mp4');
      expect(metadata.fileExtension).toBe('mp4');
      expect(metadata.fileSize).toBeGreaterThan(0);
      expect(metadata.duration).toBeGreaterThan(4);
      expect(metadata.duration).toBeLessThan(6);
      expect(metadata.durationFormatted).toMatch(/00:00:0[45]/);
    }, 30000);

    test('should extract primary video information', async () => {
      const testVideo = await testMediaGenerator.generateTestVideo('video_info.mp4', {
        duration: 3,
        width: 1920,
        height: 1080,
        fps: 60
      });

      const metadata = await extractor.extractMetadata(testVideo.path);

      expect(metadata.primaryVideo).toBeDefined();
      expect(metadata.primaryVideo?.width).toBe(1920);
      expect(metadata.primaryVideo?.height).toBe(1080);
      expect(metadata.primaryVideo?.resolution).toBe('1920x1080');
      expect(metadata.primaryVideo?.aspectRatio).toBe('16:9');
      expect(metadata.primaryVideo?.codec).toBeDefined();
      expect(metadata.primaryVideo?.frameRate).toBeDefined();
    }, 30000);

    test('should extract video streams information', async () => {
      const testVideo = await testMediaGenerator.generateTestVideo('video_streams.mp4', {
        duration: 2,
        width: 640,
        height: 480
      });

      const metadata = await extractor.extractMetadata(testVideo.path);

      expect(metadata.streams).toBeDefined();
      expect(Array.isArray(metadata.streams)).toBe(true);
      expect(metadata.videoStreams).toBeDefined();
      expect(metadata.videoStreams.length).toBeGreaterThan(0);
      
      const videoStream = metadata.videoStreams[0];
      expect(videoStream.codecType).toBe(MediaType.VIDEO);
      expect(videoStream.codecName).toBeDefined();
      expect(videoStream.width).toBe(640);
      expect(videoStream.height).toBe(480);
    }, 30000);

    test('should extract format information', async () => {
      const testVideo = await testMediaGenerator.generateTestVideo('format_test.mp4', {
        duration: 4,
        width: 800,
        height: 600
      });

      const metadata = await extractor.extractMetadata(testVideo.path);

      expect(metadata.format).toBeDefined();
      expect(metadata.format.formatName).toBeDefined();
      expect(metadata.format.formatLongName).toBeDefined();
      expect(metadata.format.duration).toBeGreaterThan(3);
      expect(metadata.format.size).toBeGreaterThan(0);
      expect(metadata.format.filename).toBeDefined();
    }, 30000);

    test('should calculate aspect ratio correctly', async () => {
      const testCases = [
        { width: 1920, height: 1080, expected: '16:9' },
        { width: 1280, height: 720, expected: '16:9' },
        { width: 640, height: 480, expected: '4:3' },
        { width: 3840, height: 2160, expected: '16:9' }
      ];

      for (const testCase of testCases) {
        const video = await testMediaGenerator.generateTestVideo(
          `aspect_${testCase.width}x${testCase.height}.mp4`,
          {
            duration: 1,
            width: testCase.width,
            height: testCase.height
          }
        );

        const metadata = await extractor.extractMetadata(video.path);
        expect(metadata.primaryVideo?.aspectRatio).toBe(testCase.expected);
      }
    }, 60000);
  });

  describe('MediaMetadataExtractor - Audio Metadata', () => {
    test('should extract complete metadata from audio file', async () => {
      const testAudio = await testMediaGenerator.generateTestAudio('metadata_audio.mp3', {
        duration: 5,
        frequency: 440,
        channels: 2
      });

      const metadata = await extractor.extractMetadata(testAudio.path);

      expect(metadata).toBeDefined();
      expect(metadata.mediaType).toBe(MediaType.AUDIO);
      expect(metadata.fileName).toBe('metadata_audio.mp3');
      expect(metadata.fileExtension).toBe('mp3');
      expect(metadata.fileSize).toBeGreaterThan(0);
      expect(metadata.duration).toBeGreaterThan(4);
    }, 30000);

    test('should extract primary audio information', async () => {
      const testAudio = await testMediaGenerator.generateTestAudio('audio_info.mp3', {
        duration: 3,
        frequency: 440,
        channels: 2,
        sampleRate: 44100
      });

      const metadata = await extractor.extractMetadata(testAudio.path);

      expect(metadata.primaryAudio).toBeDefined();
      expect(metadata.primaryAudio?.codec).toBeDefined();
      expect(metadata.primaryAudio?.channels).toBe(2);
      expect(metadata.primaryAudio?.sampleRate).toBeGreaterThan(0);
      expect(metadata.primaryAudio?.channelLayout).toBeDefined();
    }, 30000);

    test('should extract audio streams information', async () => {
      const testAudio = await testMediaGenerator.generateTestAudio('audio_streams.mp3', {
        duration: 2,
        frequency: 880,
        channels: 1
      });

      const metadata = await extractor.extractMetadata(testAudio.path);

      expect(metadata.audioStreams).toBeDefined();
      expect(metadata.audioStreams.length).toBeGreaterThan(0);
      
      const audioStream = metadata.audioStreams[0];
      expect(audioStream.codecType).toBe(MediaType.AUDIO);
      expect(audioStream.codecName).toBeDefined();
      expect(audioStream.channels).toBe(1);
    }, 30000);

    test('should handle different audio channels', async () => {
      const monoAudio = await testMediaGenerator.generateTestAudio('mono.mp3', {
        duration: 2,
        frequency: 440,
        channels: 1
      });

      const stereoAudio = await testMediaGenerator.generateTestAudio('stereo.mp3', {
        duration: 2,
        frequency: 440,
        channels: 2
      });

      const monoMetadata = await extractor.extractMetadata(monoAudio.path);
      const stereoMetadata = await extractor.extractMetadata(stereoAudio.path);

      expect(monoMetadata.primaryAudio?.channels).toBe(1);
      expect(stereoMetadata.primaryAudio?.channels).toBe(2);
    }, 40000);
  });

  describe('MediaMetadataExtractor - Video with Audio', () => {
    test('should extract both video and audio metadata', async () => {
      const videoWithAudio = await testMediaGenerator.generateVideoWithAudio('video_audio.mp4', {
        duration: 5,
        width: 1280,
        height: 720,
        frequency: 440
      });

      const metadata = await extractor.extractMetadata(videoWithAudio.path);

      expect(metadata.mediaType).toBe(MediaType.VIDEO);
      expect(metadata.primaryVideo).toBeDefined();
      expect(metadata.primaryAudio).toBeDefined();
      expect(metadata.videoStreams.length).toBeGreaterThan(0);
      expect(metadata.audioStreams.length).toBeGreaterThan(0);
    }, 30000);

    test('should list all streams correctly', async () => {
      const videoWithAudio = await testMediaGenerator.generateVideoWithAudio('streams_test.mp4', {
        duration: 3,
        width: 640,
        height: 480,
        frequency: 440
      });

      const metadata = await extractor.extractMetadata(videoWithAudio.path);

      expect(metadata.streams.length).toBeGreaterThanOrEqual(2);
      
      const hasVideo = metadata.streams.some(s => s.codecType === MediaType.VIDEO);
      const hasAudio = metadata.streams.some(s => s.codecType === MediaType.AUDIO);
      
      expect(hasVideo).toBe(true);
      expect(hasAudio).toBe(true);
    }, 30000);
  });

  describe('MediaMetadataExtractor - Media Type Detection', () => {
    test('should detect video type', async () => {
      const video = await testMediaGenerator.generateTestVideo('type_video.mp4', {
        duration: 2,
        width: 640,
        height: 480
      });

      const type = await extractor.getMediaType(video.path);
      expect(type).toBe(MediaType.VIDEO);
    }, 30000);

    test('should detect audio type', async () => {
      const audio = await testMediaGenerator.generateTestAudio('type_audio.mp3', {
        duration: 2,
        frequency: 440,
        channels: 2
      });

      const type = await extractor.getMediaType(audio.path);
      expect(type).toBe(MediaType.AUDIO);
    }, 30000);

    test('should detect image type by extension', async () => {
      // Create a simple test image file (1x1 pixel)
      const imagePath = path.join(testOutputDir, 'test.jpg');
      // Create minimal JPEG header
      const jpegData = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 
        0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
        0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9
      ]);
      await fs.writeFile(imagePath, jpegData);

      const type = await extractor.getMediaType(imagePath);
      expect(type).toBe(MediaType.IMAGE);
    }, 30000);

    test('should use isVideo helper method', async () => {
      const video = await testMediaGenerator.generateTestVideo('helper_video.mp4', {
        duration: 1,
        width: 320,
        height: 240
      });

      const isVideo = await extractor.isVideo(video.path);
      expect(isVideo).toBe(true);
    }, 30000);

    test('should use isAudio helper method', async () => {
      const audio = await testMediaGenerator.generateTestAudio('helper_audio.mp3', {
        duration: 1,
        frequency: 440,
        channels: 1
      });

      const isAudio = await extractor.isAudio(audio.path);
      expect(isAudio).toBe(true);
    }, 30000);

    test('should use isImage helper method', async () => {
      const imagePath = path.join(testOutputDir, 'helper_test.png');
      const pngData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
      ]);
      await fs.writeFile(imagePath, pngData);

      const isImage = await extractor.isImage(imagePath);
      expect(isImage).toBe(true);
    }, 30000);
  });

  describe('MediaMetadataExtractor - Basic Info', () => {
    test('should get basic info quickly', async () => {
      const video = await testMediaGenerator.generateTestVideo('basic_info.mp4', {
        duration: 3,
        width: 640,
        height: 480
      });

      const basicInfo = await extractor.getBasicInfo(video.path);

      expect(basicInfo).toBeDefined();
      expect(basicInfo.type).toBe(MediaType.VIDEO);
      expect(basicInfo.duration).toBeGreaterThan(2);
      expect(basicInfo.size).toBeGreaterThan(0);
      expect(basicInfo.format).toBeDefined();
    }, 30000);

    test('should get basic info in reasonable time', async () => {
      const video = await testMediaGenerator.generateTestVideo('speed_test.mp4', {
        duration: 5,
        width: 640,
        height: 480
      });

      const startBasic = Date.now();
      const basicInfo = await extractor.getBasicInfo(video.path);
      const basicTime = Date.now() - startBasic;

      // Verify basic info is correct
      expect(basicInfo).toBeDefined();
      expect(basicInfo.type).toBe(MediaType.VIDEO);
      expect(basicInfo.duration).toBeGreaterThan(4);
      expect(basicInfo.size).toBeGreaterThan(0);

      // Basic info should complete within reasonable time (less than 10 seconds)
      expect(basicTime).toBeLessThan(10000);
      console.log(`Basic info extracted in ${basicTime}ms`);
    }, 30000);
  });

  describe('MediaMetadataExtractor - Error Handling', () => {
    test('should throw error for non-existent file', async () => {
      await expect(
        extractor.extractMetadata('/non/existent/file.mp4')
      ).rejects.toThrow('File not found');
    });

    test('should handle corrupted file gracefully', async () => {
      const corruptedFile = await testMediaGenerator.generateCorruptedVideo('corrupted_meta.mp4');

      await expect(
        extractor.extractMetadata(corruptedFile.path)
      ).rejects.toThrow();
    }, 30000);

    test('should handle timeout', async () => {
      const video = await testMediaGenerator.generateTestVideo('timeout_test.mp4', {
        duration: 2,
        width: 640,
        height: 480
      });

      // Use very short timeout
      await expect(
        extractor.extractMetadata(video.path, { timeout: 1 })
      ).rejects.toThrow('FFprobe failed');
    }, 30000);

    test('should return UNKNOWN for invalid media type', async () => {
      // Create a text file
      const textFile = path.join(testOutputDir, 'invalid.txt');
      await fs.writeFile(textFile, 'This is not a media file');

      const type = await extractor.getMediaType(textFile);
      expect(type).toBe(MediaType.UNKNOWN);
    }, 30000);
  });

  describe('MediaMetadataExtractor - Duration Formatting', () => {
    test('should format duration correctly', async () => {
      const testCases = [
        { duration: 65, expected: '00:01:05' },
        { duration: 120, expected: '00:02:00' },
        { duration: 30, expected: '00:00:30' }
      ];

      for (const testCase of testCases) {
        const video = await testMediaGenerator.generateTestVideo(
          `duration_${testCase.duration}.mp4`,
          {
            duration: testCase.duration,
            width: 320,
            height: 240
          }
        );

        const metadata = await extractor.extractMetadata(video.path);
        expect(metadata.durationFormatted).toMatch(
          new RegExp(testCase.expected.replace(/:/g, ':'))
        );
      }
    }, 60000);
  });

  describe('MediaMetadataExtractor - File Timestamps', () => {
    test('should include file creation and modification dates', async () => {
      const video = await testMediaGenerator.generateTestVideo('timestamps.mp4', {
        duration: 1,
        width: 320,
        height: 240
      });

      const metadata = await extractor.extractMetadata(video.path);

      // Check if timestamps are available (they may not be available on all systems)
      if (metadata.createdAt) {
        expect(metadata.createdAt).toBeInstanceOf(Date);
      }
      if (metadata.modifiedAt) {
        expect(metadata.modifiedAt).toBeInstanceOf(Date);
      }
      
      // At minimum, we should have file information
      expect(metadata.fileName).toBeDefined();
      expect(metadata.fileSize).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Utility Functions', () => {
    test('formatFileSize should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(1073741824)).toBe('1 GB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    test('formatBitrate should format bitrate correctly', () => {
      expect(formatBitrate(0)).toBe('0 bps');
      expect(formatBitrate(1000)).toBe('1 Kbps');
      expect(formatBitrate(1000000)).toBe('1 Mbps');
      expect(formatBitrate(1500000)).toBe('1.5 Mbps');
    });
  });

  describe('MediaMetadataExtractor - Integration with FFmpegManager', () => {
    test('should work seamlessly with FFmpegManager', async () => {
      const manager = new FFmpegManager();
      const isAvailable = await manager.isFFmpegAvailable();
      if (!isAvailable){
        await manager.downloadFFmpegBinaries(true);
      }    

      const video = await testMediaGenerator.generateTestVideo('integration.mp4', {
        duration: 3,
        width: 640,
        height: 480
      });

      const metadata = await manager.extractMetadata(video.path);

      expect(metadata).toBeDefined();
      expect(metadata.mediaType).toBe(MediaType.VIDEO);
      expect(metadata.primaryVideo).toBeDefined();
    }, 30000);

    test('should use cached extractor instance', async () => {
      const manager = new FFmpegManager();
      const isAvailable = await manager.isFFmpegAvailable();
      if (!isAvailable){
        await manager.downloadFFmpegBinaries(true);
      }   

      const extractor1 = manager.getMetadataExtractor();
      const extractor2 = manager.getMetadataExtractor();

      expect(extractor1).toBe(extractor2); // Should be same instance
    }, 30000);
  });
});