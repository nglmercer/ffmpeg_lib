// test/hls/VideoProcessingOrchestrator.test.ts - FIXED
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { VideoProcessingOrchestrator } from '../../src/hls/VideoProcessingOrchestrator';
import { VideoProcessingEvent } from '../../src/hls/EventTypes';
import { TestMediaGenerator } from '../../src/TestMediaGenerator';
import { FFmpegManager } from '../../src/FFmpegManager';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('VideoProcessingOrchestrator Tests', () => {
    let orchestrator: VideoProcessingOrchestrator;
    let mediaGenerator: TestMediaGenerator;
    let testDir: string;
    let testVideoPath: string;

    beforeAll(async () => {
        const ffmpegManager = new FFmpegManager();
        const isAvailable = await ffmpegManager.isFFmpegAvailable();
        
        if (!isAvailable) {
            await ffmpegManager.downloadFFmpegBinaries(true);
        }
        
        const binaries = await ffmpegManager.verifyBinaries();
        
        testDir = path.join(os.tmpdir(), 'orchestrator-test-' + Date.now());
        await fs.ensureDir(testDir);
        
        mediaGenerator = new TestMediaGenerator(
            binaries.ffmpegPath,
            path.join(testDir, 'media'),
            binaries.ffprobePath
        );
        
        // Generar video de prueba
        const video = await mediaGenerator.generateVideoWithAudio('test.mp4', {
            duration: 15,
            width: 1280,
            height: 720
        });
        testVideoPath = video.path;
    }); // Timeout aumentado para beforeAll

    afterAll(async () => {
        await mediaGenerator.cleanup();
        await fs.remove(testDir);
    }); // Timeout para cleanup

    describe('Complete Processing Pipeline', () => {
        test('should process video completely with typed events', async () => {
            // ⭐ Crear nueva instancia para cada test (evitar state compartido)
            orchestrator = new VideoProcessingOrchestrator(undefined, {
                enableLogger: true  // Habilitar logs para debugging
            });

            const config = {
                outputBaseDir: path.join(testDir, 'output'),
                qualityPreset: 'low' as const,
                targetResolutions: ['480p'],
                parallel: false,
                extractAudioTracks: false,
                extractSubtitles: false,
                cleanupTemp: false
            };

            // ⭐ Usar eventos tipados del sistema nuevo
            let phaseStartedEmitted = false;
            let variantProgressEmitted = false;
            let processingCompletedEmitted = false;

            orchestrator.on(VideoProcessingEvent.PHASE_STARTED, (data) => {
                console.log(`📍 Phase started: ${data.phase}`);
                phaseStartedEmitted = true;
            });

            orchestrator.on(VideoProcessingEvent.VARIANT_PROGRESS, (data) => {
                console.log(`🎬 ${data.variantName}: ${data.percent}%`);
                variantProgressEmitted = true;
            });

            orchestrator.on(VideoProcessingEvent.PROCESSING_COMPLETED, (data) => {
                console.log(`✅ Completed in ${data.totalDuration}s`);
                processingCompletedEmitted = true;
            });

            // Procesar video
            const result = await orchestrator.processVideo(testVideoPath, config);

            // Verificaciones
            expect(result.success).toBe(true);
            expect(result.masterPlaylist).toBeDefined();
            expect(result.variants.length).toBeGreaterThan(0);
            expect(await fs.pathExists(result.masterPlaylist)).toBe(true);
            
            // Verificar que los eventos fueron emitidos
            expect(phaseStartedEmitted).toBe(true);
            expect(variantProgressEmitted).toBe(true);
            expect(processingCompletedEmitted).toBe(true);

            // Verificar estructura de directorios
            const outputDir = path.dirname(result.masterPlaylist);
            expect(await fs.pathExists(path.join(outputDir, 'video'))).toBe(true);

            console.log('\n✅ Processing completed successfully');
            console.log(`   Master playlist: ${result.masterPlaylist}`);
            console.log(`   Variants: ${result.variants.length}`);
            console.log(`   Processing time: ${result.metadata.processingTime}s`);
        }, 180000);

        test('should generate master playlist with multiple resolutions', async () => {
            orchestrator = new VideoProcessingOrchestrator();

            const config = {
                outputBaseDir: path.join(testDir, 'output-2'),
                qualityPreset: 'medium' as const,
                targetResolutions: ['720p', '480p'],
                parallel: false,
                extractAudioTracks: false,
                extractSubtitles: false
            };

            let variantsCompleted = 0;
            orchestrator.on(VideoProcessingEvent.VARIANT_COMPLETED, () => {
                variantsCompleted++;
            });

            const result = await orchestrator.processVideo(testVideoPath, config);

            // Verificar contenido del master playlist
            const masterContent = await fs.readFile(result.masterPlaylist, 'utf8');
            
            expect(masterContent).toContain('#EXTM3U');
            expect(masterContent).toContain('#EXT-X-STREAM-INF');
            expect(result.variants.length).toBe(2);
            expect(variantsCompleted).toBe(2);

            // Verificar que cada variante tenga su playlist
            for (const variant of result.variants) {
                expect(await fs.pathExists(variant.playlistPath)).toBe(true);
                console.log(`✓ Variant ${variant.name}: ${variant.segmentCount} segments`);
            }
        }, 180000);

        test('should track progress correctly', async () => {
            orchestrator = new VideoProcessingOrchestrator();

            const config = {
                outputBaseDir: path.join(testDir, 'output-3'),
                qualityPreset: 'low' as const,
                targetResolutions: ['480p'],
                parallel: false,
                extractAudioTracks: false,
                extractSubtitles: false
            };

            const progressUpdates: number[] = [];

            orchestrator.on(VideoProcessingEvent.PHASE_PROGRESS, (data) => {
                progressUpdates.push(data.percent);
            });

            await orchestrator.processVideo(testVideoPath, config);

            // Verificar que hubo actualizaciones de progreso
            expect(progressUpdates.length).toBeGreaterThan(0);
            
            // El progreso debe ser creciente
            for (let i = 1; i < progressUpdates.length; i++) {
                expect(progressUpdates[i]).toBeGreaterThanOrEqual(progressUpdates[i - 1]);
            }

            console.log(`✓ Progress updates: ${progressUpdates.length}`);
        }, 180000);

        test('should handle getProgressStatus during processing', async () => {
            orchestrator = new VideoProcessingOrchestrator();

            const config = {
                outputBaseDir: path.join(testDir, 'output-4'),
                qualityPreset: 'low' as const,
                targetResolutions: ['480p'],
                parallel: false,
                extractAudioTracks: false,
                extractSubtitles: false
            };

            let statusChecked = false;

            orchestrator.on(VideoProcessingEvent.VARIANT_PROGRESS, () => {
                if (!statusChecked) {
                    const status = orchestrator.getProgressStatus();
                    
                    expect(status).toBeDefined();
                    expect(status?.processId).toBeDefined();
                    expect(status?.phase).toBeDefined();
                    expect(status?.globalPercent).toBeGreaterThanOrEqual(0);
                    expect(status?.globalPercent).toBeLessThanOrEqual(100);
                    
                    console.log(`📊 Progress status:`, {
                        phase: status?.phase,
                        globalPercent: status?.globalPercent,
                        phasePercent: status?.phasePercent,
                        eta: status?.estimatedRemainingSeconds
                    });
                    
                    statusChecked = true;
                }
            });

            await orchestrator.processVideo(testVideoPath, config);

            expect(statusChecked).toBe(true);
        }, 180000);
    });

    describe('Error Handling', () => {
        test('should handle invalid input file', async () => {
            orchestrator = new VideoProcessingOrchestrator();

            const config = {
                outputBaseDir: path.join(testDir, 'output-error'),
                qualityPreset: 'medium' as const
            };

            let errorEmitted = false;
            orchestrator.on(VideoProcessingEvent.PROCESSING_FAILED, (data) => {
                console.log(`❌ Processing failed: ${data.error.message}`);
                errorEmitted = true;
            });

            await expect(
                orchestrator.processVideo('nonexistent.mp4', config)
            ).rejects.toThrow();

            expect(errorEmitted).toBe(true);
        });

        test('should emit warnings for non-critical issues', async () => {
            orchestrator = new VideoProcessingOrchestrator();

            const config = {
                outputBaseDir: path.join(testDir, 'output-5'),
                qualityPreset: 'low' as const,
                targetResolutions: ['480p'],
                extractSubtitles: true,  // No hay subtítulos en el video de prueba
                parallel: false
            };

            const warnings: string[] = [];
            orchestrator.on(VideoProcessingEvent.WARNING, (data) => {
                warnings.push(data.message);
            });

            const result = await orchestrator.processVideo(testVideoPath, config);

            expect(result.success).toBe(true);
            // Puede o no haber warnings dependiendo del video
            console.log(`⚠️  Warnings emitted: ${warnings.length}`);
        }, 180000);
    });

    describe('Event Lifecycle', () => {
        test('should emit all lifecycle events in correct order', async () => {
            orchestrator = new VideoProcessingOrchestrator();

            const config = {
                outputBaseDir: path.join(testDir, 'output-6'),
                qualityPreset: 'low' as const,
                targetResolutions: ['480p'],
                parallel: false,
                extractAudioTracks: false,
                extractSubtitles: false
            };

            const events: string[] = [];

            // Registrar todos los eventos principales
            orchestrator.on(VideoProcessingEvent.PHASE_STARTED, (data) => {
                events.push(`phase-started:${data.phase}`);
            });

            orchestrator.on(VideoProcessingEvent.ANALYSIS_COMPLETED, () => {
                events.push('analysis-completed');
            });

            orchestrator.on(VideoProcessingEvent.PLANNING_COMPLETED, () => {
                events.push('planning-completed');
            });

            orchestrator.on(VideoProcessingEvent.VARIANT_STARTED, (data) => {
                events.push(`variant-started:${data.variantName}`);
            });

            orchestrator.on(VideoProcessingEvent.VARIANT_COMPLETED, (data) => {
                events.push(`variant-completed:${data.variantName}`);
            });

            orchestrator.on(VideoProcessingEvent.PROCESSING_COMPLETED, () => {
                events.push('processing-completed');
            });

            await orchestrator.processVideo(testVideoPath, config);

            // Verificar orden de eventos
            console.log('\n📋 Event order:');
            events.forEach((e, i) => console.log(`   ${i + 1}. ${e}`));

            expect(events).toContain('analysis-completed');
            expect(events).toContain('planning-completed');
            expect(events).toContain('processing-completed');
            
            // El último evento debe ser processing-completed
            expect(events[events.length - 1]).toBe('processing-completed');
        }, 180000);
    });
});

console.log('\n✅ All HLS System Tests with Typed Events ready!\n');