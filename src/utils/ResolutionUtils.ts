export interface Resolution {
    width: number;
    height: number;
    name: string;
    bitrate: string;
}

export interface AspectRatio {
    width: number;
    height: number;
}

export class ResolutionUtils {
    // Escalas estándar para generar resoluciones (porcentajes del original)
    private static readonly SCALE_FACTORS = [0.75, 0.5, 0.375, 0.25];
    
    // Alturas de referencia para nombrar las resoluciones
    private static readonly REFERENCE_HEIGHTS = [2160, 1440, 1080, 720, 480, 360, 240, 144];

    /**
     * Detecta el aspect ratio basado en el ancho y alto
     */
    static detectAspectRatio(width: number, height: number): AspectRatio {
        const ratio = width / height;
        
        // Tolerancia para detectar aspect ratios comunes
        const commonRatios = [
            { ratio: 16/9, ar: { width: 16, height: 9 } },
            { ratio: 4/3, ar: { width: 4, height: 3 } },
            { ratio: 3/4, ar: { width: 3, height: 4 } },
            { ratio: 9/16, ar: { width: 9, height: 16 } },
            { ratio: 21/9, ar: { width: 21, height: 9 } },
            { ratio: 1, ar: { width: 1, height: 1 } }
        ];

        for (const { ratio: targetRatio, ar } of commonRatios) {
            if (Math.abs(ratio - targetRatio) < 0.05) {
                return ar;
            }
        }
        
        // Si no es un aspect ratio estándar, devolver el ratio simplificado
        return this.simplifyRatio(width, height);
    }

    /**
     * Simplifica un ratio a su forma más simple
     */
    private static simplifyRatio(width: number, height: number): AspectRatio {
        const gcd = this.gcd(width, height);
        return {
            width: Math.round(width / gcd),
            height: Math.round(height / gcd)
        };
    }

    /**
     * Calcula el máximo común divisor
     */
    private static gcd(a: number, b: number): number {
        return b === 0 ? a : this.gcd(b, a % b);
    }

    /**
     * Genera resoluciones inferiores basadas en escalas del original
     */
    static generateLowerResolutions(
        originalWidth: number, 
        originalHeight: number,
        options?: {
            minWidth?: number;
            minHeight?: number;
            scaleFactors?: number[];
            customBitrates?: { [key: string]: string };
        }
    ): Resolution[] {
        const minWidth = options?.minWidth || 240;
        const minHeight = options?.minHeight || 144;
        const scaleFactors = options?.scaleFactors || this.SCALE_FACTORS;
        const customBitrates = options?.customBitrates || {};

        const resolutions: Resolution[] = [];
        const processedResolutions = new Set<string>();

        // Generar resoluciones usando los factores de escala
        for (const scale of scaleFactors) {
            const scaledWidth = Math.round(originalWidth * scale);
            const scaledHeight = Math.round(originalHeight * scale);

            // Ajustar dimensiones para que sean pares
            const adjustedWidth = scaledWidth % 2 === 0 ? scaledWidth : scaledWidth - 1;
            const adjustedHeight = scaledHeight % 2 === 0 ? scaledHeight : scaledHeight - 1;

            // Verificar límites mínimos
            if (adjustedWidth < minWidth || adjustedHeight < minHeight) {
                continue;
            }

            // Evitar duplicados
            const key = `${adjustedWidth}x${adjustedHeight}`;
            if (processedResolutions.has(key)) {
                continue;
            }

            processedResolutions.add(key);

            const name = this.generateResolutionName(adjustedWidth, adjustedHeight);
            const bitrate = customBitrates[name] || this.estimateBitrate(adjustedWidth, adjustedHeight);

            resolutions.push({
                width: adjustedWidth,
                height: adjustedHeight,
                name,
                bitrate
            });
        }

        return resolutions;
    }

    /**
     * Genera un nombre descriptivo para la resolución
     */
    private static generateResolutionName(width: number, height: number): string {
        // Determinar la dimensión mayor (altura para vertical, ancho para horizontal)
        const isVertical = height > width;
        const primaryDimension = isVertical ? height : width;

        // Buscar la altura de referencia más cercana
        let closestHeight = this.REFERENCE_HEIGHTS[0];
        let minDiff = Math.abs(primaryDimension - closestHeight);

        for (const refHeight of this.REFERENCE_HEIGHTS) {
            const diff = Math.abs(primaryDimension - refHeight);
            if (diff < minDiff) {
                minDiff = diff;
                closestHeight = refHeight;
            }
        }

        // Si la diferencia es muy grande (>15%), usar dimensiones exactas
        const tolerance = closestHeight * 0.15;
        if (minDiff > tolerance) {
            return `${width}x${height}`;
        }

        return `${closestHeight}p`;
    }

    /**
     * Estima el bitrate apropiado basado en resolución
     */
    private static estimateBitrate(width: number, height: number): string {
        const totalPixels = width * height;
        const pixelsPerSecond = totalPixels * 30; // Asumiendo 30fps
        
        // Calcular bitrate base (aproximadamente 0.1 bits por pixel por segundo)
        const baseBitrate = Math.round((pixelsPerSecond * 0.1) / 1000);
        
        // Ajustar con rangos predefinidos para calidad óptima
        if (totalPixels >= 3840 * 2160) return '15000k'; // 4K
        if (totalPixels >= 2560 * 1440) return '10000k'; // 1440p
        if (totalPixels >= 1920 * 1080) return '5000k';  // 1080p
        if (totalPixels >= 1280 * 720) return '2800k';   // 720p
        if (totalPixels >= 854 * 480) return '1400k';    // 480p
        if (totalPixels >= 640 * 360) return '800k';     // 360p
        if (totalPixels >= 426 * 240) return '400k';     // 240p
        
        return `${Math.max(baseBitrate, 300)}k`;
    }

    /**
     * Genera resoluciones con escalas personalizadas más flexibles
     */
    static generateAdaptiveResolutions(
        originalWidth: number,
        originalHeight: number,
        options?: {
            targetCount?: number;
            minWidth?: number;
            minHeight?: number;
            qualityPreset?: 'high' | 'medium' | 'low';
        }
    ): Resolution[] {
        const targetCount = options?.targetCount || 4;
        const minWidth = options?.minWidth || 240;
        const minHeight = options?.minHeight || 144;
        
        // Definir escalas según el preset de calidad
        let scales: number[];
        switch (options?.qualityPreset) {
            case 'high':
                scales = [0.875, 0.75, 0.625, 0.5, 0.375, 0.25];
                break;
            case 'low':
                scales = [0.67, 0.5, 0.33];
                break;
            case 'medium':
            default:
                scales = [0.75, 0.5, 0.375, 0.25];
                break;
        }

        const resolutions = this.generateLowerResolutions(originalWidth, originalHeight, {
            minWidth,
            minHeight,
            scaleFactors: scales
        });

        // Limitar al número objetivo de resoluciones
        return resolutions.slice(0, targetCount);
    }

    /**
     * Obtiene la resolución más cercana a un objetivo
     */
    static findClosestResolution(
        targetWidth: number, 
        availableResolutions: Resolution[]
    ): Resolution | null {
        if (availableResolutions.length === 0) return null;

        return availableResolutions.reduce((closest, current) => {
            const closestDiff = Math.abs(closest.width - targetWidth);
            const currentDiff = Math.abs(current.width - targetWidth);
            return currentDiff < closestDiff ? current : closest;
        });
    }

    /**
     * Valida si una resolución es válida
     */
    static isValidResolution(width: number, height: number): boolean {
        if (width <= 0 || height <= 0) return false;
        if (width % 2 !== 0 || height % 2 !== 0) return false;
        if (width < 160 || height < 120) return false;
        return true;
    }

    /**
     * Formatea una resolución para FFmpeg
     */
    static formatForFFmpeg(resolution: Resolution): string {
        return `${resolution.width}x${resolution.height}`;
    }

    /**
     * Obtiene información detallada sobre las resoluciones generadas
     */
    static getResolutionInfo(originalWidth: number, originalHeight: number): {
        aspectRatio: AspectRatio;
        resolutions: Resolution[];
        totalPixelsReduction: string[];
    } {
        const aspectRatio = this.detectAspectRatio(originalWidth, originalHeight);
        const resolutions = this.generateLowerResolutions(originalWidth, originalHeight);
        
        const originalPixels = originalWidth * originalHeight;
        const totalPixelsReduction = resolutions.map(res => {
            const pixels = res.width * res.height;
            const percentage = ((1 - pixels / originalPixels) * 100).toFixed(1);
            return `${res.name}: -${percentage}% pixels`;
        });

        return {
            aspectRatio,
            resolutions,
            totalPixelsReduction
        };
    }
}