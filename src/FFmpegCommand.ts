import { execFile, spawn } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs-extra';
import { FFmpegManager } from './FFmpegManager';

export interface FFmpegOptions {
    ffmpegPath?: string;
    ffprobePath?: string;
    timeout?: number;
}

export interface VideoOptions {
    codec?: string;
    bitrate?: string;
    fps?: number;
    size?: string;
    aspect?: string;
}

export interface AudioOptions {
    codec?: string;
    bitrate?: string;
    channels?: number;
    frequency?: number;
}

export interface ProgressInfo {
    frames: number;
    currentFps: number;
    currentKbps: number;
    targetSize: number;
    timemark: string;
    percent?: number;
    totalDuration?: number;
}

export interface ScreenshotOptions {
    timestamps?: string[] | number[];
    count?: number;
    folder?: string;
    filename?: string;
    size?: string;
}

export interface ProbeData {
    format: {
        filename: string;
        format_name: string;
        format_long_name: string;
        duration: number;
        size: number;
        bit_rate: number;
    };
    streams: Array<{
        index: number;
        codec_name: string;
        codec_long_name?: string;
        profile?: string;
        codec_type: 'video' | 'audio' | 'subtitle';
        width?: number;
        height?: number;
        duration?: number;
        bit_rate?: number;
        sample_rate?: number;
        channels?: number;
        channel_layout?: string;
        tags?: Record<string, string>;
        disposition?: Record<string, number>;
    }>;
}

export class FFmpegCommand extends EventEmitter {
    private ffmpegPath: string;
    private ffprobePath: string;
    private inputFiles: string[] = [];
    private inputPerFileOpts: string[][] = [];
    private outputFile: string = '';
    private inputOpts: string[] = [];
    private outputOpts: string[] = [];
    private videoFiltersArray: string[] = [];
    private audioFiltersArray: string[] = [];
    private complexFiltersArray: string[] = [];
    private timeout?: number;
    private killed = false;
    private totalDuration: number = 0; // Duración total del input
    
    private tokenizeOptionString(str: string): string[] {
        return tokenizeOptionStringInternal(str);
    }

    constructor(options?: FFmpegOptions) {
        super();
        
        const manager = new FFmpegManager();
        this.ffmpegPath = options?.ffmpegPath || manager.getFFmpegPath();
        this.ffprobePath = options?.ffprobePath || manager.getFFprobePath();
        this.timeout = options?.timeout;
    }

    // ==================== INPUT/OUTPUT ====================
    
    input(source: string): this {
        this.inputFiles.push(source);
        this.inputPerFileOpts.push([]);
        return this;
    }

    output(target: string): this {
        this.outputFile = target;
        return this;
    }

    save(filename: string): this {
        this.outputFile = filename;
        return this;
    }

    // ==================== VIDEO METHODS ====================
    
    videoCodec(codec: string): this {
        this.outputOpts.push('-c:v', codec);
        return this;
    }

    videoBitrate(bitrate: string | number): this {
        const bitrateStr = typeof bitrate === 'number' ? `${bitrate}k` : bitrate;
        this.outputOpts.push('-b:v', bitrateStr);
        return this;
    }

    fps(fps: number): this {
        this.outputOpts.push('-r', fps.toString());
        return this;
    }

    size(size: string): this {
        this.outputOpts.push('-s', size);
        return this;
    }

    aspect(aspect: string): this {
        this.outputOpts.push('-aspect', aspect);
        return this;
    }

    autopad(color: string = 'black'): this {
        this.videoFiltersArray.push(`pad=iw:ih:(ow-iw)/2:(oh-ih)/2:${color}`);
        return this;
    }

    keepDAR(): this {
        this.outputOpts.push('-aspect', '0');
        return this;
    }

    noVideo(): this {
        this.outputOpts.push('-vn');
        return this;
    }

    // ==================== AUDIO METHODS ====================
    
    audioCodec(codec: string): this {
        this.outputOpts.push('-c:a', codec);
        return this;
    }

    audioBitrate(bitrate: string | number): this {
        const bitrateStr = typeof bitrate === 'number' ? `${bitrate}k` : bitrate;
        this.outputOpts.push('-b:a', bitrateStr);
        return this;
    }

    audioChannels(channels: number): this {
        this.outputOpts.push('-ac', channels.toString());
        return this;
    }

    audioFrequency(freq: number): this {
        this.outputOpts.push('-ar', freq.toString());
        return this;
    }

    noAudio(): this {
        this.outputOpts.push('-an');
        return this;
    }

    // ==================== FORMAT METHODS ====================
    
    format(format: string): this {
        this.outputOpts.push('-f', format);
        return this;
    }

    toFormat(format: string): this {
        return this.format(format);
    }

    // ==================== PROCESSING METHODS ====================
    
    seek(time: string | number): this {
        const timeStr = typeof time === 'number' ? time.toString() : time;
        this.outputOpts.push('-ss', timeStr);
        return this;
    }

    seekInput(time: string | number): this {
        const timeStr = typeof time === 'number' ? time.toString() : time;
        this.inputOpts.push('-ss', timeStr);
        return this;
    }

    duration(duration: string | number): this {
        const durationStr = typeof duration === 'number' ? duration.toString() : duration;
        this.outputOpts.push('-t', durationStr);
        return this;
    }

    setStartTime(time: string | number): this {
        return this.seek(time);
    }

    setDuration(duration: string | number): this {
        return this.duration(duration);
    }

    loop(duration?: string | number): this {
        this.inputOpts.push('-loop', '1');
        if (duration) {
            this.duration(duration);
        }
        return this;
    }

    // ==================== FILTERS ====================
    
    videoFilters(filters: string | string[]): this {
        const filtersArray = Array.isArray(filters) ? filters : [filters];
        this.videoFiltersArray.push(...filtersArray);
        return this;
    }

    audioFilters(filters: string | string[]): this {
        const filtersArray = Array.isArray(filters) ? filters : [filters];
        this.audioFiltersArray.push(...filtersArray);
        return this;
    }

    complexFilter(filters: string | string[]): this {
        const filtersArray = Array.isArray(filters) ? filters : [filters];
        this.complexFiltersArray.push(...filtersArray);
        return this;
    }

    // ==================== OPTIONS ====================
    
    outputOptions(options: string | string[]): this {
        const optsArray = Array.isArray(options) ? options : [options];
        for (const opt of optsArray) {
            if (typeof opt === 'string') {
                const tokens = this.tokenizeOptionString(opt);
                this.outputOpts.push(...tokens);
            } else {
                this.outputOpts.push(opt as any);
            }
        }
        return this;
    }

    inputOptions(options: string | string[]): this {
        const optsArray = Array.isArray(options) ? options : [options];
        for (const opt of optsArray) {
            if (typeof opt === 'string') {
                const tokens = this.tokenizeOptionString(opt);
                this.inputOpts.push(...tokens);
            } else {
                this.inputOpts.push(opt as any);
            }
        }
        return this;
    }

    inputWithOptions(source: string, options: string | string[]): this {
        const tokens = Array.isArray(options)
            ? options.flatMap(opt => (typeof opt === 'string' ? this.tokenizeOptionString(opt) : [opt as any]))
            : this.tokenizeOptionString(options);
        this.inputFiles.push(source);
        this.inputPerFileOpts.push(tokens);
        return this;
    }

    inputLavfi(source: string): this {
        return this.inputWithOptions(source, ['-f', 'lavfi']);
    }

    preset(preset: string): this {
        this.outputOpts.push('-preset', preset);
        return this;
    }

    native(): this {
        this.inputOpts.push('-re');
        return this;
    }

    // ==================== EXECUTION ====================
    
    private buildArgs(): string[] {
        const args: string[] = ['-y']; // overwrite output

        // Agregar progreso en formato parseable
        args.push('-progress', 'pipe:1');

        if (this.inputOpts.length > 0) {
            args.push(...this.inputOpts);
        }

        for (let i = 0; i < this.inputFiles.length; i++) {
            const perInputOpts = this.inputPerFileOpts[i] || [];
            if (perInputOpts.length > 0) {
                args.push(...perInputOpts);
            }
            args.push('-i', this.inputFiles[i]);
        }

        if (this.complexFiltersArray.length > 0) {
            args.push('-filter_complex', this.complexFiltersArray.join(';'));
        }

        if (this.videoFiltersArray.length > 0) {
            args.push('-vf', this.videoFiltersArray.join(','));
        }

        if (this.audioFiltersArray.length > 0) {
            args.push('-af', this.audioFiltersArray.join(','));
        }

        if (this.outputOpts.length > 0) {
            args.push(...this.outputOpts);
        }

        if (this.outputFile) {
            args.push(this.outputFile);
        }

        return args;
    }

    /**
     * Obtiene la duración del input antes de procesar
     */
    private async getDuration(inputPath: string): Promise<number> {
        try {
            const probeData = await FFmpegCommand.probe(inputPath, {
                ffprobePath: this.ffprobePath
            });
            return probeData.format.duration || 0;
        } catch (error) {
            return 0;
        }
    }

    async run(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            if (this.inputFiles.length === 0) {
                return reject(new Error('No input file specified'));
            }

            if (!this.outputFile) {
                return reject(new Error('No output file specified'));
            }

            // Obtener duración del primer input
            if (this.inputFiles.length > 0 && this.inputFiles[0] !== 'pipe:0') {
                this.totalDuration = await this.getDuration(this.inputFiles[0]);
            }

            const args = this.buildArgs();
            
            this.emit('start', `ffmpeg ${args.join(' ')}`);

            const process = spawn(this.ffmpegPath, args);
            
            let stderr = '';
            let stdout = '';

            if (this.timeout) {
                setTimeout(() => {
                    if (!this.killed) {
                        this.killed = true;
                        process.kill('SIGKILL');
                        reject(new Error('FFmpeg process timeout'));
                    }
                }, this.timeout);
            }

            // Capturar stdout para progress
            process.stdout.on('data', (data) => {
                stdout += data.toString();
                const progress = this.parseProgressOutput(stdout);
                if (progress) {
                    this.emit('progress', progress);
                }
            });

            // Capturar stderr para información adicional
            process.stderr.on('data', (data) => {
                stderr += data.toString();
                
                // También intentar parsear progreso del stderr como fallback
                const progress = this.parseStderrProgress(stderr);
                if (progress) {
                    this.emit('progress', progress);
                }
            });

            process.on('error', (error) => {
                reject(error);
            });

            process.on('close', (code) => {
                if (this.killed) return;

                if (code === 0) {
                    this.emit('end');
                    resolve();
                } else {
                    reject(new Error(`FFmpeg exited with code ${code}\n${stderr}`));
                }
            });
        });
    }

    /**
     * Parsea la salida de progreso de FFmpeg (stdout con -progress pipe:1)
     */
    private parseProgressOutput(output: string): ProgressInfo | null {
        const lines = output.split('\n');
        const progressData: any = {};

        for (const line of lines) {
            const [key, value] = line.split('=');
            if (key && value) {
                progressData[key.trim()] = value.trim();
            }
        }

        if (!progressData.out_time_ms && !progressData.out_time) {
            return null;
        }

        // Calcular progreso basado en tiempo
        let processedMicroseconds = 0;
        if (progressData.out_time_ms) {
            processedMicroseconds = parseInt(progressData.out_time_ms);
        } else if (progressData.out_time) {
            processedMicroseconds = this.timeToMicroseconds(progressData.out_time);
        }

        const processedSeconds = processedMicroseconds / 1000000;
        const percent = this.totalDuration > 0 
            ? (processedSeconds / this.totalDuration) * 100 
            : 0;

        return {
            frames: parseInt(progressData.frame) || 0,
            currentFps: parseFloat(progressData.fps) || 0,
            currentKbps: parseFloat(progressData.bitrate?.replace('kbits/s', '')) || 0,
            targetSize: parseInt(progressData.total_size) || 0,
            timemark: this.microsecondsToTime(processedMicroseconds),
            percent: Math.min(100, Math.max(0, percent)),
            totalDuration: this.totalDuration
        };
    }

    /**
     * Parsea progreso del stderr (método legacy)
     */
    private parseStderrProgress(stderr: string): ProgressInfo | null {
        const timeMatch = stderr.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        const framesMatch = stderr.match(/frame=\s*(\d+)/);
        const fpsMatch = stderr.match(/fps=\s*(\d+\.?\d*)/);
        const bitrateMatch = stderr.match(/bitrate=\s*(\d+\.?\d*)kbits\/s/);
        const sizeMatch = stderr.match(/size=\s*(\d+)kB/);

        if (!timeMatch) return null;

        const timemark = timeMatch[0].replace('time=', '');
        const parts = timemark.split(':');
        const hours = parseFloat(parts[0]);
        const minutes = parseFloat(parts[1]);
        const seconds = parseFloat(parts[2]);
        const processedSeconds = hours * 3600 + minutes * 60 + seconds;

        const percent = this.totalDuration > 0 
            ? (processedSeconds / this.totalDuration) * 100 
            : 0;

        return {
            frames: framesMatch ? parseInt(framesMatch[1]) : 0,
            currentFps: fpsMatch ? parseFloat(fpsMatch[1]) : 0,
            currentKbps: bitrateMatch ? parseFloat(bitrateMatch[1]) : 0,
            targetSize: sizeMatch ? parseInt(sizeMatch[1]) : 0,
            timemark,
            percent: Math.min(100, Math.max(0, percent)),
            totalDuration: this.totalDuration
        };
    }

    /**
     * Convierte tiempo HH:MM:SS.MS a microsegundos
     */
    private timeToMicroseconds(time: string): number {
        const parts = time.split(':');
        if (parts.length !== 3) return 0;

        const hours = parseFloat(parts[0]);
        const minutes = parseFloat(parts[1]);
        const seconds = parseFloat(parts[2]);

        return (hours * 3600 + minutes * 60 + seconds) * 1000000;
    }

    /**
     * Convierte microsegundos a formato HH:MM:SS.MS
     */
    private microsecondsToTime(microseconds: number): string {
        const totalSeconds = microseconds / 1000000;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = (totalSeconds % 60).toFixed(2);

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.padStart(5, '0')}`;
    }

    // ==================== PROBE ====================
    
    static async probe(file: string, options?: FFmpegOptions): Promise<any> {
        const manager = new FFmpegManager();
        const ffprobePath = options?.ffprobePath || manager.getFFprobePath();

        return new Promise((resolve, reject) => {
            const args = [
                '-v', 'error',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                file
            ];

            execFile(ffprobePath, args, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`FFprobe error: ${stderr || error.message}`));
                    return;
                }

                try {
                    const data = JSON.parse(stdout);
                    resolve(data);
                } catch (parseError) {
                    reject(new Error('Failed to parse FFprobe output'));
                }
            });
        });
    }

    // ==================== SCREENSHOTS ====================
    
    async screenshots(options: any): Promise<string[]> {
        const folder = options.folder || './screenshots';
        await fs.ensureDir(folder);

        const filename = options.filename || 'screenshot-%i.png';
        const outputPattern = path.join(folder, filename);

        if (options.timestamps) {
            const screenshots: string[] = [];
            
            for (let i = 0; i < options.timestamps.length; i++) {
                const timestamp = options.timestamps[i];
                const outputFile = path.join(folder, filename.replace('%i', (i + 1).toString()));
                
                const cmd = new FFmpegCommand({ 
                    ffmpegPath: this.ffmpegPath,
                    ffprobePath: this.ffprobePath 
                });
                
                cmd.input(this.inputFiles[0])
                    .seekInput(timestamp)
                    .outputOptions(['-vframes', '1']);
                
                if (options.size) {
                    cmd.size(options.size);
                }
                
                cmd.output(outputFile);
                
                await cmd.run();
                screenshots.push(outputFile);
            }
            
            return screenshots;
        } else if (options.count) {
            this.outputOptions([
                '-vf', `fps=1/${options.count}`,
                '-vframes', options.count.toString()
            ]);
            
            if (options.size) {
                this.size(options.size);
            }
            
            this.output(outputPattern);
            await this.run();
            
            const files = await fs.readdir(folder);
            return files
                .filter(f => f.startsWith('screenshot-'))
                .map(f => path.join(folder, f));
        }

        throw new Error('Either timestamps or count must be specified');
    }

    // ==================== UTILITIES ====================
    
    kill(signal: string = 'SIGKILL'): void {
        this.killed = true;
    }

    clone(): FFmpegCommand {
        const cloned = new FFmpegCommand({
            ffmpegPath: this.ffmpegPath,
            ffprobePath: this.ffprobePath,
            timeout: this.timeout
        });
        
        cloned.inputFiles = [...this.inputFiles];
        cloned.inputPerFileOpts = this.inputPerFileOpts.map(arr => [...arr]);
        cloned.outputFile = this.outputFile;
        cloned.inputOpts = [...this.inputOpts];
        cloned.outputOpts = [...this.outputOpts];
        cloned.videoFiltersArray = [...this.videoFiltersArray];
        cloned.audioFiltersArray = [...this.audioFiltersArray];
        cloned.complexFiltersArray = [...this.complexFiltersArray];
        
        return cloned;
    }
}

export function tokenizeOptionStringInternal(str: string): string[] {
    const tokens: string[] = [];
    const regex = /"([^"]*)"|'([^']*)'|[^\s]+/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(str)) !== null) {
        const quotedDouble = match[1];
        const quotedSingle = match[2];
        const unquoted = match[0];
        if (quotedDouble !== undefined) {
            tokens.push(quotedDouble);
        } else if (quotedSingle !== undefined) {
            tokens.push(quotedSingle);
        } else {
            tokens.push(unquoted);
        }
    }
    return tokens;
}
