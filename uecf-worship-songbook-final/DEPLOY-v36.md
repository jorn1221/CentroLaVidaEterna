# v36 deployment (Supabase + GitHub + Cloudflare)

## 1. Supabase SQL (SQL Editor, in order)
1. `supabase/migrations/v31-remove-admin-role.sql` (already in your project; skip if you ran it), then `v36-password-history.sql`.
2. `supabase/migrations/v36-notifications.sql`
3. `supabase/migrations/v36-extras.sql` (song version history + push device management) — notifications, push subscriptions, signup alert trigger, realtime.

## 2. Push notifications setup
1. Generate VAPID keys once: `npx web-push generate-vapid-keys`
2. Put the PUBLIC key in `notifications.js` (`VAPID_PUBLIC_KEY`). The private key never goes in the repo.
3. `supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com PUSH_WEBHOOK_SECRET=<random string>`
4. `supabase functions deploy send-push --no-verify-jwt`
5. Dashboard -> Database -> Webhooks -> table `notifications`, event INSERT, Edge Function `send-push`, header `x-webhook-secret: <same string>`.
6. Open the app logged in as Super Admin -> bell icon -> "Enable push notifications" (needs a tap; on iPhone the app must be added to the Home Screen first, iOS 16.4+).

## 3. GitHub / Cloudflare
Commit all files (index.html, notifications.js, service-worker.js, brand-config.js, manifest.json, assets, supabase/). Push to GitHub; Cloudflare redeploys. Serve over HTTPS. After deploy, open the site once online so the new service worker caches the app, then reload once.

## 4. Test checklist (do these yourself; none were run on real devices)
- Sign up a test account -> Super Admin sees a bell badge once (no duplicate), tapping opens Accounts.
- Close the app, sign up another test account -> push arrives (Android Chrome / installed PWA / desktop).
- Airplane mode: app opens, songs/search/lyrics work; bell shows saved notifications; Admin tabs say they need internet.
- Passwords: reset email -> new message; change password -> success message; bad/expired link -> failure message.
- Login/Signup/Reset: eye icon shows/hides without clearing text.
- Recycle Bin: Restore, Delete permanently, Delete all permanently (as Super Admin; as Editor it must be refused by the server).

## 5. What v36 added (summary)
- Password messages, Show Password (login/signup), Recycle Bin text + Delete all, Passwords tab Clear all / Delete record.
- Notification bell, signup alerts, Web Push, sound test (notifications.js + send-push function).
- extras.js: Recently viewed, remembered reading size (this device only), draft autosave + unsaved-changes warning,
  duplicate-title warning, Version history (editors), Songbook health (duplicates, missing details, system status),
  JSON backup and push-device management (Super Admin).
- Auto-format: when lyrics change on an existing song it now asks first and re-formats using that song's own verse/chorus colors.

## 6. Verified vs not verified
Verified in headless Chromium (no Supabase, no internet): app loads, Show Password toggles and keeps the typed text,
new reset-request message appears. Everything that needs Supabase, push services or real phones is untested.

## 7. Also added
Preview before saving (song form), Role & permission review (Super Admin, inside Songbook health), accessibility pass (focus outline, labels, reduced motion).
Verified headless: formatSongHtml output renders, Preview button appears. Not verified: everything needing Supabase, push services or real devices.
