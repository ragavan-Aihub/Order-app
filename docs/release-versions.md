# Feature and bug-fix versions

How to ship a **bug fix** or a **new feature**. The customer and delivery apps use Play or APK version codes. The **admin panel has its own version** and is not on the Play Store.

## Two numbers on each phone app

| | Customer app (`mobile/app.json`) | Delivery app (`delivery/app.json`) |
|--|----------------------------------|-------------------------------------|
| **Version** (people see this) | `expo.version` — today **1.0.0** | `expo.version` — today **1.0.0** |
| **Version code** (Play Store only) | `android.versionCode` — today **23** | `android.versionCode` — today **3** |

Rules:

- **Bug fix** — add 1 to the last part of the version: `1.0.0` → `1.0.1`. Always add 1 to the version code (`23` → `24`).
- **New feature** — add 1 to the middle part and reset the last part: `1.0.1` → `1.1.0`. Always add 1 to the version code.
- **Big rewrite** — `2.0.0` and add 1 to the version code.
- Never reuse a version code. Play Store rejects an upload that is not higher than the last one.
- Changing only the admin website or the database does **not** need a new phone app, unless the phone screens changed.

## Admin panel (website only)

One number, in `admin/config/admin-version.ts` (also `admin/package.json`). Staff see **Version 1.0.0** on the sign-in page and at the bottom of the menu. There is no Play Store version code and no update popup. After you deploy on Vercel, a browser refresh shows the new version.

| Kind | Example |
|------|---------|
| Bug fix | `1.0.0` → `1.0.1` |
| New feature | `1.0.1` → `1.1.0` |

Change that number in the same commit as the admin fix or feature, then deploy. Customers do not install anything.

## What each release needs

| Change | Customer app | Delivery app | Admin website |
|--------|----------------|--------------|----------------|
| Screen, button, or app bug | New build (APK for testing, AAB for Play) | New APK if that app changed | No |
| Shop website only | No | No | Bump admin version, then deploy on Vercel |
| Database only | No, unless the app must force an update | No | No |

Preview APKs do not update themselves. People install the new file. After the customer app is on Play, people update from the Play Store.

There is no over-the-air JavaScript update. A phone change always means a new build.

## After the customer build is uploaded

The app can ask people to update. It stays quiet until you set the numbers in Supabase.

1. Run migration `supabase/migrations/20261030233000_customer_app_version.sql` once on the hosted project.
2. Upload the new customer build (Play internal testing or production).
3. Edit and run `supabase/scripts/set-customer-app-version.sql`:

| You shipped | Set |
|-------------|-----|
| Bug fix, people may wait | `customer_app_release_kind = 'bugfix'`, latest version and version code. Leave minimum at `0`. They see **A fix is ready** and can tap **Later**. |
| New feature, people may wait | `kind = 'feature'`. They see **A new version is available** and can tap **Later**. |
| Old app must stop (broken orders or security) | Set **minimum** version code to the new code as well. They see **Please update the app** with no Later button. |

Write one or two plain sentences in `customer_app_release_notes` (shown in the popup). Leave `customer_app_update_url` empty to open the Play listing (`com.farm2flavour.app`). Set a URL only if you are still sharing an APK link instead of Play.

The popup does not appear in Expo Go or while developing on your Mac. Check it on an installed APK or Play build.

## Release log

Add a row each time you ship. Copy the “What’s new” line into Play Console.

| Date | App | Kind | Version | Version code | What’s new |
|------|-----|------|---------|--------------|------------|
| — | Customer | — | 1.0.0 | 23 | Current build in the repo (not yet a Play production release). |
| — | Delivery | — | 1.0.0 | 3 | Current preview APK in the repo. |
| — | Admin panel | — | 1.0.0 | — | Website version. Not a Play Store build. |

## Related

- Build commands: [technical-guide.md](technical-guide.md) §11.1
- Play upload: [play-store-checklist.md](play-store-checklist.md)
