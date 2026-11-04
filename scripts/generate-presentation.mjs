/**
 * Build the project slide deck from docs/presentation.md.
 * Run from the repo root: npm run docs:presentation
 *
 * Writes:
 *   docs/pdf/Project-Presentation.pptx  (open in PowerPoint or Keynote)
 *   docs/pdf/Project-Presentation.html  (present in Safari or Chrome)
 *   docs/pdf/Project-Presentation.pdf   (one slide per page, when Chrome is available)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import PptxGenJS from 'pptxgenjs';
import puppeteer from 'puppeteer';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = join(root, 'docs/presentation.md');
const outDir = join(root, 'docs/pdf');
const htmlPath = join(outDir, 'Project-Presentation.html');
const pdfPath = join(outDir, 'Project-Presentation.pdf');
const pptxPath = join(outDir, 'Project-Presentation.pptx');

const chromeCandidates = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].filter(Boolean);

function chromePath() {
  return chromeCandidates.find((candidate) => existsSync(candidate)) ?? null;
}

function parseSlides(markdown) {
  const body = markdown.replace(/<!--[\s\S]*?-->/g, '').trim();
  return body
    .split(/\n---\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      let notes = '';
      const noteAt = chunk.indexOf('\n???\n');
      if (noteAt >= 0) {
        notes = chunk.slice(noteAt + 5).trim();
        chunk = chunk.slice(0, noteAt).trim();
      }
      let kicker = '';
      chunk = chunk.replace(/^kicker:\s*(.+)$/m, (_, value) => {
        kicker = value.trim();
        return '';
      }).trim();
      const titleMatch = chunk.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : 'Slide';
      const withoutTitle = chunk.replace(/^#\s+.+\n?/, '').trim();
      return { kicker, title, body: withoutTitle, notes };
    });
}

const css = `
  :root {
    --ink: #1c1917;
    --muted: #57534e;
    --line: #e7e5e4;
    --paper: #fafaf9;
    --green: #047857;
    --green-deep: #064e3b;
    --gold: #b45309;
    --card: #ffffff;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: #111; color: var(--ink); }
  body { font-family: "Avenir Next", "Segoe UI", sans-serif; }
  .deck { height: 100%; }
  .slide {
    display: none;
    height: 100%;
    padding: 56px 72px 72px;
    background:
      linear-gradient(180deg, rgba(4, 120, 87, 0.08), transparent 180px),
      var(--paper);
    position: relative;
  }
  .slide.active { display: flex; flex-direction: column; }
  .kicker {
    margin: 0 0 12px;
    color: var(--green);
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  h1 {
    margin: 0 0 28px;
    max-width: 18ch;
    font-size: 54px;
    line-height: 1.05;
    letter-spacing: -0.03em;
    color: var(--green-deep);
  }
  .body { font-size: 24px; line-height: 1.35; color: var(--ink); max-width: 1080px; }
  .body p { margin: 0 0 16px; }
  .body ul, .body ol { margin: 8px 0 0; padding-left: 1.2em; }
  .body li { margin: 10px 0; }
  .body li::marker { color: var(--green); }
  .body strong { color: var(--green-deep); }
  .body table { width: 100%; border-collapse: collapse; font-size: 22px; background: var(--card); }
  .body th, .body td { text-align: left; padding: 14px 16px; border-bottom: 1px solid var(--line); vertical-align: top; }
  .body th { color: var(--muted); font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase; }
  .num {
    position: absolute;
    right: 36px;
    bottom: 28px;
    margin: 0;
    color: var(--muted);
    font-size: 14px;
  }
  .notes { display: none; }
  body.show-notes .notes {
    display: block;
    position: absolute;
    left: 36px;
    right: 120px;
    bottom: 22px;
    margin: 0;
    padding-top: 10px;
    border-top: 1px solid var(--line);
    color: var(--muted);
    font-size: 16px;
    line-height: 1.4;
    white-space: pre-wrap;
  }
  .help {
    position: fixed;
    left: 16px;
    bottom: 12px;
    color: #a8a29e;
    font-size: 12px;
    z-index: 2;
  }
  @media print {
    html, body { height: auto; background: white; }
    .help { display: none; }
    .slide, .slide.active {
      display: flex;
      break-after: page;
      height: 7.5in;
      width: 13.333in;
      padding: 0.55in 0.7in 0.7in;
    }
    @page { size: 13.333in 7.5in; margin: 0; }
  }
`;

function renderHtml(slides) {
  const sections = slides
    .map((slide, index) => {
      const body = slide.body ? marked.parse(slide.body) : '';
      const notes = slide.notes ? `<p class="notes">${escapeHtml(slide.notes)}</p>` : '';
      return `<section class="slide${index === 0 ? ' active' : ''}" data-index="${index}">
        ${slide.kicker ? `<p class="kicker">${escapeHtml(slide.kicker)}</p>` : ''}
        <h1>${escapeHtml(slide.title)}</h1>
        <div class="body">${body}</div>
        ${notes}
        <p class="num">${index + 1} / ${slides.length}</p>
      </section>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Farm2Flavour — project presentation</title>
  <style>${css}</style>
</head>
<body>
  <main class="deck" id="deck">${sections}</main>
  <p class="help">Arrow keys · F full screen · N speaker notes</p>
  <script>
    const slides = [...document.querySelectorAll('.slide')];
    let index = 0;
    function show(next) {
      index = Math.max(0, Math.min(slides.length - 1, next));
      slides.forEach((slide, i) => slide.classList.toggle('active', i === index));
    }
    document.addEventListener('keydown', (event) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key)) {
        event.preventDefault();
        show(index + 1);
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(event.key)) {
        event.preventDefault();
        show(index - 1);
      } else if (event.key === 'Home') {
        show(0);
      } else if (event.key === 'End') {
        show(slides.length - 1);
      } else if (event.key.toLowerCase() === 'f') {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
      } else if (event.key.toLowerCase() === 'n') {
        document.body.classList.toggle('show-notes');
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function contentBlocks(body) {
  const lines = body.split('\n');
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.trim().startsWith('|')) {
      const rows = [];
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        const raw = lines[index].trim();
        if (!/^\|\s*-+/.test(raw)) {
          rows.push(
            raw
              .replace(/^\|/, '')
              .replace(/\|$/, '')
              .split('|')
              .map((cell) => cell.trim().replace(/\*\*/g, '').replace(/`/g, '')),
          );
        }
        index += 1;
      }
      blocks.push({ type: 'table', rows });
      continue;
    }
    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\./.test(line);
      const items = [];
      while (index < lines.length && (/^[-*]\s+/.test(lines[index]) || /^\d+\.\s+/.test(lines[index]))) {
        items.push(lines[index].replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, ''));
        index += 1;
      }
      blocks.push({ type: ordered ? 'ol' : 'ul', items });
      continue;
    }
    const paragraph = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trim().startsWith('|') &&
      !/^[-*]\s+/.test(lines[index]) &&
      !/^\d+\.\s+/.test(lines[index])
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: 'p', text: paragraph.join(' ') });
  }
  return blocks;
}

function textRuns(value) {
  return value
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/)
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return { text: part.slice(2, -2), options: { bold: true } };
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return { text: part.slice(1, -1), options: { fontFace: 'Menlo' } };
      }
      return { text: part, options: {} };
    });
}

function pushRuns(parts, runs, { bullet = false, spaceBefore = 0, spaceAfter = 6 } = {}) {
  runs.forEach((run, index) => {
    parts.push({
      text: run.text,
      options: {
        ...run.options,
        bullet: bullet && index === 0,
        breakLine: index === runs.length - 1,
        paraSpaceBefore: index === 0 ? spaceBefore : 0,
        paraSpaceAfter: index === runs.length - 1 ? spaceAfter : 0,
      },
    });
  });
}

function textParts(blocks) {
  const parts = [];
  blocks.forEach((block) => {
    if (block.type === 'table') {
      return;
    }
    if (block.type === 'p') {
      const onlyBold = /^\*\*[^*]+\*\*$/.test(block.text);
      pushRuns(parts, textRuns(block.text), {
        spaceBefore: onlyBold ? 10 : 2,
        spaceAfter: onlyBold ? 2 : 8,
      });
      if (onlyBold) {
        parts[parts.length - 1].options.bold = true;
      }
      return;
    }
    block.items.forEach((item, itemIndex) => {
      const runs = textRuns(item);
      if (block.type === 'ol') {
        runs.unshift({ text: `${itemIndex + 1}.  `, options: { bold: true, color: '047857' } });
      }
      pushRuns(parts, runs, { bullet: block.type === 'ul', spaceAfter: 7 });
    });
  });
  return parts;
}

async function writePptx(deck) {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'WIDE', width: 13.333, height: 7.5 });
  pptx.layout = 'WIDE';
  pptx.author = 'Farm2Flavour';
  pptx.title = 'Farm2Flavour — project presentation';
  pptx.subject = 'How the customer app, admin panel, and delivery app work';

  deck.forEach((item, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: index === 0 ? '064E3B' : 'FAF8F5' };
    if (index !== 0) {
      slide.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 0,
        w: 0.12,
        h: 7.5,
        fill: { color: '047857' },
      });
    }

    const titleColor = index === 0 ? 'FFFFFF' : '064E3B';
    const bodyColor = index === 0 ? 'ECFDF5' : '292524';
    const titleSize = item.title.length > 42 ? 32 : 36;
    slide.addText(item.kicker || '', {
      x: 0.55,
      y: 0.32,
      w: 10,
      h: 0.32,
      fontFace: 'Avenir Next',
      fontSize: 13,
      bold: true,
      color: index === 0 ? 'A7F3D0' : '047857',
      margin: 0,
      charSpacing: 1.4,
    });
    slide.addText(item.title, {
      x: 0.55,
      y: 0.68,
      w: 12.1,
      h: item.title.length > 36 ? 1.35 : 0.95,
      fontFace: 'Avenir Next',
      fontSize: titleSize,
      bold: true,
      color: titleColor,
      margin: 0,
    });

    const blocks = contentBlocks(item.body);
    const tables = blocks.filter((block) => block.type === 'table');
    const copy = textParts(blocks);
    const lineCount = blocks.reduce((sum, block) => {
      if (block.type === 'table') return sum;
      if (block.type === 'p') return sum + 1;
      return sum + block.items.length;
    }, 0);
    const fontSize = lineCount > 12 ? 16 : lineCount > 8 ? 18 : 22;
    let cursor = item.title.length > 36 ? 2.2 : 1.85;

    for (const table of tables) {
      const rowCount = table.rows.length;
      const tableHeight = Math.min(3.4, 0.42 * rowCount + 0.2);
      slide.addTable(
        table.rows.map((row, rowIndex) =>
          row.map((cell) => ({
            text: cell,
            options: {
              fill: { color: rowIndex === 0 ? 'ECFDF5' : 'FFFFFF' },
              color: rowIndex === 0 ? '047857' : '292524',
              bold: rowIndex === 0,
              fontFace: 'Avenir Next',
              fontSize: 16,
              align: 'left',
              valign: 'middle',
            },
          })),
        ),
        {
          x: 0.55,
          y: cursor,
          w: 12.1,
          h: tableHeight,
          colW: table.rows[0]?.length === 3 ? [3.2, 4.2, 4.7] : [3.4, 8.7],
          border: [{ pt: 0, color: 'FAF8F5' }, { pt: 0, color: 'FAF8F5' }, { pt: 0.5, color: 'E7E5E4' }, { pt: 0, color: 'FAF8F5' }],
          fontFace: 'Avenir Next',
        },
      );
      cursor += tableHeight + 0.25;
    }

    if (copy.length > 0) {
      slide.addText(copy, {
        x: 0.55,
        y: cursor,
        w: 12.1,
        h: 7.05 - cursor,
        fontFace: 'Avenir Next',
        fontSize,
        color: bodyColor,
        valign: 'top',
        margin: 0,
      });
    }

    slide.addText(String(index + 1), {
      x: 12.1,
      y: 7.05,
      w: 0.7,
      h: 0.28,
      fontFace: 'Avenir Next',
      fontSize: 12,
      color: index === 0 ? 'A7F3D0' : 'A8A29E',
      align: 'right',
      margin: 0,
    });
    if (item.notes) {
      slide.addNotes(item.notes);
    }
  });

  await pptx.writeFile({ fileName: pptxPath });
  console.log(`Wrote ${pptxPath} (${deck.length} slides)`);
}

const slides = parseSlides(readFileSync(sourcePath, 'utf8'));
mkdirSync(outDir, { recursive: true });
await writePptx(slides);
writeFileSync(htmlPath, renderHtml(slides));
console.log(`Wrote ${htmlPath} (${slides.length} slides)`);

const executablePath = chromePath();
if (!executablePath) {
  console.log('Chrome was not found, so the PDF was not written. Open the HTML and use Print, or set CHROME_PATH.');
  process.exit(0);
}

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
try {
  const page = await browser.newPage();
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
  await page.emulateMediaType('print');
  const pdf = await page.pdf({
    width: '13.333in',
    height: '7.5in',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    preferCSSPageSize: true,
  });
  writeFileSync(pdfPath, pdf);
  console.log(`Wrote ${pdfPath} (${pdf.length} bytes)`);
} finally {
  await browser.close();
}
