import { describe, test, expect } from 'bun:test';

// Test just FFmpegCtrl.js
try {
  const { FFmpegCtrl } = await import('../src/FFmpegCtrl.js');
  
  describe('Single File Test - FFmpegCtrl', () => {
    test('should import FFmpegCtrl without CommonJS error', () => {
      const ctrl = new FFmpegCtrl('/path/to/ffmpeg', '/path/to/ffprobe');
      expect(ctrl).toBeDefined();
      expect(typeof ctrl.processVideo).toBe('function');
    });
  });
} catch (error) {
  describe('Single File Test - FFmpegCtrl', () => {
    test('should handle import error gracefully', () => {
      console.error('FFmpegCtrl import error:', error);
      expect(error).toBeNull();
    });
  });
}