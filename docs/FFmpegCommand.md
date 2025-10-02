# FFmpegCommand

A comprehensive FFmpeg command builder and executor that provides a fluent, type-safe interface for constructing and executing complex FFmpeg operations.

## Overview

The `FFmpegCommand` class provides a powerful, chainable API for building FFmpeg commands programmatically. It abstracts away the complexity of FFmpeg's command-line interface while providing full access to its capabilities. This class supports everything from simple conversions to complex multi-input, multi-output operations with filters, effects, and advanced encoding options.

## Features

- **Fluent API**: Chainable methods for building complex commands
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Input/Output Management**: Support for multiple inputs and outputs
- **Filter System**: Advanced filter graph construction and management
- **Codec Configuration**: Comprehensive codec and encoding options
- **Stream Mapping**: Flexible stream selection and mapping
- **Progress Monitoring**: Built-in progress tracking and reporting
- **Error Handling**: Robust error detection and reporting
- **Validation**: Input validation and command verification

## Installation

```typescript
import { FFmpegCommand, FilterChain, StreamMapping } from 'ffmpeg-lib';
```

## Basic Usage

```typescript
const command = new FFmpegCommand('/path/to/ffmpeg');

// Simple conversion
const result = await command
    .input('input.mp4')
    .output('output.avi')
    .videoCodec('libx264')
    .audioCodec('aac')
    .execute();

// Complex operation with filters
const result = await command
    .input('input.mp4')
    .output('output.mp4')
    .videoCodec('libx264')
    .videoBitrate('1000k')
    .audioCodec('aac')
    .audioBitrate('128k')
    .size('1280x720')
    .fps(30)
    .execute();
```

## API Reference

### Constructor

#### `new FFmpegCommand(ffmpegPath: string, options?: CommandOptions)`

Creates a new instance of FFmpegCommand.

**Parameters:**
- `ffmpegPath` (string): Path to the FFmpeg executable
- `options` (CommandOptions, optional): Command configuration options

**Throws:**
- `Error`: If ffmpegPath is not provided or is invalid

**Example:**
```typescript
const command = new FFmpegCommand('/usr/bin/ffmpeg', {
    logLevel: 'info',
    overwrite: true,
    timeout: 300000
});
```

### Input Methods

#### `input(source: string, options?: InputOptions): FFmpegCommand`

Adds an input source to the command.

**Parameters:**
- `source` (string): Input file path or stream URL
- `options` (InputOptions, optional): Input-specific options

**Returns:**
- `FFmpegCommand`: The command instance for chaining

**Example:**
```typescript
command
    .input('video.mp4')
    .input('audio.mp3', { startTime: 10, duration: 30 })
    .input('subtitle.srt');
```

#### `inputFormat(format: string): FFmpegCommand`

Specifies the input format.

**Parameters:**
- `format` (string): Input format (e.g., 'mp4', 'avi', 'mov')

**Returns:**
- `FFmpegCommand`: The command instance for chaining

#### `inputOptions(options: string[]): FFmpegCommand`

Adds input-specific options.

**Parameters:**
- `options` (string[]): Array of input options

**Returns:**
- `FFmpegCommand`: The command instance for chaining

### Output Methods

#### `output(destination: string, options?: OutputOptions): FFmpegCommand`

Specifies the output destination.

**Parameters:**
- `destination` (string): Output file path
- `options` (OutputOptions, optional): Output-specific options

**Returns:**
- `FFmpegCommand`: The command instance for chaining

**Example:**
```typescript
command
    .input('input.mp4')
    .output('output.mp4', { 
        seekTime: 0, 
        duration: 60,
        format: 'mp4'
    });
```

#### `outputFormat(format: string): FFmpegCommand`

Specifies the output format.

**Parameters:**
- `format` (string): Output format

**Returns:**
- `FFmpegCommand`: The command instance for chaining

#### `outputOptions(options: string[]): FFmpegCommand`

Adds output-specific options.

**Parameters:**
- `options` (string[]): Array of output options

**Returns:**
- `FFmpegCommand`: The command instance for chaining

### Video Configuration Methods

#### `videoCodec(codec: string): FFmpegCommand`

Sets the video codec.

**Parameters:**
- `codec` (string): Video codec (e.g., 'libx264', 'h264', 'vp9')

**Returns:**
- `FFmpegCommand`: The command instance for chaining

#### `videoBitrate(bitrate: string): FFmpegCommand`

Sets the video bitrate.

**Parameters:**
- `bitrate` (string): Video bitrate (e.g., '1000k', '5M')

**Returns:**
- `FFmpegCommand`: The command instance for chaining

#### `fps(fps: number): FFmpegCommand`

Sets the output frame rate.

**Parameters:**
- `fps` (number): Frames per second

**Returns:**
- `FFmpegCommand`: The command instance for chaining

#### `size(size: string): FFmpegCommand`

Sets the output video size/resolution.

**Parameters:**
- `size` (string): Video size (e.g., '1920x1080', '1280x720')

**Returns:**
- `FFmpegCommand`: The command instance for chaining

#### `aspectRatio(ratio: string): FFmpegCommand`

Sets the aspect ratio.

**Parameters:**
- `ratio` (string): Aspect ratio (e.g., '16:9', '4:3')

**Returns:**
- `FFmpegCommand`: The command instance for chaining

#### `videoFilters(filters: string[]): FFmpegCommand`

Applies video filters.

**Parameters:**
- `filters` (string[]): Array of video filter expressions

**Returns:**
- `FFmpegCommand`: The command instance for chaining

**Example:**
```typescript
command
    .videoFilters([
        'scale=1280:720',
        'fps=30',
        'brightness=0.1'
    ]);
```

### Audio Configuration Methods

#### `audioCodec(codec: string): FFmpegCommand`

Sets the audio codec.

**Parameters:**
- `codec` (string): Audio codec (e.g., 'aac', 'mp3', 'opus')

**Returns:**
- `FFmpegCommand`: The command instance for chaining

#### `audioBitrate(bitrate: string): FFmpegCommand`

Sets the audio bitrate.

**Parameters:**
- `bitrate` (string): Audio bitrate (e.g., '128k', '192k')

**Returns:**
- `FFmpegCommand`: The command instance for chaining

#### `audioChannels(channels: number): FFmpegCommand`

Sets the number of audio channels.

**Parameters:**
- `channels` (number): Number of channels (e.g., 1, 2, 6)

**Returns:**
- `FFmpegCommand`: The command instance for chaining

#### `audioSampleRate(rate: number): FFmpegCommand`

Sets the audio sample rate.

**Parameters:**
- `rate` (number): Sample rate in Hz (e.g., 44100, 48000)

**Returns:**
- `FFmpegCommand`: The command instance for chaining

#### `audioFilters(filters: string[]): FFmpegCommand`

Applies audio filters.

**Parameters:**
- `filters` (string[]): Array of audio filter expressions

**Returns:**
- `FFmpegCommand`: The command instance for chaining

### Advanced Configuration Methods

#### `duration(duration: number): FFmpegCommand`

Sets the output duration.

**Parameters:**
- `duration` (number): Duration in seconds

**Returns:**
- `FFmpegCommand`: The command instance for chaining

#### `seek(time: number): FFmpegCommand`

Seeks to a specific time in the input.

**Parameters:**
- `time` (number): Time position in seconds

**Returns:**
- `FFmpegCommand`: The command instance for chaining

#### `ss(time: number): FFmpegCommand`

Sets the start time for input.

**Parameters:**
- `time` (number): Start time in seconds

**Returns:**
- `FFmpegCommand`: The command instance for chaining

#### `streamMapping(mappings: StreamMapping[]): FFmpegCommand`

Configures stream mapping.

**Parameters:**
- `mappings` (StreamMapping[]): Array of stream mappings

**Returns:**
- `FFmpegCommand`: The command instance for chaining

#### `filterComplex(graph: string): FFmpegCommand`

Sets up a complex filter graph.

**Parameters:**
- `graph` (string): Filter graph expression

**Returns:**
- `FFmpegCommand`: The command instance for chaining

### Execution Methods

#### `execute(): Promise<ExecutionResult>`

Executes the built command.

**Returns:**
- `Promise<ExecutionResult>`: Execution result

**Example:**
```typescript
try {
    const result = await command
        .input('input.mp4')
        .output('output.mp4')
        .videoCodec('libx264')
        .audioCodec('aac')
        .execute();
    
    console.log('Success:', result.success);
    console.log('Duration:', result.duration);
} catch (error) {
    console.error('Execution failed:', error.message);
}
```

#### `executeWithProgress(onProgress?: (progress: ProgressInfo) => void): Promise<ExecutionResult>`

Executes the command with progress monitoring.

**Parameters:**
- `onProgress` (function, optional): Progress callback function

**Returns:**
- `Promise<ExecutionResult>`: Execution result with progress information

#### `build(): string[]`

Builds the command arguments array without executing.

**Returns:**
- `string[]`: Array of command arguments

**Example:**
```typescript
const args = command
    .input('input.mp4')
    .output('output.mp4')
    .videoCodec('libx264')
    .build();

console.log('Command:', args.join(' '));
```

## Interfaces

### InputOptions

Options for input configuration.

```typescript
interface InputOptions {
    format?: string;
    startTime?: number;
    duration?: number;
    seekTime?: number;
    videoCodec?: string;
    audioCodec?: string;
    frameRate?: number;
    pixelFormat?: string;
    videoSize?: string;
    videoBitrate?: string;
    audioBitrate?: string;
    sampleRate?: number;
    channels?: number;
}
```

### OutputOptions

Options for output configuration.

```typescript
interface OutputOptions {
    format?: string;
    seekTime?: number;
    duration?: number;
    targetFileSize?: number;
    targetDuration?: number;
    videoBitrate?: string;
    audioBitrate?: string;
    frameRate?: number;
    quality?: number;
}
```

### StreamMapping

Stream mapping configuration.

```typescript
interface StreamMapping {
    inputIndex: number;
    streamType: 'video' | 'audio' | 'subtitle' | 'data' | 'attachment';
    streamIndex: number;
    outputIndex?: number;
    codec?: string;
    bitrate?: string;
}
```

### ExecutionResult

Result of command execution.

```typescript
interface ExecutionResult {
    success: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
    duration: number;
    outputFiles: string[];
    warnings: string[];
    errors: string[];
}
```

### ProgressInfo

Progress information during execution.

```typescript
interface ProgressInfo {
    frame: number;
    fps: number;
    size: string;
    time: string;
    bitrate: string;
    speed: string;
    progress: number;
}
```

### CommandOptions

Configuration options for the command.

```typescript
interface CommandOptions {
    logLevel?: 'quiet' | 'panic' | 'fatal' | 'error' | 'warning' | 'info' | 'verbose' | 'debug';
    overwrite?: boolean;
    timeout?: number;
    workingDirectory?: string;
    environment?: Record<string, string>;
    hideBanner?: boolean;
    stats?: boolean;
}
```

## Advanced Examples

### Multi-Input Video with Audio Mixing

```typescript
const result = await command
    .input('video1.mp4')
    .input('video2.mp4')
    .input('background.mp3')
    .complexFilter([
        '[0:v][1:v]blend=overlay[v]',
        '[2:a]volume=0.3[a1]',
        '[0:a][a1]amix=inputs=2:duration=first[a]'
    ])
    .output('output.mp4')
    .videoCodec('libx264')
    .audioCodec('aac')
    .map(['[v]', '[a]'])
    .execute();
```

### Video Scaling with Multiple Outputs

```typescript
const result = await command
    .input('input.mp4')
    .output('output_720p.mp4')
    .videoCodec('libx264')
    .size('1280x720')
    .audioCodec('aac')
    .output('output_480p.mp4')
    .videoCodec('libx264')
    .size('854x480')
    .audioCodec('aac')
    .execute();
```

### Video Concatenation

```typescript
const result = await command
    .input('video1.mp4')
    .input('video2.mp4')
    .input('video3.mp4')
    .complexFilter([
        '[0:v][0:a][1:v][1:a][2:v][2:a]concat=n=3:v=1:a=1[v][a]'
    ])
    .output('output.mp4')
    .videoCodec('libx264')
    .audioCodec('aac')
    .map(['[v]', '[a]'])
    .execute();
```

### Video with Watermark

```typescript
const result = await command
    .input('input.mp4')
    .input('watermark.png')
    .complexFilter([
        '[0:v][1:v]overlay=10:10[v]'
    ])
    .output('output.mp4')
    .videoCodec('libx264')
    .audioCodec('copy')
    .map(['[v]', '0:a'])
    .execute();
```

### Audio Extraction and Conversion

```typescript
const result = await command
    .input('video.mp4')
    .output('audio.mp3')
    .audioCodec('mp3')
    .audioBitrate('192k')
    .audioChannels(2)
    .audioSampleRate(44100)
    .noVideo()
    .execute();
```

### Thumbnail Generation

```typescript
const result = await command
    .input('video.mp4')
    .output('thumbnail.jpg')
    .seek(5) // Extract frame at 5 seconds
    .frames(1)
    .videoFilters(['scale=320:240'])
    .execute();
```

### Live Streaming Setup

```typescript
const result = await command
    .input('input.mp4')
    .inputFormat('mp4')
    .output('rtmp://streaming-server.com/live/stream')
    .outputFormat('flv')
    .videoCodec('libx264')
    .videoBitrate('2500k')
    .fps(30)
    .size('1280x720')
    .audioCodec('aac')
    .audioBitrate('128k')
    .audioSampleRate(44100)
    .execute();
```

## Error Handling

The command builder provides detailed error information:

```typescript
try {
    const result = await command
        .input('input.mp4')
        .output('output.mp4')
        .videoCodec('invalid_codec')
        .execute();
} catch (error) {
    if (error.message.includes('Unknown encoder')) {
        console.error('Invalid codec specified');
    } else if (error.message.includes('Invalid argument')) {
        console.error('Invalid parameter provided');
    } else {
        console.error('Command failed:', error.message);
    }
}
```

## Validation

### Command Validation

```typescript
const command = new FFmpegCommand('/usr/bin/ffmpeg');

// Build command
cmd.input('input.mp4')
   .output('output.mp4')
   .videoCodec('libx264');

// Validate before execution
try {
    cmd.validate();
    const result = await cmd.execute();
} catch (error) {
    console.error('Validation failed:', error.message);
}
```

### Input Validation

```typescript
// Validate input file
const isValid = await command.validateInput('input.mp4');
if (!isValid) {
    throw new Error('Invalid input file');
}

// Validate codec support
const capabilities = await command.getCapabilities();
if (!capabilities.videoCodecs.includes('libx264')) {
    throw new Error('H.264 codec not available');
}
```

## Performance Optimization

### Efficient Command Building

```typescript
// Reuse command builder
const command = new FFmpegCommand('/usr/bin/ffmpeg');

for (const file of files) {
    const result = await command
        .reset() // Reset previous settings
        .input(file)
        .output(file.replace(/\.[^.]+$/, '.mp4'))
        .videoCodec('libx264')
        .preset('fast')
        .execute();
}
```

### Batch Processing

```typescript
async function batchConvert(files: string[]) {
    const command = new FFmpegCommand('/usr/bin/ffmpeg');
    const results = [];
    
    for (const file of files) {
        try {
            const result = await command
                .reset()
                .input(file)
                .output(file.replace(/\.[^.]+$/, '.mp4'))
                .videoCodec('libx264')
                .audioCodec('aac')
                .execute();
            
            results.push({ file, success: true, result });
        } catch (error) {
            results.push({ file, success: false, error: error.message });
        }
    }
    
    return results;
}
```

## Platform Support

The FFmpegCommand works on all platforms that support Node.js and FFmpeg:

- **Windows**: Full support with .exe binaries
- **macOS**: Full support with Unix binaries
- **Linux**: Full support with static binaries

## Dependencies

- **FFmpeg**: Required for media processing
- **Node.js**: Version 14.0.0 or higher
- **Child Process**: For command execution

## License

This documentation is part of the ffmpeg-lib project. See the main project license for details.