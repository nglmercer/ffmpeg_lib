#!/usr/bin/env node

/**
 * Script de instalación para FFmpeg
 * Este script descarga e instala los binarios de FFmpeg usando FFmpegManager
 */

const { FFmpegManager } = require('./dist/index.js');

async function main() {
    console.log('🚀 Iniciando instalación de FFmpeg...\n');
    
    try {
        // Crear instancia del gestor
        const manager = new FFmpegManager();
        
        // Verificar si ya está instalado
        const isAvailable = await manager.isFFmpegAvailable();
        if (isAvailable) {
            console.log('✅ FFmpeg ya está instalado');
            
            const info = await manager.getInstallationInfo();
            if (info) {
                console.log(`📌 Versión: ${info.version}`);
                console.log(`📌 Plataforma: ${info.platform}`);
                console.log(`📌 Fecha de instalación: ${new Date(info.downloadDate).toLocaleDateString()}`);
            }
            
            const needsUpdate = await manager.checkForUpdates();
            if (needsUpdate) {
                console.log('\n⚠️  Se recomienda actualizar los binarios (más de 30 días)');
                console.log('Ejecuta: npm run update-ffmpeg');
            }
            
            return;
        }
        
        // Descargar binarios
        console.log('📥 Descargando binarios de FFmpeg...');
        await manager.downloadFFmpegBinaries();
        
        // Verificar instalación
        console.log('\n🔍 Verificando instalación...');
        const { ffmpegPath, ffprobePath } = await manager.verifyBinaries();
        
        console.log('\n✅ Instalación completada exitosamente!');
        console.log(`📌 FFmpeg: ${ffmpegPath}`);
        console.log(`📌 FFprobe: ${ffprobePath}`);
        
        // Mostrar información de la instalación
        const info = await manager.getInstallationInfo();
        if (info) {
            console.log(`📌 Versión: ${info.version}`);
            console.log(`📌 Checksum: ${info.checksum}`);
        }
        
        console.log('\n🎉 ¡FFmpeg está listo para usar!');
        
    } catch (error) {
        console.error('❌ Error durante la instalación:', error.message);
        process.exit(1);
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    main();
}

module.exports = { main };