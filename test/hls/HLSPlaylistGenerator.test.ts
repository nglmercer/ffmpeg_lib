// ==================== test/HLSPlaylistGenerator.test.ts ====================

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { 
    HLSPlaylistGenerator, 
    HLSVariantBuilder,
    HLSVariant,
    HLSAudioTrack,
    HLSSubtitle 
} from '../../src/hls/HLSPlaylistGenerator';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('HLSPlaylistGenerator Tests', () => {
    let generator: HLSPlaylistGenerator;
    let testDir: string;

    beforeAll(async () => {
        testDir = path.join(os.tmpdir(), 'hls-test-' + Date.now());
        await fs.ensureDir(testDir);
        generator = new HLSPlaylistGenerator();
    });

    afterAll(async () => {
        await fs.remove(testDir);
    });

    describe('Variant Builder', () => {
        test('should create variants with builder', () => {
            const builder = new HLSVariantBuilder();
            const variants = builder
                .addVariant('1080p', 1920, 1080, '5000k', '128k')
                .addVariant('720p', 1280, 720, '2800k', '128k')
                .addVariant('480p', 854, 480, '1400k', '128k')
                .build();

            expect(variants).toHaveLength(3);
            expect(variants[0].name).toBe('1080p');
            expect(variants[0].bandwidth).toBeGreaterThan(0);
        });

        test('should auto-detect codec profile', () => {
            const builder = new HLSVariantBuilder();
            const variants = builder
                .addVariant('1080p', 1920, 1080, '5000k')
                .build();

            expect(variants[0].codec).toContain('avc1');
        });
    });

    describe('Master Playlist', () => {
        test('should generate master playlist', () => {
            const variants: HLSVariant[] = [
                {
                    name: '720p',
                    width: 1280,
                    height: 720,
                    bandwidth: 2928000,
                    videoBitrate: '2800k',
                    audioBitrate: '128k',
                    codec: 'avc1.4d001f,mp4a.40.2',
                    playlistPath: 'video/quality_720p.m3u8'
                }
            ];

            const content = generator.generateMasterPlaylist(variants);

            expect(content).toContain('#EXTM3U');
            expect(content).toContain('#EXT-X-VERSION:3');
            expect(content).toContain('#EXT-X-STREAM-INF');
            expect(content).toContain('BANDWIDTH=2928000');
            expect(content).toContain('RESOLUTION=1280x720');
        });

        test('should include audio tracks', () => {
            const variants: HLSVariant[] = [{
                name: '720p',
                width: 1280,
                height: 720,
                bandwidth: 2928000,
                videoBitrate: '2800k',
                audioBitrate: '128k',
                codec: 'avc1.4d001f,mp4a.40.2',
                playlistPath: 'video/quality_720p.m3u8',
                audioGroup: 'audio'
            }];

            const audioTracks: HLSAudioTrack[] = [{
                id: 'audio_es',
                name: 'Español',
                language: 'es',
                isDefault: true,
                channels: 2,
                bitrate: '128k',
                playlistPath: 'audio/audio_es.m3u8',
                groupId: 'audio'
            }];

            const content = generator.generateMasterPlaylist(variants, audioTracks);

            expect(content).toContain('#EXT-X-MEDIA:TYPE=AUDIO');
            expect(content).toContain('LANGUAGE="es"');
            expect(content).toContain('DEFAULT=YES');
        });

        test('should include subtitles', () => {
            const variants: HLSVariant[] = [{
                name: '720p',
                width: 1280,
                height: 720,
                bandwidth: 2928000,
                videoBitrate: '2800k',
                audioBitrate: '128k',
                codec: 'avc1.4d001f,mp4a.40.2',
                playlistPath: 'video/quality_720p.m3u8',
                subtitleGroup: 'subs'
            }];

            const subtitles: HLSSubtitle[] = [{
                id: 'sub_en',
                name: 'English',
                language: 'en',
                isDefault: true,
                isForced: false,
                playlistPath: 'subtitles/subtitles_en.m3u8',
                vttPath: 'subtitles/subtitles_en.vtt',
                groupId: 'subs'
            }];

            const content = generator.generateMasterPlaylist(variants, [], subtitles);

            expect(content).toContain('#EXT-X-MEDIA:TYPE=SUBTITLES');
            expect(content).toContain('LANGUAGE="en"');
        });
    });

    describe('Variant Playlist', () => {
        test('should generate variant playlist', () => {
            const segments = [
                { duration: 6.0, uri: 'segment_000.ts' },
                { duration: 6.0, uri: 'segment_001.ts' },
                { duration: 4.5, uri: 'segment_002.ts' }
            ];

            const content = generator.generateVariantPlaylist(segments);

            expect(content).toContain('#EXTM3U');
            expect(content).toContain('#EXT-X-TARGETDURATION:6');
            expect(content).toContain('#EXT-X-PLAYLIST-TYPE:VOD');
            expect(content).toContain('#EXTINF:6.000000,');
            expect(content).toContain('segment_000.ts');
            expect(content).toContain('#EXT-X-ENDLIST');
        });
    });

    describe('Subtitle Playlist', () => {
        test('should generate subtitle playlist', () => {
            const content = generator.generateSubtitlePlaylist('subtitle_en.vtt', 120);

            expect(content).toContain('#EXTM3U');
            expect(content).toContain('#EXT-X-PLAYLIST-TYPE:VOD');
            expect(content).toContain('subtitle_en.vtt');
            expect(content).toContain('#EXT-X-ENDLIST');
        });
    });

    describe('File Writing', () => {
        test('should write master playlist to disk', async () => {
            const variants: HLSVariant[] = [{
                name: '720p',
                width: 1280,
                height: 720,
                bandwidth: 2928000,
                videoBitrate: '2800k',
                audioBitrate: '128k',
                codec: 'avc1.4d001f,mp4a.40.2',
                playlistPath: 'video/quality_720p.m3u8'
            }];

            const outputPath = path.join(testDir, 'master.m3u8');
            await generator.writeMasterPlaylist(outputPath, variants);

            const exists = await fs.pathExists(outputPath);
            expect(exists).toBe(true);

            const content = await fs.readFile(outputPath, 'utf8');
            expect(content).toContain('#EXTM3U');
        });
    });

    describe('Utilities', () => {
        test('should calculate bandwidth correctly', () => {
            const bandwidth = HLSPlaylistGenerator.calculateBandwidth('2800k', '128k');
            expect(bandwidth).toBe(2928000);
        });

        test('should generate codec string', () => {
            const codec = HLSPlaylistGenerator.generateCodecString('high');
            expect(codec).toBe('avc1.64001f,mp4a.40.2');
        });

        test('should detect profile by height', () => {
            expect(HLSPlaylistGenerator.detectProfile(1080)).toBe('high');
            expect(HLSPlaylistGenerator.detectProfile(720)).toBe('main');
            expect(HLSPlaylistGenerator.detectProfile(480)).toBe('baseline');
        });

        test('should validate playlist', () => {
            const validPlaylist = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXT-X-ENDLIST';
            const result = HLSPlaylistGenerator.validatePlaylist(validPlaylist);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should detect invalid playlist', () => {
            const invalidPlaylist = 'INVALID CONTENT';
            const result = HLSPlaylistGenerator.validatePlaylist(invalidPlaylist);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });
});