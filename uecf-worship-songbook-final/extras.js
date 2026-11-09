/* v36/v37 extras: reading-size memory, clickable stat cards, draft autosave + unsaved warning, duplicate-title warning,
   version history, Songbook Health / system status / backup, push-device management. Loaded after notifications.js. */
const $ = id => document.getElementById(id);
const db = window.__uecfDb, S = () => window.__uecfState || {};
const canEdit = () => ["editor", "super_admin"].includes(S().profile?.role) && S().profile?.is_approved === true;
const isSuper = () => S().profile?.role === "super_admin" && S().profile?.is_approved === true;
const toast = m => { const t = $("toast"); if (!t) return; t.textContent = m; t.classList.remove("hidden"); setTimeout(() => t.classList.add("hidden"), 3500); };
const fmt = d => { try { return new Date(d).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return ""; } };
const norm = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const ls = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

/* ---- reading size (personal; never changes shared song formatting) ---- */
(() => { const saved = Number(localStorage.getItem("uecf_read_font")); const st = S(); if (saved >= 12 && saved <= 40 && st) st.fontSize = saved; })();

/* ---- v37: "Recently viewed" removed. Old saved lists are cleaned up. ---- */
try { Object.keys(localStorage).filter(k => k.startsWith("uecf_recent_")).forEach(k => localStorage.removeItem(k)); } catch (e) {}
let lastFont = null, lastSongsRef = null;

/* ---- v37: the four stat cards (Songs / Playlists / Favorites / Access) are real buttons ---- */
(() => { const st = document.createElement("style"); st.textContent = "#stats [data-go]{cursor:pointer;transition:transform .12s,box-shadow .12s}#stats [data-go]:hover{transform:translateY(-2px);box-shadow:0 6px 18px #0004}#stats [data-go]:active{transform:scale(.98)}"; document.head.appendChild(st); })();
function goStat(k) {
  const nav = v => document.querySelector('[data-view="' + v + '"]');
  if (k === "access") {
    if (isSuper() || canEdit()) { (nav("admin") || {}).click?.(); return; }
    const r = S().profile?.role; toast("Your access: " + (r === "super_admin" ? "Super Admin" : r === "editor" ? "Editor" : "Member (read-only)") + ".");
    return;
  }
  nav(k)?.click();
  if (k === "home") setTimeout(() => $("view-home")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
}
document.addEventListener("click", ev => { const c = ev.target.closest?.("#stats [data-go]"); if (c) goStat(c.dataset.go); });
document.addEventListener("keydown", ev => { if (ev.key !== "Enter" && ev.key !== " ") return; const c = ev.target.closest?.("#stats [data-go]"); if (c) { ev.preventDefault(); goStat(c.dataset.go); } });

/* ---- draft autosave + unsaved warning ---- */
let dirty = false, timer = null;
const draftKey = () => "uecf_draft_" + S().currentSong?.id;
function draftStatus(t) { let e = $("draftStatus"); if (!e) { const box = $("songLyricsView"); if (!box) return; e = mk("div", "text-xs text-slate-500 no-print"); e.id = "draftStatus"; box.before(e); } e.textContent = t; }
document.addEventListener("input", ev => {
  if (ev.target?.id !== "songLyricsView" || !S().currentSong) return;
  dirty = true; draftStatus("Editing… not saved yet"); clearTimeout(timer);
  timer = setTimeout(() => { ls.set(draftKey(), { html: ev.target.innerHTML, at: Date.now() }); draftStatus("Draft saved on this device · not saved to the song yet"); }, 800);
});
document.addEventListener("click", ev => {
  if (!ev.target.closest?.("#lyricSave")) return;
  setTimeout(() => { dirty = false; const box = $("songLyricsView"); const s = S().currentSong; const cur = (S().songs || []).find(x => x.id === s?.id);
    if (box && cur && cur.lyrics_html === box.innerHTML) { localStorage.removeItem(draftKey()); draftStatus("Saved"); } else draftStatus("Draft kept on this device until the save is confirmed"); }, 2500);
});
window.addEventListener("beforeunload", e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
function checkDraft() {
  const box = $("songLyricsView"); if (!box || !canEdit() || !S().currentSong) return;
  const key = S().currentSong.id + "|" + (S().currentSong.updated_at || ""); if (box.dataset.draftChecked === key) return; box.dataset.draftChecked = key;
  const d = ls.get(draftKey(), null); if (!d || !d.html || d.html === box.innerHTML) return;
  const bar = mk("div", "acct-note no-print"); bar.append("Unsaved draft from " + fmt(d.at) + ". ");
  const r = mk("button", "btn btn-primary", "Restore draft"), x = mk("button", "btn btn-ghost", "Discard"); r.type = x.type = "button"; r.style.marginLeft = x.style.marginLeft = ".4rem";
  r.onclick = () => { box.innerHTML = d.html; dirty = true; bar.remove(); draftStatus("Draft restored — press Save changes"); };
  x.onclick = () => { localStorage.removeItem(draftKey()); bar.remove(); };
  bar.append(r, x); box.before(bar);
}

/* ---- duplicate title warning in the song form ---- */
document.addEventListener("input", ev => {
  if (ev.target?.id !== "songTitle") return;
  const n = norm(ev.target.value), me = $("songId")?.value, msg = $("songMessage"); if (!msg) return;
  const dup = n.length > 2 && (S().songs || []).find(s => String(s.id) !== String(me) && norm(s.title) === n);
  msg.textContent = dup ? "Warning: a song titled “" + dup.title + "” already exists. You can still save." : "";
  if (dup) msg.className = "text-sm text-amber-700";
});

/* ---- generic dialog ---- */
function dialog(id, title) {
  $(id)?.remove(); const d = mk("dialog"); d.id = id;
  const box = mk("div", "p-5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"); box.style.minWidth = "min(92vw,480px)";
  const head = mk("div", "flex items-center justify-between gap-2 mb-2"); head.appendChild(mk("h2", "text-xl font-extrabold", title));
  const c = mk("button", "text-xl", "×"); c.type = "button"; c.setAttribute("aria-label", "Close"); c.onclick = () => d.close(); head.appendChild(c);
  const body = mk("div"); body.style.cssText = "max-height:65vh;overflow:auto"; box.append(head, body); d.appendChild(box); document.body.appendChild(d); d.showModal(); return body;
}

/* ---- version history ---- */
async function openHistory() {
  const song = S().currentSong; if (!song) return;
  const body = dialog("verDialog", "Version history"); body.textContent = "Loading…";
  if (!navigator.onLine) { body.textContent = "Version history needs an internet connection."; return; }
  const { data, error } = await db.from("song_versions").select("id,saved_at,saved_by_name,title,lyrics_chordpro").eq("song_id", String(song.id)).order("saved_at", { ascending: false }).limit(30);
  if (error) { body.textContent = "Version history is not available yet. Run v36-extras.sql in Supabase."; return; }
  body.textContent = ""; if (!data.length) { body.textContent = "No earlier versions yet. A version is saved each time the song changes."; return; }
  const cur = String(song.lyrics_chordpro || "");
  data.forEach(v => {
    const row = mk("div", "log-row"); row.appendChild(mk("b", "", fmt(v.saved_at))); row.appendChild(mk("div", "log-det", "Before the change by " + (v.saved_by_name || "Unknown")));
    const a = String(v.lyrics_chordpro || "").split("\n"), b = cur.split("\n"), added = b.filter(l => !a.includes(l)).length, removed = a.filter(l => !b.includes(l)).length;
    row.appendChild(mk("div", "log-det", "Compared with now: " + removed + " line(s) differ in this version, " + added + " line(s) differ in the current one"));
    row.appendChild(mk("div", "log-det bin-prev", String(v.lyrics_chordpro || "").replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").slice(0, 140) + "…"));
    const btn = mk("button", "btn btn-primary", "Restore this version"); btn.type = "button";
    btn.onclick = async () => { if (!confirm("Restore this version?\n\nThe current text is saved as a version first, so you can undo this.")) return; btn.disabled = true;
      const { data: ok, error: e } = await db.rpc("restore_song_version", { p_version_id: v.id });
      if (e || !ok) { toast("Unable to restore this version."); btn.disabled = false; return; } toast("Version restored."); setTimeout(() => location.reload(), 700); };
    row.appendChild(btn); body.appendChild(row);
  });
}

/* ---- Songbook health, system status, backup, push devices ---- */
async function openHealth() {
  const songs = S().songs || [], body = dialog("healthDialog", "Songbook health");
  const sec = (t, node) => { body.appendChild(mk("h3", "font-bold mt-3 mb-1", t)); body.appendChild(node); };
  const sys = mk("div", "text-sm"); sys.append(
    mk("div", "", (navigator.onLine ? "Online" : "Offline") + " · " + songs.length + " songs available" + (navigator.onLine ? "" : " from this device")),
    mk("div", "", "Songs last refreshed: " + (localStorage.getItem("uecf_songs_refreshed") ? fmt(Number(localStorage.getItem("uecf_songs_refreshed"))) : "not recorded yet")),
    mk("div", "", "Pending changes: " + ((document.getElementById("offlineStatus")?.textContent.match(/waiting to sync|PENDING SYNC|saved on this device/) ? "yes — see the status bar" : "none"))));
  sec("System status", sys);
  const groups = new Map(); songs.forEach(s => { const k = norm(s.title); if (k) groups.set(k, [...(groups.get(k) || []), s]); });
  const dups = [...groups.values()].filter(g => g.length > 1);
  const dl = mk("div", "text-sm"); dl.textContent = dups.length ? "" : "No duplicate titles."; dups.forEach(g => dl.appendChild(mk("div", "", g[0].title + " ×" + g.length)));
  sec("Possible duplicates (" + dups.length + ")", dl);
  const miss = songs.map(s => { const m = []; if (!String(s.lyrics_chordpro || "").trim()) m.push("no lyrics"); if (!s.category || s.category === "N/A") m.push("no category"); if (!s.key_signature || s.key_signature === "N/A") m.push("no key"); if (!s.lyrics_html) m.push("no saved formatting"); return m.length ? s.title + " — " + m.join(", ") : null; }).filter(Boolean);
  const ml = mk("div", "text-sm"); ml.style.cssText = "max-height:20vh;overflow:auto"; ml.textContent = miss.length ? "" : "All songs have the basic details."; miss.forEach(t => ml.appendChild(mk("div", "", t)));
  sec("Missing details (" + miss.length + ")", ml);
  if (isSuper()) {
    const bk = mk("button", "btn btn-ghost", "Download backup (JSON)"); bk.type = "button";
    bk.onclick = () => { const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), songs }, null, 1)], { type: "application/json" }); const a = mk("a"); a.href = URL.createObjectURL(blob); a.download = "songbook-backup-" + new Date().toISOString().slice(0, 10) + ".json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
    sec("Backup", bk);
    const rr = mk("div"); body.appendChild(rr); roleReview(rr);
    const dv = mk("div", "text-sm"); dv.textContent = navigator.onLine ? "Loading…" : "Needs an internet connection."; sec("Push devices", dv);
    if (navigator.onLine) { const { data, error } = await db.rpc("admin_list_push_devices"); dv.textContent = "";
      if (error) dv.textContent = "Not available yet. Run v36-extras.sql."; else if (!data.length) dv.textContent = "No devices registered.";
      else data.forEach(d => { const r = mk("div", "log-row"); r.append(mk("b", "", d.name), mk("div", "log-det", (d.device || "Unknown device") + " · " + fmt(d.created_at)));
        const b = mk("button", "btn btn-danger", "Remove"); b.type = "button"; b.onclick = async () => { if (!confirm("Remove this device from push notifications?")) return; const { error: e } = await db.rpc("admin_remove_push_device", { p_id: d.id }); if (e) { toast("Unable to remove the device."); return; } r.remove(); toast("Device removed."); }; r.appendChild(b); dv.appendChild(r); }); }
  }
}

/* ---- injected buttons + watchers ---- */
function inject() {
  const p = $("printSong");
  if (p && canEdit() && !$("verBtn")) { const b = mk("button", "btn btn-ghost"); b.id = "verBtn"; b.type = "button"; b.innerHTML = '<i class="fa-solid fa-clock-rotate-left mr-1"></i> History'; b.onclick = openHistory; ($("shareSong") || p).after(b); }
  const panel = $("notifSignupWrap")?.parentNode;
  if (panel && canEdit() && !$("healthBtn")) { const b = mk("button", "btn btn-ghost w-full mb-2", "Songbook health & system status"); b.id = "healthBtn"; b.type = "button"; b.onclick = () => { $("notifDialog")?.close(); openHealth(); }; $("notifPushBtn").before(b); }
}
setInterval(() => {
  try {
    const st = S(); if (!st.songs) return;
    if (st.songs !== lastSongsRef) { lastSongsRef = st.songs; if (st.songs.length) localStorage.setItem("uecf_songs_refreshed", String(Date.now())); }
    if (st.fontSize && st.fontSize !== lastFont) { lastFont = st.fontSize; localStorage.setItem("uecf_read_font", String(st.fontSize)); }
    $("recentWrap")?.remove(); inject(); checkDraft();
  } catch (e) {}
}, 1200);

/* ---- Preview before saving (song form) ---- */
function previewSong() {
  const api = window.__uecfApi, text = $("songLyrics")?.value || ""; if (!api || !text.trim()) { toast("Type the lyrics first."); return; }
  const auto = $("songAutoFormat")?.checked !== false;
  const body = dialog("previewDialog", "Preview");
  const note = mk("p", "text-xs text-slate-500 mb-2", auto ? "This is how the song will look after saving (songbook style, same as the song page)." : "Auto-format is off: the song will be saved without songbook formatting.");
  const box = mk("div", "lyrics mt-2"); box.style.fontSize = (S().fontSize || 16) + "px"; box.style.lineHeight = "2"; box.style.overflowWrap = "anywhere";
  if (auto) box.innerHTML = api.formatSongHtml(text); else { const pre = mk("pre", "", text); pre.style.whiteSpace = "pre-wrap"; box.appendChild(pre); }
  body.append(note, box);
}
function injectPreview() {
  const sub = document.querySelector('#songForm button[type="submit"]'); if (!sub || $("songPreviewBtn")) return;
  const b = mk("button", "btn btn-ghost w-full", "Preview before saving"); b.id = "songPreviewBtn"; b.type = "button"; b.onclick = previewSong; sub.before(b);
}

/* ---- Role & permission review (Super Admin) ---- */
async function roleReview(parent) {
  const t = mk("div", "text-sm"); t.textContent = navigator.onLine ? "Loading…" : "Needs an internet connection."; parent.appendChild(mk("h3", "font-bold mt-3 mb-1", "Role & permission review")); parent.appendChild(t);
  if (!navigator.onLine) return;
  const { data, error } = await db.from("profiles").select("role,is_approved"); t.textContent = "";
  if (error) { t.textContent = "Unable to load accounts."; return; }
  const c = {}; data.forEach(r => { const k = (r.role || "member") + (r.is_approved ? "" : " (not approved)"); c[k] = (c[k] || 0) + 1; });
  Object.keys(c).sort().forEach(k => t.appendChild(mk("div", "", k + ": " + c[k])));
  const legacy = data.filter(r => !["super_admin", "editor", "member"].includes(r.role)).length;
  if (legacy) t.appendChild(mk("div", "text-rose-600 font-bold", legacy + " account(s) have an unsupported role. Run v31-remove-admin-role.sql."));
  [["Member", "Read songs, favorites, playlists. No editing."], ["Editor", "Member rights + edit and delete songs (deleted songs go to the Recycle Bin), version history."], ["Super Admin", "Editor rights + approve accounts, change roles, Recycle Bin restore/permanent delete, logs, settings, push devices, backup."]]
    .forEach(([r, d]) => t.appendChild(mk("div", "log-det", r + ": " + d)));
  t.appendChild(mk("div", "log-det", "These rules are enforced by the database (RLS/RPC), not only by hidden buttons."));
}

/* ---- accessibility pass ---- */
(() => { const st = document.createElement("style"); st.textContent = ":focus-visible{outline:3px solid #f5b51b!important;outline-offset:2px}button,.btn,.navitem{min-height:40px}@media (prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}"; document.head.appendChild(st); })();
function a11y() { document.querySelectorAll("button:not([aria-label])").forEach(b => { if (!b.textContent.trim() && b.title) b.setAttribute("aria-label", b.title); }); }
setInterval(() => { try { injectPreview(); a11y(); } catch (e) {} }, 1500);
