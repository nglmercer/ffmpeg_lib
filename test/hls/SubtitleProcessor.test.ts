// ==================== test/SubtitleProcessor.test.ts ====================

import { describe as describe3, test as test3, expect as expect3, beforeAll as beforeAll3, afterAll as afterAll3 } from 'bun:test';
import { SubtitleProcessor, SubtitleFormat } from '../../src/hls/SubtitleProcessor';
import { FFmpegManager } from '../../src/FFmpegManager';
import fs3 from 'fs-extra';
import path3 from 'path';
import os3 from 'os';

describe3('SubtitleProcessor Tests', () => {
    let processor: SubtitleProcessor;
    let testDir: string;
    let ffmpegPath: string;
    let ffprobePath: string;

    beforeAll3(async () => {
        const ffmpegManager = new FFmpegManager();
        await ffmpegManager.downloadFFmpegBinaries();
        const binaries = await ffmpegManager.verifyBinaries();
        ffmpegPath = binaries.ffmpegPath;
        ffprobePath = binaries.ffprobePath;

        testDir = path3.join(os3.tmpdir(), 'subtitle-test-' + Date.now());
        await fs3.ensureDir(testDir);

        processor = new SubtitleProcessor(ffmpegPath, ffprobePath);
    });

    afterAll3(async () => {
        await fs3.remove(testDir);
    });

    describe3('Format Detection', () => {
        test3('should detect format by extension', () => {
            expect3(processor.detectFormatByExtension('sub.srt')).toBe(SubtitleFormat.SRT);
            expect3(processor.detectFormatByExtension('sub.ass')).toBe(SubtitleFormat.ASS);
            expect3(processor.detectFormatByExtension('sub.vtt')).toBe(SubtitleFormat.WEBVTT);
            expect3(processor.detectFormatByExtension('sub.ttml')).toBe(SubtitleFormat.TTML);
        });

        test3('should identify custom formats', () => {
            expect3(processor.isCustomFormat(SubtitleFormat.ASS)).toBe(true);
            expect3(processor.isCustomFormat(SubtitleFormat.TTML)).toBe(true);
            expect3(processor.isCustomFormat(SubtitleFormat.SRT)).toBe(false);
        });

        test3('should check HLS conversion needs', () => {
            expect3(processor.needsConversionForHLS(SubtitleFormat.SRT)).toBe(true);
            expect3(processor.needsConversionForHLS(SubtitleFormat.WEBVTT)).toBe(false);
        });
    });

    describe3('External Subtitle Processing', () => {
        test3('should process external SRT subtitle', async () => {
            // Crear subtítulo SRT de prueba
            const srtPath = path3.join(testDir, 'test.srt');
            const srtContent = `1
00:00:00,000 --> 00:00:05,000
Test subtitle line 1

2
00:00:05,000 --> 00:00:10,000
Test subtitle line 2`;
            
            await fs3.writeFile(srtPath, srtContent, 'utf8');

            const config = {
                outputDir: path3.join(testDir, 'processed'),
                saveOriginal: true,
                generateWebVTT: false
            };

            const result = await processor.processExternalSubtitle(srtPath, 'en', config);

            expect3(result.language).toBe('en');
            expect3(result.originalFormat).toBe(SubtitleFormat.SRT);
            expect3(result.customPath).toBeDefined();
            expect3(await fs3.pathExists(result.customPath!)).toBe(true);
        });
    });

    describe3('Mock WebVTT Generation', () => {
        test3('should generate mock WebVTT when enabled', async () => {
            const srtPath = path3.join(testDir, 'test-webvtt.srt');
            await fs3.writeFile(srtPath, '1\n00:00:00,000 --> 00:00:05,000\nTest', 'utf8');

            const config = {
                outputDir: path3.join(testDir, 'webvtt-mock'),
                saveOriginal: true,
                generateWebVTT: true  // Habilitar mock
            };

            const result = await processor.processExternalSubtitle(srtPath, 'es', config);

            expect3(result.webvttPath).toBeDefined();
            expect3(result.webvttPlaylistPath).toBeDefined();
            expect3(await fs3.pathExists(result.webvttPath!)).toBe(true);
        });
    });
});
