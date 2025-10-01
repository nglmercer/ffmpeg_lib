// ==================== test/HLSSegmentationManager.test.ts ====================

import { describe as describe2, test as test2, expect as expect2, beforeAll as beforeAll2, afterAll as afterAll2 } from 'bun:test';
import { HLSSegmentationManager } from '../../src/hls/HLSSegmentationManager';
import { TestMediaGenerator } from '../../src/TestMediaGenerator';
import { FFmpegManager } from '../../src/FFmpegManager';
import { ResolutionUtils } from '../../src/utils/ResolutionUtils';
import fs2 from 'fs-extra';
import path2 from 'path';
import os2 from 'os';

describe2('HLSSegmentationManager Tests', () => {
    let manager: HLSSegmentationManager;
    let mediaGenerator: TestMediaGenerator;
    let testDir: string;
    let testVideoPath: string;
    let ffmpegPath: string;
    let ffprobePath: string;

    beforeAll2(async () => {
        const ffmpegManager = new FFmpegManager();
        await ffmpegManager.downloadFFmpegBinaries();
        const binaries = await ffmpegManager.verifyBinaries();
        ffmpegPath = binaries.ffmpegPath;
        ffprobePath = binaries.ffprobePath;

        testDir = path2.join(os2.tmpdir(), 'hls-seg-test-' + Date.now());
        await fs2.ensureDir(testDir);

        mediaGenerator = new TestMediaGenerator(ffmpegPath, testDir, ffprobePath);
        manager = new HLSSegmentationManager(ffmpegPath, ffprobePath);

        // Generar video de prueba
        const video = await mediaGenerator.generateTestVideo('test.mp4', {
            duration: 12,
            width: 1280,
            height: 720
        });
        testVideoPath = video.path;
    }, 120000);

    afterAll2(async () => {
        await mediaGenerator.cleanup();
        await fs2.remove(testDir);
    });

    describe2('Video Segmentation', () => {
        test2('should segment video to HLS', async () => {
            const outputDir = path2.join(testDir, 'segments-1');
            const config = {
                segmentDuration: 6,
                segmentPattern: 'segment_%03d.ts',
                playlistName: 'playlist.m3u8',
                outputDir
            };

            const resolution = ResolutionUtils.generateLowerResolutions(1280, 720)[0];
            const videoConfig = HLSSegmentationManager.createVideoConfig(resolution);
            const audioConfig = HLSSegmentationManager.createAudioConfig('medium');

            const result = await manager.segmentVideo(testVideoPath, config, {
                video: videoConfig,
                audio: audioConfig,
                resolution
            });

            expect2(result.segmentCount).toBeGreaterThan(0);
            expect2(result.segments.length).toBeGreaterThan(0);
            expect2(await fs2.pathExists(result.playlistPath)).toBe(true);
        }, 60000);

        test2('should create segments with correct duration', async () => {
            const outputDir = path2.join(testDir, 'segments-2');
            const config = {
                segmentDuration: 4,
                segmentPattern: 'seg_%03d.ts',
                playlistName: 'test.m3u8',
                outputDir
            };

            const resolution = { width: 640, height: 480, name: '480p', bitrate: '1000k' };
            const videoConfig = HLSSegmentationManager.createVideoConfig(resolution);

            const result = await manager.segmentVideo(testVideoPath, config, {
                video: videoConfig,
                resolution
            });

            // Verificar que los segmentos tengan duración cercana a 4 segundos
            for (const segment of result.segments) {
                expect2(segment.duration).toBeGreaterThan(3);
                expect2(segment.duration).toBeLessThan(5);
            }
        }, 60000);
    });

    describe2('Progress Events', () => {
        test2('should emit progress events', async () => {
            const outputDir = path2.join(testDir, 'segments-progress');
            const config = {
                segmentDuration: 6,
                segmentPattern: 'segment_%03d.ts',
                playlistName: 'playlist.m3u8',
                outputDir
            };

            const resolution = { width: 854, height: 480, name: '480p', bitrate: '1400k' };
            const videoConfig = HLSSegmentationManager.createVideoConfig(resolution);

            let progressCount = 0;
            manager.on('progress', () => {
                progressCount++;
            });

            await manager.segmentVideo(testVideoPath, config, {
                video: videoConfig,
                resolution
            });

            expect2(progressCount).toBeGreaterThan(0);
        }, 60000);
    });

    describe2('Configuration Helpers', () => {
        test2('should create video config for different qualities', () => {
            const resolution = { width: 1920, height: 1080, name: '1080p', bitrate: '5000k' };
            const config = HLSSegmentationManager.createVideoConfig(resolution, 'fast');

            expect2(config.codec).toBe('libx264');
            expect2(config.preset).toBe('fast');
            expect2(config.profile).toBe('high');
            expect2(config.bitrate).toBe('5000k');
        });

        test2('should create audio config for different qualities', () => {
            const low = HLSSegmentationManager.createAudioConfig('low');
            const high = HLSSegmentationManager.createAudioConfig('high');

            expect2(low.bitrate).toBe('64k');
            expect2(high.bitrate).toBe('192k');
            expect2(high.sampleRate).toBe(48000);
        });
    });
});
