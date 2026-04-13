# FFmpegCommand API

`FFmpegCommand` provides a fluent, type-safe wrapper over raw `ffmpeg` command construction. It manages streams, arguments, scaling padding, filtering, formats, and event hooks natively without risking command-injection or corrupted string templates.

### Initialization

```typescript
import { FFmpegCommand } from 'ffmpeg-lib';

// Uses localized bins for execution.
const cmd = new FFmpegCommand({
    ffmpegPath: '/path/to/binaries/ffmpeg',
    ffprobePath: '/path/to/binaries/ffprobe'
});
```

### Basic Syntax

```typescript
cmd.input('source.avi')
    .videoCodec('libx264')
    .audioCodec('aac')
    .output('destination.mp4')
    .run()
    .then(() => console.log('Done!'))
    .catch(err => console.error('Error:', err));
```

### Advanced Fluent Methods

`FFmpegCommand` natively supports hundreds of chained helper calls:

```typescript
cmd.input('input.mp4')
   .seek(10.5) // Starts at 10.5 seconds
   .duration(30) // Only captures 30 seconds
   .videoBitrate('2000k')
   .audioChannels(2)
   .audioFrequency(48000)
   .format('hls')
   // Applying Complex Graph Filters
   .complexFilter([
      '[0:v]scale=1280:720[v]',
      '[0:a]volume=1.5[a]'
   ])
   .outputOptions(['-map [v]', '-map [a]'])
   .save('output.m3u8');
```

### Extracted Static Probe Utilities
Quick analysis can be run using the static wrapper over `FFprobe`:

```typescript
const metadata = await FFmpegCommand.probe('trailer.mp4', ffprobePath);
console.log(metadata.format.duration);
```
