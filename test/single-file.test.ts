import { describe, test, expect } from 'bun:test';

// Test just one JavaScript file at a time to isolate the issue
try {
  const { FFmpegManager } = await import('../src/FFmpegManager.js');
  
  describe('Single File Test - FFmpegManager', () => {
    test('should import FFmpegManager without CommonJS error', () => {
      const manager = new FFmpegManager();
      expect(manager).toBeDefined();
      expect(typeof manager.downloadFFmpegBinaries).toBe('function');
    });
  });
} catch (error) {
  describe('Single File Test - FFmpegManager', () => {
    test('should handle import error gracefully', () => {
      console.error('Import error:', error);
      // This test will fail but provide useful error information
      expect(error).toBeNull();
    });
  });
}