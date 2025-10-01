import { TestMediaGenerator } from '../src/TestMediaGenerator';
import { FFmpegManager } from '../src/FFmpegManager';
import { FFmpegCommand } from '../src/FFmpegCommand';
import path from 'path';
import fs from 'fs-extra';

/**
 * Ejemplo simple de generación de archivos multimedia
 * Genera una imagen, un archivo de audio y un video de prueba
 */
async function generateSimpleMedia() {
  console.log('🚀 Iniciando generación de archivos multimedia...');
  
  try {
    // 1. Configurar FFmpeg
    console.log('📦 Configurando FFmpeg...');
    const manager = new FFmpegManager();
    await manager.downloadFFmpegBinaries();
    const { ffmpegPath, ffprobePath } = await manager.verifyBinaries();
    
    // 2. Crear directorio de salida
    const outputDir = path.join(process.cwd(), 'generated-media');
    await fs.ensureDir(outputDir);
    
    // 3. Inicializar generador
    const generator = new TestMediaGenerator(ffmpegPath, outputDir);
    
    // 4. Generar imagen de prueba
    console.log('🖼️  Generando imagen...');
    const image = await generator.generateTestImage('ejemplo-imagen.jpg', {
      width: 1920,
      height: 1080,
      color: 'blue',
      format: 'jpg'
    });
    console.log(`✅ Imagen generada: ${image.path} (${Math.round(image.size / 1024)}KB)`);
    
    // 5. Generar audio de prueba
    console.log('🎵 Generando audio...');
    const audio = await generator.generateTestAudio('ejemplo-audio.mp3', {
      duration: 5,
      frequency: 440, // Nota A4
      channels: 2, // Estéreo
      bitrate: '128k'
    });
    console.log(`✅ Audio generado: ${audio.path} (${Math.round(audio.size / 1024)}KB)`);
    
    // 6. Generar video de prueba
    console.log('🎬 Generando video...');
    const video = await generator.generateTestVideo('ejemplo-video.mp4', {
      duration: 3,
      width: 1280,
      height: 720,
      fps: 30,
      bitrate: '2000k'
    });
    console.log(`✅ Video generado: ${video.path} (${Math.round(video.size / 1024)}KB)`);
    
    // 7. Generar video con audio
    console.log('🎬🎵 Generando video con audio...');
    const videoWithAudio = await generator.generateVideoWithAudio('ejemplo-video-audio.mp4', {
      duration: 3,
      width: 1280,
      height: 720,
      fps: 30,
      frequency: 880 // Nota A5
    });
    console.log(`✅ Video con audio generado: ${videoWithAudio.path} (${Math.round(videoWithAudio.size / 1024)}KB)`);

    // 8. Ejemplos reales con FFmpegCommand usando los archivos generados
    console.log('\n🔧 Integrando ejemplos reales con FFmpegCommand...');

    // 8.1. Probar metadatos del video con audio
    console.log('🔍 Probando metadatos (ffprobe)...');
    const metadata = await FFmpegCommand.probe(videoWithAudio.path, { ffprobePath });
    const durationSec = Number(metadata.format?.duration || 0).toFixed(2);
    console.log(`📊 Duración: ${durationSec}s | Streams: ${metadata.streams.length}`);

    // 8.2. Extraer audio del video con audio
    console.log('🎧 Extrayendo audio del video...');
    const extractedAudioPath = path.join(outputDir, 'ejemplo-extraido.mp3');
    const extractCmd = new FFmpegCommand({ ffmpegPath, ffprobePath });
    extractCmd.on('progress', (p) => {
      console.log(`⏱️ Progreso extracción: ${p.timemark}`);
    });
    await extractCmd
      .input(videoWithAudio.path)
      .output(extractedAudioPath)
      .noVideo()
      .audioCodec('mp3')
      .run();
    console.log(`✅ Audio extraído: ${extractedAudioPath}`);

    // 8.3. Convertir el video (codec, tamaño y fps)
    console.log('📼 Convirtiendo video (libx264, 640x360, 24fps)...');
    const convertedVideoPath = path.join(outputDir, 'ejemplo-video-convertido.mp4');
    const convertCmd = new FFmpegCommand({ ffmpegPath, ffprobePath });
    convertCmd.on('start', (command) => console.log(`▶️ Comando: ${command}`));
    convertCmd.on('progress', (p) => console.log(`📈 ${p.frames} frames, ${p.currentFps} fps, time=${p.timemark}`));
    await convertCmd
      .input(video.path)
      .output(convertedVideoPath)
      .videoCodec('libx264')
      .size('640x360')
      .fps(24)
      .outputOptions(['-movflags +faststart', '-pix_fmt', 'yuv420p'])
      .run();
    console.log(`✅ Video convertido: ${convertedVideoPath}`);

    // 8.4. Generar capturas (screenshots) del video con audio
    console.log('🖼️  Generando capturas del video...');
    const screenshotsDir = path.join(outputDir, 'screenshots');
    const shotsCmd = new FFmpegCommand({ ffmpegPath, ffprobePath });
    shotsCmd.input(videoWithAudio.path);
    const shots = await shotsCmd.screenshots({
      timestamps: ['00:00:01', '00:00:02'],
      folder: screenshotsDir,
      filename: 'shot_%i.png',
      size: '320x180'
    });
    console.log('✅ Capturas generadas:');
    for (const s of shots) console.log(`   - ${s}`);
    
    console.log('\n🎉 ¡Generación completada!');
    console.log(`📁 Archivos guardados en: ${outputDir}`);
    
    // Listar archivos generados
    const files = await fs.readdir(outputDir);
    console.log('\n📋 Archivos generados:');
    files.forEach(file => {
      console.log(`   - ${file}`);
    });
    
  } catch (error) {
    console.error('❌ Error durante la generación:', error);
  }
}

// Ejecutar el ejemplo
if (import.meta.main) {
  generateSimpleMedia();
}

export { generateSimpleMedia };