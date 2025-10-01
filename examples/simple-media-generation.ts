import { TestMediaGenerator } from '../src/TestMediaGenerator';
import { FFmpegManager } from '../src/FFmpegManager';
import { FFmpegCommand } from '../src/FFmpegCommand';
import { MediaMetadataExtractor } from '../src/MediaMetadataExtractor';
import path from 'path';
import fs from 'fs-extra';

interface MediaFile {
  name: string;
  path: string;
  size: number;
  metadata?: any;
}

interface GenerationResult {
  timestamp: string;
  files: {
    images: MediaFile[];
    audios: MediaFile[];
    videos: MediaFile[];
    processed: Array<MediaFile & { type: string }>;
  };
  metadata: {
    videoWithAudio?: any;
    audio?: any;
    image?: any;
  };
  processing: {
    extractedAudio?: { path: string; success: boolean };
    convertedVideo?: { path: string; success: boolean };
    screenshots?: string[];
  };
}

/**
 * Configura FFmpeg y retorna las rutas de los binarios
 */
async function setupFFmpeg() {
  const manager = new FFmpegManager();
  await manager.downloadFFmpegBinaries();
  return await manager.verifyBinaries();
}

/**
 * Genera archivos multimedia de prueba
 */
async function generateMediaFiles(generator: TestMediaGenerator, result: GenerationResult) {
  console.log('📄 Generando archivos multimedia...');
  
  // Generar imagen
  const image = await generator.generateTestImage('ejemplo-imagen.jpg', {
    width: 1920,
    height: 1080,
    color: 'blue',
    format: 'jpg'
  });
  result.files.images.push({ name: 'ejemplo-imagen.jpg', path: image.path, size: image.size });
  console.log(`   ✅ Imagen: ${image.path} (${Math.round(image.size / 1024)}KB)`);
  
  // Generar audio
  const audio = await generator.generateTestAudio('ejemplo-audio.mp3', {
    duration: 5,
    frequency: 440,
    channels: 2,
    bitrate: '128k'
  });
  result.files.audios.push({ name: 'ejemplo-audio.mp3', path: audio.path, size: audio.size });
  console.log(`   ✅ Audio: ${audio.path} (${Math.round(audio.size / 1024)}KB)`);
  
  // Generar video
  const video = await generator.generateTestVideo('ejemplo-video.mp4', {
    duration: 3,
    width: 1280,
    height: 720,
    fps: 30,
    bitrate: '2000k'
  });
  result.files.videos.push({ name: 'ejemplo-video.mp4', path: video.path, size: video.size });
  console.log(`   ✅ Video: ${video.path} (${Math.round(video.size / 1024)}KB)`);
  
  // Generar video con audio
  const videoWithAudio = await generator.generateVideoWithAudio('ejemplo-video-audio.mp4', {
    duration: 3,
    width: 1280,
    height: 720,
    fps: 30,
    frequency: 880
  });
  result.files.videos.push({ name: 'ejemplo-video-audio.mp4', path: videoWithAudio.path, size: videoWithAudio.size });
  console.log(`   ✅ Video con audio: ${videoWithAudio.path} (${Math.round(videoWithAudio.size / 1024)}KB)`);
  
  return { image, audio, video, videoWithAudio };
}

/**
 * Extrae metadatos de los archivos generados
 */
async function extractMetadata(metadataExtractor: MediaMetadataExtractor, files: any, result: GenerationResult) {
  console.log('📊 Extrayendo metadatos...');
  
  // Video con audio
  const videoMetadata = await metadataExtractor.extractMetadata(files.videoWithAudio.path);
  result.metadata.videoWithAudio = videoMetadata;
  console.log(`   ✅ Video con audio: ${videoMetadata.durationFormatted}, ${videoMetadata.primaryVideo?.resolution || 'N/A'}`);
  
  // Audio
  const audioMetadata = await metadataExtractor.extractMetadata(files.audio.path);
  result.metadata.audio = audioMetadata;
  console.log(`   ✅ Audio: ${audioMetadata.durationFormatted}, ${audioMetadata.primaryAudio?.sampleRate || 'N/A'}Hz`);
  
  // Imagen
  const imageMetadata = await metadataExtractor.extractMetadata(files.image.path);
  result.metadata.image = imageMetadata;
  console.log(`   ✅ Imagen: ${imageMetadata.mediaType}`);
}

/**
 * Procesa archivos con FFmpeg
 */
async function processFiles(ffmpegPaths: { ffmpegPath: string; ffprobePath: string }, files: any, outputDir: string, result: GenerationResult) {
  console.log('⚙️ Procesando archivos...');
  
  // Extraer audio del video
  const extractedAudioPath = path.join(outputDir, 'audio_extraido.aac');
  const extractCmd = new FFmpegCommand(ffmpegPaths);
  await extractCmd
    .input(files.videoWithAudio.path)
    .output(extractedAudioPath)
    .noVideo()
    .audioCodec('aac')
    .run();
  
  const extractedAudioStats = await fs.stat(extractedAudioPath);
  result.processing.extractedAudio = { path: extractedAudioPath, success: true };
  result.files.processed.push({ name: 'audio_extraido.aac', path: extractedAudioPath, size: extractedAudioStats.size, type: 'extracted-audio' });
  console.log(`   ✅ Audio extraído: ${path.basename(extractedAudioPath)}`);
  
  // Convertir video
  const convertedVideoPath = path.join(outputDir, 'ejemplo-video-convertido.mp4');
  const convertCmd = new FFmpegCommand(ffmpegPaths);
  await convertCmd
    .input(files.video.path)
    .output(convertedVideoPath)
    .videoCodec('libx264')
    .size('640x360')
    .fps(24)
    .outputOptions(['-pix_fmt yuv420p'])
    .run();
  
  const convertedVideoStats = await fs.stat(convertedVideoPath);
  result.processing.convertedVideo = { path: convertedVideoPath, success: true };
  result.files.processed.push({ name: 'ejemplo-video-convertido.mp4', path: convertedVideoPath, size: convertedVideoStats.size, type: 'converted-video' });
  console.log(`   ✅ Video convertido: ${path.basename(convertedVideoPath)}`);
  
  // Generar capturas
  const screenshotsDir = path.join(outputDir, 'screenshots');
  const shotsCmd = new FFmpegCommand(ffmpegPaths);
  shotsCmd.input(files.videoWithAudio.path);
  const shots = await shotsCmd.screenshots({
    timestamps: ['00:00:01', '00:00:02'],
    folder: screenshotsDir,
    filename: 'shot_%i.png',
    size: '320x180'
  });
  
  result.processing.screenshots = shots;
  for (const shot of shots) {
    const shotStats = await fs.stat(shot);
    result.files.processed.push({ name: path.basename(shot), path: shot, size: shotStats.size, type: 'screenshot' });
  }
  console.log(`   ✅ ${shots.length} capturas generadas`);
}

/**
 * Ejemplo simple de generación de archivos multimedia
 * Genera una imagen, un archivo de audio y un video de prueba
 */
async function generateSimpleMedia() {
  console.log('🚀 Iniciando generación de archivos multimedia...');
  
  // Initialize result structure
  const result: GenerationResult = {
    timestamp: new Date().toISOString(),
    files: {
      images: [],
      audios: [],
      videos: [],
      processed: []
    },
    metadata: {},
    processing: {}
  };
  
  try {
    // 1. Configurar FFmpeg
    const manager = new FFmpegManager();
    await manager.downloadFFmpegBinaries();
    const { ffmpegPath, ffprobePath } = await manager.verifyBinaries();
    
    // 2. Crear directorio de salida
    const outputDir = path.join(process.cwd(), 'generated-media');
    await fs.ensureDir(outputDir);
    
    // 3. Inicializar generador
    const generator = new TestMediaGenerator(ffmpegPath, outputDir);
    
    // 4. Generar archivos multimedia
    console.log('📄 Generando archivos multimedia...');
    
    // 4.1. Generar imagen de prueba
    const image = await generator.generateTestImage('ejemplo-imagen.jpg', {
      width: 1920,
      height: 1080,
      color: 'blue',
      format: 'jpg'
    });
    result.files.images.push({
      name: 'ejemplo-imagen.jpg',
      path: image.path,
      size: image.size
    });
    console.log(`   ✅ Imagen: ${image.path} (${Math.round(image.size / 1024)}KB)`);
    
    // 4.2. Generar audio de prueba
    const audio = await generator.generateTestAudio('ejemplo-audio.mp3', {
      duration: 5,
      frequency: 440, // Nota A4
      channels: 2, // Estéreo
      bitrate: '128k'
    });
    result.files.audios.push({
      name: 'ejemplo-audio.mp3',
      path: audio.path,
      size: audio.size
    });
    console.log(`   ✅ Audio: ${audio.path} (${Math.round(audio.size / 1024)}KB)`);
    
    // 4.3. Generar video de prueba
    const video = await generator.generateTestVideo('ejemplo-video.mp4', {
      duration: 3,
      width: 1280,
      height: 720,
      fps: 30,
      bitrate: '2000k'
    });
    result.files.videos.push({
      name: 'ejemplo-video.mp4',
      path: video.path,
      size: video.size
    });
    console.log(`   ✅ Video: ${video.path} (${Math.round(video.size / 1024)}KB)`);
    
    // 4.4. Generar video con audio
    const videoWithAudio = await generator.generateVideoWithAudio('ejemplo-video-audio.mp4', {
      duration: 3,
      width: 1280,
      height: 720,
      fps: 30,
      frequency: 880 // Nota A5
    });
    result.files.videos.push({
      name: 'ejemplo-video-audio.mp4',
      path: videoWithAudio.path,
      size: videoWithAudio.size
    });
    console.log(`   ✅ Video con audio: ${videoWithAudio.path} (${Math.round(videoWithAudio.size / 1024)}KB)`);

    // 5. Extraer metadatos completos
    console.log('📊 Extrayendo metadatos...');
    const metadataExtractor = new MediaMetadataExtractor(ffprobePath);
    
    // 5.1. Extraer metadatos del video con audio
    const videoMetadata = await metadataExtractor.extractMetadata(videoWithAudio.path);
    result.metadata.videoWithAudio = videoMetadata;
    console.log(`   ✅ Video con audio: ${videoMetadata.durationFormatted}, ${videoMetadata.primaryVideo?.resolution || 'N/A'}`);
    
    // 5.2. Extraer metadatos del audio
    const audioMetadata = await metadataExtractor.extractMetadata(audio.path);
    result.metadata.audio = audioMetadata;
    console.log(`   ✅ Audio: ${audioMetadata.durationFormatted}, ${audioMetadata.primaryAudio?.sampleRate || 'N/A'}Hz`);
    
    // 5.3. Extraer metadatos de la imagen
    const imageMetadata = await metadataExtractor.extractMetadata(image.path);
    result.metadata.image = imageMetadata;
    console.log(`   ✅ Imagen: ${imageMetadata.mediaType}`);

    // 6. Procesar archivos con FFmpeg
    console.log('⚙️ Procesando archivos...');

    // 6.1. Extraer audio del video
    const extractedAudioPath = path.join(outputDir, 'audio_extraido.aac');
    const extractCmd = new FFmpegCommand({ ffmpegPath, ffprobePath });
    await extractCmd
      .input(videoWithAudio.path)
      .output(extractedAudioPath)
      .noVideo()
      .audioCodec('aac')
      .run();
    
    const extractedAudioStats = await fs.stat(extractedAudioPath);
    result.processing.extractedAudio = {
      path: extractedAudioPath,
      success: true
    };
    result.files.processed.push({
      name: 'audio_extraido.aac',
      path: extractedAudioPath,
      size: extractedAudioStats.size,
      type: 'extracted-audio'
    });
    console.log(`   ✅ Audio extraído: ${path.basename(extractedAudioPath)}`);

    // 6.2. Convertir video
    const convertedVideoPath = path.join(outputDir, 'ejemplo-video-convertido.mp4');
    const convertCmd = new FFmpegCommand({ ffmpegPath, ffprobePath });
    await convertCmd
      .input(video.path)
      .output(convertedVideoPath)
      .videoCodec('libx264')
      .size('640x360')
      .fps(24)
      .outputOptions(['-pix_fmt yuv420p'])
      .run();
    
    const convertedVideoStats = await fs.stat(convertedVideoPath);
    result.processing.convertedVideo = {
      path: convertedVideoPath,
      success: true
    };
    result.files.processed.push({
      name: 'ejemplo-video-convertido.mp4',
      path: convertedVideoPath,
      size: convertedVideoStats.size,
      type: 'converted-video'
    });
    console.log(`   ✅ Video convertido: ${path.basename(convertedVideoPath)}`);

    // 6.3. Generar capturas
    const screenshotsDir = path.join(outputDir, 'screenshots');
    const shotsCmd = new FFmpegCommand({ ffmpegPath, ffprobePath });
    shotsCmd.input(videoWithAudio.path);
    const shots = await shotsCmd.screenshots({
      timestamps: ['00:00:01', '00:00:02'],
      folder: screenshotsDir,
      filename: 'shot_%i.png',
      size: '320x180'
    });
    
    result.processing.screenshots = shots;
    for (const shot of shots) {
      const shotStats = await fs.stat(shot);
      result.files.processed.push({
        name: path.basename(shot),
        path: shot,
        size: shotStats.size,
        type: 'screenshot'
      });
    }
    console.log(`   ✅ ${shots.length} capturas generadas`);
    
    // 7. Guardar resultados
    const resultFilePath = path.join(outputDir, 'generation-results.json');
    await fs.writeJSON(resultFilePath, result, { spaces: 2 });
    
    console.log('\n🎉 Generación completada!');
    console.log(`📁 Archivos guardados en: ${outputDir}`);
    console.log(`💾 Resultados guardados en: ${resultFilePath}`);
    
  } catch (error) {
    console.error('❌ Error durante la generación:', error);
    throw error;
  }
}

// Ejecutar el ejemplo
if (import.meta.main) {
  generateSimpleMedia();
}

export { generateSimpleMedia };