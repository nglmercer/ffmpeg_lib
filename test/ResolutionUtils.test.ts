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

      // Verificar que mantienen el aspect ratio
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
        expect(res.width).toBeLessThanOrEqual(640);
        expect(res.height).toBeLessThanOrEqual(360);
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
  });

  describe("generateAdaptiveResolutions", () => {
    test("debe generar número objetivo de resoluciones", () => {
      const resolutions = ResolutionUtils.generateAdaptiveResolutions(1920, 1080, {
        targetCount: 3
      });
      
      expect(resolutions.length).toBeLessThanOrEqual(3);
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
    });
  });

  describe("findClosestResolution", () => {
    test("debe encontrar la resolución más cercana", () => {
      const resolutions = ResolutionUtils.generateLowerResolutions(1920, 1080);
      const closest = ResolutionUtils.findClosestResolution(640, resolutions);
      
      expect(closest).toBeTruthy();
      // Verificar que encontró una resolución cercana (puede ser 720 o similar)
      expect(closest!.width).toBeGreaterThan(400);
      expect(closest!.width).toBeLessThan(900);
      
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
  });

  describe("isValidResolution", () => {
    test("debe validar resolución válida", () => {
      expect(ResolutionUtils.isValidResolution(1920, 1080)).toBe(true);
      expect(ResolutionUtils.isValidResolution(1280, 720)).toBe(true);
    });

    test("debe rechazar dimensiones impares", () => {
      expect(ResolutionUtils.isValidResolution(1921, 1080)).toBe(false);
      expect(ResolutionUtils.isValidResolution(1920, 1081)).toBe(false);
    });

    test("debe rechazar dimensiones negativas o cero", () => {
      expect(ResolutionUtils.isValidResolution(0, 1080)).toBe(false);
      expect(ResolutionUtils.isValidResolution(1920, 0)).toBe(false);
      expect(ResolutionUtils.isValidResolution(-1920, 1080)).toBe(false);
    });

    test("debe rechazar resoluciones muy pequeñas", () => {
      expect(ResolutionUtils.isValidResolution(100, 100)).toBe(false);
      expect(ResolutionUtils.isValidResolution(160, 80)).toBe(false);  // ⭐ Cambiar de 100 a 80
    });

    test("debe aceptar resolución mínima válida", () => {
      expect(ResolutionUtils.isValidResolution(160, 120)).toBe(true);
      expect(ResolutionUtils.isValidResolution(160, 90)).toBe(true);   // ⭐ AGREGAR esta línea
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
  });

  describe("getResolutionInfo", () => {
    test("debe retornar información completa", () => {
      const info = ResolutionUtils.getResolutionInfo(1920, 1080);
      
      expect(info.aspectRatio).toBeTruthy();
      expect(info.resolutions.length).toBeGreaterThan(0);
      expect(info.totalPixelsReduction.length).toBe(info.resolutions.length);
    });

    test("debe calcular reducción de píxeles correctamente", () => {
      const info = ResolutionUtils.getResolutionInfo(1920, 1080);
      
      info.totalPixelsReduction.forEach(reduction => {
        expect(reduction).toMatch(/-.+% pixels/);
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
      });
    });

    test("debe manejar video cuadrado 1:1", () => {
      const resolutions = ResolutionUtils.generateLowerResolutions(1080, 1080);
      
      expect(resolutions.length).toBeGreaterThan(0);
      resolutions.forEach(res => {
        expect(res.width).toBe(res.height); // Mantener cuadrado
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
      });
    });
  });

  describe("Integración completa", () => {
    test("flujo completo: 1080p -> 720p, 480p, 360p", () => {
      const resolutions = ResolutionUtils.generateLowerResolutions(1920, 1080);
      
      // Debe incluir al menos 720p
      const has720p = resolutions.some(r => 
        Math.abs(r.height - 720) < 50 || r.name.includes("720")
      );
      expect(has720p).toBe(true);
      
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
  });
});