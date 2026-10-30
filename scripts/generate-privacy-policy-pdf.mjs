/**
 * Readable privacy policy PDF for sharing with the business owner.
 * Run: npm run docs:privacy-pdf
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import pkg from 'md-to-pdf';

const mdToPdf = pkg.default ?? pkg;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mdPath = join(root, 'docs/privacy-policy-for-review.md');
const cssPath = join(root, 'docs/privacy-policy-pdf.css');
const outDir = join(root, 'docs/pdf');
const pdfPath = join(outDir, 'Privacy-Policy-For-Review.pdf');
const htmlPath = join(outDir, 'Privacy-Policy-For-Review.html');
const txtPath = join(outDir, 'Privacy-Policy-For-Review.txt');

mkdirSync(outDir, { recursive: true });

const markdown = readFileSync(mdPath, 'utf8');
const css = readFileSync(cssPath, 'utf8');
const bodyHtml = marked.parse(markdown);

writeFileSync(
  htmlPath,
  `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Farm2Flavours — Privacy policy (draft)</title>
  <style>${css}
  body { max-width: 720px; margin: 24px auto; padding: 0 16px 48px; }
  @media print { body { max-width: none; margin: 0; } }
  </style>
</head>
<body>${bodyHtml}
<p style="margin-top:32px;font-size:10pt;color:#666;">Open in Safari or Chrome → File → Print → Save as PDF if you need another copy.</p>
</body>
</html>`,
  'utf8',
);

writeFileSync(txtPath, markdown.replace(/^#+ /gm, '').replace(/\*\*/g, ''), 'utf8');

await mdToPdf(
  { path: mdPath },
  {
    basedir: root,
    dest: pdfPath,
    css: cssPath,
    pdf_options: {
      format: 'A4',
      margin: { top: '22mm', right: '18mm', bottom: '22mm', left: '18mm' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate:
        '<div style="font-size:9px;width:100%;text-align:center;color:#444;font-family:Arial,sans-serif;">Farm2Flavours privacy draft · Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
    },
  },
);

console.log('Wrote', pdfPath);
console.log('Wrote', htmlPath, '(open in browser if PDF viewer fails)');
console.log('Wrote', txtPath, '(plain text for WhatsApp/email)');
console.log('');
console.log('Do not open the .pdf inside Cursor — use Preview, Adobe, or your phone.');
