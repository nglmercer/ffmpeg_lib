# FFmpeg Video Processor

A powerful Node.js library for video processing using FFmpeg, featuring automatic binary management, multi-quality video processing, and comprehensive video manipulation capabilities.

## Features

- **Automatic FFmpeg Binary Management**: Downloads and manages FFmpeg binaries for Windows, Linux, and macOS
- **Multi-Quality Video Processing**: Convert videos to multiple resolutions (360p, 480p, 720p, 1080p)
- **Progress Tracking**: Real-time progress monitoring during video processing
- **Video Information Extraction**: Get detailed video metadata using FFprobe
- **Thumbnail Generation**: Create thumbnails from video frames
- **Audio Extraction**: Extract audio tracks from videos
- **Cross-Platform**: Works on Windows, Linux, and macOS
- **Executable Packaging**: Can be packaged as standalone executable using pkg

## Installation

```bash
npm install
```

## Quick Start

### 1. Update FFmpeg Binaries

Before using the library, you need to download FFmpeg binaries:

```bash
npm run update-ffmpeg
```

Or using the CLI:

```bash
node index.js --update-ffmpeg
```

### 2. Process a Video

Process a video file to multiple qualities:

```bash
node index.js --input video.mp4 --output ./processed/
```

## CLI Usage

```bash
node index.js [options]
```

### Options

- `--input, -i` - Input video file path (required)
- `--output, -o` - Output directory path (required)
- `--update-ffmpeg` - Download/update FFmpeg binaries
- `--help, -h` - Show help information

### Examples

```bash
# Process a video file
node index.js --input /path/to/video.mp4 --output ./output/

# Update FFmpeg binaries
node index.js --update-ffmpeg

# Show help
node index.js --help
```

## API Usage

### VideoProcessor Class

```javascript
const { VideoProcessor } = require('./src/VideoProcessor');

async function processVideo() {
    const processor = new VideoProcessor();
    
    const result = await processor.processVideo(
        'input.mp4',
        './output/'
    );
    
    console.log('Processing completed:', result);
}

processVideo().catch(console.error);
```

### FFmpegCtrl Class

```javascript
const { FFmpegCtrl } = require('./src/FFmpegCtrl');
const { FFmpegManager } = require('./src/FFmpegManager');

async function getVideoInfo() {
    const manager = new FFmpegManager();
    const { ffmpegPath, ffprobePath } = await manager.verifyBinaries();
    
    const ctrl = new FFmpegCtrl(ffmpegPath, ffprobePath);
    const info = await ctrl.getVideoInfo('video.mp4');
    
    console.log('Video info:', info);
}
```

## Quality Profiles

The library includes predefined quality profiles:

- **1080p**: 1920x1080, 4000k video bitrate, 192k audio bitrate
- **720p**: 1280x720, 2500k video bitrate, 128k audio bitrate  
- **480p**: 854x480, 1500k video bitrate, 96k audio bitrate
- **360p**: 640x360, 800k video bitrate, 64k audio bitrate

### Custom Quality Profiles

```javascript
const processor = new VideoProcessor();

// Add custom quality profile
processor.setCustomQualityProfile('4k', {
    resolution: '3840x2160',
    videoBitrate: '8000k',
    audioBitrate: '256k',
    suffix: '_4k'
});
```

## Output Structure

After processing a video, the output directory will contain:

```
output/
├── video_1080p.mp4
├── video_720p.mp4
├── video_480p.mp4
├── video_360p.mp4
├── video_thumbnail.jpg
├── video_audio.mp3
└── manifest.json
```

The `manifest.json` file contains metadata about the processed files:

```json
{
  "generatedAt": "2024-01-01T12:00:00.000Z",
  "qualities": {
    "1080p": {
      "file": "video_1080p.mp4",
      "size": 1024000,
      "profile": {
        "resolution": "1920x1080",
        "videoBitrate": "4000k",
        "audioBitrate": "192k",
        "suffix": "_1080p"
      }
    }
  },
  "files": ["video_1080p.mp4", "video_720p.mp4", ...]
}
```

## Package as Executable

Build standalone executables for different platforms:

```bash
npm run build
```

This creates executables in the `dist/` directory for:
- Windows (.exe)
- Linux
- macOS

## Dependencies

- `fs-extra`: Enhanced file system operations
- `axios`: HTTP requests for downloading FFmpeg binaries
- `adm-zip`: ZIP archive extraction
- `pkg`: Executable packaging

## Supported Platforms

- **Windows**: FFmpeg binaries from gyan.dev
- **Linux**: FFmpeg binaries from johnvansickle.com  
- **macOS**: FFmpeg binaries from evermeet.cx

## Error Handling

The library provides comprehensive error handling:

- File existence validation
- FFmpeg binary verification
- Process execution monitoring
- Progress tracking with error reporting

## Development

### Project Structure

```
ffmpeg_lib/
├── src/
│   ├── FFmpegManager.js    # Binary management
│   ├── FFmpegCtrl.js       # FFmpeg process control
│   └── VideoProcessor.js   # Multi-quality processing
├── scripts/
│   └── update-ffmpeg.js    # Binary update script
├── binaries/               # FFmpeg binaries storage
├── index.js               # Main entry point
├── package.json           # Project configuration
└── README.md              # This file
```

### Running Tests

```bash
npm test
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Support

For issues and questions, please open an issue on the GitHub repository.