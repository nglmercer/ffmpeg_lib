// ==================== test/VideoProcessingOrchestrator.test.ts ====================

import { describe as describe5, test as test5, expect as expect5, beforeAll as beforeAll5, afterAll as afterAll5 } from 'bun:test';
import { VideoProcessingOrchestrator } from '../../src/hls/VideoProcessingOrchestrator';
import { TestMediaGenerator } from '../../src/TestMediaGenerator';
import { FFmpegManager } from '../../src/FFmpegManager';
import fs5 from 'fs-extra';
import path5 from 'path';
import os5 from 'os';

describe5('VideoProcessingOrchestrator Tests', () => {
    let orchestrator: VideoProcessingOrchestrator;
    let mediaGenerator: TestMediaGenerator;
    let testDir: string;
    let testVideoPath: string;

    beforeAll5(async () => {
        const ffmpegManager = new FFmpegManager();
        await ffmpegManager.downloadFFmpegBinaries();
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
    }, 180000);

    afterAll5(async () => {
        await mediaGenerator.cleanup();
        await fs5.remove(testDir);
    });

    describe5('Complete Processing Pipeline', () => {
        test5('should process video completely', async () => {
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

            expect5(result.success).toBe(true);
            expect5(result.masterPlaylist).toBeDefined();
            expect5(result.variants.length).toBeGreaterThan(0);
            expect5(await fs5.pathExists(result.masterPlaylist)).toBe(true);
            expect5(progressEmitted).toBe(true);
        }, 180000);

        test5('should generate master playlist', async () => {
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
            
            expect5(masterContent).toContain('#EXTM3U');
            expect5(masterContent).toContain('#EXT-X-STREAM-INF');
            expect5(result.variants.length).toBe(2);
        }, 180000);
    });

    describe5('Error Handling', () => {
        test5('should handle invalid input file', async () => {
            const config = {
                outputBaseDir: path5.join(testDir, 'output-error'),
                qualityPreset: 'medium' as const
            };

            await expect5(
                orchestrator.processVideo('nonexistent.mp4', config)
            ).rejects.toThrow();
        });
    });
});

console.log('\n✅ All HLS System Tests defined and ready to run with Bun!\n');