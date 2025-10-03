// ==================== test/AudioTrackProcessor.test.ts ====================

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { AudioTrackProcessor, AUDIO_QUALITY_PRESETS } from '../../src/hls/AudioTrackProcessor';
import { TestMediaGenerator } from '../../src/TestMediaGenerator';
import { FFmpegManager } from '../../src/FFmpegManager';
import fs4 from 'fs-extra';
import path4 from 'path';
import os4 from 'os';

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
        if (!isAvailable){
            await ffmpegManager.downloadFFmpegBinaries(true);
        }   
        const binaries = await ffmpegManager.verifyBinaries();
        ffmpegPath = binaries.ffmpegPath;
        ffprobePath = binaries.ffprobePath;

        testDir = path4.join(os4.tmpdir(), 'audio-test-' + Date.now());
        await fs4.ensureDir(testDir);

        mediaGenerator = new TestMediaGenerator(ffmpegPath, testDir, ffprobePath);
        processor = new AudioTrackProcessor(ffmpegPath, ffprobePath);

        // Generar video con audio
        const video = await mediaGenerator.generateVideoWithAudio('test-audio.mp4', {
            duration: 10
        });
        testVideoPath = video.path;
    }); // 2 minute timeout for FFmpeg download and media generation

    afterAll(async () => {
        await mediaGenerator.cleanup();
        await fs4.remove(testDir);
    });

    describe('Audio Detection', () => {
        test('should detect audio tracks', async () => {
            const tracks = await processor.detectAudioTracks(testVideoPath);

            expect(tracks.length).toBeGreaterThan(0);
            expect(tracks[0].codec).toBeDefined();
            expect(tracks[0].channels).toBeGreaterThan(0);
        });

        test('should get default audio track', async () => {
            const track = await processor.getDefaultAudioTrack(testVideoPath);

            expect(track).not.toBeNull();
            expect(track?.isDefault).toBe(true);
        });
    });

    describe('Audio Extraction', () => {
        test('should extract full audio', async () => {
            const outputPath = path4.join(testDir, 'extracted.m4a');

            await processor.extractFullAudio(testVideoPath, outputPath, {
                codec: 'aac',
                bitrate: '128k'
            });

            expect(await fs4.pathExists(outputPath)).toBe(true);
            const stats = await fs4.stat(outputPath);
            expect(stats.size).toBeGreaterThan(0);
        }, 30000);
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
            expect(AUDIO_QUALITY_PRESETS.high.bitrate).toBe('192k');
        });
    });
});