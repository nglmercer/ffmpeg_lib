# FFmpegManager

A comprehensive FFmpeg process management system that provides high-level control over FFmpeg operations with advanced features for monitoring, error handling, and resource management.

## Overview

The `FFmpegManager` class serves as the central orchestrator for all FFmpeg operations in your application. It provides a robust, event-driven interface for executing FFmpeg commands, monitoring progress, handling errors, and managing system resources efficiently.

## Features

- **Process Management**: Complete lifecycle management of FFmpeg processes
- **Progress Monitoring**: Real-time progress tracking with detailed metrics
- **Error Handling**: Comprehensive error detection and recovery mechanisms
- **Resource Management**: Memory and CPU usage optimization
- **Event System**: Rich event system for monitoring and control
- **Queue Management**: Intelligent job queuing and execution
- **Performance Monitoring**: Detailed performance metrics and logging
- **TypeScript Support**: Full TypeScript definitions and interfaces

## Installation

```typescript
import { FFmpegManager, FFmpegEvent, ProcessStatus } from 'ffmpeg-lib';
```

## Basic Usage

```typescript
const manager = new FFmpegManager('/path/to/ffmpeg', '/path/to/ffprobe');

// Execute a simple command
const result = await manager.execute(['-i', 'input.mp4', 'output.avi']);

// Monitor progress
manager.on('progress', (event) => {
    console.log(`Progress: ${event.progress}%`);
    console.log(`Time: ${event.time}`);
    console.log(`Speed: ${event.speed}`);
});

// Handle completion
manager.on('completed', (event) => {
    console.log('Conversion completed successfully');
});
```

## API Reference

### Constructor

#### `new FFmpegManager(ffmpegPath: string, ffprobePath?: string, options?: ManagerOptions)`

Creates a new instance of FFmpegManager.

**Parameters:**
- `ffmpegPath` (string): Path to the FFmpeg executable
- `ffprobePath` (string, optional): Path to the FFprobe executable
- `options` (ManagerOptions, optional): Manager configuration options

**Throws:**
- `Error`: If ffmpegPath is not provided or is invalid

**Example:**
```typescript
const manager = new FFmpegManager('/usr/bin/ffmpeg', '/usr/bin/ffprobe', {
    maxConcurrentProcesses: 2,
    timeout: 300000, // 5 minutes
    logLevel: 'info'
});
```

### Core Methods

#### `execute(args: string[], options?: ExecutionOptions): Promise<ExecutionResult>`

Executes an FFmpeg command with the provided arguments.

**Parameters:**
- `args` (string[]): FFmpeg command arguments
- `options` (ExecutionOptions, optional): Execution configuration options

**Returns:**
- `Promise<ExecutionResult>`: Execution result with status and metrics

**Example:**
```typescript
try {
    const result = await manager.execute([
        '-i', 'input.mp4',
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-b:v', '1000k',
        'output.mp4'
    ], {
        timeout: 60000,
        priority: 'high'
    });
    
    console.log(`Completed in ${result.duration}ms`);
    console.log(`Output size: ${result.outputSize} bytes`);
} catch (error) {
    console.error('Execution failed:', error.message);
}
```

#### `executeWithProgress(args: string[], options?: ExecutionOptions): Promise<ExecutionResult>`

Executes an FFmpeg command with detailed progress monitoring.

**Parameters:**
- `args` (string[]): FFmpeg command arguments
- `options` (ExecutionOptions, optional): Execution configuration options

**Returns:**
- `Promise<ExecutionResult>`: Execution result with progress information

**Example:**
```typescript
const result = await manager.executeWithProgress([
    '-i', 'large_video.mp4',
    '-c:v', 'libx264',
    '-preset', 'slow',
    'compressed.mp4'
]);
```

#### `convert(inputPath: string, outputPath: string, options?: ConversionOptions): Promise<ConversionResult>`

Performs a simple media conversion with intelligent defaults.

**Parameters:**
- `inputPath` (string): Input file path
- `outputPath` (string): Output file path
- `options` (ConversionOptions, optional): Conversion options

**Returns:**
- `Promise<ConversionResult>`: Conversion result with details

**Example:**
```typescript
const result = await manager.convert('input.avi', 'output.mp4', {
    videoCodec: 'libx264',
    audioCodec: 'aac',
    videoBitrate: '1000k',
    audioBitrate: '128k',
    resolution: '1280x720'
});
```

### Process Control Methods

#### `getStatus(): ProcessStatus`

Gets the current status of the manager.

**Returns:**
- `ProcessStatus`: Current manager status

#### `getActiveProcesses(): ProcessInfo[]`

Gets information about currently active processes.

**Returns:**
- `ProcessInfo[]`: Array of active process information

#### `getQueueInfo(): QueueInfo`

Gets information about the current job queue.

**Returns:**
- `QueueInfo`: Queue status and job information

#### `pause(): void`

Pauses the execution queue.

#### `resume(): void`

Resumes the execution queue.

#### `cancel(jobId: string): boolean`

Cancels a specific job.

**Parameters:**
- `jobId` (string): Job identifier to cancel

**Returns:**
- `boolean`: True if job was cancelled successfully

#### `cancelAll(): number`

Cancels all pending and active jobs.

**Returns:**
- `number`: Number of jobs cancelled

### Utility Methods

#### `getVersion(): Promise<string>`

Gets the FFmpeg version information.

**Returns:**
- `Promise<string>`: FFmpeg version string

#### `getCapabilities(): Promise<FFmpegCapabilities>`

Gets available FFmpeg capabilities and codecs.

**Returns:**
- `Promise<FFmpegCapabilities>`: Capabilities information

#### `validateInput(inputPath: string): Promise<boolean>`

Validates if an input file is supported by FFmpeg.

**Parameters:**
- `inputPath` (string): Path to input file

**Returns:**
- `Promise<boolean>`: True if file is valid

#### `estimateFileSize(inputPath: string, options: ConversionOptions): Promise<number>`

Estimates the output file size for a conversion.

**Parameters:**
- `inputPath` (string): Input file path
- `options` (ConversionOptions): Conversion options

**Returns:**
- `Promise<number>`: Estimated file size in bytes

## Interfaces

### ExecutionOptions

Configuration for command execution.

```typescript
interface ExecutionOptions {
    timeout?: number;
    priority?: 'low' | 'normal' | 'high';
    workingDirectory?: string;
    environment?: Record<string, string>;
    onProgress?: (progress: ProgressEvent) => void;
    onError?: (error: ErrorEvent) => void;
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
    outputSize?: number;
    error?: string;
    warnings?: string[];
}
```

### ConversionOptions

Options for media conversion.

```typescript
interface ConversionOptions {
    videoCodec?: string;
    audioCodec?: string;
    videoBitrate?: string;
    audioBitrate?: string;
    resolution?: string;
    fps?: number;
    quality?: number;
    preset?: string;
    tune?: string;
    profile?: string;
    level?: string;
}
```

### ConversionResult

Result of media conversion.

```typescript
interface ConversionResult {
    success: boolean;
    inputPath: string;
    outputPath: string;
    duration: number;
    inputSize: number;
    outputSize: number;
    compressionRatio: number;
    videoCodec: string;
    audioCodec: string;
    resolution: string;
    fps: number;
}
```

### ProcessInfo

Information about an active process.

```typescript
interface ProcessInfo {
    id: string;
    command: string;
    status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    startTime: Date;
    estimatedEndTime?: Date;
    inputFile?: string;
    outputFile?: string;
    pid?: number;
}
```

### QueueInfo

Information about the job queue.

```typescript
interface QueueInfo {
    pending: number;
    active: number;
    completed: number;
    failed: number;
    total: number;
    estimatedCompletionTime?: Date;
}
```

### ManagerOptions

Configuration options for the manager.

```typescript
interface ManagerOptions {
    maxConcurrentProcesses?: number;
    timeout?: number;
    logLevel?: 'error' | 'warn' | 'info' | 'debug';
    enableMetrics?: boolean;
    autoCleanup?: boolean;
    retryAttempts?: number;
    retryDelay?: number;
}
```

## Events

### Progress Event

Emitted during command execution to report progress.

```typescript
interface ProgressEvent {
    jobId: string;
    progress: number;
    time: string;
    bitrate: string;
    speed: string;
    fps: number;
    frame: number;
    size: string;
}
```

### Error Event

Emitted when an error occurs during execution.

```typescript
interface ErrorEvent {
    jobId: string;
    error: string;
    exitCode?: number;
    stderr?: string;
}
```

### Completion Event

Emitted when a job completes successfully.

```typescript
interface CompletionEvent {
    jobId: string;
    duration: number;
    outputSize?: number;
    result: ExecutionResult;
}
```

## Event Handling

### Basic Event Handling

```typescript
// Listen for progress updates
manager.on('progress', (event: ProgressEvent) => {
    console.log(`Job ${event.jobId}: ${event.progress}% complete`);
    console.log(`Speed: ${event.speed}, FPS: ${event.fps}`);
});

// Listen for errors
manager.on('error', (event: ErrorEvent) => {
    console.error(`Job ${event.jobId} failed:`, event.error);
});

// Listen for completions
manager.on('completed', (event: CompletionEvent) => {
    console.log(`Job ${event.jobId} completed in ${event.duration}ms`);
});
```

### Advanced Event Handling

```typescript
// Monitor specific job
const jobId = await manager.execute([/* command */]);

manager.on('progress', (event) => {
    if (event.jobId === jobId) {
        updateProgressBar(event.progress);
    }
});

// Handle different error types
manager.on('error', (event) => {
    if (event.exitCode === 1) {
        console.error('FFmpeg error:', event.stderr);
    } else if (event.exitCode === 127) {
        console.error('FFmpeg not found');
    } else {
        console.error('Unknown error:', event.error);
    }
});
```

## Error Handling

The manager provides comprehensive error handling:

```typescript
try {
    const result = await manager.execute([
        '-i', 'input.mp4',
        '-c:v', 'invalid_codec',
        'output.mp4'
    ]);
} catch (error) {
    if (error.message.includes('Unknown encoder')) {
        console.error('Codec not supported');
    } else if (error.message.includes('No such file')) {
        console.error('Input file not found');
    } else {
        console.error('Execution failed:', error.message);
    }
}
```

## Performance Monitoring

### Basic Metrics

```typescript
const manager = new FFmpegManager('/path/to/ffmpeg', '/path/to/ffprobe', {
    enableMetrics: true
});

// Get performance metrics
const metrics = manager.getMetrics();
console.log(`Total executions: ${metrics.totalExecutions}`);
console.log(`Average duration: ${metrics.averageDuration}ms`);
console.log(`Success rate: ${metrics.successRate}%`);
```

### Advanced Monitoring

```typescript
// Monitor resource usage
manager.on('progress', (event) => {
    const status = manager.getStatus();
    console.log(`Active processes: ${status.activeProcesses}`);
    console.log(`Queue size: ${status.queueSize}`);
});

// Monitor queue performance
setInterval(() => {
    const queueInfo = manager.getQueueInfo();
    console.log(`Queue: ${queueInfo.pending} pending, ${queueInfo.active} active`);
    console.log(`Success rate: ${(queueInfo.completed / queueInfo.total * 100).toFixed(1)}%`);
}, 5000);
```

## Examples

### Batch Processing

```typescript
async function batchConvert(files: string[]) {
    const manager = new FFmpegManager('/usr/bin/ffmpeg');
    const results = [];
    
    for (const file of files) {
        try {
            const outputPath = file.replace(/\.[^.]+$/, '.mp4');
            const result = await manager.convert(file, outputPath, {
                videoCodec: 'libx264',
                audioCodec: 'aac',
                videoBitrate: '1000k'
            });
            results.push({ file, success: true, result });
        } catch (error) {
            results.push({ file, success: false, error: error.message });
        }
    }
    
    return results;
}
```

### Progress Monitoring

```typescript
async function convertWithProgress(inputPath: string, outputPath: string) {
    const manager = new FFmpegManager('/usr/bin/ffmpeg');
    
    return new Promise((resolve, reject) => {
        let lastProgress = 0;
        
        manager.on('progress', (event) => {
            if (event.progress > lastProgress + 5) {
                console.log(`Progress: ${event.progress}%`);
                console.log(`Time: ${event.time}, Speed: ${event.speed}`);
                lastProgress = event.progress;
            }
        });
        
        manager.on('completed', (event) => {
            console.log('Conversion completed!');
            resolve(event);
        });
        
        manager.on('error', (event) => {
            console.error('Conversion failed:', event.error);
            reject(new Error(event.error));
        });
        
        manager.execute([
            '-i', inputPath,
            '-c:v', 'libx264',
            '-preset', 'medium',
            outputPath
        ]).catch(reject);
    });
}
```

### Queue Management

```typescript
class ConversionQueue {
    private manager: FFmpegManager;
    
    constructor(ffmpegPath: string) {
        this.manager = new FFmpegManager(ffmpegPath, '', {
            maxConcurrentProcesses: 3,
            timeout: 300000
        });
    }
    
    async addJob(inputPath: string, outputPath: string, options: ConversionOptions) {
        const jobId = await this.manager.execute([
            '-i', inputPath,
            '-c:v', options.videoCodec || 'libx264',
            '-c:a', options.audioCodec || 'aac',
            outputPath
        ]);
        
        return jobId;
    }
    
    getQueueStatus() {
        return this.manager.getQueueInfo();
    }
    
    pause() {
        this.manager.pause();
    }
    
    resume() {
        this.manager.resume();
    }
    
    cancelJob(jobId: string) {
        return this.manager.cancel(jobId);
    }
}
```

### Error Recovery

```typescript
async function robustConversion(inputPath: string, outputPath: string, retries = 3) {
    const manager = new FFmpegManager('/usr/bin/ffmpeg', '', {
        retryAttempts: retries,
        retryDelay: 5000
    });
    
    try {
        const result = await manager.convert(inputPath, outputPath, {
            videoCodec: 'libx264',
            preset: 'slow',
            videoBitrate: '2000k'
        });
        
        return result;
    } catch (error) {
        console.error('Conversion failed after retries:', error.message);
        throw error;
    }
}
```

## Platform Support

The FFmpegManager works on all platforms that support Node.js and FFmpeg:

- **Windows**: Full support with .exe binaries
- **macOS**: Full support with Unix binaries
- **Linux**: Full support with static binaries

## Dependencies

- **FFmpeg**: Required for media processing
- **FFprobe**: Optional but recommended for media analysis
- **Node.js**: Version 14.0.0 or higher
- **EventEmitter**: For event handling

## License

This documentation is part of the ffmpeg-lib project. See the main project license for details.