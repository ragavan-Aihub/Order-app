const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function readDotEnv() {
  const file = path.join(__dirname, '.env');
  const values = {};
  if (!fs.existsSync(file)) {
    return values;
  }
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq < 1) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    values[key] = value;
  }
  return values;
}

function imageExtension(contentType, logoUrl) {
  const type = (contentType || '').toLowerCase();
  const url = logoUrl.toLowerCase();
  if (type.includes('png') || url.includes('.png')) {
    return 'png';
  }
  if (type.includes('jpeg') || type.includes('jpg') || url.includes('.jpg') || url.includes('.jpeg')) {
    return 'jpg';
  }
  return '';
}

function curl(args, encoding) {
  return execFileSync('curl', ['-fsS', '--max-time', '8', ...args], {
    encoding,
    timeout: 10000,
  });
}

function existingLaunchIcon() {
  let best = null;
  let bestTime = -1;
  for (const ext of ['png', 'jpg']) {
    try {
      const stat = fs.statSync(path.join(__dirname, 'assets/images', `dev-launch-icon.${ext}`));
      if (stat.size > 0 && stat.mtimeMs >= bestTime) {
        bestTime = stat.mtimeMs;
        best = `./assets/images/dev-launch-icon.${ext}`;
      }
    } catch {
      // No saved logo for this extension.
    }
  }
  return best;
}

/** Expo Go shows this file before the app opens. Keep the Profile logo, not the F2F mark. */
function fetchLaunchIcon(fileEnv) {
  const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || fileEnv.EXPO_PUBLIC_SUPABASE_URL || '')
    .trim()
    .replace(/\/$/, '');
  const anonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || fileEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  const businessId = (process.env.EXPO_PUBLIC_BUSINESS_ID || fileEnv.EXPO_PUBLIC_BUSINESS_ID || '').trim();
  if (!supabaseUrl || !anonKey || !businessId) {
    return existingLaunchIcon();
  }
  try {
    const raw = curl(
      [
        '-X',
        'POST',
        `${supabaseUrl}/rest/v1/rpc/get_business_public`,
        '-H',
        `apikey: ${anonKey}`,
        '-H',
        `Authorization: Bearer ${anonKey}`,
        '-H',
        'Content-Type: application/json',
        '-d',
        JSON.stringify({ p_business_id: businessId }),
      ],
      'utf8',
    );
    const rows = JSON.parse(raw);
    const logoUrl = (Array.isArray(rows) ? rows[0]?.logo_url : rows?.logo_url)?.trim?.() || '';
    if (!logoUrl) {
      return existingLaunchIcon();
    }
    const destBase = path.join(__dirname, 'assets/images/dev-launch-icon');
    const contentType = curl(['-L', '-o', `${destBase}.bin`, '-w', '%{content_type}', logoUrl], 'utf8');
    const ext = imageExtension(contentType, logoUrl);
    const downloaded = `${destBase}.bin`;
    if (!ext) {
      fs.rmSync(downloaded, { force: true });
      return existingLaunchIcon();
    }
    const relative = `./assets/images/dev-launch-icon.${ext}`;
    fs.renameSync(downloaded, path.join(__dirname, relative));
    return relative;
  } catch {
    return existingLaunchIcon();
  }
}

let launchIconCache;
let refreshStarted = false;

function loadLaunchIcon(fileEnv) {
  if (launchIconCache !== undefined) {
    return launchIconCache;
  }
  if (process.env.EAS_BUILD === 'true') {
    launchIconCache = null;
    return null;
  }
  const existing = existingLaunchIcon();
  if (existing) {
    launchIconCache = existing;
    if (!refreshStarted) {
      refreshStarted = true;
      setImmediate(() => {
        try {
          fetchLaunchIcon(fileEnv);
        } catch {
          // Keep the saved Profile logo.
        }
      });
    }
    return existing;
  }
  launchIconCache = fetchLaunchIcon(fileEnv);
  return launchIconCache;
}

module.exports = ({ config }) => {
  const fileEnv = readDotEnv();
  const samApiUrl = (
    process.env.EXPO_PUBLIC_SAM_API_URL ||
    fileEnv.EXPO_PUBLIC_SAM_API_URL ||
    ''
  ).trim();
  if (samApiUrl) {
    process.env.EXPO_PUBLIC_SAM_API_URL = samApiUrl;
  }
  const android = { ...config.android };
  let plugins = config.plugins ?? [];
  android.permissions = (android.permissions ?? []).filter((permission) => !/RECORD_AUDIO$/.test(permission));
  android.blockedPermissions = [
    ...new Set([
      ...(android.blockedPermissions ?? []),
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_SMS',
      'android.permission.RECEIVE_SMS',
      'android.permission.SEND_SMS',
      'android.permission.RECEIVE_MMS',
      'android.permission.RECEIVE_WAP_PUSH',
    ]),
  ];
  plugins = plugins.filter((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) !== 'expo-speech-recognition');
  const ios = { ...config.ios };
  const infoPlist = { ...(ios.infoPlist ?? {}) };
  delete infoPlist.NSMicrophoneUsageDescription;
  delete infoPlist.NSSpeechRecognitionUsageDescription;
  ios.infoPlist = infoPlist;

  const launchIcon = loadLaunchIcon(fileEnv);
  let icon = config.icon;
  let name = config.name;
  if (launchIcon) {
    icon = launchIcon;
    name = '\u200b';
    android.icon = launchIcon;
    android.adaptiveIcon = {
      ...(android.adaptiveIcon ?? {}),
      backgroundColor: '#F5F5F4',
      foregroundImage: launchIcon,
    };
    plugins = plugins.map((plugin) => {
      if (!Array.isArray(plugin) || plugin[0] !== 'expo-splash-screen') {
        return plugin;
      }
      return [
        plugin[0],
        {
          ...(plugin[1] ?? {}),
          backgroundColor: '#F5F5F4',
          image: launchIcon,
          imageWidth: 220,
        },
      ];
    });
  }

  return {
    ...config,
    name,
    icon,
    android,
    ios,
    plugins,
    extra: {
      ...config.extra,
      samApiUrl,
    },
  };
};
