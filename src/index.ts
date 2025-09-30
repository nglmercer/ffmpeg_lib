import { FFmpegManager } from './FFmpegManager.js';
import { spawn } from 'child_process';
import path from 'path';

export interface FFmpegOptions {
    inputPath: string;
    outputPath: string;
    codec?: string;
    bitrate?: string;
    resolution?: string;
    framerate?: number;
    audioBitrate?: string;
    audioCodec?: string;
    overwrite?: boolean;
}

export interface FFmpegProgress {
    frame: number;
    fps: number;
    bitrate: string;
    time: string;
    speed: number;
}

export class FFmpegWrapper {
    private ffmpegManager: FFmpegManager;

    constructor() {
        this.ffmpegManager = new FFmpegManager();
    }

    async convertVideo(options: FFmpegOptions): Promise<void> {
        await this.ffmpegManager.verifyFFmpeg();
        
        const ffmpegPath = this.ffmpegManager.getFFmpegPath();
        const args = this.buildFFmpegArgs(options);

        return new Promise((resolve, reject) => {
            const ffmpeg = spawn(ffmpegPath, args);
            
            ffmpeg.stderr.on('data', (data) => {
                const output = data.toString();
                console.log(output);
            });

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`FFmpeg process exited with code ${code}`));
                }
            });

            ffmpeg.on('error', reject);
        });
    }

    async convertVideoWithProgress(
        options: FFmpegOptions, 
        onProgress?: (progress: FFmpegProgress) => void
    ): Promise<void> {
        await this.ffmpegManager.verifyFFmpeg();
        
        const ffmpegPath = this.ffmpegManager.getFFmpegPath();
        const args = this.buildFFmpegArgs(options);

        return new Promise((resolve, reject) => {
            const ffmpeg = spawn(ffmpegPath, args);
            
            ffmpeg.stderr.on('data', (data) => {
                const output = data.toString();
                
                if (onProgress) {
                    const progress = this.parseProgress(output);
                    if (progress) {
                        onProgress(progress);
                    }
                }
                
                console.log(output);
            });

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`FFmpeg process exited with code ${code}`));
                }
            });

            ffmpeg.on('error', reject);
        });
    }

    private buildFFmpegArgs(options: FFmpegOptions): string[] {
        const args: string[] = [
            '-i', options.inputPath
        ];

        if (options.codec) {
            args.push('-c:v', options.codec);
        }

        if (options.bitrate) {
            args.push('-b:v', options.bitrate);
        }

        if (options.resolution) {
            args.push('-s', options.resolution);
        }

        if (options.framerate) {
            args.push('-r', options.framerate.toString());
        }

        if (options.audioCodec) {
            args.push('-c:a', options.audioCodec);
        }

        if (options.audioBitrate) {
            args.push('-b:a', options.audioBitrate);
        }

        if (options.overwrite) {
            args.push('-y');
        }

        args.push(options.outputPath);

        return args;
    }

    private parseProgress(output: string): FFmpegProgress | null {
        // Parse FFmpeg progress output
        const frameMatch = output.match(/frame=\s*(\d+)/);
        const fpsMatch = output.match(/fps=\s*(\d+\.?\d*)/);
        const bitrateMatch = output.match(/bitrate=\s*(\S+)/);
        const timeMatch = output.match(/time=\s*(\S+)/);
        const speedMatch = output.match(/speed=\s*(\d+\.?\d*)x/);

        if (frameMatch && fpsMatch && bitrateMatch && timeMatch && speedMatch) {
            return {
                frame: parseInt(frameMatch[1]),
                fps: parseFloat(fpsMatch[1]),
                bitrate: bitrateMatch[1],
                time: timeMatch[1],
                speed: parseFloat(speedMatch[1])
            };
        }

        return null;
    }

    async getVideoInfo(inputPath: string): Promise<any> {
        await this.ffmpegManager.verifyFFmpeg();
        
        const ffmpegPath = this.ffmpegManager.getFFmpegPath();

        return new Promise((resolve, reject) => {
            const ffmpeg = spawn(ffmpegPath, ['-i', inputPath]);
            
            let stderr = '';
            
            ffmpeg.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            ffmpeg.on('close', (code) => {
                // FFmpeg always returns non-zero when using -i without output
                const info = this.parseVideoInfo(stderr);
                if (info) {
                    resolve(info);
                } else {
                    reject(new Error('Could not parse video information'));
                }
            });

            ffmpeg.on('error', reject);
        });
    }

    private parseVideoInfo(output: string): any {
        const durationMatch = output.match(/Duration: (\d+:\d+:\d+\.\d+)/);
        const bitrateMatch = output.match(/bitrate: (\d+) kb\/s/);
        const videoStreamMatch = output.match(/Stream #\d+:\d+(?:\(\w+\))?: Video: ([^,]+)/);
        const audioStreamMatch = output.match(/Stream #\d+:\d+(?:\(\w+\))?: Audio: ([^,]+)/);

        if (durationMatch) {
            return {
                duration: durationMatch[1],
                bitrate: bitrateMatch ? parseInt(bitrateMatch[1]) : null,
                videoCodec: videoStreamMatch ? videoStreamMatch[1] : null,
                audioCodec: audioStreamMatch ? audioStreamMatch[1] : null
            };
        }

        return null;
    }

    async updateFFmpeg(): Promise<void> {
        await this.ffmpegManager.downloadFFmpegBinaries();
    }

    async isFFmpegAvailable(): Promise<boolean> {
        return await this.ffmpegManager.isFFmpegAvailable();
    }
}

// Export the main class
export { FFmpegManager };

// Export default instance for convenience
export const ffmpeg = new FFmpegWrapper();