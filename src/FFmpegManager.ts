import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';
import { MediaMetadataExtractor, MediaMetadata, MediaType } from './MediaMetadataExtractor.js';
interface FFmpegUrls {
    win32: string;
    linux: string;
    darwin: string;
    /** Optional: separate download URL for the ffprobe binary (per platform).
     *  Use this when ffmpeg and ffprobe are distributed as separate archives
     *  (e.g. ffmpeg.martin-riedl.de).
     */
    ffprobe?: {
        win32?: string;
        linux?: string;
        darwin?: string;
    };
}

interface VersionInfo {
    version: string;
    releaseDate: string;
    checksum?: string;
}

interface BinaryInfo {
    path: string;
    version: string;
    lastChecked: string;
}

interface CacheManifest {
    version: string;
    platform: string;
    checksum: string;
    downloadDate: string;
    ffmpegPath: string;
    ffprobePath: string;
}
const logger = {
    info: (...args: unknown[]) => console.info(`[FFmpegManager]`, ...args),
    error: (...args: unknown[]) => console.error(`[FFmpegManager]`, ...args),
    warn: (...args: unknown[]) => console.warn(`[FFmpegManager]`, ...args),
    debug: (...args: unknown[]) => console.debug(`[FFmpegManager]`, ...args),
    log: (...args: unknown[]) => { console.log(`[FFmpegManager]`, ...args) }
}
class FFmpegManager {
    public binariesDir: string;
    public platform: string;
    public ffmpegUrls: FFmpegUrls;
    private cacheFile: string;
    private manifestFile: string;
    private metadataExtractor?: MediaMetadataExtractor;
    constructor(customBinariesDir?: string, customUrls?: Partial<FFmpegUrls>) {
        this.binariesDir = customBinariesDir || path.join(__dirname, '..', 'binaries');
        this.platform = this.getPlatform();
        this.cacheFile = path.join(this.binariesDir, '.ffmpeg-cache.json');
        this.manifestFile = path.join(this.binariesDir, '.manifest.json');

        const defaultUrls: FFmpegUrls = {
            'win32': 'https://github.com/GyanD/codexffmpeg/releases/download/7.1/ffmpeg-7.1-essentials_build.zip',
            'linux': 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz',
            'darwin': 'https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip'
        };

        // Allow users to override the download links globally or per-platform
        this.ffmpegUrls = {
            ...defaultUrls,
            ...customUrls,
            // Merge nested ffprobe URLs
            ffprobe: { ...defaultUrls.ffprobe, ...customUrls?.ffprobe }
        };
    }

    private getPlatform(): string {
        const platform = process.platform;
        if (platform === 'win32') return 'win32';
        if (platform === 'linux') return 'linux';
        if (platform === 'darwin') return 'darwin';
        throw new Error(`Unsupported platform: ${platform}`);
    }

    /**
     * Verifica si hay una actualización disponible
     */
    async checkForUpdates(): Promise<boolean> {
        try {
            const manifest = await this.readManifest();
            if (!manifest) return true;

            // Verificar si los binarios existen
            const exists = await this.isFFmpegAvailable();
            if (!exists) return true;

            // Verificar antigüedad (actualizar si > 30 días)
            const downloadDate = new Date(manifest.downloadDate);
            const daysSinceDownload = (Date.now() - downloadDate.getTime()) / (1000 * 60 * 60 * 24);

            if (daysSinceDownload > 30) {
                logger.log('⏰ Binaries are older than 30 days, update recommended');
                return true;
            }

            return false;
        } catch {
            return true;
        }
    }

    /**
     * Lee el manifest de la instalación actual
     */
    private async readManifest(): Promise<CacheManifest | null> {
        try {
            if (await fs.pathExists(this.manifestFile)) {
                return await fs.readJSON(this.manifestFile);
            }
        } catch (error) {
            console.warn('Could not read manifest file:', error);
        }
        return null;
    }

    /**
     * Escribe el manifest con información de la instalación
     */
    private async writeManifest(data: CacheManifest): Promise<void> {
        await fs.writeJSON(this.manifestFile, data, { spaces: 2 });
    }

    /**
     * Calcula el checksum SHA256 de un archivo
     */
    private async calculateChecksum(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const stream = fs.createReadStream(filePath);

            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }

    private async withLock<T>(lockName: string, fn: () => Promise<T>): Promise<T> {
        const lockDir = path.join(this.binariesDir, `${lockName}.lock`);
        await fs.ensureDir(this.binariesDir);
        let retries = 60;

        while (retries > 0) {
            try {
                await fs.mkdir(lockDir);
                break;
            } catch (error: any) {
                if (error.code === 'EEXIST') {
                    retries--;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    throw error;
                }
            }
        }

        if (retries === 0) {
            throw new Error(`Failed to acquire lock ${lockName} after 60 seconds`);
        }

        try {
            return await fn();
        } finally {
            await fs.rmdir(lockDir).catch(() => { });
        }
    }

    /**
     * Descarga FFmpeg con manejo de caché y verificación
     */
    async downloadFFmpegBinaries(force: boolean = false): Promise<void> {
        return this.withLock('download', async () => {
            logger.log('Checking FFmpeg binaries...');

            // Verificar si necesita actualización
            if (!force) {
                const needsUpdate = await this.checkForUpdates();
                if (!needsUpdate) {
                    logger.log('✅ FFmpeg binaries are up to date');
                    return;
                }
            }


            logger.log('Downloading FFmpeg binaries...');

            await fs.ensureDir(this.binariesDir);

            const ffmpegUrl = this.ffmpegUrls[this.platform as keyof Omit<FFmpegUrls, 'ffprobe'>];
            if (!ffmpegUrl || typeof ffmpegUrl !== 'string') {
                throw new Error(`No FFmpeg URL available for platform: ${this.platform}`);
            }

            // Optional separate ffprobe URL (e.g. martin-riedl.de distributes them separately)
            const ffprobeUrl = this.ffmpegUrls.ffprobe?.[this.platform as 'win32' | 'linux' | 'darwin'];

            const tempDir = path.join(this.binariesDir, 'temp_' + crypto.randomBytes(8).toString('hex'));
            await fs.ensureDir(tempDir);

            try {
                // --- Download ffmpeg archive ---
                await this.downloadFile(ffmpegUrl, tempDir, 'ffmpeg');

                // --- Download ffprobe archive (if a separate URL is configured) ---
                if (ffprobeUrl) {
                    await this.downloadFile(ffprobeUrl, tempDir, 'ffprobe');
                }

                // Calculate checksum of the first (main) file for manifest
                const mainFile = path.join(tempDir, path.basename(ffmpegUrl.split('?')[0]));
                const checksum = await this.calculateChecksum(mainFile);
                logger.log('Checksum:', checksum);

                await this.copyBinaries(tempDir);

                // Verify installation
                const { ffmpegPath, ffprobePath } = await this.verifyBinaries();

                // Get version info
                const version = await this.getFFmpegVersion(ffmpegPath);

                // Write manifest
                await this.writeManifest({
                    version,
                    platform: this.platform,
                    checksum,
                    downloadDate: new Date().toISOString(),
                    ffmpegPath,
                    ffprobePath
                });

                logger.log(` Version: ${version}`);
            } finally {
                await fs.remove(tempDir);
            }
        });
    }

    /**
     * Downloads a single file from a URL and extracts it into destDir.
     */
    private async downloadFile(url: string, destDir: string, label: string): Promise<void> {
        logger.log(`📥 Downloading ${label} from: ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to download ${label}: ${response.status} ${response.statusText}`);
        }

        const filename = path.basename(url.split('?')[0]) || `${label}.bin`;
        const filePath = path.join(destDir, filename);

        const arrayBuffer = await response.arrayBuffer();
        await fs.writeFile(filePath, Buffer.from(arrayBuffer));
        logger.log(`✅ ${label} download completed (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB)`);

        logger.log(`📦 Extracting ${label}...`);
        await this.extractBinaries(filePath, destDir);
    }

    /**
     * Obtiene la versión de FFmpeg instalada
     */
    private async getFFmpegVersion(ffmpegPath: string): Promise<string> {
        try {
            const output = execSync(`"${ffmpegPath}" -version`, {
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'pipe']
            });

            const match = output.match(/ffmpeg version (\S+)/);
            return match ? match[1] : 'unknown';
        } catch (error) {
            console.warn('Could not determine FFmpeg version:', error);
            return 'unknown';
        }
    }

    private async extractBinaries(filePath: string, extractDir: string): Promise<void> {
        const ext = path.extname(filePath);

        try {
            if (ext === '.zip') {
                // Para Windows y macOS zips
                const AdmZip = (await import('adm-zip')).default;
                const zip = new AdmZip(filePath);
                zip.extractAllTo(extractDir, true);
            } else if (filePath.includes('.tar.xz') || filePath.includes('.tar.gz')) {
                // Para Linux tarballs
                execSync(`tar -xf "${filePath}" -C "${extractDir}"`, {
                    stdio: 'inherit',
                    encoding: 'utf8'
                });
            } else {
                throw new Error(`Unsupported archive format: ${ext}`);
            }
        } catch (error) {
            throw new Error(`Failed to extract binaries: ${(error as Error).message}`);
        }
    }

    private async copyBinaries(tempDir: string): Promise<void> {
        const files = await this.findBinaries(tempDir);

        if (files.length === 0) {
            throw new Error('No FFmpeg binaries found in extracted files');
        }

        for (const file of files) {
            const filename = path.basename(file);
            const destPath = path.join(this.binariesDir, filename);

            await fs.copy(file, destPath, { overwrite: true });

            // Make executable on Unix-like systems
            if (this.platform !== 'win32') {
                await fs.chmod(destPath, 0o755);
            }

            logger.log(`✓ Installed: ${filename}`);
        }
    }

    /**
     * Busca recursivamente los binarios de FFmpeg
     */
    private async findBinaries(dir: string): Promise<string[]> {
        const binaries: string[] = [];

        const search = async (currentDir: string) => {
            const entries = await fs.readdir(currentDir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);

                if (entry.isDirectory()) {
                    await search(fullPath);
                } else {
                    const filename = entry.name.toLowerCase();
                    // Buscar ejecutables específicos
                    if (
                        filename === 'ffmpeg' ||
                        filename === 'ffmpeg.exe' ||
                        filename === 'ffprobe' ||
                        filename === 'ffprobe.exe'
                    ) {
                        binaries.push(fullPath);
                    }
                }
            }
        };

        await search(dir);
        return binaries;
    }

    getFFmpegPath(): string {
        const binaryName = this.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
        return path.join(this.binariesDir, binaryName);
    }

    getFFprobePath(): string {
        const binaryName = this.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
        return path.join(this.binariesDir, binaryName);
    }

    /**
     * Alias para mantener compatibilidad
     */
    async verifyFFmpeg(): Promise<void> {
        await this.verifyBinaries();
    }

    /**
     * Verifica si FFmpeg está disponible
     */
    async isFFmpegAvailable(): Promise<boolean> {
        try {
            await this.verifyBinaries();
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Verifica y retorna las rutas de los binarios
     */
    async verifyBinaries(): Promise<{ ffmpegPath: string; ffprobePath: string }> {
        const ffmpegPath = this.getFFmpegPath();
        const ffprobePath = this.getFFprobePath();

        const ffmpegExists = await fs.pathExists(ffmpegPath);
        const ffprobeExists = await fs.pathExists(ffprobePath);

        if (!ffmpegExists || !ffprobeExists) {
            throw new Error(
                'FFmpeg binaries not found. Please run downloadFFmpegBinaries() first.'
            );
        }

        // Verificar que son ejecutables válidos
        try {
            execSync(`"${ffmpegPath}" -version`, {
                stdio: 'pipe',
                encoding: 'utf8'
            });
        } catch (error) {
            throw new Error('FFmpeg binary exists but is not executable or corrupted');
        }

        return { ffmpegPath, ffprobePath };
    }

    /**
     * Obtiene información sobre la instalación actual
     */
    async getInstallationInfo(): Promise<CacheManifest | null> {
        return await this.readManifest();
    }

    /**
     * Limpia los binarios instalados
     */
    async cleanBinaries(): Promise<void> {
        const files = [
            this.getFFmpegPath(),
            this.getFFprobePath(),
            this.manifestFile,
            this.cacheFile
        ];

        for (const file of files) {
            if (await fs.pathExists(file)) {
                await fs.remove(file);
                logger.log(`🗑️  Removed: ${path.basename(file)}`);
            }
        }
    }
    /**
 * Obtiene la instancia del extractor de metadatos
 */
    getMetadataExtractor(): MediaMetadataExtractor {
        if (!this.metadataExtractor) {
            const ffprobePath = this.getFFprobePath();
            this.metadataExtractor = new MediaMetadataExtractor(ffprobePath);
        }
        return this.metadataExtractor;
    }

    /**
     * Extrae metadatos completos de un archivo multimedia
     * @param filePath Ruta al archivo multimedia
     * @returns Metadatos completos del archivo
     */
    async extractMetadata(filePath: string): Promise<MediaMetadata> {
        await this.verifyBinaries();
        const extractor = this.getMetadataExtractor();
        return await extractor.extractMetadata(filePath);
    }

    /**
     * Obtiene solo el tipo de medio de un archivo
     * @param filePath Ruta al archivo
     * @returns Tipo de medio (video, audio, image, etc.)
     */
    async getMediaType(filePath: string): Promise<MediaType> {
        await this.verifyBinaries();
        const extractor = this.getMetadataExtractor();
        return await extractor.getMediaType(filePath);
    }

    /**
     * Obtiene información básica de un archivo (más rápido)
     * @param filePath Ruta al archivo
     * @returns Información básica (tipo, duración, tamaño, formato)
     */
    async getBasicInfo(filePath: string): Promise<{
        type: MediaType;
        duration: number;
        size: number;
        format: string;
    }> {
        await this.verifyBinaries();
        const extractor = this.getMetadataExtractor();
        return await extractor.getBasicInfo(filePath);
    }

    /**
     * Verifica si un archivo es un video válido
     */
    async isVideo(filePath: string): Promise<boolean> {
        await this.verifyBinaries();
        const extractor = this.getMetadataExtractor();
        return await extractor.isVideo(filePath);
    }

    /**
     * Verifica si un archivo es un audio válido
     */
    async isAudio(filePath: string): Promise<boolean> {
        await this.verifyBinaries();
        const extractor = this.getMetadataExtractor();
        return await extractor.isAudio(filePath);
    }

    /**
     * Verifica si un archivo es una imagen válida
     */
    async isImage(filePath: string): Promise<boolean> {
        await this.verifyBinaries();
        const extractor = this.getMetadataExtractor();
        return await extractor.isImage(filePath);
    }
}

export { FFmpegManager, CacheManifest, BinaryInfo, VersionInfo };