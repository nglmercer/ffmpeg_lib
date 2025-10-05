import path from 'path';
import fs from 'fs-extra';
import { FFmpegManager } from '../src/FFmpegManager';
import { TestMediaGenerator } from '../src/TestMediaGenerator';
import { MediaMetadataExtractor } from '../src/MediaMetadataExtractor';
import { VideoProcessingOrchestrator } from '../src/hls/VideoProcessingOrchestrator';
import { ProcessingConfig} from '../src/hls/types';
import { AudioTrackProcessor, createDefaultAudioConfig } from '../src/hls/AudioTrackProcessor';
import { SubtitleProcessor, createDefaultSubtitleConfig } from '../src/hls/SubtitleProcessor';

// ==================== INTERFACES ====================

interface ProcessingResults {
  timestamp: string;
  inputVideo: {
    path: string;
    size: number;
    duration: string;
  };
  hlsOutput: {
    masterPlaylist: string;
    videoVariants: Array<{
      name: string;
      resolution: string;
      segmentCount: number;
      size: number;
    }>;
    audioTracks: Array<{
      language: string;
      size: number;
    }>;
    subtitles: Array<{
      language: string;
      format: string;
    }>;
  };
  processing: {
    duration: number;
    compressionRatio: number;
  };
  errors: string[];
}

// ==================== FUNCIÓN PRINCIPAL ====================

async function processVideoToHLS() {
  console.log('🎬 Iniciando procesamiento de video a HLS...\n');
  
  const results: ProcessingResults = {
    timestamp: new Date().toISOString(),
    inputVideo: {
      path: '',
      size: 0,
      duration: ''
    },
    hlsOutput: {
      masterPlaylist: '',
      videoVariants: [],
      audioTracks: [],
      subtitles: []
    },
    processing: {
      duration: 0,
      compressionRatio: 0
    },
    errors: []
  };

  try {
    // ==================== PASO 1: CONFIGURAR FFMPEG ====================
    console.log('📦 Paso 1: Configurando FFmpeg...');
    const manager = new FFmpegManager();
    await manager.downloadFFmpegBinaries();
    const { ffmpegPath, ffprobePath } = await manager.verifyBinaries();
    console.log('   ✅ FFmpeg configurado correctamente\n');

    // ==================== PASO 2: GENERAR VIDEO DE PRUEBA ====================
    console.log('🎥 Paso 2: Generando video de prueba...');
    const mediaDir = path.join(process.cwd(), 'test-media');
    await fs.ensureDir(mediaDir);
    
    const generator = new TestMediaGenerator(ffmpegPath, mediaDir, ffprobePath);
    
    // Generar video HD con audio (simulando contenido real)
    const testVideo = await generator.generateVideoWithAudio('source-video.mp4', {
      duration: 30,      // 30 segundos
      width: 1920,
      height: 1080,
      fps: 30,
      frequency: 440     // Tono A4 para el audio
    });
    
    results.inputVideo = {
      path: testVideo.path,
      size: testVideo.size,
      duration: '30s'
    };
    console.log(`   ✅ Video generado: ${testVideo.path}`);
    console.log(`   📊 Tamaño: ${Math.round(testVideo.size / 1024 / 1024)}MB\n`);

    // ==================== PASO 3: EXTRAER METADATOS ====================
    console.log('📊 Paso 3: Extrayendo metadatos del video...');
    const metadataExtractor = new MediaMetadataExtractor(ffprobePath);
    const metadata = await metadataExtractor.extractMetadata(testVideo.path);
    
    console.log(`   ✅ Duración: ${metadata.durationFormatted}`);
    console.log(`   ✅ Resolución: ${metadata.primaryVideo?.resolution || 'N/A'}`);
    console.log(`   ✅ FPS: ${metadata.primaryVideo?.frameRate || 'N/A'}`);
    console.log(`   ✅ Codec: ${metadata.primaryVideo?.codec || 'N/A'}\n`);

    // ==================== PASO 4: CONFIGURAR PROCESAMIENTO HLS ====================
    console.log('⚙️ Paso 4: Configurando procesamiento HLS...');
    const outputDir = path.join(process.cwd(), 'hls-output');
    await fs.ensureDir(outputDir);

    const config: ProcessingConfig = {
      outputBaseDir: outputDir,
      qualityPreset: 'medium',
      targetResolutions: ['1080p', '720p', '480p', '360p'],
      videoPreset: 'fast',
      audioQuality: 'medium',
      segmentDuration: 6,
      parallel: false,              // Procesar secuencialmente para ver progreso
      extractAudioTracks: true,
      extractSubtitles: false,      // El video de prueba no tiene subtítulos
      cleanupTemp: true,
      keepOriginal: true
    };

    console.log(`   📁 Salida: ${outputDir}`);
    console.log(`   🎯 Calidades: ${config.targetResolutions?.join(', ')}\n`);

    // ==================== PASO 5: PROCESAR VIDEO ====================
    console.log('🚀 Paso 5: Procesando video a HLS...');
    console.log('   (Esto puede tomar varios minutos...)\n');
    
    const orchestrator = new VideoProcessingOrchestrator();
    
    // Escuchar eventos de progreso (solo hitos importantes)
    orchestrator.on('progress', (progress) => {
      console.log(progress);
    });
    const startTime = Date.now();
    const result = await orchestrator.processVideo(testVideo.path, config);
    const processingTime = (Date.now() - startTime) / 1000;

    console.log('\n   ✅ Procesamiento completado!\n');

    // ==================== PASO 6: RECOPILAR RESULTADOS ====================
    console.log('📋 Paso 6: Recopilando resultados...');
    
    results.hlsOutput.masterPlaylist = result.masterPlaylist;
    results.hlsOutput.videoVariants = result.variants.map(v => ({
      name: v.name,
      resolution: v.resolution,
      segmentCount: v.segmentCount,
      size: v.size
    }));
    results.hlsOutput.audioTracks = result.audioTracks.map(a => ({
      language: a.language,
      size: a.size
    }));
    results.processing.duration = processingTime;
    results.processing.compressionRatio = result.metadata.compressionRatio;

    console.log(`   ✅ Master playlist: ${path.basename(result.masterPlaylist)}`);
    console.log(`   ✅ Variantes generadas: ${result.variants.length}`);
    console.log(`   ✅ Tiempo de procesamiento: ${processingTime.toFixed(2)}s`);
    console.log(`   ✅ Ratio de compresión: ${result.metadata.compressionRatio.toFixed(2)}x\n`);

    // ==================== PASO 7: PROCESAR AUDIO ADICIONAL ====================
    console.log('🔊 Paso 7: Ejemplo de procesamiento de audio...');
    const audioProcessor = new AudioTrackProcessor(ffmpegPath, ffprobePath);
    
    // Detectar pistas de audio
    const audioTracks = await audioProcessor.detectAudioTracks(testVideo.path);
    console.log(`   ✅ Pistas de audio detectadas: ${audioTracks.length}`);
    
    if (audioTracks.length > 0) {
      const track = audioTracks[0];
      console.log(`   📊 Pista principal: ${track.languageName} (${track.codec}, ${track.channels}ch)\n`);
    }

    // ==================== PASO 8: EJEMPLO DE SUBTÍTULOS ====================
    console.log('💬 Paso 8: Ejemplo de procesamiento de subtítulos...');
    const subtitleProcessor = new SubtitleProcessor(ffmpegPath, ffprobePath);
    
    // Detectar subtítulos embebidos (el video de prueba no tendrá ninguno)
    const subtitles = await subtitleProcessor.detectEmbeddedSubtitles(testVideo.path);
    console.log(`   ℹ️ Subtítulos embebidos: ${subtitles.length}`);
    
    // ==================== PASO 9: VERIFICAR ESTRUCTURA DE SALIDA ====================
    console.log('📂 Paso 9: Estructura de archivos generados...');
    const videoIdDir = path.dirname(result.masterPlaylist);
    
    console.log(`   ${videoIdDir}/`);
    console.log(`   ├── master.m3u8           (Playlist principal)`);
    console.log(`   ├── video/                (Segmentos de video)`);
    
    for (const variant of result.variants) {
      const segmentFiles = await fs.readdir(path.join(videoIdDir, 'video'));
      const variantSegments = segmentFiles.filter(f => f.startsWith(variant.name));
      console.log(`   │   ├── quality_${variant.name}.m3u8`);
      console.log(`   │   └── ${variant.name}_segment_*.ts (${variantSegments.length} segmentos)`);
    }
    
    if (result.audioTracks.length > 0) {
      console.log(`   ├── audio/                (Pistas de audio alternativas)`);
      for (const audio of result.audioTracks) {
        console.log(`   │   └── audio_${audio.language}.m3u8`);
      }
    }
    const resultsPath = path.join(outputDir, 'processing-results.json');
    await fs.writeJSON(resultsPath, results, { spaces: 2 });
    console.log(`   ✅ Resultados guardados: ${resultsPath}\n`);

    // ==================== RESUMEN FINAL ====================
    console.log(`📁 Salida HLS: ${videoIdDir}`);
    console.log(`🎬 Master Playlist: ${path.basename(result.masterPlaylist)}`);
    console.log(`📊 Variantes: ${result.variants.length}`);
    console.log(`⏱️ Tiempo: ${processingTime.toFixed(2)}s`);
    console.log(`💾 Tamaño original: ${Math.round(testVideo.size / 1024 / 1024)}MB`);
    console.log(`💾 Tamaño procesado: ${Math.round(result.metadata.processedSize / 1024 / 1024)}MB`);
    console.log(`📉 Compresión: ${result.metadata.compressionRatio.toFixed(2)}x`);


  } catch (error) {
    console.error('\n❌ Error durante el procesamiento:', error);
    results.errors.push((error as Error).message);
    throw error;
  }
}

// ==================== FUNCIÓN AUXILIAR: PROCESAMIENTO PERSONALIZADO ====================

async function customVideoProcessing() {
  console.log('🎨 Ejemplo de procesamiento personalizado...\n');

  try {
    // Setup
    const manager = new FFmpegManager();
    await manager.downloadFFmpegBinaries();
    const { ffmpegPath, ffprobePath } = await manager.verifyBinaries();

    // Generar video
    const mediaDir = path.join(process.cwd(), 'test-media');
    const generator = new TestMediaGenerator(ffmpegPath, mediaDir, ffprobePath);
    const video = await generator.generateVideoWithAudio('custom-source.mp4', {
      duration: 15,
      width: 1280,
      height: 720,
      fps: 30
    });

    console.log('✅ Video generado\n');

    // Procesamiento con configuración personalizada
    const outputDir = path.join(process.cwd(), 'custom-output');
    
    const customConfig: ProcessingConfig = {
      outputBaseDir: outputDir,
      targetResolutions: ['720p', '480p'],  // Solo 2 calidades
      videoPreset: 'ultrafast',              // Más rápido
      audioQuality: 'low',                   // Audio de menor calidad
      segmentDuration: 4,                    // Segmentos más cortos
      parallel: true,                        // Procesar en paralelo
      extractAudioTracks: false,
      extractSubtitles: false
    };

    const orchestrator = new VideoProcessingOrchestrator();
    const result = await orchestrator.processVideo(video.path, customConfig);

    console.log(`\n✅ Procesamiento personalizado completado`);
    console.log(`📁 Salida: ${result.masterPlaylist}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// ==================== EJECUTAR ====================

async function main() {
  //"example 1";
  //await processVideoToHLS();
  //"example 2";
  await customVideoProcessing();
}

// Ejecutar si es el archivo principal
if (import.meta.main) {
  main().catch(console.error);
}

export { processVideoToHLS, customVideoProcessing };