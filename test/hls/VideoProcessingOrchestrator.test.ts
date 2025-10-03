// ==================== test/VideoProcessingOrchestrator.test.ts ====================

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { VideoProcessingOrchestrator } from '../../src/hls/VideoProcessingOrchestrator';
import { TestMediaGenerator } from '../../src/TestMediaGenerator';
import { FFmpegManager } from '../../src/FFmpegManager';
import fs5 from 'fs-extra';
import path5 from 'path';
import os5 from 'os';

describe('VideoProcessingOrchestrator Tests', () => {
    let orchestrator: VideoProcessingOrchestrator;
    let mediaGenerator: TestMediaGenerator;
    let testDir: string;
    let testVideoPath: string;

    beforeAll(async () => {
        const ffmpegManager = new FFmpegManager();
        const isAvailable = await ffmpegManager.isFFmpegAvailable();
        if (!isAvailable){
            await ffmpegManager.downloadFFmpegBinaries(true);
        }  
        const binaries = await ffmpegManager.verifyBinaries();

        testDir = path5.join(os5.tmpdir(), 'orchestrator-test-' + Date.now());
        await fs5.ensureDir(testDir);

        mediaGenerator = new TestMediaGenerator(
            binaries.ffmpegPath, 
            path5.join(testDir, 'media'),
            binaries.ffprobePath
        );

        orchestrator = new VideoProcessingOrchestrator();

        // Generar video de prueba
        const video = await mediaGenerator.generateVideoWithAudio('test.mp4', {
            duration: 15,
            width: 1280,
            height: 720
        });
        testVideoPath = video.path;
    }, 120000); // 2 minute timeout for FFmpeg download and media generation

    afterAll(async () => {
        await mediaGenerator.cleanup();
        await fs5.remove(testDir);
    });

    describe('Complete Processing Pipeline', () => {
        test('should process video completely', async () => {
            const config = {
                outputBaseDir: path5.join(testDir, 'output'),
                qualityPreset: 'low' as const,
                targetResolutions: ['480p'],
                parallel: false,
                extractAudioTracks: false,
                extractSubtitles: false,
                cleanupTemp: false
            };

            let progressEmitted = false;
            orchestrator.on('progress', () => {
                progressEmitted = true;
            });

            const result = await orchestrator.processVideo(testVideoPath, config);

            expect(result.success).toBe(true);
            expect(result.masterPlaylist).toBeDefined();
            expect(result.variants.length).toBeGreaterThan(0);
            expect(await fs5.pathExists(result.masterPlaylist)).toBe(true);
            expect(progressEmitted).toBe(true);
        }, 180000);

        test('should generate master playlist', async () => {
            const config = {
                outputBaseDir: path5.join(testDir, 'output-2'),
                qualityPreset: 'medium' as const,
                targetResolutions: ['720p', '480p'],
                parallel: false,
                extractAudioTracks: false,
                extractSubtitles: false
            };

            const result = await orchestrator.processVideo(testVideoPath, config);

            const masterContent = await fs5.readFile(result.masterPlaylist, 'utf8');
            
            expect(masterContent).toContain('#EXTM3U');
            expect(masterContent).toContain('#EXT-X-STREAM-INF');
            expect(result.variants.length).toBe(2);
        }, 180000);
    });

    describe('Error Handling', () => {
        test('should handle invalid input file', async () => {
            const config = {
                outputBaseDir: path5.join(testDir, 'output-error'),
                qualityPreset: 'medium' as const
            };

            await expect(
                orchestrator.processVideo('nonexistent.mp4', config)
            ).rejects.toThrow();
        });
    });
});

console.log('\n✅ All HLS System Tests defined and ready to run with Bun!\n');