import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { FFmpegCommand, FFmpegOptions, VideoOptions, AudioOptions, ProgressInfo, ProbeData, ScreenshotOptions } from '../src/FFmpegCommand';
import { FFmpegManager } from '../src/FFmpegManager';
import { TestMediaGenerator } from '../src/TestMediaGenerator';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('FFmpegCommand Tests', () => {
  let ffmpegCommand: FFmpegCommand;
  let testMediaGenerator: TestMediaGenerator;
  let testOutputDir: string;
  let ffmpegPath: string;
  let ffprobePath: string;

  beforeAll(async () => {
    // Setup FFmpeg binaries and test environment
    const manager = new FFmpegManager();
    await manager.downloadFFmpegBinaries();
    const binaries = await manager.verifyBinaries();
    ffmpegPath = binaries.ffmpegPath;
    ffprobePath = binaries.ffprobePath;

    // Create test output directory
    testOutputDir = path.join(os.tmpdir(), 'ffmpeg-command-test-' + Date.now());
    await fs.ensureDir(testOutputDir);

    // Initialize test media generator
    testMediaGenerator = new TestMediaGenerator(ffmpegPath, testOutputDir);
  }, 120000);

  afterAll(async () => {
    // Cleanup test files
    await testMediaGenerator.cleanup();
    if (await fs.pathExists(testOutputDir)) {
      await fs.remove(testOutputDir);
    }
  });

  beforeEach(() => {
    // Create fresh FFmpegCommand instance for each test
    ffmpegCommand = new FFmpegCommand({ ffmpegPath, ffprobePath });
  });

  afterEach(() => {
    // Clean up any event listeners
    ffmpegCommand.removeAllListeners();
  });

  describe('FFmpegCommand - Initialization', () => {
    test('should initialize with default options', () => {
      const cmd = new FFmpegCommand();
      expect(cmd).toBeDefined();
    });

    test('should initialize with custom paths', () => {
      const options: FFmpegOptions = {
        ffmpegPath: '/custom/ffmpeg',
        ffprobePath: '/custom/ffprobe',
        timeout: 30000
      };
      const cmd = new FFmpegCommand(options);
      expect(cmd).toBeDefined();
    });

    test('should extend EventEmitter', () => {
      expect(ffmpegCommand).toHaveProperty('on');
      expect(ffmpegCommand).toHaveProperty('emit');
      expect(typeof ffmpegCommand.on).toBe('function');
      expect(typeof ffmpegCommand.emit).toBe('function');
    });
  });

  describe('FFmpegCommand - Input/Output Methods', () => {
    test('should set input file', () => {
      const result = ffmpegCommand.input('test.mp4');
      expect(result).toBe(ffmpegCommand); // Should return this for chaining
      expect(ffmpegCommand).toBeDefined();
    });

    test('should set output file', () => {
      const result = ffmpegCommand.output('output.mp4');
      expect(result).toBe(ffmpegCommand);
      expect(ffmpegCommand).toBeDefined();
    });

    test('should set output file using save method', () => {
      const result = ffmpegCommand.save('output.mp4');
      expect(result).toBe(ffmpegCommand);
      expect(ffmpegCommand).toBeDefined();
    });

    test('should chain input and output methods', () => {
      const result = ffmpegCommand
        .input('input.mp4')
        .output('output.mp4');
      
      expect(result).toBe(ffmpegCommand);
      expect(ffmpegCommand).toBeDefined();
    });
  });

  describe('FFmpegCommand - Video Methods', () => {
    test('should set video codec', () => {
      const result = ffmpegCommand.videoCodec('libx264');
      expect(result).toBe(ffmpegCommand);
    });

    test('should set video bitrate as string', () => {
      const result = ffmpegCommand.videoBitrate('1000k');
      expect(result).toBe(ffmpegCommand);
    });

    test('should set video bitrate as number', () => {
      const result = ffmpegCommand.videoBitrate(1000);
      expect(result).toBe(ffmpegCommand);
    });

    test('should set fps', () => {
      const result = ffmpegCommand.fps(30);
      expect(result).toBe(ffmpegCommand);
    });

    test('should set video size', () => {
      const result = ffmpegCommand.size('1920x1080');
      expect(result).toBe(ffmpegCommand);
    });

    test('should set aspect ratio', () => {
      const result = ffmpegCommand.aspect('16:9');
      expect(result).toBe(ffmpegCommand);
    });

    test('should enable autopad with default color', () => {
      const result = ffmpegCommand.autopad();
      expect(result).toBe(ffmpegCommand);
    });

    test('should enable autopad with custom color', () => {
      const result = ffmpegCommand.autopad('white');
      expect(result).toBe(ffmpegCommand);
    });

    test('should enable keep display aspect ratio', () => {
      const result = ffmpegCommand.keepDAR();
      expect(result).toBe(ffmpegCommand);
    });

    test('should disable video', () => {
      const result = ffmpegCommand.noVideo();
      expect(result).toBe(ffmpegCommand);
    });

    test('should chain multiple video methods', () => {
      const result = ffmpegCommand
        .videoCodec('libx264')
        .videoBitrate('2000k')
        .fps(60)
        .size('1280x720')
        .aspect('16:9');
      
      expect(result).toBe(ffmpegCommand);
    });
  });

  describe('FFmpegCommand - Audio Methods', () => {
    test('should set audio codec', () => {
      const result = ffmpegCommand.audioCodec('aac');
      expect(result).toBe(ffmpegCommand);
    });

    test('should set audio bitrate as string', () => {
      const result = ffmpegCommand.audioBitrate('128k');
      expect(result).toBe(ffmpegCommand);
    });

    test('should set audio bitrate as number', () => {
      const result = ffmpegCommand.audioBitrate(128);
      expect(result).toBe(ffmpegCommand);
    });

    test('should set audio channels', () => {
      const result = ffmpegCommand.audioChannels(2);
      expect(result).toBe(ffmpegCommand);
    });

    test('should set audio frequency', () => {
      const result = ffmpegCommand.audioFrequency(44100);
      expect(result).toBe(ffmpegCommand);
    });

    test('should disable audio', () => {
      const result = ffmpegCommand.noAudio();
      expect(result).toBe(ffmpegCommand);
    });

    test('should chain multiple audio methods', () => {
      const result = ffmpegCommand
        .audioCodec('mp3')
        .audioBitrate('192k')
        .audioChannels(2)
        .audioFrequency(48000);
      
      expect(result).toBe(ffmpegCommand);
    });
  });

  describe('FFmpegCommand - Format Methods', () => {
    test('should set format', () => {
      const result = ffmpegCommand.format('mp4');
      expect(result).toBe(ffmpegCommand);
    });

    test('should set format using toFormat alias', () => {
      const result = ffmpegCommand.toFormat('avi');
      expect(result).toBe(ffmpegCommand);
    });
  });

  describe('FFmpegCommand - Processing Methods', () => {
    test('should set seek time as string', () => {
      const result = ffmpegCommand.seek('00:00:10');
      expect(result).toBe(ffmpegCommand);
    });

    test('should set seek time as number', () => {
      const result = ffmpegCommand.seek(10);
      expect(result).toBe(ffmpegCommand);
    });

    test('should set input seek time as string', () => {
      const result = ffmpegCommand.seekInput('00:00:05');
      expect(result).toBe(ffmpegCommand);
    });

    test('should set input seek time as number', () => {
      const result = ffmpegCommand.seekInput(5);
      expect(result).toBe(ffmpegCommand);
    });

    test('should set duration as string', () => {
      const result = ffmpegCommand.duration('00:00:30');
      expect(result).toBe(ffmpegCommand);
    });

    test('should set duration as number', () => {
      const result = ffmpegCommand.duration(30);
      expect(result).toBe(ffmpegCommand);
    });

    test('should set start time using alias', () => {
      const result = ffmpegCommand.setStartTime('00:00:15');
      expect(result).toBe(ffmpegCommand);
    });

    test('should set duration using alias', () => {
      const result = ffmpegCommand.setDuration(45);
      expect(result).toBe(ffmpegCommand);
    });

    test('should enable loop without duration', () => {
      const result = ffmpegCommand.loop();
      expect(result).toBe(ffmpegCommand);
    });

    test('should enable loop with duration', () => {
      const result = ffmpegCommand.loop(60);
      expect(result).toBe(ffmpegCommand);
    });

    test('should chain processing methods', () => {
      const result = ffmpegCommand
        .seek('00:00:10')
        .duration('00:00:30')
        .setStartTime('00:00:05');
      
      expect(result).toBe(ffmpegCommand);
    });
  });

  describe('FFmpegCommand - Filter Methods', () => {
    test('should add single video filter', () => {
      const result = ffmpegCommand.videoFilters('scale=1280:720');
      expect(result).toBe(ffmpegCommand);
    });

    test('should add multiple video filters as array', () => {
      const result = ffmpegCommand.videoFilters(['scale=1280:720', 'fps=30']);
      expect(result).toBe(ffmpegCommand);
    });

    test('should add single audio filter', () => {
      const result = ffmpegCommand.audioFilters('volume=0.8');
      expect(result).toBe(ffmpegCommand);
    });

    test('should add multiple audio filters as array', () => {
      const result = ffmpegCommand.audioFilters(['volume=0.8', 'bass=g=5']);
      expect(result).toBe(ffmpegCommand);
    });

    test('should add single complex filter', () => {
      const result = ffmpegCommand.complexFilter('[0:v][1:v]overlay=10:10');
      expect(result).toBe(ffmpegCommand);
    });

    test('should add multiple complex filters as array', () => {
      const result = ffmpegCommand.complexFilter([
        '[0:v]scale=1280:720[scaled]',
        '[scaled][1:v]overlay=10:10'
      ]);
      expect(result).toBe(ffmpegCommand);
    });

    test('should chain filter methods', () => {
      const result = ffmpegCommand
        .videoFilters('scale=1920x1080')
        .audioFilters('volume=1.0')
        .complexFilter('[0:v]fade=out:300:30');
      
      expect(result).toBe(ffmpegCommand);
    });
  });

  describe('FFmpegCommand - Options Methods', () => {
    test('should add single output option', () => {
      const result = ffmpegCommand.outputOptions('-movflags +faststart');
      expect(result).toBe(ffmpegCommand);
    });

    test('should add multiple output options as array', () => {
      const result = ffmpegCommand.outputOptions([
        '-movflags +faststart',
        '-pix_fmt yuv420p'
      ]);
      expect(result).toBe(ffmpegCommand);
    });

    test('should add single input option', () => {
      const result = ffmpegCommand.inputOptions('-hwaccel cuda');
      expect(result).toBe(ffmpegCommand);
    });

    test('should add multiple input options as array', () => {
      const result = ffmpegCommand.inputOptions([
        '-hwaccel cuda',
        '-threads 4'
      ]);
      expect(result).toBe(ffmpegCommand);
    });

    test('should set preset', () => {
      const result = ffmpegCommand.preset('fast');
      expect(result).toBe(ffmpegCommand);
    });

    test('should enable native mode', () => {
      const result = ffmpegCommand.native();
      expect(result).toBe(ffmpegCommand);
    });

    test('should chain options methods', () => {
      const result = ffmpegCommand
        .outputOptions('-movflags +faststart')
        .inputOptions('-hwaccel cuda')
        .preset('slow')
        .native();
      
      expect(result).toBe(ffmpegCommand);
    });
  });

  describe('FFmpegCommand - Execution Tests', () => {
    test('should throw error when no input file specified', async () => {
      await expect(ffmpegCommand.run()).rejects.toThrow('No input file specified');
    });

    test('should throw error when no output file specified', async () => {
      ffmpegCommand.input('test.mp4');
      await expect(ffmpegCommand.run()).rejects.toThrow('No output file specified');
    });

    test('should execute basic video conversion', async () => {
      // Generate test input file
      const inputFile = await testMediaGenerator.generateTestVideo('input.mp4', {
        duration: 2,
        width: 640,
        height: 480
      });

      const outputFile = path.join(testOutputDir, 'output_basic.mp4');

      const result = await ffmpegCommand
        .input(inputFile.path)
        .output(outputFile)
        .run();

      expect(result).toBeUndefined(); // run() resolves to void
      expect(await fs.pathExists(outputFile)).toBe(true);
    }, 30000);

    test('should execute video conversion with options', async () => {
      const inputFile = await testMediaGenerator.generateTestVideo('input_opts.mp4', {
        duration: 2,
        width: 1280,
        height: 720
      });

      const outputFile = path.join(testOutputDir, 'output_opts.mp4');

      await ffmpegCommand
        .input(inputFile.path)
        .output(outputFile)
        .videoCodec('libx264')
        .videoBitrate('1000k')
        .fps(30)
        .size('640x480')
        .run();

      expect(await fs.pathExists(outputFile)).toBe(true);
    }, 30000);

    test('should execute audio extraction', async () => {
      const videoWithAudio = await testMediaGenerator.generateVideoWithAudio('input_audio.mp4', {
        duration: 2,
        frequency: 440
      });

      const outputAudio = path.join(testOutputDir, 'extracted_audio.mp3');

      await ffmpegCommand
        .input(videoWithAudio.path)
        .output(outputAudio)
        .noVideo()
        .audioCodec('mp3')
        .run();

      expect(await fs.pathExists(outputAudio)).toBe(true);
    }, 30000);

    test('should execute video with filters', async () => {
      const inputFile = await testMediaGenerator.generateTestVideo('input_filters.mp4', {
        duration: 2,
        width: 1280,
        height: 720
      });

      const outputFile = path.join(testOutputDir, 'output_filtered.mp4');

      await ffmpegCommand
        .input(inputFile.path)
        .output(outputFile)
        .videoFilters('scale=640:480')
        .run();

      expect(await fs.pathExists(outputFile)).toBe(true);
    }, 30000);

    test('should emit progress events during execution', async () => {
      const inputFile = await testMediaGenerator.generateTestVideo('input_progress.mp4', {
        duration: 5,
        width: 640,
        height: 480
      });

      const outputFile = path.join(testOutputDir, 'output_progress.mp4');
      const progressEvents: ProgressInfo[] = [];

      ffmpegCommand.on('progress', (progress: ProgressInfo) => {
        progressEvents.push(progress);
      });

      await ffmpegCommand
        .input(inputFile.path)
        .output(outputFile)
        .run();

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0]).toHaveProperty('frames');
      expect(progressEvents[0]).toHaveProperty('currentFps');
      expect(progressEvents[0]).toHaveProperty('timemark');
    }, 30000);

    test('should emit start and end events', async () => {
      const inputFile = await testMediaGenerator.generateTestVideo('input_events.mp4', {
        duration: 1,
        width: 640,
        height: 480
      });

      const outputFile = path.join(testOutputDir, 'output_events.mp4');
      let startEventFired = false;
      let endEventFired = false;

      ffmpegCommand.on('start', (command: string) => {
        startEventFired = true;
        expect(command).toContain('ffmpeg');
      });

      ffmpegCommand.on('end', () => {
        endEventFired = true;
      });

      await ffmpegCommand
        .input(inputFile.path)
        .output(outputFile)
        .run();

      expect(startEventFired).toBe(true);
      expect(endEventFired).toBe(true);
    }, 30000);

    test('should handle timeout', async () => {
      const timeoutCommand = new FFmpegCommand({ ffmpegPath, ffprobePath, timeout: 100 });
      const inputFile = await testMediaGenerator.generateTestVideo('input_timeout.mp4', {
        duration: 10, // Long duration to ensure timeout
        width: 640,
        height: 480
      });

      const outputFile = path.join(testOutputDir, 'output_timeout.mp4');

      await expect(
        timeoutCommand
          .input(inputFile.path)
          .output(outputFile)
          .run()
      ).rejects.toThrow('FFmpeg process timeout');
    }, 30000);
  });

  describe('FFmpegCommand - Static Probe Method', () => {
    test('should probe video file and return metadata', async () => {
      const testVideo = await testMediaGenerator.generateTestVideo('probe_test.mp4', {
        duration: 3,
        width: 1280,
        height: 720,
        fps: 30
      });

      const probeData: ProbeData = await FFmpegCommand.probe(testVideo.path, { ffprobePath });

      expect(probeData).toBeDefined();
      expect(probeData.format).toBeDefined();
      expect(probeData.streams).toBeDefined();
      expect(Array.isArray(probeData.streams)).toBe(true);
      expect(probeData.streams.length).toBeGreaterThan(0);
      
      // Check for video stream
      const videoStream = probeData.streams.find((stream: any) => stream.codec_type === 'video');
      expect(videoStream).toBeDefined();
      expect(videoStream.width).toBe(1280);
      expect(videoStream.height).toBe(720);
      
      // Check format information
      expect(probeData.format.duration).toBeDefined();
      expect(parseFloat(probeData.format.duration)).toBeGreaterThan(2);
      expect(parseFloat(probeData.format.duration)).toBeLessThan(4);
    }, 30000);

    test('should probe audio file and return metadata', async () => {
      const testAudio = await testMediaGenerator.generateTestAudio('probe_audio.mp3', {
        duration: 3,
        frequency: 440,
        channels: 2
      });

      const probeData: ProbeData = await FFmpegCommand.probe(testAudio.path, { ffprobePath });

      expect(probeData).toBeDefined();
      expect(probeData.format).toBeDefined();
      expect(probeData.streams).toBeDefined();
      expect(probeData.streams.length).toBeGreaterThan(0);
      
      const audioStream = probeData.streams.find(s => s.codec_type === 'audio');
      expect(audioStream).toBeDefined();
      expect(audioStream?.channels).toBe(2);
    }, 30000);

    test('should throw error for non-existent file', async () => {
      await expect(
        FFmpegCommand.probe('/non/existent/file.mp4', { ffprobePath })
      ).rejects.toThrow('FFprobe error');
    });

    test('should throw error for corrupted file', async () => {
      const corruptedFile = await testMediaGenerator.generateCorruptedVideo('corrupted.mp4');
      
      await expect(
        FFmpegCommand.probe(corruptedFile.path, { ffprobePath })
      ).rejects.toThrow();
    });
  });

  describe('FFmpegCommand - Screenshots Method', () => {
    test('should generate screenshots at specific timestamps', async () => {
      const testVideo = await testMediaGenerator.generateTestVideo('screenshot_test.mp4', {
        duration: 10,
        width: 1280,
        height: 720
      });

      ffmpegCommand.input(testVideo.path);
      const screenshots = await ffmpegCommand.screenshots({
        timestamps: ['00:00:02', '00:00:05', '00:00:08'],
        folder: path.join(testOutputDir, 'screenshots_timestamps')
      });

      expect(screenshots.length).toBe(3);
      for (const screenshot of screenshots) {
        expect(await fs.pathExists(screenshot)).toBe(true);
      }
    }, 30000);

    test('should generate specified number of screenshots', async () => {
      const testVideo = await testMediaGenerator.generateTestVideo('screenshot_count.mp4', {
        duration: 10,
        width: 1280,
        height: 720
      });

      ffmpegCommand.input(testVideo.path);
      const screenshots = await ffmpegCommand.screenshots({
        count: 5,
        folder: path.join(testOutputDir, 'screenshots_count')
      });

      expect(screenshots).toBeDefined();
      expect(Array.isArray(screenshots)).toBe(true);
      expect(screenshots.length).toBeGreaterThan(0);
      for (const screenshot of screenshots) {
        expect(await fs.pathExists(screenshot)).toBe(true);
      }
    }, 30000);

    test('should generate screenshots with custom size', async () => {
      const testVideo = await testMediaGenerator.generateTestVideo('screenshot_size.mp4', {
        duration: 5,
        width: 1920,
        height: 1080
      });

      ffmpegCommand.input(testVideo.path);
      const screenshots = await ffmpegCommand.screenshots({
        count: 2,
        size: '640x360',
        folder: path.join(testOutputDir, 'screenshots_size')
      });

      expect(screenshots.length).toBe(2);
      expect(await fs.pathExists(screenshots[0])).toBe(true);
    }, 30000);

    test('should generate screenshots with custom filename', async () => {
      const testVideo = await testMediaGenerator.generateTestVideo('screenshot_custom.mp4', {
        duration: 5,
        width: 640,
        height: 480
      });

      ffmpegCommand.input(testVideo.path);
      const screenshots = await ffmpegCommand.screenshots({
        count: 2,
        filename: 'custom-thumb-%i.png',
        folder: path.join(testOutputDir, 'screenshots_custom')
      });

      expect(screenshots).toBeDefined();
      expect(Array.isArray(screenshots)).toBe(true);
      expect(screenshots.length).toBeGreaterThan(0);
      expect(screenshots[0]).toContain('custom-thumb-1.png');
      expect(screenshots[1]).toContain('custom-thumb-2.png');
    }, 30000);

    test('should throw error when neither timestamps nor count specified', async () => {
      const testVideo = await testMediaGenerator.generateTestVideo('screenshot_error.mp4', {
        duration: 5,
        width: 640,
        height: 480
      });

      ffmpegCommand.input(testVideo.path);
      
      await expect(
        ffmpegCommand.screenshots({
          folder: path.join(testOutputDir, 'screenshots_error')
        })
      ).rejects.toThrow('Either timestamps or count must be specified');
    });
  });

  describe('FFmpegCommand - Utility Methods', () => {
    test('should clone FFmpegCommand instance', () => {
      const original = ffmpegCommand
        .input('test.mp4')
        .output('output.mp4')
        .videoCodec('libx264')
        .audioCodec('aac');

      const cloned = original.clone();
      
      expect(cloned).toBeInstanceOf(FFmpegCommand);
      expect(cloned).not.toBe(original); // Should be different instance
    });

    test('should kill process (method exists)', () => {
      expect(() => {
        ffmpegCommand.kill();
      }).not.toThrow();
    });

    test('should kill process with custom signal', () => {
      expect(() => {
        ffmpegCommand.kill('SIGTERM');
      }).not.toThrow();
    });
  });

  describe('FFmpegCommand - Complex Workflows', () => {
    test('should handle video with multiple inputs and complex filters', async () => {
      const video1 = await testMediaGenerator.generateTestVideo('complex_1.mp4', {
        duration: 3,
        width: 640,
        height: 480,
        color: 'red'
      });

      const video2 = await testMediaGenerator.generateTestVideo('complex_2.mp4', {
        duration: 3,
        width: 640,
        height: 480,
        color: 'blue'
      });

      const outputFile = path.join(testOutputDir, 'complex_output.mp4');

      // Note: This is a simplified test - real complex filtering would require proper setup
      await ffmpegCommand
        .input(video1.path)
        .input(video2.path)
        .output(outputFile)
        .complexFilter('[0:v][1:v]hstack=inputs=2')
        .run();

      expect(await fs.pathExists(outputFile)).toBe(true);
    }, 30000);

    test('should handle video scaling and format conversion', async () => {
      const inputVideo = await testMediaGenerator.generateTestVideo('scale_input.mp4', {
        duration: 2,
        width: 1920,
        height: 1080
      });

      const outputFile = path.join(testOutputDir, 'scaled_output.mp4');

      await ffmpegCommand
        .input(inputVideo.path)
        .output(outputFile)
        .size('1280x720')
        .videoCodec('libx264')
        .preset('fast')
        .format('mp4')
        .outputOptions([
          '-movflags', '+faststart',
          '-pix_fmt', 'yuv420p'
        ])
        .run();

      expect(await fs.pathExists(outputFile)).toBe(true);
    }, 30000);

    test('should handle audio processing with multiple effects', async () => {
      const inputAudio = await testMediaGenerator.generateTestAudio('audio_input.mp3', {
        duration: 3,
        frequency: 440,
        channels: 2
      });

      const outputFile = path.join(testOutputDir, 'processed_audio.mp3');

      await ffmpegCommand
        .input(inputAudio.path)
        .output(outputFile)
        .audioFilters([
          'volume=0.8',
          'bass=g=3',
          'treble=g=2'
        ])
        .audioBitrate('192k')
        .run();

      expect(await fs.pathExists(outputFile)).toBe(true);
    }, 30000);
  });

  describe('FFmpegCommand - Error Handling', () => {
    test('should handle invalid input file', async () => {
      await expect(
        ffmpegCommand
          .input('/non/existent/file.mp4')
          .output(path.join(testOutputDir, 'error_output.mp4'))
          .run()
      ).rejects.toThrow();
    }, 30000);

    test('should handle corrupted input file', async () => {
      const corruptedFile = await testMediaGenerator.generateCorruptedVideo('corrupted_error.mp4');
      
      await expect(
        ffmpegCommand
          .input(corruptedFile.path)
          .output(path.join(testOutputDir, 'corrupted_output.mp4'))
          .run()
      ).rejects.toThrow();
    }, 30000);

    test('should handle invalid codec', async () => {
      const inputFile = await testMediaGenerator.generateTestVideo('invalid_codec_input.mp4', {
        duration: 1,
        width: 640,
        height: 480
      });

      await expect(
        ffmpegCommand
          .input(inputFile.path)
          .output(path.join(testOutputDir, 'invalid_codec_output.mp4'))
          .videoCodec('invalid_codec_xyz')
          .run()
      ).rejects.toThrow();
    }, 30000);
  });
});