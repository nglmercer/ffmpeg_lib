import { describe, test, expect } from 'bun:test';

describe('TypeScript Only Tests', () => {
  test('basic TypeScript test', () => {
    expect(true).toBe(true);
  });

  test('verify TypeScript compilation', () => {
    // This test verifies that TypeScript files can be imported
    // without CommonJS wrapper issues
    expect(typeof describe).toBe('function');
    expect(typeof test).toBe('function');
    expect(typeof expect).toBe('function');
  });
});