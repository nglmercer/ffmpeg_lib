# FFmpegLib

A comprehensive, fluent, and type-safe Node.js library for programmatic interaction with FFmpeg and FFprobe.

<!-- Optional: Add badges here -->
[![NPM version](https://img.shields.io/npm/v/ffmpeglib.svg)](https://www.npmjs.com/package/ffmpeglib)
[![Build Status](https://travis-ci.org/your-repo.svg?branch=main)](https://travis-ci.org/your-repo)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

FFmpegLib provides a powerful and intuitive interface to handle complex multimedia operations in Node.js. It abstracts the complexity of the FFmpeg command-line interface while offering full access to its capabilities, from simple conversions to advanced HLS packaging and media analysis.

## Core Features

- **Fluent Command Builder (`FFmpegCommand`)**: A chainable, type-safe API for building complex FFmpeg commands.
- **Advanced Process Management (`FFmpegManager`)**: High-level control with job queuing, progress monitoring, and resource management.
- **HLS Packaging Suite**: A complete toolset for HLS video processing, including segmentation, playlist generation, and variant stream creation.
- **Metadata Extraction (`MediaMetadataExtractor`)**: Easily extract detailed metadata from media files using FFprobe.
- **Test Media Generation (`TestMediaGenerator`)**: Create synthetic video, audio, and image files for testing purposes.
- **Full TypeScript Support**: Modern, type-safe development experience with comprehensive type definitions.

## Installation

```bash
npm install ffmpeglib
```

## Quick Start

Here's how easy it is to perform a video conversion while monitoring its progress:

```typescript
import { FFmpegManager } from 'ffmpeg-lib';

// Initialize the manager with the path to your FFmpeg executable
const manager = new FFmpegManager('/usr/bin/ffmpeg');

// Listen for progress events
manager.on('progress', (event) => {
    console.log(`Progress: ${event.progress}% | Speed: ${event.speed}`);
});

// Listen for completion
manager.on('completed', (event) => {
    console.log(`Conversion finished in ${event.duration}ms!`);
});

// Execute a conversion command
async function convertVideo() {
    try {
        console.log('Starting conversion...');
        const result = await manager.convert('input.mov', 'output.mp4', {
            videoCodec: 'libx264',
            videoBitrate: '2000k',
            resolution: '1280x720',
            audioCodec: 'aac',
            audioBitrate: '128k'
        });
        console.log('Success!', result);
    } catch (error) {
        console.error('An error occurred:', error.message);
    }
}

convertVideo();
```
## Core Components

FFmpegLib is organized into several powerful components. Choose the one that best fits your needs.

- **[FFmpegCommand](./docs/FFmpegCommand.md)**: For fine-grained, manual control over building and executing FFmpeg commands.
- **[FFmpegManager](./docs/FFmpegManager.md)**: For high-level process management, job queuing, and event-driven monitoring.
- **[MediaMetadataExtractor](./docs/MediaMetadataExtractor.md)**: To read and analyze media file properties with FFprobe.
- **[TestMediaGenerator](./docs/TestMediaGenerator.md)**: A utility to create placeholder media for your test suites.
- **[HLS Tools](./docs/HLS.md)**: A suite of classes for creating adaptive bitrate streaming content (HLS).

## Full Documentation

For a deep dive into the API and advanced examples, please check our **[full documentation](./docs/)**.

## License

This project is licensed under the MIT License.
