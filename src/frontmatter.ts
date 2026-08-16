/**
 * Remove a leading YAML frontmatter block from a Markdown document.
 *
 * SKILL.md needs frontmatter so Claude Code can discover the skill by name and
 * description, but consumers that embed the skill body (a tool description, a
 * prompt) want the prose only. A document without frontmatter, or with an
 * unterminated block, is returned unchanged — `---` used as a section divider
 * further down the file is never mistaken for a delimiter.
 */
export function stripFrontmatter(markdown: string): string {
  const lines = markdown.split('\n');
  if (lines[0]?.trimEnd() !== '---') return markdown;

  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trimEnd() !== '---') continue;
    // Drop the closing delimiter plus one blank separator line, if present.
    const start = lines[i + 1]?.trim() === '' ? i + 2 : i + 1;
    return lines.slice(start).join('\n');
  }

  return markdown;
}
