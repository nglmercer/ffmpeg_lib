# Ejemplo Simple de Generación Multimedia

Este ejemplo demuestra cómo generar archivos multimedia de prueba (imagen, audio y video) usando la biblioteca FFmpeg.

## ¿Qué hace este ejemplo?

Genera cuatro archivos de prueba:
1. **Imagen**: Una imagen azul de 1920x1080 píxeles
2. **Audio**: Un archivo de audio de 5 segundos con un tono de 440Hz (nota A4)
3. **Video**: Un video de 3 segundos con patrón de prueba en 720p
4. **Video con Audio**: Un video de 3 segundos con patrón visual y tono de audio de 880Hz

## Cómo ejecutar

```bash
# Desde la raíz del proyecto - ejecutar directamente con Bun
bun run examples/simple-media-generation.ts

# O compilar para Node.js
bun build examples/simple-media-generation.ts --target=node --outdir=dist/examples
node dist/examples/simple-media-generation.js

# O simplemente ejecutar con Bun sin compilar
bun examples/simple-media-generation.ts
```

## Archivos generados

Los archivos se guardarán en la carpeta `generated-media/` dentro del directorio del proyecto:
- `ejemplo-imagen.jpg`
- `ejemplo-audio.mp3`
- `ejemplo-video.mp4`
- `ejemplo-video-audio.mp4`

## Personalización

Puedes modificar los parámetros en el código:
- **Imagen**: Cambiar tamaño, color, formato
- **Audio**: Cambiar duración, frecuencia, canales, bitrate
- **Video**: Cambiar duración, resolución, fps, bitrate

## Requisitos

- FFmpeg debe estar instalado o se descargará automáticamente
- Node.js/Bun para ejecutar TypeScript