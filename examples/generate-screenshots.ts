import { FFmpegCommand } from '../src/index.js';
import fs from 'fs';

async function generateThumbnails() {
  console.log('Generating screenshots...');
  
  // Create thumbnails directory if it doesn't exist
  if (!fs.existsSync('./thumbnails')) {
    fs.mkdirSync('./thumbnails');
  }

  const command = new FFmpegCommand();
  command.input('video.mp4');

  try {
    // Generate screenshots at specific timestamps
    const thumbnails = await command.screenshots({
      timestamps: ['00:00:05', '00:00:10', '00:00:15'], // Take screenshot at 5s, 10s, 15s
      folder: './thumbnails',
      filename: 'thumb_%i.jpg', // %i is replaced with sequence number (1, 2, 3...)
      size: '1280x720' // Fix size to 720p
    });

    console.log('Thumbnails created successfully:', thumbnails);
  } catch (error) {
    console.error('Error generating screenshots:', error);
  }
}

generateThumbnails();
