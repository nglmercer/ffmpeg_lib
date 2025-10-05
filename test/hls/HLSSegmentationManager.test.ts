// ==================== test/HLSSegmentationManager.test.ts ====================

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { HLSSegmentationManager } from '../../src/hls/HLSSegmentationManager';
import { TestMediaGenerator } from '../../src/TestMediaGenerator';
import { FFmpegManager } from '../../src/FFmpegManager';
import { ResolutionUtils } from '../../src/utils/ResolutionUtils';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('HLSSegmentationManager Tests', () => {
    let manager: HLSSegmentationManager;
    let mediaGenerator: TestMediaGenerator;
    let testDir: string;
    let testVideoPath: string;
    let ffmpegPath: string;
    let ffprobePath: string;

    beforeAll(async () => {
        const ffmpegManager = new FFmpegManager();
        const isAvailable = await ffmpegManager.isFFmpegAvailable();
        if (!isAvailable) {
            await ffmpegManager.downloadFFmpegBinaries(true);
        }
        const binaries = await ffmpegManager.verifyBinaries();
        ffmpegPath = binaries.ffmpegPath;
        ffprobePath = binaries.ffprobePath;

        testDir = path.join(os.tmpdir(), 'hls-seg-test-' + Date.now());
        await fs.ensureDir(testDir);

        mediaGenerator = new TestMediaGenerator(ffmpegPath, testDir, ffprobePath);
        manager = new HLSSegmentationManager(ffmpegPath, ffprobePath);

        const video = await mediaGenerator.generateTestVideo('test.mp4', {
            duration: 12,
            width: 1280,
            height: 720
        });
        testVideoPath = video.path;
    });

    afterAll(async () => {
        await mediaGenerator.cleanup();
        await fs.remove(testDir);
    });

    describe('Video Segmentation', () => {
        test('should segment video to HLS', async () => {
            const outputDir = path.join(testDir, 'segments-basic');
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

            expect(result.segmentCount).toBeGreaterThan(0);
            expect(result.segments.length).toBeGreaterThan(0);
            expect(await fs.pathExists(result.playlistPath)).toBe(true);
            expect(result.duration).toBeGreaterThan(0);
            expect(result.fileSize).toBeGreaterThan(0);
        }, 60000);

        test('should create segments with correct duration', async () => {
            const outputDir = path.join(testDir, 'segments-duration');
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

            // Verificar duración de segmentos
            for (const segment of result.segments) {
                expect(segment.duration).toBeGreaterThan(3);
                expect(segment.duration).toBeLessThan(5);
            }

            // Verificar que existen los archivos
            for (const segmentPath of result.segmentPaths) {
                expect(await fs.pathExists(segmentPath)).toBe(true);
            }
        }, 60000);

        test('should handle different video qualities', async () => {
            const qualities = [
                { width: 1920, height: 1080, name: '1080p', bitrate: '5000k' },
                { width: 1280, height: 720, name: '720p', bitrate: '2500k' },
                { width: 854, height: 480, name: '480p', bitrate: '1000k' }
            ];

            for (const quality of qualities) {
                const outputDir = path.join(testDir, `quality-${quality.name}`);
                const config = {
                    segmentDuration: 6,
                    segmentPattern: `${quality.name}_segment_%03d.ts`,
                    playlistName: `${quality.name}.m3u8`,
                    outputDir
                };

                const videoConfig = HLSSegmentationManager.createVideoConfig(quality);
                const result = await manager.segmentVideo(testVideoPath, config, {
                    video: videoConfig,
                    resolution: quality
                });

                expect(result.segmentCount).toBeGreaterThan(0);
                expect(await fs.pathExists(result.playlistPath)).toBe(true);
            }
        }, 180000);
    });

    describe('Standardized Events', () => {
        test('should emit start event with correct structure', async () => {
            const outputDir = path.join(testDir, 'events-start');
            const config = {
                segmentDuration: 6,
                segmentPattern: 'segment_%03d.ts',
                playlistName: 'playlist.m3u8',
                outputDir
            };

            let startEvent: any = null;
            manager.once('start', (event) => {
                console.log('Start Event:', event);
                startEvent = event;
            });

            const resolution = { width: 854, height: 480, name: '480p', bitrate: '1400k' };
            const videoConfig = HLSSegmentationManager.createVideoConfig(resolution);

            await manager.segmentVideo(testVideoPath, config, {
                video: videoConfig,
                resolution
            });

            expect(startEvent).not.toBeNull();
            expect(startEvent.type).toBe('hls-segmentation');
            expect(startEvent.inputPath).toBe(testVideoPath);
            expect(startEvent.config).toBeDefined();
            expect(startEvent.estimatedSegments).toBeGreaterThan(0);
        }, 60000);

        test('should emit progress events with standardized structure', async () => {
            const outputDir = path.join(testDir, 'events-progress');
            const config = {
                segmentDuration: 6,
                segmentPattern: 'segment_%03d.ts',
                playlistName: 'playlist.m3u8',
                outputDir
            };

            const progressEvents: any[] = [];
            manager.on('progress', (event) => {
                progressEvents.push(event);
                
                // Verificar estructura del evento
                expect(event.type).toBe('hls-segmentation');
                expect(typeof event.percent).toBe('number');
                expect(typeof event.currentSegment).toBe('number');
                expect(typeof event.totalSegments).toBe('number');
                expect(event.phase).toBeDefined();
            });

            const resolution = { width: 854, height: 480, name: '480p', bitrate: '1400k' };
            const videoConfig = HLSSegmentationManager.createVideoConfig(resolution);

            await manager.segmentVideo(testVideoPath, config, {
                video: videoConfig,
                resolution
            });

            expect(progressEvents.length).toBeGreaterThan(0);
            
            // Verificar que el progreso aumenta
            if (progressEvents.length > 1) {
                const firstPercent = progressEvents[0].percent;
                const lastPercent = progressEvents[progressEvents.length - 1].percent;
                expect(lastPercent).toBeGreaterThanOrEqual(firstPercent);
            }
        }, 60000);

        test('should emit complete event with result', async () => {
            const outputDir = path.join(testDir, 'events-complete');
            const config = {
                segmentDuration: 6,
                segmentPattern: 'segment_%03d.ts',
                playlistName: 'playlist.m3u8',
                outputDir
            };

            let completeEvent: any = null;
            manager.once('complete', (event) => {
                completeEvent = event;
            });

            const resolution = { width: 640, height: 360, name: '360p', bitrate: '800k' };
            const videoConfig = HLSSegmentationManager.createVideoConfig(resolution);

            const result = await manager.segmentVideo(testVideoPath, config, {
                video: videoConfig,
                resolution
            });

            expect(completeEvent).not.toBeNull();
            expect(completeEvent.type).toBe('hls-segmentation');
            expect(completeEvent.success).toBe(true);
            expect(completeEvent.result).toBeDefined();
            expect(completeEvent.result.segmentCount).toBe(result.segmentCount);
            expect(typeof completeEvent.duration).toBe('number');
            expect(completeEvent.duration).toBeGreaterThan(0);
        }, 60000);
    });

    describe('Audio Segmentation', () => {
        let testVideoWithAudioPath: string;

        beforeAll(async () => {
            // Generate video with audio for audio segmentation tests
            const videoWithAudio = await mediaGenerator.generateVideoWithAudio('test-with-audio.mp4', {
                duration: 10
            });
            testVideoWithAudioPath = videoWithAudio.path;
        });

        test('should segment audio only', async () => {
            const outputDir = path.join(testDir, 'audio-segments');
            const config = {
                segmentDuration: 6,
                segmentPattern: 'audio_segment_%03d.ts',
                playlistName: 'audio.m3u8',
                outputDir
            };

            const audioConfig = HLSSegmentationManager.createAudioConfig('high');

            const result = await manager.segmentAudio(
                testVideoWithAudioPath,
                config,
                audioConfig
            );

            expect(result.segmentCount).toBeGreaterThan(0);
            expect(await fs.pathExists(result.playlistPath)).toBe(true);
        }, 60000);

        test('should emit events for audio segmentation', async () => {
            const outputDir = path.join(testDir, 'audio-events');
            const config = {
                segmentDuration: 6,
                segmentPattern: 'audio_segment_%03d.ts',
                playlistName: 'audio.m3u8',
                outputDir
            };

            let startEmitted = false;
            let progressEmitted = false;
            let completeEmitted = false;

            manager.once('start', () => { startEmitted = true; });
            manager.once('progress', () => { progressEmitted = true; });
            manager.once('complete', () => { completeEmitted = true; });

            const audioConfig = HLSSegmentationManager.createAudioConfig('medium');

            await manager.segmentAudio(testVideoWithAudioPath, config, audioConfig);

            expect(startEmitted).toBe(true);
            expect(progressEmitted).toBe(true);
            expect(completeEmitted).toBe(true);
        }, 60000);
    });

    describe('Multiple Qualities with Progress Tracking', () => {
        test('should segment multiple qualities sequentially', async () => {
            const outputDir = path.join(testDir, 'multi-quality-seq');
            const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720);

            const results = await manager.segmentMultipleQualities(
                testVideoPath,
                outputDir,
                resolutions,
                { parallel: false }
            );

            expect(results.length).toBe(resolutions.length);
            
            for (const result of results) {
                expect(result.segmentCount).toBeGreaterThan(0);
                expect(await fs.pathExists(result.playlistPath)).toBe(true);
            }
        }, 180000);

        test('should emit quality-specific events', async () => {
            const outputDir = path.join(testDir, 'multi-quality-events');
            const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720).slice(0, 2);

            const events = {
                qualityStart: [] as any[],
                qualityProgress: [] as any[],
                qualityComplete: [] as any[]
            };

            manager.on('quality-start', (name, index, total) => {
                events.qualityStart.push({ name, index, total });
            });

            manager.on('quality-progress', (data) => {
                events.qualityProgress.push(data);
                
                // Verificar estructura
                expect(data.quality).toBeDefined();
                expect(data.qualityIndex).toBeGreaterThan(0);
                expect(data.totalQualities).toBeGreaterThan(0);
                expect(typeof data.qualityPercent).toBe('number');
                expect(typeof data.globalPercent).toBe('number');
            });

            manager.on('quality-complete', (name, index, total, result) => {
                events.qualityComplete.push({ name, index, total, result });
            });

            await manager.segmentMultipleQualities(
                testVideoPath,
                outputDir,
                resolutions,
                { parallel: false }
            );

            expect(events.qualityStart.length).toBe(resolutions.length);
            expect(events.qualityProgress.length).toBeGreaterThan(0);
            expect(events.qualityComplete.length).toBe(resolutions.length);

            // Verificar que cada calidad se completó
            expect(events.qualityStart.length).toBe(resolutions.length);
            expect(events.qualityComplete.length).toBe(resolutions.length);
            
            for (let i = 0; i < resolutions.length; i++) {
                const startEvent = events.qualityStart[i];
                const completeEvent = events.qualityComplete[i];
                
                // Verificar que los eventos tienen los índices correctos
                expect(startEvent.index).toBeGreaterThan(0);
                expect(startEvent.index).toBeLessThanOrEqual(resolutions.length);
                expect(startEvent.total).toBe(resolutions.length);
                
                expect(completeEvent.index).toBeGreaterThan(0);
                expect(completeEvent.index).toBeLessThanOrEqual(resolutions.length);
                expect(completeEvent.total).toBe(resolutions.length);
                expect(completeEvent.result.segmentCount).toBeGreaterThan(0);
            }
        }, 180000);

        test('should track global progress across qualities', async () => {
            const outputDir = path.join(testDir, 'multi-quality-global');
            const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720).slice(0, 2);

            const globalProgress: number[] = [];

            let lastQuality = '';
            let qualityProgress: Record<string, number[]> = {};
            
            manager.on('quality-progress', (data) => {
                if (!qualityProgress[data.quality]) {
                    qualityProgress[data.quality] = [];
                }
                qualityProgress[data.quality].push(data.qualityPercent);
            });

            await manager.segmentMultipleQualities(
                testVideoPath,
                outputDir,
                resolutions,
                { parallel: false }
            );

            // Verificar que el progreso global aumenta
            expect(globalProgress.length).toBeGreaterThan(0);
            
            if (globalProgress.length > 1) {
                for (const [quality, values] of Object.entries(qualityProgress)) {
                    for (let i = 1; i < values.length; i++) {
                        expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
                    }
                }
                // Note: Progress might reset between qualities, so we don't strictly require monotonic increase
                // but we verify we got reasonable values
                expect(Math.max(...globalProgress)).toBeGreaterThan(0);
                expect(Math.max(...globalProgress)).toBeLessThanOrEqual(100);
            }
        }, 180000);
    });

    describe('Configuration Helpers', () => {
        test('should create video config for different qualities', () => {
            const configs = [
                { resolution: { width: 1920, height: 1080, name: '1080p', bitrate: '5000k' }, expectedProfile: 'high' },
                { resolution: { width: 1280, height: 720, name: '720p', bitrate: '2500k' }, expectedProfile: 'main' },
                { resolution: { width: 640, height: 360, name: '360p', bitrate: '800k' }, expectedProfile: 'baseline' }
            ];

            for (const { resolution, expectedProfile } of configs) {
                const config = HLSSegmentationManager.createVideoConfig(resolution, 'fast');

                expect(config.codec).toBe('libx264');
                expect(config.preset).toBe('fast');
                expect(config.profile).toBe(expectedProfile);
                expect(config.bitrate).toBe(resolution.bitrate);
                expect(config.gopSize).toBe(60);
                expect(config.pixelFormat).toBe('yuv420p');
            }
        });

        test('should create audio config for different qualities', () => {
            const low = HLSSegmentationManager.createAudioConfig('low');
            const medium = HLSSegmentationManager.createAudioConfig('medium');
            const high = HLSSegmentationManager.createAudioConfig('high');

            expect(low.bitrate).toBe('64k');
            expect(low.sampleRate).toBe(44100);
            expect(medium.bitrate).toBe('128k');
            expect(medium.sampleRate).toBe(48000);
            expect(high.bitrate).toBe('192k');
            expect(high.sampleRate).toBe(48000);

            // Verificar que todos usan AAC
            expect(low.codec).toBe('aac');
            expect(medium.codec).toBe('aac');
            expect(high.codec).toBe('aac');
        });

        test('should support different presets', () => {
            const resolution = { width: 1280, height: 720, name: '720p', bitrate: '2500k' };
            const presets: Array<'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium'> = 
                ['ultrafast', 'fast', 'medium'];

            for (const preset of presets) {
                const config = HLSSegmentationManager.createVideoConfig(resolution, preset);
                expect(config.preset).toBe(preset);
            }
        });
    });

    describe('Playlist Validation', () => {
        test('should create valid HLS playlist', async () => {
            const outputDir = path.join(testDir, 'playlist-validation');
            const config = {
                segmentDuration: 6,
                segmentPattern: 'segment_%03d.ts',
                playlistName: 'playlist.m3u8',
                outputDir
            };

            const resolution = { width: 854, height: 480, name: '480p', bitrate: '1400k' };
            const videoConfig = HLSSegmentationManager.createVideoConfig(resolution);

            const result = await manager.segmentVideo(testVideoPath, config, {
                video: videoConfig,
                resolution
            });

            const playlistContent = await fs.readFile(result.playlistPath, 'utf8');

            // Verificar encabezados HLS
            expect(playlistContent).toContain('#EXTM3U');
            expect(playlistContent).toContain('#EXT-X-VERSION');
            expect(playlistContent).toContain('#EXT-X-TARGETDURATION');
            expect(playlistContent).toContain('#EXTINF');
            expect(playlistContent).toContain('#EXT-X-ENDLIST');

            // Verificar que lista todos los segmentos
            expect(result.segments.length).toBe(result.segmentCount);
            
            for (const segment of result.segments) {
                expect(playlistContent).toContain(segment.uri);
            }
        }, 60000);
    });
});