import { FFmpegCommand } from '../src/index.js';

async function extractAudio() {
  console.log('Starting audio extraction...');
  
  const command = new FFmpegCommand();
  
  command.on('progress', (progress) => console.log('Progress:', progress.timemark));
  
  try {
    // This will strip the video stream entirely and only convert the audio
    await command
      .input('video.mp4')
      .output('audio.mp3')
      .noVideo()               // Disables video output stream
      .audioCodec('libmp3lame') // Specific mp3 codec
      .audioBitrate('192k')    // Good quality audio
      .audioChannels(2)        // Stereo sound
      .run();
      
    console.log('Audio extracted successfully to audio.mp3!');
  } catch (error) {
    console.error('Error during audio extraction:', error);
  }
}

extractAudio();
