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

  // martin-riedl.de provides precompiled binaries as separate ZIPs per binary.
  // The "redirect/latest" scripting URLs always points to the latest release build (8.1).
  const manager = new FFmpegManager(undefined, {
    linux: 'https://ffmpeg.martin-riedl.de/redirect/latest/linux/amd64/release/ffmpeg.zip',
    win32: 'https://ffmpeg.martin-riedl.de/redirect/latest/windows/amd64/release/ffmpeg.zip',
    darwin: 'https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffmpeg.zip',
    // martin-riedl.de distributes ffmpeg and ffprobe as separate ZIP files
    ffprobe: {
      linux: 'https://ffmpeg.martin-riedl.de/redirect/latest/linux/amd64/release/ffprobe.zip',
      win32: 'https://ffmpeg.martin-riedl.de/redirect/latest/windows/amd64/release/ffprobe.zip',
      darwin: 'https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffprobe.zip',
    }
  });

  // Force download and ignore the cache to get fresh FFmpeg 8.1 binaries
  console.log('Force downloading FFmpeg 8.1 precompiled binaries...');
  await manager.downloadFFmpegBinaries(true);
  console.log('Download complete.');


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
