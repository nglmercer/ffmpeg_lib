// ==================== test/AudioTrackProcessor.test.ts ====================

import { describe as describe4, test as test4, expect as expect4, beforeAll as beforeAll4, afterAll as afterAll4 } from 'bun:test';
import { AudioTrackProcessor, AUDIO_QUALITY_PRESETS } from '../../src/hls/AudioTrackProcessor';
import { TestMediaGenerator } from '../../src/TestMediaGenerator';
import { FFmpegManager } from '../../src/FFmpegManager';
import fs4 from 'fs-extra';
import path4 from 'path';
import os4 from 'os';

describe4('AudioTrackProcessor Tests', () => {
    let processor: AudioTrackProcessor;
    let mediaGenerator: TestMediaGenerator;
    let testDir: string;
    let testVideoPath: string;
    let ffmpegPath: string;
    let ffprobePath: string;

    beforeAll4(async () => {
        const ffmpegManager = new FFmpegManager();
        await ffmpegManager.downloadFFmpegBinaries();
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
    }, 120000);

    afterAll4(async () => {
        await mediaGenerator.cleanup();
        await fs4.remove(testDir);
    });

    describe4('Audio Detection', () => {
        test4('should detect audio tracks', async () => {
            const tracks = await processor.detectAudioTracks(testVideoPath);

            expect4(tracks.length).toBeGreaterThan(0);
            expect4(tracks[0].codec).toBeDefined();
            expect4(tracks[0].channels).toBeGreaterThan(0);
        });

        test4('should get default audio track', async () => {
            const track = await processor.getDefaultAudioTrack(testVideoPath);

            expect4(track).not.toBeNull();
            expect4(track?.isDefault).toBe(true);
        });
    });

    describe4('Audio Extraction', () => {
        test4('should extract full audio', async () => {
            const outputPath = path4.join(testDir, 'extracted.m4a');

            await processor.extractFullAudio(testVideoPath, outputPath, {
                codec: 'aac',
                bitrate: '128k'
            });

            expect4(await fs4.pathExists(outputPath)).toBe(true);
            const stats = await fs4.stat(outputPath);
            expect4(stats.size).toBeGreaterThan(0);
        }, 30000);
    });

    describe4('Quality Presets', () => {
        test4('should have quality presets defined', () => {
            expect4(AUDIO_QUALITY_PRESETS.low).toBeDefined();
            expect4(AUDIO_QUALITY_PRESETS.medium).toBeDefined();
            expect4(AUDIO_QUALITY_PRESETS.high).toBeDefined();
            expect4(AUDIO_QUALITY_PRESETS.premium).toBeDefined();
        });

        test4('presets should have correct bitrates', () => {
            expect4(AUDIO_QUALITY_PRESETS.low.bitrate).toBe('64k');
            expect4(AUDIO_QUALITY_PRESETS.high.bitrate).toBe('192k');
        });
    });
});