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
  return {
    ...config,
    extra: {
      ...config.extra,
      samApiUrl,
    },
  };
};
