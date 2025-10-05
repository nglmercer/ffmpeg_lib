// ==================== test/SubtitleProcessor.test.ts ====================

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { SubtitleProcessor, SubtitleFormat } from '../../src/hls/SubtitleProcessor';
import { FFmpegManager } from '../../src/FFmpegManager';
import fs3 from 'fs-extra';
import path3 from 'path';
import os3 from 'os';

describe('SubtitleProcessor Tests', () => {
    let processor: SubtitleProcessor;
    let testDir: string;
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

        testDir = path3.join(os3.tmpdir(), 'subtitle-test-' + Date.now());
        await fs3.ensureDir(testDir);

        processor = new SubtitleProcessor(ffmpegPath, ffprobePath);
    });

    afterAll(async () => {
        await fs3.remove(testDir);
    });

    describe('Format Detection', () => {
        test('should detect format by extension', () => {
            expect(processor.detectFormatByExtension('sub.srt')).toBe(SubtitleFormat.SRT);
            expect(processor.detectFormatByExtension('sub.ass')).toBe(SubtitleFormat.ASS);
            expect(processor.detectFormatByExtension('sub.vtt')).toBe(SubtitleFormat.WEBVTT);
            expect(processor.detectFormatByExtension('sub.ttml')).toBe(SubtitleFormat.TTML);
        });

        test('should identify custom formats', () => {
            expect(processor.isCustomFormat(SubtitleFormat.ASS)).toBe(true);
            expect(processor.isCustomFormat(SubtitleFormat.TTML)).toBe(true);
            expect(processor.isCustomFormat(SubtitleFormat.SRT)).toBe(false);
        });

        test('should check HLS conversion needs', () => {
            expect(processor.needsConversionForHLS(SubtitleFormat.SRT)).toBe(true);
            expect(processor.needsConversionForHLS(SubtitleFormat.WEBVTT)).toBe(false);
        });
    });

    describe('External Subtitle Processing', () => {
        test('should process external SRT subtitle', async () => {
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

            expect(result.language).toBe('en');
            expect(result.originalFormat).toBe(SubtitleFormat.SRT);
            expect(result.customPath).toBeDefined();
            expect(await fs3.pathExists(result.customPath!)).toBe(true);
        });
    });

    describe('Mock WebVTT Generation', () => {
        test('should generate mock WebVTT when enabled', async () => {
            const srtPath = path3.join(testDir, 'test-webvtt.srt');
            await fs3.writeFile(srtPath, '1\n00:00:00,000 --> 00:00:05,000\nTest', 'utf8');

            const config = {
                outputDir: path3.join(testDir, 'webvtt-mock'),
                saveOriginal: true,
                generateWebVTT: true  // Habilitar mock
            };

            const result = await processor.processExternalSubtitle(srtPath, 'es', config);

            expect(result.webvttPath).toBeDefined();
            expect(result.webvttPlaylistPath).toBeDefined();
            expect(await fs3.pathExists(result.webvttPath!)).toBe(true);
        });
    });
});
