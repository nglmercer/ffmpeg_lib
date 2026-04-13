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

*For more details on operations, see [Getting Started](./docs/getting-started.md).*
