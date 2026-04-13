# Getting Started

`ffmpeg-lib` is a comprehensive, fluent, and type-safe Node.js wrapper for FFmpeg and FFprobe. It solves the common issue of managing native binaries while providing a modern, Promise-based API for handling media generation, HLS packaging, extraction, and orchestrating complex pipelines securely.

## Installation

You can install `ffmpeg-lib` via your favorite package manager:

```bash
bun add ffmpeg-lib
# or
npm install ffmpeg-lib
# or
yarn add ffmpeg-lib
```

## Features
- **Auto-managed Binaries:** Automatically downloads and cleanly manages `ffmpeg` and `ffprobe` distributions locally.
- **HLS Pipelines**: Built-in logic for multi-language, multi-bitrate segmented streaming processing.
- **Fluent Builder**: Secure chainable functions replacing dirty string-concatenation commands.
- **Subtitles & Demuxing**: Native handlers for WebVTT creation, SRT mapping, and extracting specific language audio-channels.
- **Testing Primitives**: `TestMediaGenerator` lets developers synthetically emulate media chunks locally without keeping binary test assets in code repositories.

## Quick Start
```typescript
import { FFmpegManager, FFmpegCommand } from 'ffmpeg-lib';

// Optional: download missing binaries.
const manager = new FFmpegManager();
if (!(await manager.isFFmpegAvailable())) {
    await manager.downloadFFmpegBinaries();
}

const { ffmpegPath, ffprobePath } = await manager.verifyBinaries();

// Generate command
const cmd = new FFmpegCommand({ ffmpegPath, ffprobePath })
    .input('source.mp4')
    .videoCodec('libx264')
    .videoBitrate('2500k')
    .size('1920x1080')
    .output('output.mp4');

await cmd.run();
console.log('Conversion successful!');
```

For more details, check out the specific articles in the documentation!
