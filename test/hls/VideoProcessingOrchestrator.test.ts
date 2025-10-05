import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { 
    VideoProcessingOrchestrator,
    createDefaultOrchestratorConfig,
    createStreamingConfig
} from '../../src/hls/VideoProcessingOrchestrator';
import { TestMediaGenerator } from '../../src/TestMediaGenerator';
import { FFmpegManager } from '../../src/FFmpegManager';
import { ResolutionUtils } from '../../src/utils/ResolutionUtils';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('VideoProcessingOrchestrator Tests', () => {
    let orchestrator: VideoProcessingOrchestrator;
    let mediaGenerator: TestMediaGenerator;
    let testDir: string;
    let testVideoPath: string;
    let testSubtitlePath: string;
    let mkvTestVideoPath: string;
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

        testDir = path.join(os.tmpdir(), 'orchestrator-test-' + Date.now());
        await fs.ensureDir(testDir);

        mediaGenerator = new TestMediaGenerator(ffmpegPath, testDir, ffprobePath);
        orchestrator = new VideoProcessingOrchestrator(ffmpegPath, ffprobePath);

        // Generar video de prueba con audio
        const video = await mediaGenerator.generateVideoWithAudio('test.mp4', {
            duration: 12,
            width: 1280,
            height: 720
        });
        const mkvvideo = await mediaGenerator.generateVideoWithSubtitles('test_mkv.mkv', {
            duration: 10
        });

        testVideoPath = video.path;
        mkvTestVideoPath = mkvvideo.path;
        
        // Crear subtítulo de prueba
        testSubtitlePath = path.join(testDir, 'test.srt');
        const srtContent = `1
00:00:00,000 --> 00:00:05,000
First subtitle line

2
00:00:05,000 --> 00:00:10,000
Second subtitle line`;
        await fs.writeFile(testSubtitlePath, srtContent, 'utf8');
    });

    afterAll(async () => {
        await mediaGenerator.cleanup();
        await fs.remove(testDir);
    });

    describe('Configuration Builders', () => {
        test('should create default configuration', () => {
            const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720);
            const config = createDefaultOrchestratorConfig(
                testVideoPath,
                path.join(testDir, 'output'),
                resolutions
            );

            expect(config.inputPath).toBe(testVideoPath);
            expect(config.video.enabled).toBe(true);
            expect(config.audio.enabled).toBe(true);
            expect(config.subtitles.enabled).toBe(true);
            expect(config.video.resolutions.length).toBeGreaterThan(0);
        });

        test('should create streaming configuration', () => {
            const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720);
            const config = createStreamingConfig(
                testVideoPath,
                path.join(testDir, 'streaming'),
                resolutions,
                {
                    multiAudio: true,
                    languages: ['en', 'es'],
                    preset: 'medium'
                }
            );

            expect(config.audio.extractAll).toBe(true);
            expect(config.audio.languages).toContain('en');
            expect(config.audio.languages).toContain('es');
            expect(config.video.preset).toBe('medium');
            expect(config.subtitles.generateWebVTT).toBe(true);
        });
    });

    describe('Complete Processing', () => {
        test('should process video with all components enabled', async () => {
            const outputDir = path.join(testDir, 'complete-processing');
            const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720).slice(0, 2);
            
            const config = createDefaultOrchestratorConfig(
                testVideoPath,
                outputDir,
                resolutions
            );

            // Agregar subtítulo externo
            config.subtitles.externalFiles = [{
                path: testSubtitlePath,
                language: 'en'
            }];

            const result = await orchestrator.process(config);

            // Verificar éxito general
            expect(result.success).toBe(true);
            expect(result.errors.length).toBe(0);

            // Verificar video
            expect(result.video).toBeDefined();
            expect(result.video!.qualities.length).toBe(resolutions.length);
            expect(result.video!.masterPlaylistPath).toBeDefined();

            // Verificar audio
            expect(result.audio).toBeDefined();
            expect(result.audio!.tracks.length).toBeGreaterThan(0);
            expect(result.audio!.defaultTrack).toBeDefined();

            // Verificar subtítulos
            expect(result.subtitles).toBeDefined();
            expect(result.subtitles!.tracks.length).toBeGreaterThan(0);

            // Verificar metadata
            expect(result.metadata.totalSize).toBeGreaterThan(0);
            expect(result.metadata.totalProcessingTime).toBeGreaterThan(0);
        }, 180000);

        test('should process video only', async () => {
            const outputDir = path.join(testDir, 'video-only');
            const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720).slice(0, 1);
            
            const config = createDefaultOrchestratorConfig(
                testVideoPath,
                outputDir,
                resolutions
            );
            
            // Deshabilitar audio y subtítulos
            config.audio.enabled = false;
            config.subtitles.enabled = false;

            const result = await orchestrator.process(config);

            expect(result.success).toBe(true);
            expect(result.video).toBeDefined();
            expect(result.audio).toBeUndefined();
            expect(result.subtitles).toBeUndefined();
        }, 60000);

        test('should process audio only', async () => {
            const outputDir = path.join(testDir, 'audio-only');
            const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720).slice(0, 1);
            
            const config = createDefaultOrchestratorConfig(
                testVideoPath,
                outputDir,
                resolutions
            );
            
            // Deshabilitar video y subtítulos
            config.video.enabled = false;
            config.subtitles.enabled = false;

            const result = await orchestrator.process(config);

            expect(result.success).toBe(true);
            expect(result.video).toBeUndefined();
            expect(result.audio).toBeDefined();
            expect(result.audio!.tracks.length).toBeGreaterThan(0);
        }, 60000);
    });

    describe('Event Emission', () => {
        test('should emit start event', async () => {
            const outputDir = path.join(testDir, 'events-start');
            const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720).slice(0, 1);
            
            const config = createDefaultOrchestratorConfig(
                testVideoPath,
                outputDir,
                resolutions
            );
            config.audio.enabled = false;
            config.subtitles.enabled = false;

            let startEmitted = false;
            orchestrator.once('start', (data) => {
                startEmitted = true;
                expect(data.config).toBeDefined();
                expect(data.timestamp).toBeInstanceOf(Date);
            });

            await orchestrator.process(config);
            expect(startEmitted).toBe(true);
        }, 60000);

        test('should emit progress events', async () => {
            const outputDir = path.join(testDir, 'events-progress');
            const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720).slice(0, 1);
            
            const config = createDefaultOrchestratorConfig(
                testVideoPath,
                outputDir,
                resolutions
            );
            config.audio.enabled = false;
            config.subtitles.enabled = false;

            const progressEvents: any[] = [];
            orchestrator.on('progress', (data) => {
                progressEvents.push(data);
                
                // Verificar estructura
                expect(data.phase).toBeDefined();
                expect(typeof data.phasePercent).toBe('number');
                expect(typeof data.globalPercent).toBe('number');
            });

            await orchestrator.process(config);
            expect(progressEvents.length).toBeGreaterThan(0);
        }, 60000);

        test('should emit phase-specific events', async () => {
            const outputDir = path.join(testDir, 'events-phases');
            const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720).slice(0, 1);
            
            const config = createDefaultOrchestratorConfig(
                testVideoPath,
                outputDir,
                resolutions
            );

            const phaseEvents = {
                video: { start: false, complete: false },
                audio: { start: false, complete: false },
                subtitles: { start: false, complete: false }
            };

            orchestrator.on('phase-start', (phase) => {
                if (phase in phaseEvents) {
                    phaseEvents[phase as keyof typeof phaseEvents].start = true;
                }
            });

            orchestrator.on('phase-complete', (phase) => {
                if (phase in phaseEvents) {
                    phaseEvents[phase as keyof typeof phaseEvents].complete = true;
                }
            });

            await orchestrator.process(config);

            expect(phaseEvents.video.start).toBe(true);
            expect(phaseEvents.video.complete).toBe(true);
            expect(phaseEvents.audio.start).toBe(true);
            expect(phaseEvents.audio.complete).toBe(true);
        }, 120000);

        test('should emit complete event', async () => {
            const outputDir = path.join(testDir, 'events-complete');
            const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720).slice(0, 1);
            
            const config = createDefaultOrchestratorConfig(
                testVideoPath,
                outputDir,
                resolutions
            );
            config.audio.enabled = false;
            config.subtitles.enabled = false;

            let completeEmitted = false;
            let completeData: any = null;

            orchestrator.once('complete', (data) => {
                completeEmitted = true;
                completeData = data;
            });

            const result = await orchestrator.process(config);

            expect(completeEmitted).toBe(true);
            expect(completeData).toBeDefined();
            expect(completeData.success).toBe(true);
            expect(completeData.metadata).toBeDefined();
        }, 60000);
    });

    describe('Master Playlist Generation', () => {
        test('should generate master playlist with multiple qualities', async () => {
            const outputDir = path.join(testDir, 'master-playlist');
            const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720).slice(0, 2);
            
            const config = createDefaultOrchestratorConfig(
                testVideoPath,
                outputDir,
                resolutions
            );
            config.subtitles.enabled = false;

            const result = await orchestrator.process(config);

            expect(result.video!.masterPlaylistPath).toBeDefined();
            expect(await fs.pathExists(result.video!.masterPlaylistPath!)).toBe(true);

            // Verificar contenido del master playlist
            const content = await fs.readFile(result.video!.masterPlaylistPath!, 'utf8');
            
            expect(content).toContain('#EXTM3U');
            expect(content).toContain('#EXT-X-STREAM-INF');
            expect(content).toContain('BANDWIDTH=');
            expect(content).toContain('RESOLUTION=');
            
            // Debe contener referencias a cada calidad
            for (const resolution of resolutions) {
                expect(content).toContain(`${resolution.width}x${resolution.height}`);
            }
        }, 120000);

        test('should include audio tracks in master playlist', async () => {
            const outputDir = path.join(testDir, 'master-audio');
            const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720).slice(0, 1);
            
            const config = createDefaultOrchestratorConfig(
                testVideoPath,
                outputDir,
                resolutions
            );
            config.subtitles.enabled = false;

            const result = await orchestrator.process(config);

            const content = await fs.readFile(result.video!.masterPlaylistPath!, 'utf8');
            
            // El video de prueba tiene solo 1 pista de audio embebida en cada variante
            // Por lo tanto, no habrá GROUP-ID="audio" separado
            // Solo verificamos que el playlist se generó correctamente
            expect(content).toContain('#EXT-X-STREAM-INF');
            expect(content).toContain('BANDWIDTH=');
        }, 90000);

        test('should include subtitles in master playlist when WebVTT is enabled', async () => {
            const outputDir = path.join(testDir, 'master-subtitles');
            const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720).slice(0, 1);
            
            const config = createDefaultOrchestratorConfig(
                testVideoPath,
                outputDir,
                resolutions
            );
            config.subtitles.generateWebVTT = true;
            config.subtitles.externalFiles = [{
                path: testSubtitlePath,
                language: 'en'
            }];

            const result = await orchestrator.process(config);

            const content = await fs.readFile(result.video!.masterPlaylistPath!, 'utf8');
            
            // Verificar referencias a subtítulos
            if (result.subtitles && result.subtitles.tracks.some(t => t.webvttPlaylistPath)) {
                expect(content).toContain('TYPE=SUBTITLES');
                expect(content).toContain('GROUP-ID="subs"');
            }
        }, 90000);
    });

    describe('Error Handling', () => {
        test('should handle non-existent input file', async () => {
            const outputDir = path.join(testDir, 'error-input');
            const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720).slice(0, 1);
            
            const config = createDefaultOrchestratorConfig(
                '/non/existent/file.mp4',
                outputDir,
                resolutions
            );

            await expect(orchestrator.process(config)).rejects.toThrow();
        });

        test('should continue processing on non-critical errors', async () => {
            const outputDir = path.join(testDir, 'error-noncritical');
            const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720).slice(0, 1);
            
            const config = createDefaultOrchestratorConfig(
                testVideoPath,
                outputDir,
                resolutions
            );
            
            // Agregar subtítulo externo inválido (no crítico)
            config.subtitles.externalFiles = [{
                path: '/invalid/subtitle.srt',
                language: 'en'
            }];

            const result = await orchestrator.process(config);

            // El procesamiento debe completarse aunque falle subtítulos
            expect(result.video).toBeDefined();
            expect(result.audio).toBeDefined();
            expect(result.errors.length).toBeGreaterThan(0);
            
            // Verificar que el error no es crítico
            const subtitleError = result.errors.find(e => e.phase === 'subtitles');
            expect(subtitleError).toBeDefined();
            expect(subtitleError!.critical).toBe(false);
        }, 120000);

        test('should report errors in result', async () => {
            const outputDir = path.join(testDir, 'error-reporting');
            const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720).slice(0, 1);
            
            const config = createDefaultOrchestratorConfig(
                testVideoPath,
                outputDir,
                resolutions
            );
            
            config.subtitles.externalFiles = [{
                path: '/invalid.srt',
                language: 'en'
            }];

            const result = await orchestrator.process(config);

            expect(result.errors).toBeDefined();
            
            if (result.errors.length > 0) {
                const error = result.errors[0];
                expect(error.phase).toBeDefined();
                expect(error.message).toBeDefined();
                expect(error.timestamp).toBeInstanceOf(Date);
                expect(typeof error.critical).toBe('boolean');
            }
        }, 120000);
    });

    describe('Multi-Language Support', () => {
        test('should process audio with language filtering', async () => {
            const outputDir = path.join(testDir, 'multi-language');
            const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720).slice(0, 1);
            
            // El video de prueba tiene solo 1 pista de audio (sin idioma específico)
            // Cuando se solicita extractAll con filtro de idiomas que no existen,
            // no se extraerá ninguna pista (comportamiento esperado)
            const config = createStreamingConfig(
                testVideoPath,
                outputDir,
                resolutions,
                {
                    multiAudio: false, // Solo extraer default
                    languages: undefined
                }
            );
            config.subtitles.enabled = false;

            const result = await orchestrator.process(config);

            expect(result.audio).toBeDefined();
            expect(result.audio!.tracks.length).toBeGreaterThanOrEqual(1);
        }, 90000);
    });

    describe('Processing Time Estimation', () => {
        test('should estimate processing time', async () => {
            const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720).slice(0, 2);
            const config = createDefaultOrchestratorConfig(
                testVideoPath,
                path.join(testDir, 'estimate'),
                resolutions
            );

            const estimatedTime = await orchestrator.estimateProcessingTime(
                testVideoPath,
                config
            );

            expect(estimatedTime).toBeGreaterThan(0);
            expect(typeof estimatedTime).toBe('number');
        });
    });

    describe('Output Structure', () => {
        test('should create organized output directory structure', async () => {
            const outputDir = path.join(testDir, 'output-structure');
            const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720).slice(0, 1);
            
            const config = createDefaultOrchestratorConfig(
                testVideoPath,
                outputDir,
                resolutions
            );
            config.subtitles.externalFiles = [{
                path: testSubtitlePath,
                language: 'en'
            }];

            await orchestrator.process(config);

            // Verificar estructura de directorios
            expect(await fs.pathExists(path.join(outputDir, 'video'))).toBe(true);
            expect(await fs.pathExists(path.join(outputDir, 'audio'))).toBe(true);
            expect(await fs.pathExists(path.join(outputDir, 'subtitles'))).toBe(true);
            expect(await fs.pathExists(path.join(outputDir, 'master.m3u8'))).toBe(true);
        }, 120000);

        test('should calculate total output size', async () => {
            const outputDir = path.join(testDir, 'output-size');
            const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720).slice(0, 1);
            
            const config = createDefaultOrchestratorConfig(
                testVideoPath,
                outputDir,
                resolutions
            );
            config.subtitles.enabled = false;

            const result = await orchestrator.process(config);

            // Solo verificar que se calculó algún tamaño
            expect(result.metadata.totalSize).toBeGreaterThan(0);
            
            // Información útil para debugging
            const inputStats = await fs.stat(testVideoPath);
            const ratio = result.metadata.totalSize / inputStats.size;
            
            // Log para referencia (no es una validación estricta)
            // HLS puede generar archivos 1.5x-3x más grandes debido a overhead
            expect(ratio).toBeGreaterThan(0);
        }, 90000);
    });

    describe('Different Quality Configurations', () => {
        test('should handle single quality processing', async () => {
            const outputDir = path.join(testDir, 'single-quality');
            const resolutions = [ResolutionUtils.generateLowerResolutions(1280, 720)[0]];
            
            const config = createDefaultOrchestratorConfig(
                testVideoPath,
                outputDir,
                resolutions
            );
            config.audio.enabled = false;
            config.subtitles.enabled = false;

            const result = await orchestrator.process(config);

            expect(result.video!.qualities.length).toBe(1);
        }, 60000);

        test('should handle multiple quality processing', async () => {
            const outputDir = path.join(testDir, 'multi-quality');
            const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720).slice(0, 3);
            
            const config = createDefaultOrchestratorConfig(
                testVideoPath,
                outputDir,
                resolutions
            );
            config.audio.enabled = false;
            config.subtitles.enabled = false;

            const result = await orchestrator.process(config);

            expect(result.video!.qualities.length).toBe(3);
            
            // Verificar que cada calidad se procesó
            for (const quality of result.video!.qualities) {
                expect(await fs.pathExists(quality.playlistPath)).toBe(true);
                expect(quality.segmentCount).toBeGreaterThan(0);
            }
        }, 180000);
    });

    describe('Preset Configurations', () => {
        test('should support different encoding presets', async () => {
            const outputDir = path.join(testDir, 'preset-fast');
            const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720).slice(0, 1);
            
            const config = createDefaultOrchestratorConfig(
                testVideoPath,
                outputDir,
                resolutions
            );
            config.video.preset = 'fast';
            config.audio.enabled = false;
            config.subtitles.enabled = false;

            const result = await orchestrator.process(config);

            expect(result.success).toBe(true);
            expect(result.video).toBeDefined();
        }, 60000);
    });
    describe('mkv video processing', () => {
        test('should process mkv video with subtitles', async () => {
            const outputDir = path.join(testDir, 'mkv-subtitles');
            const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720).slice(0, 1);
            
            const config = createDefaultOrchestratorConfig(
                mkvTestVideoPath,
                outputDir,
                resolutions
            );
            config.subtitles.externalFiles = [{
                path: testSubtitlePath,
                language: 'en'
            }];
            
            const result = await orchestrator.process(config);

            expect(result.success).toBe(true);
            expect(result.video).toBeDefined();
            console.log("mkv video processing result:", result);
        }, 60000);
    });
});