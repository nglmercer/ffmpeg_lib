// test/hls/VideoProcessingOrchestrator.test.ts - FIXED & IMPROVED
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { VideoProcessingOrchestrator } from '../../src/hls/VideoProcessingOrchestrator';
import { VideoProcessingEvent, ProcessingPhase } from '../../src/hls/EventTypes';
import { TestMediaGenerator } from '../../src/TestMediaGenerator';
import { FFmpegManager } from '../../src/FFmpegManager';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('VideoProcessingOrchestrator Tests', () => {
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
        
        // Generar video de prueba (más corto para tests rápidos)
        const video = await mediaGenerator.generateVideoWithAudio('test.mp4', {
            duration: 10, // ⭐ Reducido a 10s
            width: 1280,
            height: 720
        });
        testVideoPath = video.path;
        
        console.log(`✅ Test video ready: ${testVideoPath}`);
    });

    afterAll(async () => {
        await mediaGenerator.cleanup();
        await fs.remove(testDir);
        console.log('🧹 Cleanup completed');
    });

    describe('Complete Processing Pipeline', () => {
        test('should process video completely with typed events', async () => {
            const orchestrator = new VideoProcessingOrchestrator(undefined, {
                enableLogger: false // ⭐ Desactivar logs para tests más limpios
            });

            const config = {
                outputBaseDir: path.join(testDir, 'output-1'),
                qualityPreset: 'low' as const,
                targetResolutions: ['480p'],
                parallel: false,
                extractAudioTracks: false,
                extractSubtitles: false,
                cleanupTemp: true
            };

            // ⭐ Tracking de eventos clave
            const eventsEmitted = {
                phaseStarted: false,
                variantStarted: false,
                variantProgress: false,
                variantCompleted: false,
                processingCompleted: false
            };

            orchestrator.on(VideoProcessingEvent.PHASE_STARTED, (data) => {
                eventsEmitted.phaseStarted = true;
                console.log(`📍 ${data.phase}`);
            });

            orchestrator.on(VideoProcessingEvent.VARIANT_STARTED, (data) => {
                eventsEmitted.variantStarted = true;
                console.log(`🎬 Starting: ${data.variantName} (${data.resolution})`);
            });

            orchestrator.on(VideoProcessingEvent.VARIANT_PROGRESS, (data) => {
                eventsEmitted.variantProgress = true;
                if (data.percent % 25 === 0) { // Solo log cada 25%
                    console.log(`   ${data.variantName}: ${data.percent.toFixed(1)}%`);
                }
            });

            orchestrator.on(VideoProcessingEvent.VARIANT_COMPLETED, (data) => {
                eventsEmitted.variantCompleted = true;
                console.log(`✅ ${data.variantName}: ${data.segmentCount} segments`);
            });

            orchestrator.on(VideoProcessingEvent.PROCESSING_COMPLETED, (data) => {
                eventsEmitted.processingCompleted = true;
                console.log(`✅ Total time: ${data.totalDuration.toFixed(2)}s`);
            });

            const result = await orchestrator.processVideo(testVideoPath, config);

            // ⭐ Verificaciones exhaustivas
            expect(result.success).toBe(true);
            expect(result.masterPlaylist).toBeDefined();
            expect(result.videoId).toBeDefined();
            expect(result.variants.length).toBe(1);
            expect(result.metadata.processingTime).toBeGreaterThan(0);
            
            // Verificar archivos generados
            expect(await fs.pathExists(result.masterPlaylist)).toBe(true);
            
            const masterContent = await fs.readFile(result.masterPlaylist, 'utf8');
            expect(masterContent).toContain('#EXTM3U');
            expect(masterContent).toContain('#EXT-X-STREAM-INF');
            
            // Verificar que todos los eventos fueron emitidos
            expect(eventsEmitted.phaseStarted).toBe(true);
            expect(eventsEmitted.variantStarted).toBe(true);
            expect(eventsEmitted.variantProgress).toBe(true);
            expect(eventsEmitted.variantCompleted).toBe(true);
            expect(eventsEmitted.processingCompleted).toBe(true);

            console.log(`\n📊 Results:`);
            console.log(`   Master: ${path.basename(result.masterPlaylist)}`);
            console.log(`   Variants: ${result.variants.length}`);
            console.log(`   Time: ${result.metadata.processingTime.toFixed(2)}s`);
        }, 120000);

        test('should generate master playlist with multiple resolutions', async () => {
            const orchestrator = new VideoProcessingOrchestrator(undefined, {
                enableLogger: false
            });

            const config = {
                outputBaseDir: path.join(testDir, 'output-2'),
                qualityPreset: 'medium' as const,
                targetResolutions: ['720p', '480p'], // ⭐ Resoluciones válidas para video 720p
                parallel: false,
                extractAudioTracks: false,
                extractSubtitles: false,
                cleanupTemp: true
            };

            let variantsStarted = 0;
            let variantsCompleted = 0;
            const variantNames: string[] = [];

            orchestrator.on(VideoProcessingEvent.VARIANT_STARTED, (data) => {
                variantsStarted++;
                variantNames.push(data.variantName);
                console.log(`🎬 Starting variant ${variantsStarted}: ${data.variantName}`);
            });

            orchestrator.on(VideoProcessingEvent.VARIANT_COMPLETED, (data) => {
                variantsCompleted++;
                console.log(`✅ Completed variant ${variantsCompleted}: ${data.variantName}`);
            });

            const result = await orchestrator.processVideo(testVideoPath, config);

            // ⭐ Verificaciones mejoradas
            expect(result.success).toBe(true);
            expect(result.variants.length).toBe(2);
            expect(variantsStarted).toBe(2);
            expect(variantsCompleted).toBe(2);
            expect(variantNames).toContain('720p');
            expect(variantNames).toContain('480p');

            // Verificar contenido del master playlist
            const masterContent = await fs.readFile(result.masterPlaylist, 'utf8');
            expect(masterContent).toContain('#EXTM3U');
            expect(masterContent).toContain('quality_720p.m3u8');
            expect(masterContent).toContain('quality_480p.m3u8');

            // Verificar que cada variante existe y tiene segmentos
            for (const variant of result.variants) {
                expect(await fs.pathExists(variant.playlistPath)).toBe(true);
                expect(variant.segmentCount).toBeGreaterThan(0);
                console.log(`   ✓ ${variant.name}: ${variant.segmentCount} segments, ${(variant.size / 1024 / 1024).toFixed(2)} MB`);
            }
        }, 120000);

        test('should track progress correctly', async () => {
            const orchestrator = new VideoProcessingOrchestrator(undefined, {
                enableLogger: false
            });

            const config = {
                outputBaseDir: path.join(testDir, 'output-3'),
                qualityPreset: 'low' as const,
                targetResolutions: ['480p'],
                parallel: false,
                extractAudioTracks: false,
                extractSubtitles: false,
                cleanupTemp: true
            };

            const progressUpdates: number[] = [];
            const phaseProgressMap = new Map<ProcessingPhase, number[]>();

            orchestrator.on(VideoProcessingEvent.PHASE_PROGRESS, (data) => {
                progressUpdates.push(data.percent);
                
                if (!phaseProgressMap.has(data.phase)) {
                    phaseProgressMap.set(data.phase, []);
                }
                phaseProgressMap.get(data.phase)!.push(data.percent);
            });

            await orchestrator.processVideo(testVideoPath, config);

            // ⭐ Verificaciones de progreso
            expect(progressUpdates.length).toBeGreaterThan(0);
            
            // El progreso debe ser monotónicamente creciente (o igual)
            for (let i = 1; i < progressUpdates.length; i++) {
                expect(progressUpdates[i]).toBeGreaterThanOrEqual(progressUpdates[i - 1]);
            }

            // Verificar que hubo progreso en la fase de video
            const videoProgress = phaseProgressMap.get(ProcessingPhase.PROCESSING_VIDEO);
            expect(videoProgress).toBeDefined();
            expect(videoProgress!.length).toBeGreaterThan(0);

            console.log(`\n📊 Progress tracking:`);
            console.log(`   Total updates: ${progressUpdates.length}`);
            console.log(`   Phases tracked: ${phaseProgressMap.size}`);
            console.log(`   Final progress: ${progressUpdates[progressUpdates.length - 1].toFixed(1)}%`);
        }, 120000);


        test('should handle getProgressStatus during processing', async () => {
            const orchestrator = new VideoProcessingOrchestrator(undefined, {
                enableLogger: false
            });

            const config = {
                outputBaseDir: path.join(testDir, 'output-4'),
                qualityPreset: 'low' as const,
                targetResolutions: ['480p'],
                parallel: false,
                extractAudioTracks: false,
                extractSubtitles: false,
                cleanupTemp: true
            };

            const statusSnapshots: any[] = [];
            let checkCount = 0;
            const maxChecks = 5;

            // ⭐ CAMBIO: Usar PHASE_PROGRESS en lugar de VARIANT_PROGRESS
            orchestrator.on(VideoProcessingEvent.PHASE_PROGRESS, (data) => {
                if (checkCount < maxChecks && data.phase === ProcessingPhase.PROCESSING_VIDEO) {
                    const status = orchestrator.getProgressStatus();
                    
                    if (status && status.globalPercent > 0) {
                        expect(status).toBeDefined();
                        expect(status.processId).toBeDefined();
                        expect(status.phase).toBeDefined();
                        expect(status.globalPercent).toBeGreaterThanOrEqual(0);
                        expect(status.globalPercent).toBeLessThanOrEqual(100);
                        expect(status.phasePercent).toBeGreaterThanOrEqual(0);
                        expect(status.elapsedSeconds).toBeGreaterThan(0);
                        
                        statusSnapshots.push({
                            check: checkCount + 1,
                            phase: status.phase,
                            globalPercent: status.globalPercent,
                            phasePercent: status.phasePercent,
                        });
                        
                        checkCount++;
                    }
                }
            });

            await orchestrator.processVideo(testVideoPath, config);

            expect(statusSnapshots.length).toBeGreaterThan(0);
            
            for (let i = 1; i < statusSnapshots.length; i++) {
                expect(statusSnapshots[i].globalPercent)
                    .toBeGreaterThanOrEqual(statusSnapshots[i - 1].globalPercent);
            }

            console.log(`\n📊 Status snapshots captured: ${statusSnapshots.length}`);
            statusSnapshots.forEach(s => {
                console.log(`   Check ${s.check}: ${s.phase} - ${s.globalPercent.toFixed(1)}% (phase: ${s.phasePercent.toFixed(1)}%)`);
            });
        }, 120000);
    });

    describe('Error Handling', () => {
        test('should handle invalid input file', async () => {
            const orchestrator = new VideoProcessingOrchestrator(undefined, {
                enableLogger: false
            });

            const config = {
                outputBaseDir: path.join(testDir, 'output-error'),
                qualityPreset: 'medium' as const
            };

            let failedEvent: any = null;
            orchestrator.on(VideoProcessingEvent.PROCESSING_FAILED, (data) => {
                failedEvent = data;
            });

            await expect(
                orchestrator.processVideo('nonexistent.mp4', config)
            ).rejects.toThrow('Input file not found');

            expect(failedEvent).not.toBeNull();
            expect(failedEvent.stage).toBeDefined();
            expect(failedEvent.error).toBeDefined();
            
            console.log(`✓ Error handled: ${failedEvent.error.message}`);
        }, 30000);

        test('should handle processing errors gracefully', async () => {
            const orchestrator = new VideoProcessingOrchestrator(undefined, {
                enableLogger: false
            });

            // ⭐ Configuración inválida (resolución no disponible)
            const config = {
                outputBaseDir: path.join(testDir, 'output-error-2'),
                qualityPreset: 'medium' as const,
                targetResolutions: ['4K'], // ⭐ Video es 720p, no puede hacer 4K
                parallel: false,
                extractAudioTracks: false,
                extractSubtitles: false
            };

            const result = await orchestrator.processVideo(testVideoPath, config);

            // ⭐ Debe completar pero sin variantes (filtradas)
            expect(result.success).toBe(true);
            expect(result.variants.length).toBe(0); // No hay variantes válidas
            
            console.log(`✓ Handled invalid resolution gracefully`);
        }, 120000);
    });

    describe('Event Lifecycle', () => {
        test('should emit all lifecycle events in correct order', async () => {
            const orchestrator = new VideoProcessingOrchestrator(undefined, {
                enableLogger: false
            });

            const config = {
                outputBaseDir: path.join(testDir, 'output-lifecycle'),
                qualityPreset: 'low' as const,
                targetResolutions: ['480p'],
                parallel: false,
                extractAudioTracks: false,
                extractSubtitles: false,
                cleanupTemp: true
            };

            const events: Array<{ name: string; timestamp: number }> = [];

            const trackEvent = (name: string) => {
                events.push({ name, timestamp: Date.now() });
            };

            // ⭐ Registrar todos los eventos principales
            orchestrator.on(VideoProcessingEvent.PHASE_STARTED, (data) => {
                trackEvent(`phase-started:${data.phase}`);
            });

            orchestrator.on(VideoProcessingEvent.ANALYSIS_COMPLETED, () => {
                trackEvent('analysis-completed');
            });

            orchestrator.on(VideoProcessingEvent.PLANNING_COMPLETED, () => {
                trackEvent('planning-completed');
            });

            orchestrator.on(VideoProcessingEvent.VARIANT_STARTED, (data) => {
                trackEvent(`variant-started:${data.variantName}`);
            });

            orchestrator.on(VideoProcessingEvent.VARIANT_COMPLETED, (data) => {
                trackEvent(`variant-completed:${data.variantName}`);
            });

            orchestrator.on(VideoProcessingEvent.PHASE_COMPLETED, (data) => {
                trackEvent(`phase-completed:${data.phase}`);
            });

            orchestrator.on(VideoProcessingEvent.PROCESSING_COMPLETED, () => {
                trackEvent('processing-completed');
            });

            await orchestrator.processVideo(testVideoPath, config);

            // ⭐ Verificaciones de orden
            const eventNames = events.map(e => e.name);
            
            // Eventos obligatorios
            expect(eventNames).toContain('analysis-completed');
            expect(eventNames).toContain('planning-completed');
            expect(eventNames).toContain('variant-started:480p');
            expect(eventNames).toContain('variant-completed:480p');
            expect(eventNames).toContain('processing-completed');
            
            // El último evento debe ser processing-completed
            expect(eventNames[eventNames.length - 1]).toBe('processing-completed');
            
            // analysis-completed debe venir antes que planning-completed
            const analysisIdx = eventNames.indexOf('analysis-completed');
            const planningIdx = eventNames.indexOf('planning-completed');
            expect(planningIdx).toBeGreaterThan(analysisIdx);
            
            // variant-started debe venir antes que variant-completed
            const variantStartIdx = eventNames.indexOf('variant-started:480p');
            const variantEndIdx = eventNames.indexOf('variant-completed:480p');
            expect(variantEndIdx).toBeGreaterThan(variantStartIdx);

            console.log(`\n📋 Event lifecycle (${events.length} events):`);
            events.forEach((e, i) => {
                const elapsed = i > 0 ? `+${(e.timestamp - events[0].timestamp) / 1000}s` : '0s';
                console.log(`   ${i + 1}. ${e.name.padEnd(40)} ${elapsed}`);
            });
        }, 120000);

        test('should maintain phase order', async () => {
            const orchestrator = new VideoProcessingOrchestrator(undefined, {
                enableLogger: false
            });

            const config = {
                outputBaseDir: path.join(testDir, 'output-phases'),
                qualityPreset: 'low' as const,
                targetResolutions: ['480p'],
                parallel: false,
                extractAudioTracks: false,
                extractSubtitles: false,
                cleanupTemp: true
            };

            const phases: ProcessingPhase[] = [];

            orchestrator.on(VideoProcessingEvent.PHASE_STARTED, (data) => {
                phases.push(data.phase);
            });

            await orchestrator.processVideo(testVideoPath, config);

            // ⭐ Orden esperado de fases
            const expectedOrder = [
                ProcessingPhase.ANALYZING,
                ProcessingPhase.PLANNING,
                ProcessingPhase.PROCESSING_VIDEO,
                ProcessingPhase.GENERATING_PLAYLISTS
            ];

            // Verificar que las fases están en el orden correcto
            let currentIndex = 0;
            for (const phase of phases) {
                const expectedIndex = expectedOrder.indexOf(phase);
                if (expectedIndex !== -1) {
                    expect(expectedIndex).toBeGreaterThanOrEqual(currentIndex);
                    currentIndex = expectedIndex;
                }
            }

            console.log(`\n📊 Phase order:`);
            phases.forEach((phase, i) => console.log(`   ${i + 1}. ${phase}`));
        }, 120000);
    });

    describe('Performance', () => {
        test('should process within reasonable time', async () => {
            const orchestrator = new VideoProcessingOrchestrator(undefined, {
                enableLogger: false
            });

            const config = {
                outputBaseDir: path.join(testDir, 'output-perf'),
                qualityPreset: 'low' as const,
                targetResolutions: ['480p'],
                parallel: false,
                extractAudioTracks: false,
                extractSubtitles: false,
                cleanupTemp: true
            };

            const startTime = Date.now();
            const result = await orchestrator.processVideo(testVideoPath, config);
            const elapsedTime = (Date.now() - startTime) / 1000;

            expect(result.success).toBe(true);
            
            // ⭐ Para un video de 10s, debería procesar en menos de 60s
            expect(elapsedTime).toBeLessThan(60);
            
            console.log(`\n⏱️  Performance:`);
            console.log(`   Video duration: 10s`);
            console.log(`   Processing time: ${elapsedTime.toFixed(2)}s`);
            console.log(`   Ratio: ${(elapsedTime / 10).toFixed(2)}x`);
        }, 120000);
    });
});

console.log('\n✅ All VideoProcessingOrchestrator tests ready!\n');