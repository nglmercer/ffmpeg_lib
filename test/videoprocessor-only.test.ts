import { describe, test, expect } from 'bun:test';
import { VideoProcessor } from '../src/VideoProcessor.js';

describe('Single File Test - VideoProcessor', () => {
  test('should import VideoProcessor without CommonJS error', () => {
    const processor = new VideoProcessor();
    expect(processor).toBeDefined();
    expect(typeof processor.processVideo).toBe('function');
  });
});