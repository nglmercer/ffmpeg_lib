import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

interface VideoOptions {
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  codec?: string;
  pixelFormat?: string;
  bitrate?: string;
}

interface AudioOptions {
  duration?: number;
  frequency?: number;
  sampleRate?: number;
  channels?: number;
  codec?: string;
  bitrate?: string;
}

interface ImageOptions {
  width?: number;
  height?: number;
  format?: 'jpg' | 'png' | 'bmp';
  color?: string;
}

interface MediaFile {
  path: string;
  size: number;
  type: 'video' | 'audio' | 'image';
  metadata: any;
}

/**
 * Clase para generar archivos multimedia de prueba
 * Requiere FFmpeg instalado en el sistema
 */
class TestMediaGenerator {
  private ffmpegPath: string;
  private outputDir: string;
  private ffprobePath?: string;

  constructor(ffmpegPath: string, outputDir: string, ffprobePath?: string) {
    this.ffmpegPath = ffmpegPath;
    this.outputDir = outputDir;
    this.ffprobePath = ffprobePath;
  }

  /**
   * Genera un video de prueba con patrón de colores
   */
  async generateTestVideo(
    filename: string,
    options: VideoOptions = {}
  ): Promise<MediaFile> {
    const {
      duration = 10,
      width = 1280,
      height = 720,
      fps = 30,
      codec = 'libx264',
      pixelFormat = 'yuv420p',
      bitrate = '1000k'
    } = options;

    await fs.ensureDir(this.outputDir);
    const outputPath = path.join(this.outputDir, filename);

    // Generar video con patrón de test (testsrc)
    const command = `"${this.ffmpegPath}" -f lavfi -i testsrc=duration=${duration}:size=${width}x${height}:rate=${fps} \
      -c:v ${codec} -pix_fmt ${pixelFormat} -b:v ${bitrate} \
      -y "${outputPath}"`;

    try {
      execSync(command, { stdio: 'pipe' });

      const stats = await fs.stat(outputPath);
      
      return {
        path: outputPath,
        size: stats.size,
        type: 'video',
        metadata: {
          duration,
          width,
          height,
          fps,
          codec,
          bitrate
        }
      };
    } catch (error) {
      throw new Error(`Failed to generate test video: ${(error as Error).message}`);
    }
  }

  /**
   * Genera un video con audio sincronizado
   */
  async generateVideoWithAudio(
    filename: string,
    options: VideoOptions & AudioOptions = {}
  ): Promise<MediaFile> {
    const {
      duration = 10,
      width = 1280,
      height = 720,
      fps = 30,
      frequency = 440,
      sampleRate = 44100
    } = options;

    await fs.ensureDir(this.outputDir);
    const outputPath = path.join(this.outputDir, filename);

    // Generar video con patrón visual y audio (tono)
    const command = `"${this.ffmpegPath}" \
      -f lavfi -i testsrc=duration=${duration}:size=${width}x${height}:rate=${fps} \
      -f lavfi -i sine=frequency=${frequency}:duration=${duration}:sample_rate=${sampleRate} \
      -c:v libx264 -pix_fmt yuv420p \
      -c:a aac -b:a 128k \
      -y "${outputPath}"`;

    try {
      execSync(command, { stdio: 'pipe' });

      const stats = await fs.stat(outputPath);
      
      return {
        path: outputPath,
        size: stats.size,
        type: 'video',
        metadata: {
          duration,
          width,
          height,
          fps,
          hasAudio: true,
          audioFrequency: frequency
        }
      };
    } catch (error) {
      throw new Error(`Failed to generate video with audio: ${(error as Error).message}`);
    }
  }

  /**
   * Genera un archivo de audio de prueba
   */
  async generateTestAudio(
    filename: string,
    options: AudioOptions = {}
  ): Promise<MediaFile> {
    const {
      duration = 10,
      frequency = 440,
      sampleRate = 44100,
      channels = 2,
      codec = 'libmp3lame',
      bitrate = '128k'
    } = options;

    await fs.ensureDir(this.outputDir);
    const outputPath = path.join(this.outputDir, filename);

    // Generar audio con tono
    const command = `"${this.ffmpegPath}" \
      -f lavfi -i sine=frequency=${frequency}:duration=${duration}:sample_rate=${sampleRate} \
      -ac ${channels} -c:a ${codec} -b:a ${bitrate} \
      -y "${outputPath}"`;

    try {
      execSync(command, { stdio: 'pipe' });

      const stats = await fs.stat(outputPath);
      
      return {
        path: outputPath,
        size: stats.size,
        type: 'audio',
        metadata: {
          duration,
          frequency,
          sampleRate,
          channels,
          codec,
          bitrate
        }
      };
    } catch (error) {
      throw new Error(`Failed to generate test audio: ${(error as Error).message}`);
    }
  }

  /**
   * Genera una imagen de prueba
   */
  async generateTestImage(
    filename: string,
    options: ImageOptions = {}
  ): Promise<MediaFile> {
    const {
      width = 1920,
      height = 1080,
      format = 'jpg',
      color = 'blue'
    } = options;

    await fs.ensureDir(this.outputDir);
    const outputPath = path.join(this.outputDir, filename);

    // Generar imagen con color sólido
    const command = `"${this.ffmpegPath}" \
      -f lavfi -i color=c=${color}:s=${width}x${height}:d=1 \
      -frames:v 1 \
      -y "${outputPath}"`;

    try {
      execSync(command, { stdio: 'pipe' });

      const stats = await fs.stat(outputPath);
      
      return {
        path: outputPath,
        size: stats.size,
        type: 'image',
        metadata: {
          width,
          height,
          format,
          color
        }
      };
    } catch (error) {
      throw new Error(`Failed to generate test image: ${(error as Error).message}`);
    }
  }

  /**
   * Genera un video corrupto para pruebas de manejo de errores
   */
  async generateCorruptedVideo(filename: string): Promise<MediaFile> {
    await fs.ensureDir(this.outputDir);
    const outputPath = path.join(this.outputDir, filename);

    // Crear archivo con datos aleatorios (corrupto)
    const buffer = Buffer.alloc(1024);
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }

    await fs.writeFile(outputPath, buffer);

    const stats = await fs.stat(outputPath);

    return {
      path: outputPath,
      size: stats.size,
      type: 'video',
      metadata: {
        corrupted: true
      }
    };
  }

  /**
   * Genera múltiples archivos de prueba con diferentes características
   */
  async generateTestSuite(outputDir?: string): Promise<MediaFile[]> {
    const targetDir = outputDir || this.outputDir;
    const files: MediaFile[] = [];

    try {
      // Video HD corto
      files.push(await this.generateTestVideo('test_hd_short.mp4', {
        duration: 5,
        width: 1920,
        height: 1080,
        fps: 30
      }));

      // Video SD largo
      files.push(await this.generateTestVideo('test_sd_long.mp4', {
        duration: 30,
        width: 854,
        height: 480,
        fps: 24
      }));

      // Video con audio
      files.push(await this.generateVideoWithAudio('test_with_audio.mp4', {
        duration: 10,
        width: 1280,
        height: 720,
        frequency: 440
      }));

      // Audio
      files.push(await this.generateTestAudio('test_audio.mp3', {
        duration: 15,
        frequency: 880
      }));

      // Imagen
      files.push(await this.generateTestImage('test_image.jpg', {
        width: 1920,
        height: 1080,
        color: 'red'
      }));

      // Video corrupto
      files.push(await this.generateCorruptedVideo('test_corrupted.mp4'));

      return files;
    } catch (error) {
      throw new Error(`Failed to generate test suite: ${(error as Error).message}`);
    }
  }

  /**
   * Limpia todos los archivos de prueba generados
   */
  async cleanup(): Promise<void> {
    try {
      if (await fs.pathExists(this.outputDir)) {
        const files = await fs.readdir(this.outputDir);
        
        for (const file of files) {
          const filePath = path.join(this.outputDir, file);
          await fs.remove(filePath);
        }
        
        console.log(`✓ Cleaned ${files.length} test files`);
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }

  /**
   * Verifica si un archivo es válido usando FFprobe
   */
  async validateMediaFile(filePath: string): Promise<boolean> {
    try {
      const ffprobePath = this.resolveFFprobePath();
      
      execSync(`"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`, {
        stdio: 'pipe'
      });
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Obtiene información detallada de un archivo multimedia
   */
  async getMediaInfo(filePath: string): Promise<any> {
    try {
      const ffprobePath = this.resolveFFprobePath();
      
      const output = execSync(
        `"${ffprobePath}" -v quiet -print_format json -show_format -show_streams "${filePath}"`,
        { encoding: 'utf8' }
      );
      
      return JSON.parse(output);
    } catch (error) {
      throw new Error(`Failed to get media info: ${(error as Error).message}`);
    }
  }

  /**
   * Resuelve la ruta de ffprobe de forma segura y multiplataforma.
   * Evita reemplazar accidentalmente partes del path (por ejemplo, carpetas como "ffmpeg_lib").
   */
  private resolveFFprobePath(): string {
    if (this.ffprobePath) return this.ffprobePath;
    const dir = path.dirname(this.ffmpegPath);
    const binaryName = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
    return path.join(dir, binaryName);
  }
}

export { TestMediaGenerator, MediaFile, VideoOptions, AudioOptions, ImageOptions };