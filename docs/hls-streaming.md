# HLS Streaming & Orchestration

`ffmpeg_lib` shines entirely with its high-level orchestration architectures handling HLS formatting, variants, audio-track mapping, and subtitle integration perfectly.

### VideoProcessingOrchestrator

The main `VideoProcessingOrchestrator` consumes components via an event-driven `EventEmitter` system that handles `metadata -> extraction -> transcoding -> HLS-Segments -> master-playlist`.

```typescript
import { 
    VideoProcessingOrchestrator, 
    createStreamingConfig, 
    ResolutionUtils 
} from 'ffmpeg-lib';

const orchestrator = new VideoProcessingOrchestrator(ffmpegPath, ffprobePath);

// Generate scaling layers (e.g. 1080p -> 720, 480, 240)
const qualities = ResolutionUtils.generateLowerResolutions(1920, 1080);

const config = createStreamingConfig(
    'movie.mkv',
    './hls-output/',
    qualities,
    {
        multiAudio: true, // Demux and HLS segment mapping for distinct tracks
        languages: ['en', 'es', 'fr', 'ja'], // Only keep specified tags
        preset: 'fast' 
    }
);

// Map Subtitles explicitly
config.subtitles.externalFiles = [
    { path: 'subs-en.srt', language: 'en' },
    { path: 'subs-es.ass', language: 'es' }
];

// Subscribe to events cleanly
orchestrator.on('progress', (data) => console.log(`Current phase progress: ${data.globalPercent}%`));
orchestrator.on('phase-complete', (phase) => console.log(`Finished ${phase}`));

// Process pipeline
const report = await orchestrator.process(config);
console.log('Master Playlist Created at:', report.video.masterPlaylistPath);
```

### Underlying Pipelines
When calling `.process`, under the hood several abstractions act:

- **HLSSegmentationManager**: Calculates Apple-Standard HLS specs, `-f hls`, segment sizes, `master.m3u8` grouping, and independent stream mapping logic natively.
- **AudioTrackProcessor**: Performs demuxing, removing interlaced channels natively built into large unformatted files and outputs segregated mapped HLS chunks cleanly separated from the Video tracks `GROUP-ID=audio`. 
- **SubtitleProcessor**: Runs mappings for `VTT`/`SRT`/`ASS`, creating separated HLS WebVTT segmented objects ensuring stream bandwidth isn't interrupted by subtitles.
