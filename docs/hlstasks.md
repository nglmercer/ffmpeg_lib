# generate mkv with audio and subtitles?
- generate mkv with audio and subtitles?
- convert to hls
1. issue generate a video fragments and subtitle playlists
```m3u8
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:8
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:7.507500,
quality_360p0.vtt
#EXTINF:5.005000,
quality_360p1.vtt
```
2. make or reutilize a same subtitle playlist for all video quality fragments

### VERIFICAR SI AL CONVERTIR A HLS UN MKV EXTRAE LOS SUBTÍTULOS POR DEFECTO EN FRAGMENTOS
- manejamos los subs por aparte como generar varias calidades problema al reutilizar subtitulos duplica para cada calidad
- verificar si al convertir a hls un mkv extrae los subtítulos por defecto en fragmentos
- añadir algun metodo o manera de ignorar o evitar la extraccion de subtitulos por defecto en fragmentos || se ara por aparte