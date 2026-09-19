import { describe, it, expect } from 'vitest';
import { countCharacters, validMessage } from './chat-rules';
describe('20-character human messages', () => {
  it('accepts 20 but not 21 visible characters', () => {
    expect(validMessage('书'.repeat(20))).toBe(true);
    expect(validMessage('书'.repeat(21))).toBe(false);
  });
  it('counts family emoji as one', () => {
    expect(countCharacters('👨‍👩‍👧‍👦')).toBe(1);
    expect(validMessage('👨‍👩‍👧‍👦'.repeat(20))).toBe(true);
  });
  it('rejects empty and whitespace', () => {
    expect(validMessage('  ')).toBe(false);
    expect(validMessage('')).toBe(false);
  });
});
