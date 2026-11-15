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

function imageExtension(contentType, fileUrl) {
  const type = (contentType || '').toLowerCase();
  const url = (fileUrl || '').toLowerCase();
  if (type.includes('png') || url.includes('.png')) {
    return 'png';
  }
  if (type.includes('jpeg') || type.includes('jpg') || url.includes('.jpg') || url.includes('.jpeg')) {
    return 'jpg';
  }
  return '';
}

function curl(args, encoding) {
  return execFileSync('curl', ['-fsS', '--max-time', '20', ...args], {
    encoding,
    timeout: 25000,
  });
}

function existingFile(relative) {
  try {
    const stat = fs.statSync(path.join(__dirname, relative));
    return stat.size > 0 ? relative : null;
  } catch {
    return null;
  }
}

function existingLaunchIcon() {
  return (
    existingFile('./assets/images/shop-app-icon.png') ||
    existingFile('./assets/images/dev-launch-icon.png') ||
    existingFile('./assets/images/dev-launch-icon.jpg')
  );
}

let shopRowCache;
let shopRowTried = false;

function fetchShopRow(fileEnv) {
  if (shopRowTried) {
    return shopRowCache;
  }
  shopRowTried = true;
  const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || fileEnv.EXPO_PUBLIC_SUPABASE_URL || '')
    .trim()
    .replace(/\/$/, '');
  const anonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || fileEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  const businessId = (process.env.EXPO_PUBLIC_BUSINESS_ID || fileEnv.EXPO_PUBLIC_BUSINESS_ID || '').trim();
  if (!supabaseUrl || !anonKey || !businessId) {
    shopRowCache = null;
    return null;
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
    shopRowCache = (Array.isArray(rows) ? rows[0] : rows) || null;
  } catch {
    shopRowCache = null;
  }
  return shopRowCache;
}

function downloadImage(fileUrl, destRelative) {
  const destPath = path.join(__dirname, destRelative);
  const tempPath = `${destPath}.bin`;
  const contentType = curl(['-L', '-o', tempPath, '-w', '%{content_type}', fileUrl], 'utf8');
  const ext = imageExtension(contentType, fileUrl);
  if (!ext || (destRelative.endsWith('.png') && ext !== 'png')) {
    fs.rmSync(tempPath, { force: true });
    return null;
  }
  fs.renameSync(tempPath, destPath);
  return destRelative;
}

/** Colour home-screen icon from Profile (saved app icon, else logo). */
function fetchLaunchIcon(fileEnv) {
  try {
    const shop = fetchShopRow(fileEnv);
    const colourUrl = shop?.app_icon_url?.trim?.() || shop?.logo_url?.trim?.() || '';
    if (!colourUrl) {
      return existingLaunchIcon();
    }
    if (shop?.app_icon_url?.trim?.()) {
      return downloadImage(colourUrl, './assets/images/shop-app-icon.png') || existingLaunchIcon();
    }
    const destBase = path.join(__dirname, 'assets/images/dev-launch-icon');
    const contentType = curl(['-L', '-o', `${destBase}.bin`, '-w', '%{content_type}', colourUrl], 'utf8');
    const ext = imageExtension(contentType, colourUrl);
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

function fetchNotificationIcon(fileEnv) {
  try {
    const shop = fetchShopRow(fileEnv);
    const glyphUrl = shop?.notification_icon_url?.trim?.() || '';
    if (!glyphUrl) {
      return existingFile('./assets/images/shop-notification-icon.png');
    }
    return (
      downloadImage(glyphUrl, './assets/images/shop-notification-icon.png') ||
      existingFile('./assets/images/shop-notification-icon.png')
    );
  } catch {
    return existingFile('./assets/images/shop-notification-icon.png');
  }
}

let launchIconCache;
let notificationIconCache;
let refreshStarted = false;

function loadLaunchIcon(fileEnv) {
  if (launchIconCache !== undefined) {
    return launchIconCache;
  }
  const existing = existingLaunchIcon();
  if (process.env.EAS_BUILD === 'true') {
    launchIconCache = fetchLaunchIcon(fileEnv);
    return launchIconCache;
  }
  if (existing) {
    launchIconCache = existing;
    if (!refreshStarted) {
      refreshStarted = true;
      setImmediate(() => {
        try {
          fetchLaunchIcon(fileEnv);
          fetchNotificationIcon(fileEnv);
        } catch {
          // Keep the saved Profile icon.
        }
      });
    }
    return existing;
  }
  launchIconCache = fetchLaunchIcon(fileEnv);
  return launchIconCache;
}

function loadNotificationIcon(fileEnv) {
  if (notificationIconCache !== undefined) {
    return notificationIconCache;
  }
  if (process.env.EAS_BUILD === 'true') {
    notificationIconCache = fetchNotificationIcon(fileEnv);
    return notificationIconCache;
  }
  notificationIconCache =
    existingFile('./assets/images/shop-notification-icon.png') || fetchNotificationIcon(fileEnv);
  return notificationIconCache;
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

  const easBuild = process.env.EAS_BUILD === 'true';
  const launchIcon = loadLaunchIcon(fileEnv);
  const notificationIcon = loadNotificationIcon(fileEnv);
  let icon = config.icon;
  let name = config.name;
  if (launchIcon) {
    icon = launchIcon;
    android.icon = launchIcon;
    android.adaptiveIcon = {
      ...(android.adaptiveIcon ?? {}),
      backgroundColor: '#F5F5F4',
      foregroundImage: launchIcon,
    };
    if (!easBuild) {
      name = '\u200b';
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
  }
  if (notificationIcon) {
    plugins = plugins.map((plugin) => {
      if (!Array.isArray(plugin) || plugin[0] !== 'expo-notifications') {
        return plugin;
      }
      return [
        plugin[0],
        {
          ...(plugin[1] ?? {}),
          icon: notificationIcon,
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
