#!/usr/bin/env node
/**
 * Prints Supabase targets for admin, mobile, and CLI link.
 * Warns on prod ref or admin/mobile mismatch.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');

const prodRefs = new Set(
  (process.env.ORDERAPP_PROD_SUPABASE_REFS ?? 'wskzdjpjmxhulgoevaim')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

function parseDotEnv(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadEnv(relPath) {
  const path = join(root, relPath);
  if (!existsSync(path)) return null;
  return parseDotEnv(readFileSync(path, 'utf8'));
}

function hostFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url || '(missing)';
  }
}

function refFromHost(host) {
  const m = /^([a-z0-9]+)\.supabase\.co$/i.exec(host);
  return m ? m[1] : null;
}

function labelRef(ref) {
  if (!ref) return 'unknown';
  if (prodRefs.has(ref)) return `${ref} ⚠ PRODUCTION`;
  return ref;
}

const admin = loadEnv('admin/.env');
const mobile = loadEnv('mobile/.env');
const cliRef = existsSync(join(root, 'supabase/.temp/project-ref'))
  ? readFileSync(join(root, 'supabase/.temp/project-ref'), 'utf8').trim()
  : null;

const adminUrl = admin?.NEXT_PUBLIC_SUPABASE_URL ?? '';
const mobileUrl = mobile?.EXPO_PUBLIC_SUPABASE_URL ?? '';

console.log('Supabase environment check\n');
console.log('Admin (admin/.env):', admin ? hostFromUrl(adminUrl) : '(no admin/.env)');
if (admin) console.log('  ref:', labelRef(refFromHost(hostFromUrl(adminUrl))));
console.log('Mobile (mobile/.env):', mobile ? hostFromUrl(mobileUrl) : '(no mobile/.env)');
if (mobile) console.log('  ref:', labelRef(refFromHost(hostFromUrl(mobileUrl))));
console.log('CLI link (supabase/.temp/project-ref):', cliRef ? labelRef(cliRef) : '(not linked)');

const adminRef = refFromHost(hostFromUrl(adminUrl));
const mobileRef = refFromHost(hostFromUrl(mobileUrl));
let exitCode = 0;

if (admin && mobile && adminRef && mobileRef && adminRef !== mobileRef) {
  console.log('\n⚠ Admin and mobile point at different projects.');
  exitCode = 1;
}

if (admin && adminRef && prodRefs.has(adminRef)) {
  console.log('\n⚠ admin/.env uses PRODUCTION. Use staging for daily dev (see docs/supabase-environments.md).');
  exitCode = 1;
}

if (mobile && mobileRef && prodRefs.has(mobileRef)) {
  console.log('\n⚠ mobile/.env uses PRODUCTION. Use staging for daily dev.');
  exitCode = 1;
}

if (cliRef && prodRefs.has(cliRef) && (adminRef !== cliRef || mobileRef !== cliRef)) {
  console.log('\n⚠ CLI is linked to PRODUCTION while apps may target another project.');
  exitCode = 1;
}

if (exitCode === 0 && admin && mobile) {
  console.log('\nOK: admin and mobile match (non-prod or intentional prod).');
}

process.exit(exitCode);