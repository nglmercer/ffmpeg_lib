import { TestMediaGenerator } from '../src/TestMediaGenerator';
import { FFmpegManager } from '../src/FFmpegManager';
import { VideoProcessingOrchestrator, createDefaultOrchestratorConfig, ResolutionUtils } from '../src/index';
import fs from 'fs-extra';
import path from 'path';
async function main() {
  // Configurar FFmpeg
  const manager = new FFmpegManager();
  const isAvailable = await manager.isFFmpegAvailable();
  if (!isAvailable){
    await manager.downloadFFmpegBinaries();
  }
  const { ffmpegPath: ffmpeg,ffprobePath: ffprobe } = await manager.verifyBinaries();
  const testOutputDir = path.join(process.cwd(), 'test-output');
  await fs.ensureDir(testOutputDir);
/*   const generator = new TestMediaGenerator(ffmpeg, testOutputDir);
  const video = await generator.generateVideoWithSubtitles('test_mkv.mkv', {
    duration: 10
  }); */
  const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720).slice(0, 1);
  
  const config = createDefaultOrchestratorConfig(
      path.join(testOutputDir, 'test_mkv.mkv'),
      testOutputDir,
      resolutions
  );
/*   config.audio.enabled = true;
  config.audio.extractAll = true;
  config.audio.generateHLS = true; */
  config.subtitles.generateWebVTT = true;
  const processor = new VideoProcessingOrchestrator(ffmpeg,ffprobe);
  const hlsVideo = await processor.process(config)
  return {hlsVideo};
}
main().then(result => {
  console.log(result);
});
