import { FFmpegCommand } from '../src/index.js'; // Assuming you build to dist or can import from src in tsx

async function runBasicConversion() {
  console.log('Starting basic video conversion...');
  
  const command = new FFmpegCommand();
  
  // Set up event listeners to monitor progress
  command.on('start', (cmdLine) => {
    console.log(`Spawned FFmpeg with command: ${cmdLine}`);
  });
  
  command.on('progress', (progress) => {
    console.log(`Processing: ${progress.timemark} | FPS: ${progress.currentFps}`);
  });
  
  command.on('end', () => {
    console.log('Video conversion completed successfully!');
  });
  
  command.on('error', (err) => {
    console.error('An error occurred during conversion:', err.message);
  });

  try {
    await command
      .input('input.mp4')          // Input file
      .output('output.mkv')        // Output file
      .videoCodec('libx264')       // Use H.264 video codec
      .videoBitrate('2000k')       // Target video bitrate
      .audioCodec('aac')           // Use AAC audio codec
      .audioBitrate('128k')        // Target audio bitrate
      .size('1280x720')            // Resize to 720p
      .run();                      // Execute command
  } catch (err) {
    console.error('Failed to convert video:', err);
  }
}

runBasicConversion();
