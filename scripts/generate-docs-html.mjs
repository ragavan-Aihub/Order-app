/**
 * Standalone HTML copies of the guides (open in any browser, Print → PDF).
 * Run: node scripts/generate-docs-html.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'docs/pdf-style.css'), 'utf8');

const guides = [
  { title: 'Ordering App Business Guide', input: 'docs/business-guide.md', output: 'docs/pdf/Business-Guide.html' },
  { title: 'Ordering App Technical Guide', input: 'docs/technical-guide.md', output: 'docs/pdf/Technical-Guide.html' },
];

mkdirSync(join(root, 'docs/pdf'), { recursive: true });

for (const guide of guides) {
  const markdown = readFileSync(join(root, guide.input), 'utf8').replace(/^---[\s\S]*?---\n/, '');
  const body = marked.parse(markdown);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${guide.title}</title>
  <style>
    body { max-width: 820px; margin: 24px auto; padding: 0 16px 48px; }
    ${css}
    @media print { body { max-width: none; margin: 0; } }
  </style>
</head>
<body class="markdown-body">${body}</body>
</html>`;
  writeFileSync(join(root, guide.output), html);
  console.log('Wrote', guide.output);
}
