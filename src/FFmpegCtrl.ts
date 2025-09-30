import { spawn, ChildProcess } from 'child_process';
import path from 'path';

interface VideoInfo {
    format?: any;
    streams?: any[];
}

interface ProcessOptions {
    videoCodec?: string;
    audioCodec?: string;
    videoBitrate?: string;
    audioBitrate?: string;
    resolution?: string;
    framerate?: number;
    onProgress?: (progress: ProgressInfo) => void;
}

interface ProgressInfo {
    time: string;
    bitrate: number | null;
    speed: number | null;
}

interface ProcessResult {
    outputFile: string;
    stderr: string;
}

class FFmpegCtrl {
    public ffmpegPath: string;
    public ffprobePath: string;

    constructor(ffmpegPath: string, ffprobePath: string) {
        this.ffmpegPath = ffmpegPath;
        this.ffprobePath = ffprobePath;
    }

    async getVideoInfo(inputFile: string): Promise<VideoInfo | null> {
        return new Promise((resolve, reject) => {
            const args = [
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                inputFile
            ];

            const ffprobe = spawn(this.ffprobePath, args);
            let stdout = '';
            let stderr = '';

            ffprobe.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            ffprobe.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            ffprobe.on('close', (code) => {
                if (code === 0) {
                    try {
                        const info = JSON.parse(stdout);
                        resolve(info);
                    } catch (parseError) {
                        reject(new Error(`Failed to parse FFprobe output:`,{cause: parseError}));
                    }
                } else {
                    reject(new Error(`FFprobe failed with code ${code}: ${stderr}`));
                }
            });

            ffprobe.on('error', (error) => {
                reject(new Error(`FFprobe execution failed: ${error.message}`));
            });
        });
    }

    async processVideo(inputFile: string, outputFile: string, options: ProcessOptions = {}): Promise<ProcessResult> {
        const {
            videoCodec = 'libx264',
            audioCodec = 'aac',
            videoBitrate = '2000k',
            audioBitrate = '128k',
            resolution = '1920x1080',
            framerate = 30,
            onProgress = null
        } = options;

        return new Promise((resolve, reject) => {
            const args = [
                '-i', inputFile,
                '-c:v', videoCodec,
                '-b:v', videoBitrate,
                '-c:a', audioCodec,
                '-b:a', audioBitrate,
                '-s', resolution,
                '-r', framerate.toString(),
                '-y', // Overwrite output file
                outputFile
            ];

            const ffmpeg = spawn(this.ffmpegPath, args);
            let stderr = '';

            ffmpeg.stderr.on('data', (data) => {
                const line = data.toString();
                stderr += line;

                // Parse progress information
                if (onProgress) {
                    const progress = this.parseProgress(line);
                    if (progress) {
                        onProgress(progress);
                    }
                }
            });

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve({ outputFile, stderr });
                } else {
                    reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
                }
            });

            ffmpeg.on('error', (error) => {
                reject(new Error(`FFmpeg execution failed: ${error.message}`));
            });
        });
    }

    private parseProgress(line: string): ProgressInfo | null {
        // Parse FFmpeg progress output
        const timeMatch = line.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
        const bitrateMatch = line.match(/bitrate=\s*([\d.]+)\s*kbits\/s/);
        const speedMatch = line.match(/speed=\s*([\d.]+)x/);

        if (timeMatch) {
            return {
                time: timeMatch[1],
                bitrate: bitrateMatch ? parseFloat(bitrateMatch[1]) : null,
                speed: speedMatch ? parseFloat(speedMatch[1]) : null
            };
        }

        return null;
    }

    async createThumbnail(inputFile: string, outputFile: string, time: string = '00:00:01'): Promise<ProcessResult> {
        return new Promise((resolve, reject) => {
            const args = [
                '-i', inputFile,
                '-ss', time,
                '-vframes', '1',
                '-q:v', '2',
                '-y',
                outputFile
            ];

            const ffmpeg = spawn(this.ffmpegPath, args);
            let stderr = '';

            ffmpeg.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve({ outputFile, stderr });
                } else {
                    reject(new Error(`FFmpeg thumbnail creation failed: ${stderr}`));
                }
            });

            ffmpeg.on('error', (error) => {
                reject(new Error(`FFmpeg execution failed: ${error.message}`));
            });
        });
    }

    async extractAudio(inputFile: string, outputFile: string, format: string = 'mp3'): Promise<ProcessResult> {
        return new Promise((resolve, reject) => {
            const args = [
                '-i', inputFile,
                '-vn', // No video
                '-acodec', format === 'mp3' ? 'libmp3lame' : 'aac',
                '-b:a', '192k',
                '-y',
                outputFile
            ];

            const ffmpeg = spawn(this.ffmpegPath, args);
            let stderr = '';

            ffmpeg.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve({ outputFile, stderr });
                } else {
                    reject(new Error(`FFmpeg audio extraction failed: ${stderr}`));
                }
            });

            ffmpeg.on('error', (error) => {
                reject(new Error(`FFmpeg execution failed: ${error.message}`));
            });
        });
    }
}

export { FFmpegCtrl };