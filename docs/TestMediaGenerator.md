# TestMediaGenerator

A powerful test media generation utility for creating synthetic multimedia files for testing and development purposes.

## Overview

The `TestMediaGenerator` class provides a comprehensive solution for generating various types of test media files including videos, audio files, images, and test patterns. It's designed to help developers create consistent, predictable media files for testing applications, workflows, and media processing pipelines.

## Features

- **Multiple Media Types**: Generate videos, audio files, images, and test patterns
- **Customizable Parameters**: Control resolution, duration, codecs, and quality
- **Test Patterns**: Built-in test patterns like SMPTE color bars, test cards, and noise
- **Audio Generation**: Generate synthetic audio with various waveforms and frequencies
- **Batch Generation**: Create multiple test files with different configurations
- **Performance Optimized**: Efficient generation with minimal resource usage
- **TypeScript Support**: Full TypeScript definitions and interfaces

## Installation

```typescript
import { TestMediaGenerator, MediaType, TestPattern } from 'ffmpeg-lib';
```

## Basic Usage

```typescript
const generator = new TestMediaGenerator('/path/to/ffmpeg');

// Generate a simple test video
const videoPath = await generator.generateVideo({
    outputPath: '/tmp/test_video.mp4',
    duration: 10,
    resolution: '1920x1080',
    fps: 30
});

// Generate test audio
const audioPath = await generator.generateAudio({
    outputPath: '/tmp/test_audio.mp3',
    duration: 5,
    sampleRate: 44100
});

// Generate test image
const imagePath = await generator.generateImage({
    outputPath: '/tmp/test_image.jpg',
    resolution: '1920x1080',
    pattern: TestPattern.SMPTE_BARS
});
```

## API Reference

### Constructor

#### `new TestMediaGenerator(ffmpegPath: string)`

Creates a new instance of TestMediaGenerator.

**Parameters:**
- `ffmpegPath` (string): Path to the FFmpeg executable

**Throws:**
- `Error`: If ffmpegPath is not provided or is empty

### Video Generation Methods

#### `generateVideo(options: VideoGenerationOptions): Promise<string>`

Generates a test video file with specified parameters.

**Parameters:**
- `options` (VideoGenerationOptions): Video generation configuration

**Returns:**
- `Promise<string>`: Path to the generated video file

**Example:**
```typescript
const videoPath = await generator.generateVideo({
    outputPath: '/tmp/test_video.mp4',
    duration: 30,
    resolution: '1920x1080',
    fps: 30,
    codec: 'libx264',
    bitrate: '5000k',
    pattern: TestPattern.SMPTE_BARS
});
```

#### `generateTestVideo(outputPath: string, duration?: number, resolution?: string): Promise<string>`

Generates a simple test video with default parameters.

**Parameters:**
- `outputPath` (string): Output file path
- `duration` (number, optional): Duration in seconds (default: 10)
- `resolution` (string, optional): Video resolution (default: '1280x720')

**Returns:**
- `Promise<string>`: Path to the generated video file

### Audio Generation Methods

#### `generateAudio(options: AudioGenerationOptions): Promise<string>`

Generates a test audio file with specified parameters.

**Parameters:**
- `options` (AudioGenerationOptions): Audio generation configuration

**Returns:**
- `Promise<string>`: Path to the generated audio file

**Example:**
```typescript
const audioPath = await generator.generateAudio({
    outputPath: '/tmp/test_audio.wav',
    duration: 10,
    sampleRate: 44100,
    channels: 2,
    waveform: 'sine',
    frequency: 440,
    amplitude: 0.8
});
```

#### `generateTone(outputPath: string, frequency?: number, duration?: number): Promise<string>`

Generates a simple sine wave tone.

**Parameters:**
- `outputPath` (string): Output file path
- `frequency` (number, optional): Tone frequency in Hz (default: 440)
- `duration` (number, optional): Duration in seconds (default: 5)

**Returns:**
- `Promise<string>`: Path to the generated audio file

### Image Generation Methods

#### `generateImage(options: ImageGenerationOptions): Promise<string>`

Generates a test image with specified parameters.

**Parameters:**
- `options` (ImageGenerationOptions): Image generation configuration

**Returns:**
- `Promise<string>`: Path to the generated image file

**Example:**
```typescript
const imagePath = await generator.generateImage({
    outputPath: '/tmp/test_image.png',
    resolution: '1920x1080',
    pattern: TestPattern.COLOR_BARS,
    format: 'png',
    quality: 95
});
```

#### `generateTestCard(outputPath: string, resolution?: string): Promise<string>`

Generates a standard test card image.

**Parameters:**
- `outputPath` (string): Output file path
- `resolution` (string, optional): Image resolution (default: '1920x1080')

**Returns:**
- `Promise<string>`: Path to the generated image file

### Batch Generation Methods

#### `generateTestSuite(outputDir: string, config?: TestSuiteConfig): Promise<string[]>`

Generates a comprehensive test suite with multiple media files.

**Parameters:**
- `outputDir` (string): Output directory path
- `config` (TestSuiteConfig, optional): Test suite configuration

**Returns:**
- `Promise<string[]>`: Array of paths to generated files

**Example:**
```typescript
const testFiles = await generator.generateTestSuite('/tmp/test_suite', {
    videoConfigs: [
        { duration: 10, resolution: '1920x1080', fps: 30 },
        { duration: 5, resolution: '1280x720', fps: 60 }
    ],
    audioConfigs: [
        { duration: 10, sampleRate: 44100 },
        { duration: 5, sampleRate: 48000 }
    ],
    imageConfigs: [
        { resolution: '1920x1080', pattern: TestPattern.SMPTE_BARS },
        { resolution: '1280x720', pattern: TestPattern.COLOR_WHEEL }
    ]
});
```

## Interfaces

### VideoGenerationOptions

Configuration for video generation.

```typescript
interface VideoGenerationOptions {
    outputPath: string;
    duration: number;
    resolution: string;
    fps: number;
    codec?: string;
    bitrate?: string;
    pixelFormat?: string;
    pattern?: TestPattern;
    color?: string;
    backgroundColor?: string;
    includeAudio?: boolean;
    audioFrequency?: number;
    audioSampleRate?: number;
}
```

### AudioGenerationOptions

Configuration for audio generation.

```typescript
interface AudioGenerationOptions {
    outputPath: string;
    duration: number;
    sampleRate?: number;
    channels?: number;
    waveform?: 'sine' | 'square' | 'triangle' | 'sawtooth' | 'noise';
    frequency?: number;
    amplitude?: number;
    codec?: string;
    bitrate?: string;
}
```

### ImageGenerationOptions

Configuration for image generation.

```typescript
interface ImageGenerationOptions {
    outputPath: string;
    resolution: string;
    pattern?: TestPattern;
    format?: string;
    quality?: number;
    color?: string;
    backgroundColor?: string;
    text?: string;
    fontSize?: number;
}
```

### TestSuiteConfig

Configuration for batch test suite generation.

```typescript
interface TestSuiteConfig {
    videoConfigs?: Array<{
        duration: number;
        resolution: string;
        fps: number;
        codec?: string;
        pattern?: TestPattern;
    }>;
    audioConfigs?: Array<{
        duration: number;
        sampleRate: number;
        channels?: number;
        waveform?: string;
    }>;
    imageConfigs?: Array<{
        resolution: string;
        pattern?: TestPattern;
        format?: string;
    }>;
    namingPattern?: string;
}
```

### TestPattern

Available test patterns for visual content.

```typescript
enum TestPattern {
    SMPTE_BARS = 'smpte_bars',
    COLOR_BARS = 'color_bars',
    COLOR_WHEEL = 'color_wheel',
    TEST_CARD = 'test_card',
    NOISE = 'noise',
    GRADIENT = 'gradient',
    CHECKERBOARD = 'checkerboard',
    CIRCLES = 'circles',
    GRID = 'grid'
}
```

## Test Patterns

### SMPTE Bars (SMPTE_BARS)
Standard SMPTE color bars for video calibration.

### Color Bars (COLOR_BARS)
Simple color bars pattern.

### Color Wheel (COLOR_WHEEL)
Circular color wheel for color testing.

### Test Card (TEST_CARD)
Standard broadcast test card pattern.

### Noise (NOISE)
Random noise pattern for testing compression.

### Gradient (GRADIENT)
Smooth gradient from black to white.

### Checkerboard (CHECKERBOARD)
Alternating black and white squares.

### Circles (CIRCLES)
Array of circles for geometry testing.

### Grid (GRID)
Regular grid pattern for alignment testing.

## Error Handling

The generator provides detailed error messages for various failure scenarios:

```typescript
try {
    const videoPath = await generator.generateVideo({
        outputPath: '/tmp/test.mp4',
        duration: 10,
        resolution: '1920x1080',
        fps: 30
    });
} catch (error) {
    if (error.message.includes('FFmpeg failed')) {
        console.error('FFmpeg execution failed');
    } else if (error.message.includes('Invalid parameters')) {
        console.error('Invalid generation parameters');
    } else {
        console.error('Unknown error:', error.message);
    }
}
```

## Examples

### Generate Test Video with Custom Pattern

```typescript
const videoPath = await generator.generateVideo({
    outputPath: '/tmp/calibration_video.mp4',
    duration: 60,
    resolution: '1920x1080',
    fps: 30,
    pattern: TestPattern.SMPTE_BARS,
    includeAudio: true,
    audioFrequency: 1000,
    audioSampleRate: 48000
});
```

### Generate Audio Test Suite

```typescript
const audioFiles = await generator.generateTestSuite('/tmp/audio_tests', {
    audioConfigs: [
        { duration: 10, sampleRate: 44100, waveform: 'sine', frequency: 440 },
        { duration: 10, sampleRate: 48000, waveform: 'square', frequency: 1000 },
        { duration: 5, sampleRate: 22050, waveform: 'triangle', frequency: 220 },
        { duration: 15, sampleRate: 44100, waveform: 'noise' }
    ]
});
```

### Generate Image Test Patterns

```typescript
const patterns = [
    TestPattern.COLOR_BARS,
    TestPattern.COLOR_WHEEL,
    TestPattern.CHECKERBOARD,
    TestPattern.GRID
];

for (const pattern of patterns) {
    const imagePath = await generator.generateImage({
        outputPath: `/tmp/${pattern}_test.png`,
        resolution: '1920x1080',
        pattern: pattern,
        format: 'png',
        quality: 100
    });
    console.log(`Generated ${pattern} pattern: ${imagePath}`);
}
```

### Generate Complex Test Video

```typescript
const complexVideo = await generator.generateVideo({
    outputPath: '/tmp/complex_test.mp4',
    duration: 30,
    resolution: '3840x2160',
    fps: 60,
    codec: 'libx264',
    bitrate: '20000k',
    pixelFormat: 'yuv420p',
    pattern: TestPattern.TEST_CARD,
    includeAudio: true,
    audioFrequency: 440,
    audioSampleRate: 48000
});
```

## Performance Considerations

- **Resolution Impact**: Higher resolutions take longer to generate
- **Duration Impact**: Longer durations increase generation time
- **Codec Selection**: Some codecs are faster than others
- **Pattern Complexity**: Complex patterns may take longer to generate
- **Batch Processing**: Use `generateTestSuite()` for efficient batch generation

## Platform Support

The TestMediaGenerator works on all platforms that support Node.js and FFmpeg:

- **Windows**: Full support with .exe binaries
- **macOS**: Full support with Unix binaries
- **Linux**: Full support with static binaries

## Dependencies

- **FFmpeg**: Required for media generation
- **Node.js**: Version 14.0.0 or higher
- **fs-extra**: For file system operations

## License

This documentation is part of the ffmpeg-lib project. See the main project license for details.