# FFmpeg Lib

![Logo](https://img.shields.io/badge/FFMPEG-LIB-%23000?style=for-the-badge&logo=ffmpeg&logoColor=green)

A comprehensive, fluent, and type-safe Node.js wrapper for FFmpeg and FFprobe geared heavily towards reliable operations, HLS streaming, multi-bitrate segmented encoding, and resilient lifecycle/error recovery.

## Documentation Index

Please see the `docs/` directory for detailed reading on various internal systems:

- [1. Getting Started](./docs/getting-started.md) - Installation and basic rapid initialization scenarios.
- [2. System FFmpeg Manager](./docs/ffmpeg-manager.md) - Automatically managing, fetching, and locally authenticating `ffmpeg`/`ffprobe` binaries without cluttering local paths.
- [3. FFmpeg Fluent Command](./docs/ffmpeg-command.md) - Fluent abstraction for chaining intricate commands predictably.
- [4. Advanced HLS Orchestration](./docs/hls-streaming.md) - Demuxing, processing streaming topologies natively via the `VideoProcessingOrchestrator` pipelines.

## Installation

```bash
bun add ffmpeg-lib
```

## Quick Examples

### Basic Video Conversion
```typescript
import { FFmpegCommand } from 'ffmpeg-lib';

const command = new FFmpegCommand();

await command
  .input('input.mp4')
  .output('output.mkv')
  .videoCodec('libx264')
  .videoBitrate('2000k')
  .audioCodec('aac')
  .run();
```

### Extracting Audio
```typescript
import { FFmpegCommand } from 'ffmpeg-lib';

const command = new FFmpegCommand();

await command
  .input('video.mp4')
  .output('audio.mp3')
  .noVideo()
  .audioCodec('mp3')
  .run();
```

### Generating Screenshots
```typescript
import { FFmpegCommand } from 'ffmpeg-lib';

const command = new FFmpegCommand();
command.input('video.mp4');

const thumbnails = await command.screenshots({
  timestamps: ['00:00:05', '00:00:10'],
  folder: './thumbnails',
  filename: 'thumb_%i.jpg',
  size: '1280x720'
});
```

*For more details on operations, see [Getting Started](./docs/getting-started.md).*