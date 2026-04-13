/**
 * Example: Using a Custom System FFmpeg Version (e.g. FFmpeg 8.x)
 * 
 * If you have a specific version of FFmpeg installed locally on your system,
 * you can completely bypass the automatic downloader inside `FFmpegManager` 
 * and directly run workflows using your paths.
 */

import { FFmpegCommand, VideoProcessingOrchestrator } from '../src/index';
import path from 'path';
import os from 'os';

// 1. Specify the path to your custom FFmpeg 8.x binaries.
// Usually on Linux systems, custom built versions are in /usr/local/bin.
const customFfmpegPath = process.platform === 'win32' ? 'C:\\ffmpeg8\\bin\\ffmpeg.exe' : '/usr/local/bin/ffmpeg';
const customFfprobePath = process.platform === 'win32' ? 'C:\\ffmpeg8\\bin\\ffprobe.exe' : '/usr/local/bin/ffprobe';

async function generateWithFfmpeg8() {
  console.log(`Executing using custom FFmpeg paths.`);
  console.log(`FFmpeg: ${customFfmpegPath}`);
  console.log(`FFprobe: ${customFfprobePath}`);

  // 2. Bypass FFmpegManager and inject your paths directly into FFmpegCommand
  const cmd = new FFmpegCommand({
    ffmpegPath: customFfmpegPath,
    ffprobePath: customFfprobePath
  });

  // Example usage extracting metadata using custom ffprobe:
  try {
    const metadata = await FFmpegCommand.probe('sample.mp4', { ffprobePath: customFfprobePath });
    console.log('Detected Duration:', metadata.format.duration);
  } catch (e) {
    console.log('Note: Ensure sample.mp4 exists first!');
  }

  // 3. Or pass custom paths to the advanced Orchestrator components
  const orchestrator = new VideoProcessingOrchestrator(customFfmpegPath, customFfprobePath);

  console.log("Successfully wired FFmpeg-lib to utilize FFmpeg 8 (or any system paths)!", orchestrator.eventNames());
}

generateWithFfmpeg8().catch(console.error);
