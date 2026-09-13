# Performance Hub — Mobile

Flutter app for Employees, Managers and HR. Talks directly to the same Supabase project as the Next.js web app — RLS handles authorization.

## 1. Prerequisites

- Flutter `>= 3.22.0` (Dart 3.4+). Check with `flutter --version`.
- Android Studio (for Android SDK + emulator) or a connected Android device.
- Xcode 15+ on macOS for iOS builds.
- The web app already deployed (or at least the Supabase project provisioned).

## 2. Generate the platform folders

This repo only commits the cross-platform Dart code in `lib/`, plus `pubspec.yaml` and `.env.example`. After cloning, generate the standard Android / iOS / desktop folders **once** inside `mobile/`:

```bash
cd mobile
flutter create . --project-name performance_hub --org com.performancehub --platforms=android,ios
flutter pub get
```

`flutter create .` is idempotent — it only adds files that don't already exist (it will not overwrite the Dart code).

## 3. Apply the new database migration (one-time)

In the Supabase SQL Editor, run:

```
scripts/migration-mobile-v1.sql
```

This creates:

- the `device_tokens` table with RLS (one row per user device),
- `SECURITY INVOKER` SQL functions for objectives approve/reject/submit, appraisal save/finalize, calibration sign-off, and HR dashboard aggregates.

The same RPCs are also called from the Next.js web app (see follow-up refactor).

## 4. Configure env

```bash
cp .env.example .env
```

Then edit `.env`:

```
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_ANON_KEY=YOUR_ANON_KEY      # the *anon* key, never the service-role key
ENABLE_PUSH=false                    # flip to true once Firebase is wired (step 5)
```

`mobile/.env` is git-ignored and bundled as a Flutter asset.

## 5. (Optional) Wire up Firebase Cloud Messaging

If you want push notifications:

1. Create a Firebase project (or reuse one).
2. Install the FlutterFire CLI: `dart pub global activate flutterfire_cli`.
3. From `mobile/`, run `flutterfire configure --project=<your-firebase-project-id>`.
   This generates `lib/firebase_options.dart`, `android/app/google-services.json`, and `ios/Runner/GoogleService-Info.plist` (all git-ignored).
4. Set `ENABLE_PUSH=true` in `mobile/.env`.

### Server-side fan-out

Deploy the `push-fanout` Edge Function (in `supabase/functions/push-fanout`):

```bash
# From the repo root
supabase functions deploy push-fanout
supabase secrets set FCM_PROJECT_ID=<your-firebase-project-id>
supabase secrets set FCM_SERVICE_ACCOUNT="$(cat path/to/service-account.json)"
```

Then in the Supabase dashboard, create a **Database Webhook**:

- Table: `public.notifications`
- Events: `INSERT`
- Type: Supabase Edge Function → `push-fanout`

That's it — every notification row inserted by the web app or by the SQL RPCs is now pushed to every registered device for that user.

## 6. Run

```bash
flutter run                     # picks the first available device
flutter run -d "Pixel 7 Pro"    # specific device
```

## 7. Build artifacts (internal distribution)

### Android (Firebase App Distribution)

```bash
flutter build apk --release           # one universal APK
# or
flutter build appbundle --release     # smaller AABs (recommended)
```

Outputs:

- `build/app/outputs/flutter-apk/app-release.apk`
- `build/app/outputs/bundle/release/app-release.aab`

Upload to **Firebase App Distribution** (web UI or CLI):

```bash
firebase appdistribution:distribute build/app/outputs/flutter-apk/app-release.apk \
  --app <android-app-id> \
  --groups "hr,managers,employees" \
  --release-notes "Performance Hub mobile preview"
```

### iOS (TestFlight)

Requires Apple Developer Program enrollment + a signing identity:

```bash
flutter build ipa --release
```

Output: `build/ios/ipa/performance_hub.ipa`

Upload to App Store Connect / TestFlight:

```bash
xcrun altool --upload-app -t ios -f build/ios/ipa/performance_hub.ipa \
  --apiKey <key-id> --apiIssuer <issuer-id>
```

Add testers to an Internal Testing group inside App Store Connect — internal testing does **not** require App Review.

## 8. Project layout

```
mobile/
├── lib/
│   ├── main.dart              # bootstrap
│   ├── app.dart               # MaterialApp.router
│   ├── core/                  # env, supabase, theme, router, role, auth
│   ├── data/
│   │   ├── models/            # plain Dart models mirroring src/lib/supabase/types.ts
│   │   └── repositories/      # one repository per domain (Riverpod providers)
│   ├── features/
│   │   ├── auth/              # login_page.dart, splash_page.dart
│   │   ├── shell/             # bottom-nav scaffold
│   │   ├── dashboard/
│   │   ├── objectives/        # list / edit / manager review
│   │   ├── appraisals/        # list / self / manager / hr finalize
│   │   ├── calibration/
│   │   ├── employees/         # directory with filters/pagination
│   │   ├── idp/               # courses + certificate upload
│   │   ├── notifications/     # in-app feed + FCM push service
│   │   └── hr_dashboard/
│   └── shared/widgets/        # AsyncValueView, StatusChip, EmptyState
└── README.md (this file)
```

## 9. Smoke test checklist

After `flutter run` against a populated Supabase:

1. **Login** — enter an HR user's email, type the OTP from email → lands on `/dashboard`.
2. **Objectives** — create one as an employee, weight 100%, submit → row shows `Submitted`.
3. **Approval** — sign in as the manager, open Inbox → approval menu → approve → employee sees `Approved`.
4. **Appraisal** — open an existing appraisal in `Draft` → rate competencies → Submit to manager → status becomes `N1 Complete`.
5. **HR finalize** — sign in as HR → open the appraisal → Finalize → status `Final`, employee gets an in-app notification.
6. **Push** (if Firebase configured) — confirm the same notification arrives as a system push.

If you hit RLS errors, the `scripts/migration-mobile-v1.sql` is the only schema change required.
