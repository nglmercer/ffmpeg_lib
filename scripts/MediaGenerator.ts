import { TestMediaGenerator } from '../src/TestMediaGenerator';
import { FFmpegManager } from '../src/FFmpegManager';
import { VideoProcessingOrchestrator } from '../src/index';
import fs from 'fs-extra';
import path from 'path';
async function main() {
  // Configurar FFmpeg
  const manager = new FFmpegManager();
  const isAvailable = await manager.isFFmpegAvailable();
  if (!isAvailable){
    await manager.downloadFFmpegBinaries();
  }
  const { ffmpegPath: ffmpeg } = await manager.verifyBinaries();
  const testOutputDir = path.join(process.cwd(), 'test-output');
  await fs.ensureDir(testOutputDir);
/*   const generator = new TestMediaGenerator(ffmpeg, testOutputDir);
  const video = await generator.generateVideoWithSubtitles('test_mkv.mkv', {
    duration: 10
  }); */
  const processor = new VideoProcessingOrchestrator();
  const hlsVideo = await processor.processVideo(path.join(testOutputDir, 'test_mkv.mkv'),{
    outputBaseDir: path.join(testOutputDir, 'hls-output'),
  });
  return {hlsVideo};
}
main().then(result => {
  console.log(result);
});
