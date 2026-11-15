/**
 * Builds docs/qa-test-cases.csv and docs/qa-test-cases.xlsx from scripts/qa-test-case-rows.mjs.
 * Run: npm run docs:qa-xlsx
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

import { COLUMNS, ROWS, SHEET_ORDER } from './qa-test-case-rows.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const csvPath = join(root, 'docs/qa-test-cases.csv');
const xlsxPath = join(root, 'docs/qa-test-cases.xlsx');

function csvCell(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function prefixFor(row) {
  if (row.module === 'Store review') {
    return 'PLAY';
  }
  if (row.app.startsWith('Order app →')) {
    return 'E2E';
  }
  if (row.app === 'Admin panel') {
    return 'A';
  }
  if (row.app === 'Delivery app') {
    return 'D';
  }
  return 'O';
}

function withOrderedIds(rows) {
  const count = { A: 0, O: 0, D: 0, E2E: 0, PLAY: 0 };
  return rows.map((row) => {
    if (!SHEET_ORDER.includes(row.module)) {
      throw new Error(`Unknown module "${row.module}"`);
    }
    const prefix = prefixFor(row);
    count[prefix] += 1;
    return { ...row, id: `TC-${prefix}-${String(count[prefix]).padStart(3, '0')}` };
  });
}

const ORDERED = withOrderedIds(ROWS);
const ids = new Set();
for (const row of ORDERED) {
  if (ids.has(row.id)) {
    throw new Error(`Duplicate test case id ${row.id}`);
  }
  ids.add(row.id);
}

const grouped = new Map(SHEET_ORDER.map((name) => [name, []]));
for (const row of ORDERED) {
  grouped.get(row.module).push(row);
}

function cells(row, seq) {
  return [
    seq,
    row.id,
    row.app,
    row.module,
    row.type,
    row.priority,
    row.pre,
    row.use,
    row.todo,
    row.see,
    '',
  ];
}

const csvLines = [COLUMNS.map(csvCell).join(',')];
const allAoA = [COLUMNS];
let globalSeq = 0;
for (const moduleName of SHEET_ORDER) {
  const list = grouped.get(moduleName);
  list.forEach((row) => {
    globalSeq += 1;
    const line = cells(row, globalSeq);
    csvLines.push(line.map(csvCell).join(','));
    allAoA.push(line);
  });
}
writeFileSync(csvPath, `${csvLines.join('\n')}\n`, 'utf8');

const colWidths = [
  { wch: 6 },
  { wch: 14 },
  { wch: 28 },
  { wch: 16 },
  { wch: 10 },
  { wch: 10 },
  { wch: 42 },
  { wch: 52 },
  { wch: 72 },
  { wch: 72 },
  { wch: 12 },
];

function sheetFromAoA(aoa) {
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet['!cols'] = colWidths;
  return sheet;
}

const howTo = [
  ['Farm2Flavour — test cases by module'],
  [''],
  ['How to use this file'],
  ['1. Open Index to see every module sheet and how many P0 checks it has.'],
  ['2. Open one module sheet (for example Sign-up or Notifications). Work top to bottom using Seq.'],
  ['3. When Sign-up (or any module) changes later, add a new row on that module only. Re-run npm run docs:qa-xlsx so Test case ids stay in order (TC-A-001, TC-A-002, …).'],
  ['4. Read Preconditions, then Use case, then What to do, then What you should see.'],
  ['5. In Status write: Pass, Fail, Blocked, or Not started. If it fails, add a Notes column yourself.'],
  ['6. All cases is the same list in one sheet if you want to filter.'],
  [''],
  ['Type'],
  ['Happy — normal success path.'],
  ['Negative — should be blocked or show an error.'],
  ['Edge — limits, timing, offline, or rare timing.'],
  [''],
  ['Priority'],
  ['P0 — Must work before we go live.'],
  ['P1 — Should work before go-live.'],
  ['P2 — Useful; a workaround exists if it fails.'],
  ['P3 — After Play Store, or low risk.'],
  [''],
  ['Apps'],
  ['Admin panel — shop website in the browser.'],
  ['Order app — customer phone app (preview APK, not a Metro URL).'],
  ['Delivery app — staff phone app (same email and password as the admin website).'],
  [''],
  ['Suggested first session'],
  ['Filter All cases by Priority = P0. Always run customer Google and email sign-in, Notifications P0 rows, and End-to-end.'],
  [''],
  ['Words'],
  ['Placed — customer just ordered; shop has not confirmed yet.'],
  ['Confirmed — shop accepted the order. Customer can still cancel (with a reason) until Out for delivery.'],
  ['Out for delivery — on the way. Customer cannot cancel in the app.'],
  ['Delivered — handed over.'],
  ['Outstanding — delivered but not paid yet.'],
  ['Inbox — Notifications list in the customer app (latest 20).'],
  ['Google sign-in — Continue with Google. No password.'],
  ['Email link — Continue with Email, then the link from Supabase Auth.'],
];

const workbook = XLSX.utils.book_new();
const intro = XLSX.utils.aoa_to_sheet(howTo);
intro['!cols'] = [{ wch: 110 }];
XLSX.utils.book_append_sheet(workbook, intro, 'How to use');

const indexAoA = [
  ['Module', 'Sheets as', 'Cases', 'P0', 'P1', 'P2', 'P3'],
];
for (const moduleName of SHEET_ORDER) {
  const list = grouped.get(moduleName);
  if (list.length === 0) {
    continue;
  }
  const count = (priority) => list.filter((row) => row.priority === priority).length;
  indexAoA.push([moduleName, moduleName, list.length, count('P0'), count('P1'), count('P2'), count('P3')]);
}
indexAoA.push([]);
indexAoA.push(['Total', '', ORDERED.length, '', '', '', '']);
const indexSheet = XLSX.utils.aoa_to_sheet(indexAoA);
indexSheet['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }];
XLSX.utils.book_append_sheet(workbook, indexSheet, 'Index');

for (const moduleName of SHEET_ORDER) {
  const list = grouped.get(moduleName);
  if (list.length === 0) {
    continue;
  }
  const aoa = [COLUMNS, ...list.map((row, index) => cells(row, index + 1))];
  XLSX.utils.book_append_sheet(workbook, sheetFromAoA(aoa), moduleName.slice(0, 31));
}

XLSX.utils.book_append_sheet(workbook, sheetFromAoA(allAoA), 'All cases');
XLSX.writeFile(workbook, xlsxPath);

console.log(`Wrote ${csvPath} (${ORDERED.length} cases)`);
console.log(`Wrote ${xlsxPath}`);
