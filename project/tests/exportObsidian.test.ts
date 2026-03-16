import { describe, it, expect } from 'vitest';

/**
 * escapeYamlString is a local function inside exportToObsidianFormat, so we
 * replicate its logic here for direct unit-testing. If the implementation
 * changes, these tests should be updated to match.
 *
 * The canonical source is in lib/utils/exportObsidian.ts.
 */
function escapeYamlString(str: string): string {
  if (/[:#\[\]{}&*!|>',@`]/.test(str) || str.startsWith('-') || str.startsWith('?') || str.includes('\n')) {
    const escaped = str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    return `"${escaped}"`;
  }
  return str;
}

describe('escapeYamlString (Obsidian export helper)', () => {
  it('returns plain strings unchanged', () => {
    expect(escapeYamlString('Hello World')).toBe('Hello World');
  });

  it('wraps strings containing colons in double quotes', () => {
    const result = escapeYamlString('key: value');
    expect(result).toBe('"key: value"');
  });

  it('wraps strings containing hash in double quotes', () => {
    const result = escapeYamlString('C# programming');
    expect(result).toBe('"C# programming"');
  });

  it('wraps strings starting with dash in double quotes', () => {
    const result = escapeYamlString('- list item');
    expect(result).toBe('"- list item"');
  });

  it('wraps strings starting with question mark in double quotes', () => {
    const result = escapeYamlString('?unknown');
    expect(result).toBe('"?unknown"');
  });

  it('escapes embedded double quotes when quoting is triggered', () => {
    // Double quotes alone don't trigger quoting; a special char like : is needed
    const result = escapeYamlString('He said "hello": yes');
    expect(result).toBe('"He said \\"hello\\": yes"');
  });

  it('does not quote strings with only double quotes and no special chars', () => {
    const result = escapeYamlString('He said "hello"');
    expect(result).toBe('He said "hello"');
  });

  it('escapes backslashes before other escapes', () => {
    const result = escapeYamlString('path\\to: dir');
    expect(result).toBe('"path\\\\to: dir"');
  });

  it('converts newlines to \\n', () => {
    const result = escapeYamlString('line1\nline2');
    expect(result).toBe('"line1\\nline2"');
  });

  it('handles strings with square brackets', () => {
    const result = escapeYamlString('value [1]');
    expect(result).toBe('"value [1]"');
  });

  it('handles strings with curly braces', () => {
    const result = escapeYamlString('value {a}');
    expect(result).toBe('"value {a}"');
  });

  it('handles strings with ampersand', () => {
    const result = escapeYamlString('Tom & Jerry');
    expect(result).toBe('"Tom & Jerry"');
  });

  it('handles strings with asterisk', () => {
    const result = escapeYamlString('bold *text*');
    expect(result).toBe('"bold *text*"');
  });

  it('handles strings with single quote', () => {
    const result = escapeYamlString("it's a test");
    expect(result).toBe('"it\'s a test"');
  });

  it('handles strings with backtick', () => {
    const result = escapeYamlString('code `snippet`');
    expect(result).toBe('"code `snippet`"');
  });

  it('handles empty string', () => {
    expect(escapeYamlString('')).toBe('');
  });
});

/**
 * sanitizeFilename is also a local function. Replicate for direct testing.
 */
function sanitizeFilename(title: string): string {
  return title
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);
}

describe('sanitizeFilename (Obsidian export helper)', () => {
  it('leaves safe filenames unchanged', () => {
    expect(sanitizeFilename('My Video Title')).toBe('My Video Title');
  });

  it('replaces invalid Windows characters with dash', () => {
    expect(sanitizeFilename('test<>:"/\\|?*end')).toBe('test---------end');
  });

  it('normalizes whitespace', () => {
    expect(sanitizeFilename('hello   world')).toBe('hello world');
  });

  it('trims whitespace', () => {
    expect(sanitizeFilename('  hello  ')).toBe('hello');
  });

  it('truncates to 200 characters', () => {
    const longTitle = 'A'.repeat(250);
    expect(sanitizeFilename(longTitle).length).toBe(200);
  });
});
