import { describe, test, expect } from "bun:test";
import { ResolutionUtils } from "../src/utils/ResolutionUtils";

describe("ResolutionUtils", () => {
  describe("detectAspectRatio", () => {
    test("debe detectar aspect ratio 16:9", () => {
      const ar = ResolutionUtils.detectAspectRatio(1920, 1080);
      expect(ar.width).toBe(16);
      expect(ar.height).toBe(9);
    });

    test("debe detectar aspect ratio 9:16 (vertical)", () => {
      const ar = ResolutionUtils.detectAspectRatio(1080, 1920);
      expect(ar.width).toBe(9);
      expect(ar.height).toBe(16);
    });

    test("debe detectar aspect ratio 4:3", () => {
      const ar = ResolutionUtils.detectAspectRatio(1440, 1080);
      expect(ar.width).toBe(4);
      expect(ar.height).toBe(3);
    });

    test("debe detectar aspect ratio 3:4 (vertical)", () => {
      const ar = ResolutionUtils.detectAspectRatio(1080, 1440);
      expect(ar.width).toBe(3);
      expect(ar.height).toBe(4);
    });

    test("debe detectar aspect ratio 21:9 (ultrawide)", () => {
      const ar = ResolutionUtils.detectAspectRatio(2560, 1080);
      expect(ar.width).toBe(21);
      expect(ar.height).toBe(9);
    });

    test("debe detectar aspect ratio 1:1 (cuadrado)", () => {
      const ar = ResolutionUtils.detectAspectRatio(1080, 1080);
      expect(ar.width).toBe(1);
      expect(ar.height).toBe(1);
    });

    test("debe simplificar ratios no estándar", () => {
      const ar = ResolutionUtils.detectAspectRatio(800, 600);
      expect(ar.width).toBe(4);
      expect(ar.height).toBe(3);
    });
  });

  describe("generateLowerResolutions", () => {
    test("debe generar resoluciones menores para 1080p 16:9", () => {
      const resolutions = ResolutionUtils.generateLowerResolutions(1920, 1080);
      
      expect(resolutions.length).toBeGreaterThan(0);
      
      // Todas las resoluciones deben ser menores al original
      resolutions.forEach(res => {
        expect(res.width).toBeLessThan(1920);
        expect(res.height).toBeLessThan(1080);
      });

      // Verificar que mantienen el aspect ratio aproximado
      const aspectRatio = 1920 / 1080;
      resolutions.forEach(res => {
        const resAspectRatio = res.width / res.height;
        expect(Math.abs(resAspectRatio - aspectRatio)).toBeLessThan(0.015);
      });
    });

    test("debe generar resoluciones menores para 480p", () => {
      const resolutions = ResolutionUtils.generateLowerResolutions(854, 480);
      
      expect(resolutions.length).toBeGreaterThan(0);
      
      resolutions.forEach(res => {
        expect(res.width).toBeLessThan(854);
        expect(res.height).toBeLessThan(480);
      });
    });

    test("debe generar resoluciones para video vertical 9:16", () => {
      const resolutions = ResolutionUtils.generateLowerResolutions(1080, 1920);
      
      expect(resolutions.length).toBeGreaterThan(0);
      
      resolutions.forEach(res => {
        expect(res.width).toBeLessThan(1080);
        expect(res.height).toBeLessThan(1920);
        expect(res.height).toBeGreaterThan(res.width); // Vertical
      });
    });

    test("debe generar resoluciones para 720p 16:9", () => {
      const resolutions = ResolutionUtils.generateLowerResolutions(1280, 720);
      
      expect(resolutions.length).toBeGreaterThan(0);
      console.log("resolutions", resolutions);
      resolutions.forEach(res => {
        expect(res.width).toBeLessThan(1280);
        expect(res.height).toBeLessThan(720);
      });
    });

    test("debe respetar el ancho mínimo", () => {
      const resolutions = ResolutionUtils.generateLowerResolutions(1920, 1080, {
        minWidth: 500
      });
      
      resolutions.forEach(res => {
        expect(res.width).toBeGreaterThanOrEqual(500);
      });
    });

    test("debe respetar la altura mínima", () => {
      const resolutions = ResolutionUtils.generateLowerResolutions(1920, 1080, {
        minHeight: 300
      });
      
      resolutions.forEach(res => {
        expect(res.height).toBeGreaterThanOrEqual(300);
      });
    });

    test("debe generar dimensiones pares", () => {
      const resolutions = ResolutionUtils.generateLowerResolutions(1920, 1080);
      
      resolutions.forEach(res => {
        expect(res.width % 2).toBe(0);
        expect(res.height % 2).toBe(0);
      });
    });

    test("debe incluir nombre y bitrate", () => {
      const resolutions = ResolutionUtils.generateLowerResolutions(1920, 1080);
      
      resolutions.forEach(res => {
        expect(res.name).toBeTruthy();
        expect(typeof res.name).toBe('string');
        expect(res.bitrate).toMatch(/^\d+k$/);
      });
    });

    test("debe permitir bitrates personalizados", () => {
      const customBitrates = {
        "720p": "3000k",
        "480p": "1500k"
      };
      
      const resolutions = ResolutionUtils.generateLowerResolutions(1920, 1080, {
        customBitrates
      });
      
      const res720 = resolutions.find(r => r.name === "720p");
      if (res720) {
        expect(res720.bitrate).toBe("3000k");
      }
      
      const res480 = resolutions.find(r => r.name === "480p");
      if (res480) {
        expect(res480.bitrate).toBe("1500k");
      }
    });

    test("debe usar escalas personalizadas", () => {
      const resolutions = ResolutionUtils.generateLowerResolutions(1920, 1080, {
        scaleFactors: [0.5, 0.25]
      });
      
      expect(resolutions.length).toBe(2);
      expect(resolutions[0].width).toBe(960); // 50%
      expect(resolutions[1].width).toBe(480); // 25%
    });

    test("no debe generar resoluciones duplicadas", () => {
      const resolutions = ResolutionUtils.generateLowerResolutions(1920, 1080);
      
      const uniqueKeys = new Set(resolutions.map(r => `${r.width}x${r.height}`));
      expect(uniqueKeys.size).toBe(resolutions.length);
    });

    test("debe omitir resoluciones por debajo del mínimo", () => {
      const resolutions = ResolutionUtils.generateLowerResolutions(320, 180, {
        minWidth: 160,
        minHeight: 90
      });
      
      // Puede no generar ninguna o muy pocas resoluciones
      resolutions.forEach(res => {
        expect(res.width).toBeGreaterThanOrEqual(160);
        expect(res.height).toBeGreaterThanOrEqual(90);
      });
    });
  });

  describe("generateAdaptiveResolutions", () => {
    test("debe generar número objetivo de resoluciones", () => {
      const resolutions = ResolutionUtils.generateAdaptiveResolutions(1920, 1080, {
        targetCount: 3
      });
      
      expect(resolutions.length).toBeLessThanOrEqual(3);
      expect(resolutions.length).toBeGreaterThan(0);
    });

    test("preset high debe generar más resoluciones", () => {
      const high = ResolutionUtils.generateAdaptiveResolutions(1920, 1080, {
        qualityPreset: "high",
        targetCount: 10
      });
      
      const medium = ResolutionUtils.generateAdaptiveResolutions(1920, 1080, {
        qualityPreset: "medium",
        targetCount: 10
      });
      
      expect(high.length).toBeGreaterThanOrEqual(medium.length);
    });

    test("preset low debe generar menos resoluciones", () => {
      const low = ResolutionUtils.generateAdaptiveResolutions(1920, 1080, {
        qualityPreset: "low",
        targetCount: 10
      });
      
      expect(low.length).toBeLessThanOrEqual(4);
      expect(low.length).toBeGreaterThan(0);
    });

    test("debe respetar límites mínimos personalizados", () => {
      const resolutions = ResolutionUtils.generateAdaptiveResolutions(1920, 1080, {
        minWidth: 640,
        minHeight: 360
      });
      
      resolutions.forEach(res => {
        expect(res.width).toBeGreaterThanOrEqual(640);
        expect(res.height).toBeGreaterThanOrEqual(360);
      });
    });

    test("debe usar valores por defecto si no se especifican opciones", () => {
      const resolutions = ResolutionUtils.generateAdaptiveResolutions(1920, 1080);
      
      expect(resolutions.length).toBeGreaterThan(0);
      expect(resolutions.length).toBeLessThanOrEqual(4);
    });
  });

  describe("findClosestResolution", () => {
    test("debe encontrar la resolución más cercana", () => {
      const resolutions = ResolutionUtils.generateLowerResolutions(1920, 1080);
      const closest = ResolutionUtils.findClosestResolution(640, resolutions);
      
      expect(closest).toBeTruthy();
      expect(closest!.width).toBeGreaterThan(0);
      
      // Verificar que es la más cercana al objetivo
      const targetDiff = Math.abs(closest!.width - 640);
      resolutions.forEach(res => {
        const diff = Math.abs(res.width - 640);
        expect(targetDiff).toBeLessThanOrEqual(diff);
      });
    });

    test("debe retornar null con array vacío", () => {
      const closest = ResolutionUtils.findClosestResolution(640, []);
      expect(closest).toBeNull();
    });

    test("debe encontrar resolución exacta si existe", () => {
      const resolutions = [
        { width: 1920, height: 1080, name: "1080p", bitrate: "5000k" },
        { width: 1280, height: 720, name: "720p", bitrate: "2800k" },
        { width: 854, height: 480, name: "480p", bitrate: "1400k" }
      ];
      
      const closest = ResolutionUtils.findClosestResolution(1280, resolutions);
      expect(closest?.width).toBe(1280);
      expect(closest?.name).toBe("720p");
    });

    test("debe funcionar con un solo elemento", () => {
      const resolutions = [
        { width: 1920, height: 1080, name: "1080p", bitrate: "5000k" }
      ];
      
      const closest = ResolutionUtils.findClosestResolution(640, resolutions);
      expect(closest).toBeTruthy();
      expect(closest?.width).toBe(1920);
    });
  });

  describe("isValidResolution", () => {
    test("debe validar resolución válida", () => {
      expect(ResolutionUtils.isValidResolution(1920, 1080)).toBe(true);
      expect(ResolutionUtils.isValidResolution(1280, 720)).toBe(true);
      expect(ResolutionUtils.isValidResolution(640, 360)).toBe(true);
    });

    test("debe rechazar dimensiones impares", () => {
      expect(ResolutionUtils.isValidResolution(1921, 1080)).toBe(false);
      expect(ResolutionUtils.isValidResolution(1920, 1081)).toBe(false);
      expect(ResolutionUtils.isValidResolution(1921, 1081)).toBe(false);
    });

    test("debe rechazar dimensiones negativas o cero", () => {
      expect(ResolutionUtils.isValidResolution(0, 1080)).toBe(false);
      expect(ResolutionUtils.isValidResolution(1920, 0)).toBe(false);
      expect(ResolutionUtils.isValidResolution(-1920, 1080)).toBe(false);
      expect(ResolutionUtils.isValidResolution(1920, -1080)).toBe(false);
      expect(ResolutionUtils.isValidResolution(-1920, -1080)).toBe(false);
    });

    test("debe rechazar resoluciones muy pequeñas", () => {
      expect(ResolutionUtils.isValidResolution(100, 100)).toBe(false);
      expect(ResolutionUtils.isValidResolution(160, 80)).toBe(false);
      expect(ResolutionUtils.isValidResolution(80, 90)).toBe(false);
      expect(ResolutionUtils.isValidResolution(150, 90)).toBe(false);
    });

    test("debe aceptar resolución mínima válida", () => {
      expect(ResolutionUtils.isValidResolution(160, 120)).toBe(true);
      expect(ResolutionUtils.isValidResolution(160, 90)).toBe(true);
      expect(ResolutionUtils.isValidResolution(240, 90)).toBe(true);
    });
  });

  describe("formatForFFmpeg", () => {
    test("debe formatear correctamente para FFmpeg", () => {
      const resolution = {
        width: 1920,
        height: 1080,
        name: "1080p",
        bitrate: "5000k"
      };
      
      const formatted = ResolutionUtils.formatForFFmpeg(resolution);
      expect(formatted).toBe("1920x1080");
    });

    test("debe formatear diferentes resoluciones", () => {
      const resolutions = [
        { width: 1280, height: 720, name: "720p", bitrate: "2800k" },
        { width: 854, height: 480, name: "480p", bitrate: "1400k" },
        { width: 640, height: 360, name: "360p", bitrate: "800k" }
      ];
      
      expect(ResolutionUtils.formatForFFmpeg(resolutions[0])).toBe("1280x720");
      expect(ResolutionUtils.formatForFFmpeg(resolutions[1])).toBe("854x480");
      expect(ResolutionUtils.formatForFFmpeg(resolutions[2])).toBe("640x360");
    });
  });

  describe("getResolutionInfo", () => {
    test("debe retornar información completa", () => {
      const info = ResolutionUtils.getResolutionInfo(1920, 1080);
      
      expect(info.aspectRatio).toBeTruthy();
      expect(info.aspectRatio.width).toBe(16);
      expect(info.aspectRatio.height).toBe(9);
      expect(info.resolutions.length).toBeGreaterThan(0);
      expect(info.totalPixelsReduction.length).toBe(info.resolutions.length);
    });

    test("debe calcular reducción de píxeles correctamente", () => {
      const info = ResolutionUtils.getResolutionInfo(1920, 1080);
      
      info.totalPixelsReduction.forEach(reduction => {
        expect(reduction).toMatch(/^.+: -\d+\.\d+% pixels$/);
        expect(reduction).toContain("-");
        expect(reduction).toContain("%");
        expect(reduction).toContain("pixels");
      });
    });

    test("debe funcionar con diferentes resoluciones", () => {
      const info4K = ResolutionUtils.getResolutionInfo(3840, 2160);
      expect(info4K.aspectRatio.width).toBe(16);
      expect(info4K.aspectRatio.height).toBe(9);
      expect(info4K.resolutions.length).toBeGreaterThan(0);

      const infoVertical = ResolutionUtils.getResolutionInfo(1080, 1920);
      expect(infoVertical.aspectRatio.width).toBe(9);
      expect(infoVertical.aspectRatio.height).toBe(16);
    });

    test("reducción de píxeles debe ser lógica", () => {
      const info = ResolutionUtils.getResolutionInfo(1920, 1080);
      const originalPixels = 1920 * 1080;
      
      info.resolutions.forEach((res, idx) => {
        const pixels = res.width * res.height;
        const expectedReduction = ((1 - pixels / originalPixels) * 100).toFixed(1);
        expect(info.totalPixelsReduction[idx]).toContain(expectedReduction);
      });
    });
  });

  describe("Casos edge y aspect ratios especiales", () => {
    test("debe manejar video 4K 16:9", () => {
      const resolutions = ResolutionUtils.generateLowerResolutions(3840, 2160);
      
      expect(resolutions.length).toBeGreaterThan(0);
      resolutions.forEach(res => {
        expect(res.width).toBeLessThan(3840);
        expect(res.height).toBeLessThan(2160);
        expect(res.width % 2).toBe(0);
        expect(res.height % 2).toBe(0);
      });
    });

    test("debe manejar video cuadrado 1:1", () => {
      const resolutions = ResolutionUtils.generateLowerResolutions(1080, 1080);
      
      expect(resolutions.length).toBeGreaterThan(0);
      resolutions.forEach(res => {
        expect(res.width).toBe(res.height); // Mantener cuadrado
        expect(res.width).toBeLessThan(1080);
      });
    });

    test("debe manejar video ultrawide 21:9", () => {
      const resolutions = ResolutionUtils.generateLowerResolutions(2560, 1080);
      
      expect(resolutions.length).toBeGreaterThan(0);
      
      const aspectRatio = 2560 / 1080;
      resolutions.forEach(res => {
        const resAspectRatio = res.width / res.height;
        expect(Math.abs(resAspectRatio - aspectRatio)).toBeLessThan(0.02);
      });
    });

    test("debe manejar resolución muy baja", () => {
      const resolutions = ResolutionUtils.generateLowerResolutions(640, 360);
      
      // Puede que no genere muchas (o ninguna) resolución menor
      resolutions.forEach(res => {
        expect(res.width).toBeLessThanOrEqual(640);
        expect(res.height).toBeLessThanOrEqual(360);
        expect(ResolutionUtils.isValidResolution(res.width, res.height)).toBe(true);
      });
    });

    test("debe manejar aspect ratio 3:4 vertical", () => {
      const resolutions = ResolutionUtils.generateLowerResolutions(1080, 1440);
      const aspectRatio = 1080 / 1440;
      
      resolutions.forEach(res => {
        const resAspectRatio = res.width / res.height;
        expect(Math.abs(resAspectRatio - aspectRatio)).toBeLessThan(0.02);
      });
    });
  });

  describe("Integración completa", () => {
    test("flujo completo: 1080p -> 720p, 480p, 360p", () => {
      const resolutions = ResolutionUtils.generateLowerResolutions(1920, 1080);
      
      expect(resolutions.length).toBeGreaterThan(0);
      
      // Debe incluir al menos 720p o resolución cercana
      const has720pArea = resolutions.some(r => 
        Math.abs(r.height - 720) < 50 || r.name.includes("720")
      );
      expect(has720pArea).toBe(true);
      
      // Todas válidas
      resolutions.forEach(res => {
        expect(ResolutionUtils.isValidResolution(res.width, res.height)).toBe(true);
      });
      
      // Formato FFmpeg funcional
      resolutions.forEach(res => {
        const formatted = ResolutionUtils.formatForFFmpeg(res);
        expect(formatted).toMatch(/^\d+x\d+$/);
      });
    });

    test("flujo completo: 480p -> 360p, 240p", () => {
      const resolutions = ResolutionUtils.generateLowerResolutions(854, 480);
      
      resolutions.forEach(res => {
        expect(res.width).toBeLessThan(854);
        expect(res.height).toBeLessThan(480);
        expect(ResolutionUtils.isValidResolution(res.width, res.height)).toBe(true);
      });
    });

    test("flujo completo con getResolutionInfo", () => {
      const info = ResolutionUtils.getResolutionInfo(1920, 1080);
      
      // Verificar estructura completa
      expect(info.aspectRatio).toBeTruthy();
      expect(info.resolutions).toBeTruthy();
      expect(info.totalPixelsReduction).toBeTruthy();
      
      // Verificar coherencia
      expect(info.resolutions.length).toBe(info.totalPixelsReduction.length);
      
      // Todas las resoluciones generadas deben ser válidas
      info.resolutions.forEach(res => {
        expect(ResolutionUtils.isValidResolution(res.width, res.height)).toBe(true);
      });
    });

    test("flujo adaptativo completo", () => {
      const high = ResolutionUtils.generateAdaptiveResolutions(1920, 1080, {
        qualityPreset: "high",
        targetCount: 5
      });
      
      const medium = ResolutionUtils.generateAdaptiveResolutions(1920, 1080, {
        qualityPreset: "medium",
        targetCount: 5
      });
      
      const low = ResolutionUtils.generateAdaptiveResolutions(1920, 1080, {
        qualityPreset: "low",
        targetCount: 5
      });
      
      // Verificar que todos generan resoluciones válidas
      [...high, ...medium, ...low].forEach(res => {
        expect(ResolutionUtils.isValidResolution(res.width, res.height)).toBe(true);
        expect(res.name).toBeTruthy();
        expect(res.bitrate).toMatch(/^\d+k$/);
      });
    });
  });
});