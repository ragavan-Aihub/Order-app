import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import XLSX from 'xlsx';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const csvPath = join(root, 'docs/qa-test-cases.csv');
const xlsxPath = join(root, 'docs/qa-test-cases.xlsx');

const howTo = [
  ['Farm2Flavour — test cases for friends and shop staff'],
  [''],
  ['How to use this file'],
  ['1. Open the sheet named Test cases.'],
  ['2. Start at Step 1 and go down in order. Later steps assume the shop is already signed in and has a few products.'],
  ['3. Read Use case (what we are checking), then What to do, then What you should see.'],
  ['4. In Status write: Pass, Fail, Blocked, or Not started. If it fails, add a short note in a column you add yourself (for example Notes).'],
  [''],
  ['Priority'],
  ['P0 — Must work before we go live (sign-in, place order, deliver, take payment, real SMS).'],
  ['P1 — Should work before go-live (everyday shop and customer tasks).'],
  ['P2 — Useful, but there is a workaround if it fails.'],
  ['P3 — Nice to check after the app is on the Play Store, or low risk.'],
  [''],
  ['Apps'],
  ['Admin panel — shop website in the browser.'],
  ['Order app — customer phone app.'],
  ['Delivery app — optional phone app for the person who delivers (same email and password as the admin website).'],
  [''],
  ['Suggested first session'],
  ['Do every P0 row, especially Step 57 (one order from the customer through payment). Then do P1 rows in step order.'],
  [''],
  ['Words'],
  ['Placed — customer just ordered; shop has not confirmed yet.'],
  ['Confirmed — shop accepted the order.'],
  ['Out for delivery — on the way.'],
  ['Delivered — handed over.'],
  ['Outstanding — delivered but not paid yet.'],
  ['OTP — the 6-digit code sent by SMS to sign in.'],
];

const workbook = XLSX.utils.book_new();
const intro = XLSX.utils.aoa_to_sheet(howTo);
intro['!cols'] = [{ wch: 110 }];
XLSX.utils.book_append_sheet(workbook, intro, 'How to use');

const csv = readFileSync(csvPath, 'utf8');
const casesBook = XLSX.read(csv, { type: 'string' });
const cases = casesBook.Sheets[casesBook.SheetNames[0]];
cases['!cols'] = [
  { wch: 6 },
  { wch: 12 },
  { wch: 28 },
  { wch: 16 },
  { wch: 10 },
  { wch: 62 },
  { wch: 72 },
  { wch: 72 },
  { wch: 14 },
];
XLSX.utils.book_append_sheet(workbook, cases, 'Test cases');

XLSX.writeFile(workbook, xlsxPath);
console.log(`Wrote ${xlsxPath}`);
