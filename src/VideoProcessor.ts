import fs from 'fs-extra';
import path from 'path';
import { FFmpegManager } from './FFmpegManager.js';
import { FFmpegCtrl } from './FFmpegCtrl.js';

interface QualityProfile {
    resolution: string;
    videoBitrate: string;
    audioBitrate: string;
    suffix: string;
}

interface ProcessResult {
    qualities: { [key: string]: QualityResult };
    thumbnail: string | null;
    audio: string | null;
    originalInfo: any;
}

interface QualityResult {
    file: string;
    profile: QualityProfile;
    success: boolean;
    error?: string;
}

class VideoProcessor {
    private ffmpegManager: FFmpegManager;
    private ffmpegCtrl: FFmpegCtrl | null;
    public qualityProfiles: { [key: string]: QualityProfile };

    constructor() {
        this.ffmpegManager = new FFmpegManager();
        this.ffmpegCtrl = null;
        this.qualityProfiles = {
            '1080p': {
                resolution: '1920x1080',
                videoBitrate: '4000k',
                audioBitrate: '192k',
                suffix: '_1080p'
            },
            '720p': {
                resolution: '1280x720',
                videoBitrate: '2500k',
                audioBitrate: '128k',
                suffix: '_720p'
            },
            '480p': {
                resolution: '854x480',
                videoBitrate: '1500k',
                audioBitrate: '96k',
                suffix: '_480p'
            },
            '360p': {
                resolution: '640x360',
                videoBitrate: '800k',
                audioBitrate: '64k',
                suffix: '_360p'
            }
        };
    }

    async processVideo(inputFile: string, outputDir: string): Promise<ProcessResult> {
        console.log(`Processing video: ${inputFile}`);
        
        // Verify input file exists
        if (!(await fs.pathExists(inputFile))) {
            throw new Error(`Input file not found: ${inputFile}`);
        }

        // Ensure output directory exists
        await fs.ensureDir(outputDir);

        // Initialize FFmpeg
        await this.initializeFFmpeg();

        // Get video information
        const videoInfo = await this.ffmpegCtrl!.getVideoInfo(inputFile);
        console.log('Video information:', JSON.stringify(videoInfo, null, 2));

        // Process video in multiple qualities
        const results = await this.processMultipleQualities(inputFile, outputDir, videoInfo);

        // Create thumbnail
        const thumbnailPath = await this.createThumbnail(inputFile, outputDir);

        // Extract audio
        const audioPath = await this.extractAudio(inputFile, outputDir);

        return {
            qualities: results,
            thumbnail: thumbnailPath,
            audio: audioPath,
            originalInfo: videoInfo
        };
    }

    private async initializeFFmpeg(): Promise<void> {
        const { ffmpegPath, ffprobePath } = await this.ffmpegManager.verifyBinaries();
        this.ffmpegCtrl = new FFmpegCtrl(ffmpegPath, ffprobePath);
    }

    private async processMultipleQualities(inputFile: string, outputDir: string, videoInfo: any): Promise<{ [key: string]: QualityResult }> {
        const results: Record<string, QualityResult> = {};
        const baseName = path.basename(inputFile, path.extname(inputFile));

        for (const [quality, profile] of Object.entries(this.qualityProfiles)) {
            console.log(`\nProcessing ${quality} quality...`);
            
            const outputFile = path.join(outputDir, `${baseName}${profile.suffix}.mp4`);
            
            try {
                const result = await this.ffmpegCtrl!.processVideo(inputFile, outputFile, {
                    resolution: profile.resolution,
                    videoBitrate: profile.videoBitrate,
                    audioBitrate: profile.audioBitrate,
                    framerate: 30,
                    onProgress: (progress) => {
                        console.log(`${quality}: Time: ${progress.time}, Speed: ${progress.speed}x`);
                    }
                });

                results[quality] = {
                    file: outputFile,
                    profile: profile,
                    success: true
                };

                console.log(`✓ ${quality} completed: ${outputFile}`);
            } catch (error) {
                console.error(`✗ ${quality} failed:`, (error as Error).message);
                results[quality] = {
                    file: outputFile,
                    profile: profile,
                    success: false,
                    error: (error as Error).message
                };
            }
        }

        return results;
    }

    private async createThumbnail(inputFile: string, outputDir: string): Promise<string | null> {
        const baseName = path.basename(inputFile, path.extname(inputFile));
        const thumbnailPath = path.join(outputDir, `${baseName}_thumbnail.jpg`);

        try {
            await this.ffmpegCtrl!.createThumbnail(inputFile, thumbnailPath);
            console.log(`✓ Thumbnail created: ${thumbnailPath}`);
            return thumbnailPath;
        } catch (error) {
            console.error('✗ Thumbnail creation failed:', (error as Error).message);
            return null;
        }
    }

    private async extractAudio(inputFile: string, outputDir: string): Promise<string | null> {
        const baseName = path.basename(inputFile, path.extname(inputFile));
        const audioPath = path.join(outputDir, `${baseName}_audio.mp3`);

        try {
            await this.ffmpegCtrl!.extractAudio(inputFile, audioPath);
            console.log(`✓ Audio extracted: ${audioPath}`);
            return audioPath;
        } catch (error) {
            console.error('✗ Audio extraction failed:', (error as Error).message);
            return null;
        }
    }

    async generateManifest(outputDir: string, results: { [key: string]: QualityResult }): Promise<string> {
        const manifest: { generatedAt: string, qualities: Record<string, any>, files: string[] } = {
            generatedAt: new Date().toISOString(),
            qualities: {},
            files: []
        };

        for (const [quality, result] of Object.entries(results)) {
            if (result.success) {
                const stats = await fs.stat(result.file);
                (manifest.qualities as Record<string, any>)[quality] = {
                    file: path.basename(result.file),
                    size: stats.size,
                    profile: result.profile
                };
                manifest.files.push(path.basename(result.file));
            }
        }

        const manifestPath = path.join(outputDir, 'manifest.json');
        await fs.writeJson(manifestPath, manifest, { spaces: 2 });
        
        console.log(`✓ Manifest created: ${manifestPath}`);
        return manifestPath;
    }

    setCustomQualityProfile(name: string, profile: QualityProfile): void {
        this.qualityProfiles[name] = profile;
    }

    getAvailableQualities(): string[] {
        return Object.keys(this.qualityProfiles);
    }
}

export { VideoProcessor };