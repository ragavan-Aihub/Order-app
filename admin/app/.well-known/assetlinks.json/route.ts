import { NextResponse } from 'next/server';

const PACKAGE_NAME = 'com.farm2flavour.app';

function sha256Fingerprints(): string[] {
  return (process.env.ANDROID_APP_LINK_SHA256 ?? '')
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function GET() {
  const fingerprints = sha256Fingerprints();
  if (fingerprints.length === 0) {
    return NextResponse.json([], {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  }

  return NextResponse.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: PACKAGE_NAME,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
}
