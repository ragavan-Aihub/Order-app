/**
 * Generate Business + Technical guide PDFs (full document print).
 * Run from repo root: npm run docs:pdf
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import puppeteer from 'puppeteer';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'docs/pdf-style.css'), 'utf8');

const guides = [
  {
    title: 'Ordering App Business Guide',
    input: join(root, 'docs/business-guide.md'),
    output: join(root, 'docs/pdf/Business-Guide.pdf'),
    footer: 'Business Guide',
  },
  {
    title: 'Ordering App Technical Guide',
    input: join(root, 'docs/technical-guide.md'),
    output: join(root, 'docs/pdf/Technical-Guide.pdf'),
    footer: 'Technical Guide',
  },
];

function stripFrontmatter(markdown) {
  return markdown.replace(/^---[\s\S]*?---\n/, '');
}

function buildHtml(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>${css}</style>
</head>
<body class="markdown-body">${bodyHtml}</body>
</html>`;
}

mkdirSync(join(root, 'docs/pdf'), { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  for (const guide of guides) {
    process.stdout.write(`PDF: ${guide.input} … `);
    const markdown = readFileSync(guide.input, 'utf8');
    const bodyHtml = marked.parse(stripFrontmatter(markdown));
    const html = buildHtml(guide.title, bodyHtml);

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.emulateMediaType('print');

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '22mm', right: '16mm', bottom: '22mm', left: '16mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="font-size:9px;width:100%;text-align:center;color:#71717a;font-family:Arial,sans-serif;">${guide.footer} · Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
    });

    writeFileSync(guide.output, pdf);
    await page.close();
    process.stdout.write(`→ ${guide.output} (${pdf.length} bytes)\n`);
  }
} finally {
  await browser.close();
}
