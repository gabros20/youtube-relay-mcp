import { describe, expect, test } from 'bun:test';
import { stripFrontmatter } from '../src/frontmatter';

describe('stripFrontmatter', () => {
  test('removes a leading YAML block and its trailing blank line', () => {
    const md = '---\nname: youtube-relay\ndescription: Does things.\n---\n\n# Heading\n\nBody.\n';
    expect(stripFrontmatter(md)).toBe('# Heading\n\nBody.\n');
  });

  test('leaves a document without frontmatter untouched', () => {
    const md = '# Heading\n\nBody.\n';
    expect(stripFrontmatter(md)).toBe(md);
  });

  test('does not treat a horizontal rule further down as frontmatter', () => {
    const md = '# Heading\n\n---\n\n## Section\n';
    expect(stripFrontmatter(md)).toBe(md);
  });

  test('keeps `---` section dividers inside the body', () => {
    const md = '---\nname: x\n---\n\n# H\n\n---\n\n## Section\n';
    expect(stripFrontmatter(md)).toBe('# H\n\n---\n\n## Section\n');
  });

  test('handles CRLF line endings', () => {
    const md = '---\r\nname: x\r\n---\r\n\r\n# H\r\n';
    expect(stripFrontmatter(md)).toBe('# H\r\n');
  });

  test('returns the input unchanged when the block is never closed', () => {
    const md = '---\nname: x\n\n# H\n';
    expect(stripFrontmatter(md)).toBe(md);
  });

  test('handles a closing delimiter with no body after it', () => {
    expect(stripFrontmatter('---\nname: x\n---\n')).toBe('');
  });
});
