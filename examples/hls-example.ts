import path from 'path';
import fs from 'fs-extra';
import { FFmpegManager } from '../src/FFmpegManager';
import { TestMediaGenerator } from '../src/TestMediaGenerator';
import { MediaMetadataExtractor } from '../src/MediaMetadataExtractor';
import { ProcessingConfig} from '../src/hls/types';
import { AudioTrackProcessor, createDefaultAudioConfig } from '../src/hls/AudioTrackProcessor';
import { SubtitleProcessor, createDefaultSubtitleConfig } from '../src/hls/SubtitleProcessor';
import { VideoProcessingOrchestrator, createDefaultOrchestratorConfig, ResolutionUtils } from '../src/index';

// ==================== INTERFACES ====================



// ==================== FUNCIÓN PRINCIPAL ====================

async function processVideoToHLS() {
  console.log('🎬 Iniciando procesamiento de video a HLS...\n');

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
    const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720).slice(0, 1);
    const config = createDefaultOrchestratorConfig(testVideo.path,outputDir,resolutions);

    console.log(`   📁 Salida: ${outputDir}`);
    console.log(`   🎯 Calidades:`,resolutions);

    // ==================== PASO 5: PROCESAR VIDEO ====================
    console.log('🚀 Paso 5: Procesando video a HLS...');
    console.log('   (Esto puede tomar varios minutos...)\n');
    
    const orchestrator = new VideoProcessingOrchestrator(ffmpegPath, ffprobePath);
    
    // Escuchar eventos de progreso (solo hitos importantes)
    orchestrator.on('progress', (progress) => {
      console.log(progress);
    });
    const startTime = Date.now();
    const result = await orchestrator.process(config);
    const processingTime = (Date.now() - startTime) / 1000;

    console.log('\n   ✅ Procesamiento completado!\n',result);




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
    const videoIdDir = path.dirname(result.video?.masterPlaylistPath || '');
    
    console.log(`   ${videoIdDir}/`);
    console.log(`   ├── master.m3u8           (Playlist principal)`);
    console.log(`   ├── video/                (Segmentos de video)`);
    
    for (const variant of result.video?.qualities || []) {
      const segmentFiles = await fs.readdir(path.join(videoIdDir, 'video'));
      const variantSegments = segmentFiles.filter(f => f.startsWith(variant.playlistPath));
      console.log(`   │   ├── ${path.basename(variant.playlistPath)}`);
      console.log(`   │   └── ${path.basename(variantSegments[0])} (${variantSegments.length} segmentos)`);
    }
    
    if (result.audio?.tracks && result.audio.tracks.length > 0) {
      console.log(`   ├── audio/                (Pistas de audio alternativas)`);
      for (const audio of result.audio?.tracks || []) {
        console.log(audio.hlsPlaylistPath);
      }
    }
    const resultsPath = path.join(outputDir, 'processing-results.json');
    await fs.writeJSON(resultsPath, result, { spaces: 2 });
    console.log(`   ✅ Resultados guardados: ${resultsPath}\n`);

    // ==================== RESUMEN FINAL ====================
    console.log(`📁 Salida HLS: ${videoIdDir}`);

  } catch (error) {
    console.error('\n❌ Error durante el procesamiento:', error);
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
    
    const customConfig = createDefaultOrchestratorConfig(
      video.path,
      outputDir,
      ResolutionUtils.generateLowerResolutions(1280, 720).slice(0, 1)
    );

    const orchestrator = new VideoProcessingOrchestrator(ffmpegPath, ffprobePath);
    const result = await orchestrator.process(customConfig);

    console.log(`\n✅ Procesamiento personalizado completado`,result);

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