# CENTRO LA VIDA ETERNA Songbook — Complete Upload Package

Design: navy blue + gold + warm cream, your chapel photo, and the dove/seal logo. Public users do not create accounts; they enter the shared access code `BUHAY NA WALANG HANGGAN`. Admins sign in using Supabase Auth. Song and playlist changes are saved to Supabase and synchronize to other open devices via realtime refresh/subscriptions.

## A. Supabase setup (required for live shared data)
1. Create/open your Supabase project.
2. Open **SQL Editor → New query**, paste all of `supabase-schema.sql`, then click **Run**. If you already have the old database, this script attempts to preserve/rename the old `key` column. Review any SQL error before proceeding.
3. Open **Authentication → Users → Add user** and create your first administrator with email and a strong password.
4. In SQL Editor run this, replacing the sample email with that exact admin email:
   ```sql
   insert into public.cle_songbook_admin_users(email) values ('first.admin@example.com') on conflict (email) do nothing;
   ```
5. Open **Project Settings → API** and copy the Project URL and the **publishable** key (or legacy anon key). Do not use `service_role` or secret keys in the browser.
6. Edit `config.js`: paste URL and publishable/anon key. Keep the visitor code as `BUHAY NA WALANG HANGGAN` unless you intentionally change it.

## B. GitHub upload
1. Extract this ZIP on your computer.
2. Create/open your GitHub repository. Upload the **contents** of this folder (not the ZIP itself) to repository root. `index.html`, `config.js`, `supabase-schema.sql`, `chapel-photo.jpg`, and `logo-dove.png` should be at the root.
3. Commit/push to the production branch (usually `main`).

## C. Cloudflare Pages deployment
1. Cloudflare Dashboard → Workers & Pages → Create → Pages → Import an existing Git repository.
2. Connect GitHub and select your repo.
3. Framework preset: **None**. Build command: `exit 0`. Build output directory: `/` (if rejected, use `.`). Save and deploy.
4. Open the `*.pages.dev` URL. Test from a phone and a computer. For every new GitHub push, Cloudflare Pages automatically builds/deploys.

## Visitor manual
1. Open the church songbook website.
2. Enter access code exactly: **BUHAY NA WALANG HANGGAN** (case-insensitive). No visitor account is required.
3. Search by song title, artist, lyrics, category or chords. Open a song to read lyrics/chords. Use Print/PDF to print or save to PDF.
4. Open Worship Playlist to see service setlists. Refresh the page if another device just made a change.
5. Internet is needed for fresh live data. Previously loaded pages may open offline, but changes made offline do not sync until connected.

## Administrator manual
1. In Supabase Authentication → Users, create an account for each admin. Give each person their own account/password; never share one admin login.
2. The first admin is added through the SQL step above. After login, go to **Admin** tab → **Pamamahala ng mga administrator** and add the other admin's exact email. Their Auth user must already exist.
3. Admin opens the website, enters the visitor code, clicks **Admin login**, then signs in with their Supabase email/password.
4. Use **Magdagdag ng kanta** to create a song. Fill title, artist, category, key, tempo, and lyrics/chords, then Save. Use Edit or Delete on song cards to maintain entries.
5. Create/edit/delete worship playlists. Use Export backup JSON regularly and store the backup safely.
6. Admin can remove another admin's access in the admin panel. Do not remove the last working admin. If removed user is still logged in, have them sign out and back in.
7. To reset an admin password, use Supabase Authentication user-management tools.

## Live update / troubleshooting
- Changes save to Supabase, not only to the current browser. Other devices receive live table events where Realtime is enabled; otherwise reload or use **I-sync / i-refresh**. In Supabase Database → Replication/Realtime, ensure `cle_songbook_songs` and `cle_songbook_playlists` are enabled for Postgres Changes if required by your project.
- `Invalid API key`: check Project URL and publishable/anon key in `config.js`. Never paste the service-role key into this file.
- Admin login but cannot edit: confirm that email exists in `public.cle_songbook_admin_users` in lowercase and the user is logged in.
- Cannot add an admin: create their Auth user first; then add their email through the admin panel.
- Empty songbook: the database starts empty. Add songs through Admin after setup.
- Backups: use Export backup JSON. Keep a copy outside GitHub if lyrics or other data need controlled access.

## Important access-code and privacy note
The requested visitor code is a **front-end entry gate**, not strong data security. Since the songbook is designed for public read-only access, its songs and playlists are readable through the public Supabase API by a technically knowledgeable person even without entering the code. Do not store private information in this public songbook. Actual protection for private content requires server-side code verification and a different access design.

## Copyright
Only upload lyrics/chords you wrote or are authorized/licensed to reproduce.


## Existing Supabase project safety
This package is configured to use `cle_songbook_songs`, `cle_songbook_playlists`, and `cle_songbook_admin_users`; it does not create, alter, or delete generic `songs`, `playlists`, or `admin_users` tables belonging to your other system. Create the first Songbook admin in Authentication first, then run the bootstrap INSERT in the SQL file with that exact email.
