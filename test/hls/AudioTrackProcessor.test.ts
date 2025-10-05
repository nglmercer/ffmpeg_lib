// ==================== test/AudioTrackProcessor.test.ts ====================

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { AudioTrackProcessor, AUDIO_QUALITY_PRESETS, createDefaultAudioConfig } from '../../src/hls/AudioTrackProcessor';
import { TestMediaGenerator } from '../../src/TestMediaGenerator';
import { FFmpegManager } from '../../src/FFmpegManager';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('AudioTrackProcessor Tests', () => {
    let processor: AudioTrackProcessor;
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

        testDir = path.join(os.tmpdir(), 'audio-test-' + Date.now());
        await fs.ensureDir(testDir);

        mediaGenerator = new TestMediaGenerator(ffmpegPath, testDir, ffprobePath);
        processor = new AudioTrackProcessor(ffmpegPath, ffprobePath);

        // Generar video con audio
        const video = await mediaGenerator.generateVideoWithAudio('test-audio.mp4', {
            duration: 10
        });
        testVideoPath = video.path;
    });

    afterAll(async () => {
        await mediaGenerator.cleanup();
        await fs.remove(testDir);
    });

    describe('Audio Detection', () => {
        test('should detect audio tracks', async () => {
            const tracks = await processor.detectAudioTracks(testVideoPath);
            
            expect(tracks.length).toBeGreaterThan(0);
            expect(tracks[0].codec).toBeDefined();
            expect(tracks[0].channels).toBeGreaterThan(0);
            expect(tracks[0].sampleRate).toBeGreaterThan(0);
            expect(tracks[0].language).toBeDefined();
        });

        test('should get default audio track', async () => {
            const track = await processor.getDefaultAudioTrack(testVideoPath);
            
            expect(track).not.toBeNull();
            if (track) {
                expect(track.isDefault).toBe(true);
                expect(track.codec).toBeDefined();
            }
        });

        test('should provide language information', async () => {
            const tracks = await processor.detectAudioTracks(testVideoPath);
            
            expect(tracks[0].language).toBeDefined();
            expect(tracks[0].languageName).toBeDefined();
            expect(tracks[0].languageName).not.toBe('');
        });
    });

    describe('Audio Extraction', () => {
        test('should extract full audio with default options', async () => {
            const outputPath = path.join(testDir, 'extracted-default.m4a');
            
            await processor.extractFullAudio(testVideoPath, outputPath);
            
            expect(await fs.pathExists(outputPath)).toBe(true);
            const stats = await fs.stat(outputPath);
            expect(stats.size).toBeGreaterThan(0);
        }, 30000);

        test('should extract audio with custom codec', async () => {
            const outputPath = path.join(testDir, 'extracted-custom.m4a');
            
            await processor.extractFullAudio(testVideoPath, outputPath, {
                codec: 'aac',
                bitrate: '192k',
                sampleRate: 48000,
                channels: 2
            });
            
            expect(await fs.pathExists(outputPath)).toBe(true);
            const stats = await fs.stat(outputPath);
            expect(stats.size).toBeGreaterThan(0);
        }, 30000);
    });

    describe('Audio Processing with Events', () => {
        test('should emit start event when processing begins', async () => {
            const outputDir = path.join(testDir, 'process-events-1');
            const config = createDefaultAudioConfig(outputDir);
            config.generateHLS = false;

            let startEmitted = false;
            processor.once('start', () => {
                startEmitted = true;
            });

            await processor.processAudioTracks(testVideoPath, config);
            
            expect(startEmitted).toBe(true);
        }, 60000);

        test('should emit progress events during processing', async () => {
            const outputDir = path.join(testDir, 'process-events-2');
            const config = createDefaultAudioConfig(outputDir);
            config.generateHLS = true;

            const progressEvents: any[] = [];
            processor.on('progress', (data) => {
                progressEvents.push(data);
            });

            await processor.processAudioTracks(testVideoPath, config);
            
            expect(progressEvents.length).toBeGreaterThan(0);
        }, 60000);

        test('should emit complete event when processing finishes', async () => {
            const outputDir = path.join(testDir, 'process-events-3');
            const config = createDefaultAudioConfig(outputDir);
            config.generateHLS = false;

            let completeEmitted = false;
            let completeData: any = null;

            processor.once('complete', (data) => {
                completeEmitted = true;
                completeData = data;
            });

            const result = await processor.processAudioTracks(testVideoPath, config);
            
            expect(completeEmitted).toBe(true);
            expect(completeData).toBeDefined();
            expect(result.success).toBe(true);
        }, 60000);

        test('should emit track-specific events', async () => {
            const outputDir = path.join(testDir, 'process-track-events');
            const config = createDefaultAudioConfig(outputDir);

            const events = {
                tracksDetected: false,
                trackStart: false,
                trackComplete: false
            };

            processor.once('tracks-detected', (count, total) => {
                events.tracksDetected = true;
                expect(count).toBeGreaterThan(0);
                expect(total).toBeGreaterThan(0);
            });

            processor.once('track-start', (language, index) => {
                events.trackStart = true;
                expect(language).toBeDefined();
                expect(typeof index).toBe('number');
            });

            processor.once('track-complete', (language, data) => {
                events.trackComplete = true;
                expect(language).toBeDefined();
                expect(data.audioPath).toBeDefined();
            });

            await processor.processAudioTracks(testVideoPath, config);
            
            expect(events.tracksDetected).toBe(true);
            expect(events.trackStart).toBe(true);
            expect(events.trackComplete).toBe(true);
        }, 60000);
    });

    describe('Audio Processing with HLS', () => {
        test('should process audio and generate HLS segments', async () => {
            const outputDir = path.join(testDir, 'hls-segments');
            const config = createDefaultAudioConfig(outputDir);
            config.generateHLS = true;
            config.segmentDuration = 6;

            const result = await processor.processAudioTracks(testVideoPath, config);
            
            expect(result.success).toBe(true);
            expect(result.tracks.length).toBeGreaterThan(0);
            
            const track = result.tracks[0];
            expect(track.hlsPlaylistPath).toBeDefined();
            expect(track.hlsSegmentCount).toBeGreaterThan(0);
            expect(await fs.pathExists(track.hlsPlaylistPath!)).toBe(true);
        }, 60000);

        test('should create segments with correct duration', async () => {
            const outputDir = path.join(testDir, 'hls-duration');
            const config = createDefaultAudioConfig(outputDir);
            config.generateHLS = true;
            config.segmentDuration = 4;

            const result = await processor.processAudioTracks(testVideoPath, config);
            
            expect(result.tracks[0].hlsSegmentCount).toBeGreaterThan(1);
            
            // Verificar que el playlist existe
            const playlistPath = result.tracks[0].hlsPlaylistPath!;
            const playlistContent = await fs.readFile(playlistPath, 'utf8');
            expect(playlistContent).toContain('#EXTM3U');
            expect(playlistContent).toContain('#EXTINF');
        }, 60000);
    });

    describe('Quality Presets', () => {
        test('should have quality presets defined', () => {
            expect(AUDIO_QUALITY_PRESETS.low).toBeDefined();
            expect(AUDIO_QUALITY_PRESETS.medium).toBeDefined();
            expect(AUDIO_QUALITY_PRESETS.high).toBeDefined();
            expect(AUDIO_QUALITY_PRESETS.premium).toBeDefined();
        });

        test('presets should have correct bitrates', () => {
            expect(AUDIO_QUALITY_PRESETS.low.bitrate).toBe('64k');
            expect(AUDIO_QUALITY_PRESETS.medium.bitrate).toBe('128k');
            expect(AUDIO_QUALITY_PRESETS.high.bitrate).toBe('192k');
            expect(AUDIO_QUALITY_PRESETS.premium.bitrate).toBe('256k');
        });

        test('should process audio with different quality presets', async () => {
            const qualities: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high'];
            
            for (const quality of qualities) {
                const outputDir = path.join(testDir, `quality-${quality}`);
                const preset = AUDIO_QUALITY_PRESETS[quality];
                
                const config = createDefaultAudioConfig(outputDir);
                config.targetBitrate = preset.bitrate;
                config.targetSampleRate = preset.sampleRate;
                config.generateHLS = false;

                const result = await processor.processAudioTracks(testVideoPath, config);
                
                expect(result.success).toBe(true);
                expect(result.tracks[0].metadata.targetBitrate).toBe(preset.bitrate);
            }
        }, 90000);
    });

    describe('Progress Tracking', () => {
        test('should provide detailed progress information', async () => {
            const outputDir = path.join(testDir, 'progress-tracking');
            const config = createDefaultAudioConfig(outputDir);
            config.generateHLS = true;

            const progressUpdates: any[] = [];

            processor.on('progress', (progress) => {
                progressUpdates.push(progress);
                
                // Verificar estructura del progreso
                expect(progress).toHaveProperty('percent');
                expect(typeof progress.percent).toBe('number');
            });

            await processor.processAudioTracks(testVideoPath, config);
            
            expect(progressUpdates.length).toBeGreaterThan(0);
            
            // Verificar que el progreso aumenta
            if (progressUpdates.length > 1) {
                const firstPercent = progressUpdates[0].percent;
                const lastPercent = progressUpdates[progressUpdates.length - 1].percent;
                expect(lastPercent).toBeGreaterThanOrEqual(firstPercent);
            }
        }, 60000);
    });

    describe('Error Handling', () => {
        test('should handle non-existent input file', async () => {
            const outputDir = path.join(testDir, 'error-test');
            const config = createDefaultAudioConfig(outputDir);
            
            await expect(
                processor.processAudioTracks('/non/existent/file.mp4', config)
            ).rejects.toThrow();
        });

        test('should report errors in processing result', async () => {
            const outputDir = path.join(testDir, 'error-result');
            const config = createDefaultAudioConfig(outputDir);
            
            // Intentar procesar archivo inválido
            try {
                await processor.processAudioTracks('/invalid/path.mp4', config);
            } catch (error) {
                // Expected to throw
                expect(error).toBeDefined();
            }
        });
    });

    describe('Utilities', () => {
        test('should estimate audio size correctly', () => {
            const duration = 60; // 60 seconds
            const bitrate = '128k';
            
            const estimatedSize = processor.estimateAudioSize(duration, bitrate);
            
            expect(estimatedSize).toBeGreaterThan(0);
            // 60 seconds * 128 kbps = ~960 KB
            expect(estimatedSize).toBeCloseTo(960000, -4);
        });

        test('should detect when conversion is needed', () => {
            expect(processor.needsConversion('aac', 'mp3')).toBe(true);
            expect(processor.needsConversion('aac', 'aac')).toBe(false);
            expect(processor.needsConversion('AAC', 'aac')).toBe(false);
        });
    });
});