# MediaMetadataExtractor

A comprehensive media metadata extraction utility that provides detailed information about multimedia files using FFprobe.

## Overview

The `MediaMetadataExtractor` class is designed to extract comprehensive metadata from various multimedia files including videos, audio files, and images. It provides a high-level interface for analyzing media files and extracting technical information, format details, and stream information.

## Features

- **Multi-format Support**: Extracts metadata from videos, audio files, images, and subtitle files
- **Stream Analysis**: Detailed information about video, audio, and subtitle streams
- **Format Information**: Complete file format details including duration, bitrate, and size
- **Performance Optimized**: Fast detection methods for common use cases
- **Error Handling**: Robust error handling with detailed error messages
- **TypeScript Support**: Full TypeScript definitions and interfaces

## Installation

```typescript
import { MediaMetadataExtractor, MediaType, MediaMetadata } from 'ffmpeg-lib';
```

## Basic Usage

```typescript
const extractor = new MediaMetadataExtractor('/path/to/ffprobe');

// Extract complete metadata
const metadata = await extractor.extractMetadata('/path/to/video.mp4');
console.log(metadata);

// Quick media type detection
const type = await extractor.getMediaType('/path/to/file.mp4');
console.log(type); // 'video', 'audio', 'image', or 'unknown'
```

## API Reference

### Constructor

#### `new MediaMetadataExtractor(ffprobePath: string)`

Creates a new instance of MediaMetadataExtractor.

**Parameters:**
- `ffprobePath` (string): Path to the FFprobe executable

**Throws:**
- `Error`: If ffprobePath is not provided or is empty

### Methods

#### `extractMetadata(filePath: string, options?: MetadataOptions): Promise<MediaMetadata>`

Extracts complete metadata from a multimedia file.

**Parameters:**
- `filePath` (string): Path to the media file
- `options` (MetadataOptions, optional): Extraction options

**Returns:**
- `Promise<MediaMetadata>`: Complete metadata object

**Throws:**
- `Error`: If file doesn't exist or FFprobe fails

**Example:**
```typescript
const metadata = await extractor.extractMetadata('/path/to/video.mp4', {
    includeThumbnail: true,
    includeChapters: true,
    timeout: 30000
});
```

#### `getMediaType(filePath: string): Promise<MediaType>`

Quickly determines the type of media file.

**Parameters:**
- `filePath` (string): Path to the media file

**Returns:**
- `Promise<MediaType>`: Media type (video, audio, image, unknown)

**Example:**
```typescript
const type = await extractor.getMediaType('/path/to/file.mp4');
if (type === MediaType.VIDEO) {
    console.log('This is a video file');
}
```

#### `isVideo(filePath: string): Promise<boolean>`

Checks if a file is a valid video file.

**Parameters:**
- `filePath` (string): Path to the file

**Returns:**
- `Promise<boolean>`: True if the file is a video

#### `isAudio(filePath: string): Promise<boolean>`

Checks if a file is a valid audio file.

**Parameters:**
- `filePath` (string): Path to the file

**Returns:**
- `Promise<boolean>`: True if the file is audio

#### `isImage(filePath: string): Promise<boolean>`

Checks if a file is a valid image file.

**Parameters:**
- `filePath` (string): Path to the file

**Returns:**
- `Promise<boolean>`: True if the file is an image

#### `getBasicInfo(filePath: string): Promise<{type: MediaType, duration: number, size: number, format: string}>`

Gets basic information about a media file (faster than full extraction).

**Parameters:**
- `filePath` (string): Path to the media file

**Returns:**
- Basic media information object

## Interfaces

### MediaMetadata

Complete metadata structure returned by `extractMetadata()`.

```typescript
interface MediaMetadata {
    filePath: string;
    fileName: string;
    fileSize: number;
    fileExtension: string;
    mediaType: MediaType;
    format: FormatInfo;
    streams: StreamInfo[];
    videoStreams: StreamInfo[];
    audioStreams: StreamInfo[];
    subtitleStreams: StreamInfo[];
    primaryVideo?: {
        codec: string;
        resolution: string;
        width: number;
        height: number;
        aspectRatio: string;
        frameRate: string;
        bitrate?: number;
        pixelFormat?: string;
        colorSpace?: string;
    };
    primaryAudio?: {
        codec: string;
        sampleRate: number;
        channels: number;
        channelLayout: string;
        bitrate?: number;
        language?: string;
    };
    duration: number;
    durationFormatted: string;
    metadata: Record<string, string>;
    createdAt?: Date;
    modifiedAt?: Date;
}
```

### StreamInfo

Detailed information about individual streams.

```typescript
interface StreamInfo {
    index: number;
    codecName: string;
    codecLongName: string;
    codecType: MediaType;
    profile?: string;
    width?: number;
    height?: number;
    pixelFormat?: string;
    sampleRate?: number;
    channels?: number;
    channelLayout?: string;
    bitrate?: number;
    duration?: number;
    frameRate?: string;
    bitDepth?: number;
    colorSpace?: string;
    language?: string;
    tags?: Record<string, string>;
}
```

### FormatInfo

File format information.

```typescript
interface FormatInfo {
    filename: string;
    formatName: string;
    formatLongName: string;
    duration: number;
    size: number;
    bitrate: number;
    probeScore: number;
    tags?: Record<string, string>;
}
```

### MetadataOptions

Options for metadata extraction.

```typescript
interface MetadataOptions {
    includeThumbnail?: boolean;
    includeChapters?: boolean;
    timeout?: number; // Timeout in milliseconds
}
```

### MediaType

Enum for media types.

```typescript
enum MediaType {
    VIDEO = 'video',
    AUDIO = 'audio',
    IMAGE = 'image',
    SUBTITLE = 'subtitle',
    UNKNOWN = 'unknown'
}
```

## Utility Functions

### `formatFileSize(bytes: number): string`

Formats file size in human-readable format.

**Example:**
```typescript
console.log(formatFileSize(1048576)); // "1 MB"
console.log(formatFileSize(1073741824)); // "1 GB"
```

### `formatBitrate(bps: number): string`

Formats bitrate in human-readable format.

**Example:**
```typescript
console.log(formatBitrate(128000)); // "128 Kbps"
console.log(formatBitrate(1000000)); // "1 Mbps"
```

## Error Handling

The extractor provides detailed error messages for various failure scenarios:

```typescript
try {
    const metadata = await extractor.extractMetadata('/path/to/file.mp4');
} catch (error) {
    if (error.message.includes('File not found')) {
        console.error('The specified file does not exist');
    } else if (error.message.includes('FFprobe failed')) {
        console.error('FFprobe execution failed');
    } else {
        console.error('Unknown error:', error.message);
    }
}
```

## Performance Considerations

- **Quick Detection**: Use `getMediaType()` for fast file type detection
- **Basic Info**: Use `getBasicInfo()` when you only need basic information
- **Full Extraction**: Use `extractMetadata()` for complete analysis
- **Timeout Control**: Set appropriate timeouts for large files

## Examples

### Complete Video Analysis

```typescript
const extractor = new MediaMetadataExtractor('/path/to/ffprobe');

async function analyzeVideo(filePath: string) {
    try {
        const metadata = await extractor.extractMetadata(filePath);
        
        console.log(`File: ${metadata.fileName}`);
        console.log(`Duration: ${metadata.durationFormatted}`);
        console.log(`Size: ${formatFileSize(metadata.fileSize)}`);
        
        if (metadata.primaryVideo) {
            console.log(`Video: ${metadata.primaryVideo.resolution} @ ${metadata.primaryVideo.frameRate}`);
            console.log(`Codec: ${metadata.primaryVideo.codec}`);
        }
        
        if (metadata.primaryAudio) {
            console.log(`Audio: ${metadata.primaryAudio.codec} ${metadata.primaryAudio.channels}ch`);
        }
        
        console.log(`Streams: ${metadata.streams.length} total`);
        console.log(`  Video: ${metadata.videoStreams.length}`);
        console.log(`  Audio: ${metadata.audioStreams.length}`);
        console.log(`  Subtitle: ${metadata.subtitleStreams.length}`);
        
    } catch (error) {
        console.error('Analysis failed:', error.message);
    }
}
```

### Batch Processing

```typescript
async function batchAnalyze(files: string[]) {
    const extractor = new MediaMetadataExtractor('/path/to/ffprobe');
    const results = [];
    
    for (const file of files) {
        try {
            const type = await extractor.getMediaType(file);
            if (type === MediaType.VIDEO) {
                const metadata = await extractor.extractMetadata(file);
                results.push({ file, metadata });
            }
        } catch (error) {
            console.error(`Failed to analyze ${file}:`, error.message);
        }
    }
    
    return results;
}
```

### Media Validation

```typescript
async function validateMediaFiles(files: string[]) {
    const extractor = new MediaMetadataExtractor('/path/to/ffprobe');
    const validFiles = [];
    
    for (const file of files) {
        try {
            const isVideo = await extractor.isVideo(file);
            const isAudio = await extractor.isAudio(file);
            
            if (isVideo || isAudio) {
                validFiles.push(file);
            }
        } catch (error) {
            console.warn(`Invalid file ${file}:`, error.message);
        }
    }
    
    return validFiles;
}
```

## Platform Support

The MediaMetadataExtractor works on all platforms that support Node.js and FFprobe:

- **Windows**: Full support with .exe binaries
- **macOS**: Full support with Unix binaries
- **Linux**: Full support with static binaries

## Dependencies

- **FFprobe**: Required for metadata extraction
- **Node.js**: Version 14.0.0 or higher
- **fs-extra**: For file system operations

## License

This documentation is part of the ffmpeg-lib project. See the main project license for details.