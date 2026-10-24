# UECF Worship Songbook — Deployment Package

Taglish setup guide. Built from the uploaded **UECF Worship Songbook - Final System Specification & Prompts.pdf**. Includes the requested UECFI logo and Centro La Vida Eterna chapel photo.

## Included files

- `index.html` — single-file responsive web app, Tailwind CDN, Supabase JS v2, Font Awesome
- `assets/uecfi-logo.png` — supplied UECFI logo
- `assets/centro-la-vida-eterna.jpg` — supplied chapel photo
- `supabase/schema.sql` — tables, RLS policies, signup profile trigger, role helper functions
- `README.md` — this guide

## Implemented UI and features

- Responsive desktop and mobile layout
- Search by title, artist, key, category, language, and lyrics
- Song add/edit/delete UI for approved editor/admin roles
- ChordPro renderer for chords in `[G]lyrics` format
- Show/hide chords toggle
- Chord transposition controls (+/- semitone)
- Key, tempo, category `N/A` options
- Light/dark theme with `localStorage` preference
- Supabase email/password signup, login, logout
- New account is a pending member and read-only until approval
- Super Admin approval/revoke UI
- Favorites saved in browser
- Playlist creation and adding songs to playlists
- Browser Print / Save as PDF
- Mobile bottom navigation

## IMPORTANT: not live until configured

I cannot access your Supabase or GitHub account from this chat unless you connect the relevant service and authorize actions. No real Supabase URL/key has been supplied in the PDF or chat. The app therefore contains placeholders and **will not connect to Supabase until configured**.

### Step 1 — Supabase

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Review and run `supabase/schema.sql`.
4. Go to **Project Settings → API** (or the API Keys section in the current dashboard).
5. Copy the Project URL and **anon/public key**.
6. In `index.html`, replace:
   - `PASTE_SUPABASE_PROJECT_URL_HERE`
   - `PASTE_SUPABASE_ANON_PUBLIC_KEY_HERE`
7. Never put the `service_role` / secret key in this HTML or GitHub.
8. Create the intended Super Admin account by signing up on the app. Find that user's UUID in Supabase Authentication → Users. Run the one-time bootstrap SQL from the comments at the bottom of `schema.sql`, replacing the UUID. Only trusted project owners should do this.

### Step 2 — GitHub

1. Create a repository, for example `uecf-worship-songbook`.
2. Upload the files preserving the folder structure. The `index.html` must be at the repository root.
3. Commit the configured `index.html` only if you're comfortable with the public anon key being visible; Supabase anon/public keys are intended for client use when RLS is correct. Never commit secret/service-role keys.
4. Run security tests before opening the repository to public contributions.

### Step 3 — Cloudflare Pages

1. Open Cloudflare Dashboard → Workers & Pages → Create → Pages.
2. Connect the GitHub repository.
3. For a static single-file app, leave Build command blank and set output directory to `/` or the project root as requested by the dashboard.
4. Deploy and open the generated URL.
5. Add your production domain to Supabase Auth → URL Configuration → Site URL and Redirect URLs as appropriate.

## Security / verification checklist

- [ ] Confirm RLS is enabled on every table.
- [ ] Test anonymous users can read songs but cannot write.
- [ ] Test pending users cannot write or approve anyone.
- [ ] Test approved editors can manage songs/playlists.
- [ ] Test only the designated Super Admin can approve/revoke profiles.
- [ ] Test signup email confirmation and password reset in the deployed domain.
- [ ] Check browser console and network errors.
- [ ] Verify all songs and lyrics are licensed/authorized for your use.

## Honest limitations to finish before production

- This is a deployable front-end package, not a hosted live website. Supabase credentials and the first Super Admin bootstrap are still required.
- The exact implementation uses a single HTML file as requested, with CDN dependencies; first load requires internet.
- Favorites are currently stored in the browser, not synced across devices.
- Playlist song ordering is stored as a position, but drag-and-drop reorder is not implemented in this version.
- This does not provide native Android/iOS apps; it is a responsive website. PWA install/offline support still needs a manifest and service worker.
- No actual production security test can be claimed until tested in your Supabase project and deployed URL.
- Sample songs are clearly placeholders. Import only songs/lyrics you have permission to use.
