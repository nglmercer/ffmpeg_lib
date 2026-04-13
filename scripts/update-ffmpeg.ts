#!/usr/bin/env node

import { FFmpegManager } from '../src/FFmpegManager';

async function main(): Promise<void> {
    console.log('FFmpeg Binary Updater');
    console.log('=====================\n');

    try {
        const manager = new FFmpegManager();
        await manager.downloadFFmpegBinaries();

        console.log('FFmpeg binaries updated successfully!');
        console.log('Binaries location:', manager.binariesDir);

        // Verify the binaries
        const { ffmpegPath, ffprobePath } = await manager.verifyBinaries();
        console.log('FFmpeg path:', ffmpegPath);
        console.log('FFprobe path:', ffprobePath);

    } catch (error) {
        const err_msg = error instanceof Error ? error.message : String(error);
        console.error('Error updating FFmpeg binaries:', err_msg);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}

export { main };