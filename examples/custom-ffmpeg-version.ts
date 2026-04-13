/**
 * Example: Using managed FFmpeg binaries from FFmpegManager downloader
 * 
 * Instead of relying on manual PATH configuration or pre-installed versions,
 * you can use the built-in FFmpegManager to automatically download, 
 * verify, and resolve the binaries correctly per OS.
 */

import { FFmpegCommand, VideoProcessingOrchestrator, FFmpegManager } from '../src/index.js';

async function generateWithDownloadedBinaries() {
  console.log(`Initializing FFmpegManager to request FFmpeg version 8 (git master)...`);

  // Pass undefined for custom path, and '8' as the requested version to fetch the latest git builds
  const manager = new FFmpegManager(undefined, {
    linux: 'https://www.ffmpeg.org/releases/ffmpeg-8.1.tar.gz',
    win32: 'https://github.com/GyanD/codexffmpeg/releases/download/8.1/ffmpeg-8.1-full_build-shared.zip',

  });

  // 1. Check if FFmpeg is available locally or download it
  await manager.downloadFFmpegBinaries(true);
  const isAvailable = await manager.isFFmpegAvailable();
  if (!isAvailable) {
    console.log('FFmpeg binaries not found in cache. Downloading them now...');
    // Setting `true` ensures it attempts to place them in your configured directories
    console.log('Download complete.');
  } else {
    console.log('FFmpeg binaries already exist in cache.');
  }

  // 2. Retrieve the dynamically managed paths
  const binaries = await manager.verifyBinaries();
  const injectedFfmpegPath = binaries.ffmpegPath;
  const injectedFfprobePath = binaries.ffprobePath;

  console.log(`Using Resolved FFmpeg: ${injectedFfmpegPath}`);
  console.log(`Using Resolved FFprobe: ${injectedFfprobePath}`);

  // 3. Inject the resolved paths into FFmpegCommand
  const cmd = new FFmpegCommand({
    ffmpegPath: injectedFfmpegPath,
    ffprobePath: injectedFfprobePath
  });

  // Example usage extracting metadata using the resolved ffprobe path:
  try {
    const metadata = await FFmpegCommand.probe('sample.mp4', { ffprobePath: injectedFfprobePath });
    console.log('Detected Duration:', metadata.format.duration);
  } catch (e) {
    console.log('Note: Ensure sample.mp4 exists locally to test probing!');
  }

  // 4. Alternatively pass resolved paths to the advanced Orchestrator components
  const orchestrator = new VideoProcessingOrchestrator(injectedFfmpegPath, injectedFfprobePath);

  console.log("Successfully wired FFmpeg-lib to utilize auto-downloaded binaries!", orchestrator.eventNames());
}

generateWithDownloadedBinaries().catch(console.error);
