/* v36 — Notification center, signup alerts, Web Push, sound, song sharing.
   Runs after the main module. Uses window.__uecfDb (Supabase client, anon key only) and window.__uecfState. */
const VAPID_PUBLIC_KEY = "PASTE_VAPID_PUBLIC_KEY_HERE"; // public key only; the private key stays in Supabase secrets
const $ = id => document.getElementById(id);
const db = window.__uecfDb, S = () => window.__uecfState || {};
const LS = { sound: "uecf_notif_sound", cache: uid => "uecf_notifs_" + uid };
let items = [], tab = "all", channel = null, uid = null, prefs = { signup_alerts: true, push_enabled: true };

function soundOn() { return localStorage.getItem(LS.sound) !== "off"; }
function beep() { // short two-tone; browsers may block audio until the user has interacted with the page
  try {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return false;
    const ctx = new C(), t = ctx.currentTime;
    [[880, 0], [1175, .16]].forEach(([f, d]) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(.0001, t + d); g.gain.exponentialRampToValueAtTime(.25, t + d + .02); g.gain.exponentialRampToValueAtTime(.0001, t + d + .14); o.start(t + d); o.stop(t + d + .15); });
    return true;
  } catch (e) { return false; }
}
function toast(m) { const t = $("toast"); if (!t) return; t.textContent = m; t.classList.remove("hidden"); setTimeout(() => t.classList.add("hidden"), 3500); }
function unread() { return items.filter(n => !n.read_at).length; }
function saveCache() { if (uid) try { localStorage.setItem(LS.cache(uid), JSON.stringify(items.slice(0, 100))); } catch (e) {} }
function fmt(d) { try { return new Date(d).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return ""; } }

/* ---- UI ---- */
function ensureUI() {
  if ($("notifBtn")) return;
  const btn = document.createElement("button");
  btn.id = "notifBtn"; btn.type = "button"; btn.className = "btn btn-ghost !border-white/30 text-white hidden"; btn.setAttribute("aria-label", "Notifications");
  btn.style.position = "relative"; btn.innerHTML = '<i class="fa-solid fa-bell"></i><span id="notifBadge" class="hidden" style="position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#e11d48;color:#fff;font-size:11px;font-weight:800;line-height:18px;text-align:center"></span>';
  const theme = $("themeBtn"); theme.parentNode.insertBefore(btn, theme);
  const css = document.createElement("style");
  css.textContent = ".nf-tabs{display:flex;gap:.4rem;margin:.6rem 0}.nf-tab{border-radius:999px;padding:.3rem .85rem;font-weight:700;font-size:.85rem;border:1px solid #64748b55;background:transparent;color:inherit}.nf-tab.on{background:#f5b51b;color:#1b1400;border-color:#f5b51b}"
    + ".nf-item{display:flex;gap:.7rem;align-items:flex-start;padding:.65rem .5rem;border-radius:12px;cursor:pointer;position:relative}.nf-item:hover{background:#64748b22}.nf-item.unread{background:#f5b51b1c}"
    + ".nf-ic{flex:0 0 auto;width:42px;height:42px;border-radius:50%;background:#173b75;color:#fff;display:flex;align-items:center;justify-content:center}.nf-tx{flex:1;min-width:0;font-size:.92rem;line-height:1.3}.nf-tx b{display:block}.nf-ago{font-size:.75rem;color:#f5b51b;font-weight:700;margin-top:2px}.nf-dot{flex:0 0 auto;width:10px;height:10px;border-radius:50%;background:#f5b51b;margin-top:.9rem}"
    + "#notifSettings summary{cursor:pointer;font-weight:700;font-size:.85rem;padding:.4rem 0}";
  document.head.appendChild(css);
  const dlg = document.createElement("dialog"); dlg.id = "notifDialog";
  dlg.innerHTML = `<div class="p-5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" style="min-width:min(92vw,420px)">
    <div class="flex items-center justify-between gap-2"><h2 class="text-xl font-extrabold">Notifications</h2><button type="button" id="notifClose" class="text-xl" aria-label="Close">&times;</button></div>
    <div class="flex items-center justify-between gap-2"><div class="nf-tabs"><button type="button" class="nf-tab on" id="nfAll">All</button><button type="button" class="nf-tab" id="nfUnread">Unread</button></div><button type="button" id="notifReadAll" class="text-sm font-bold" style="color:#f5b51b">Mark all as read</button></div>
    <div id="notifStatus" class="text-xs text-slate-500"></div>
    <div id="notifList" style="max-height:48vh;overflow:auto" class="mt-2"></div>
    <button type="button" id="notifClear" class="btn btn-ghost w-full mt-3" style="color:#e11d48">Clear all notifications</button>
    <details id="notifSettings" class="mt-3"><summary>Notification settings</summary><div class="mt-2">
    <label class="flex items-center gap-2 text-sm mb-2"><input type="checkbox" id="notifSoundChk"> In-app notification sound</label>
    <button type="button" id="notifTest" class="btn btn-ghost mb-2">Test sound</button>
    <label id="notifSignupWrap" class="flex items-center gap-2 text-sm mb-2 hidden"><input type="checkbox" id="notifSignupChk"> New signup alerts</label>
    <button type="button" id="notifPushBtn" class="btn btn-primary w-full">Enable push notifications</button>
    <p id="notifPushMsg" class="text-xs text-slate-500 mt-2"></p></div></details></div>`;
  document.body.appendChild(dlg);
  btn.onclick = () => { render(); dlg.showModal(); };
  $("notifClose").onclick = () => dlg.close();
  $("notifReadAll").onclick = markAll; $("notifClear").onclick = clearAll;
  $("nfAll").onclick = () => { tab = "all"; render(); }; $("nfUnread").onclick = () => { tab = "unread"; render(); };
  $("notifTest").onclick = () => { if (!beep()) toast("Sound could not play on this device/browser."); };
  $("notifSoundChk").onchange = e => localStorage.setItem(LS.sound, e.target.checked ? "on" : "off");
  $("notifSignupChk").onchange = async e => { const v = e.target.checked; const { error } = await db.from("notification_prefs").upsert({ user_id: uid, signup_alerts: v, updated_at: new Date().toISOString() }); if (error) { e.target.checked = !v; toast("Could not save the setting."); } else prefs.signup_alerts = v; };
  $("notifPushBtn").onclick = togglePush;
}
function render() {
  const badge = $("notifBadge"), n = unread();
  if (badge) { badge.textContent = n > 99 ? "99+" : String(n); badge.classList.toggle("hidden", !n); }
  const list = $("notifList"); if (!list) return;
  $("notifStatus").textContent = (navigator.onLine ? "Online" : "Offline — showing saved notifications") + " · " + n + " unread";
  $("notifSoundChk").checked = soundOn();
  $("notifSignupWrap").classList.toggle("hidden", S().profile?.role !== "super_admin");
  $("notifSignupChk").checked = prefs.signup_alerts !== false;
  $("nfAll").classList.toggle("on", tab === "all"); $("nfUnread").classList.toggle("on", tab === "unread");
  list.textContent = "";
  const shown = tab === "unread" ? items.filter(x => !x.read_at) : items;
  if (!shown.length) { const p = document.createElement("p"); p.className = "text-sm text-slate-500 py-4 text-center"; p.textContent = tab === "unread" ? "No unread notifications." : "No notifications yet."; list.appendChild(p); refreshPushUI(); return; }
  for (const it of shown) {
    const row = document.createElement("div"); row.className = "nf-item" + (it.read_at ? "" : " unread");
    const ic = document.createElement("div"); ic.className = "nf-ic"; ic.innerHTML = '<i class="fa-solid ' + (/sign|account|member/i.test((it.title || "") + (it.link || "")) ? "fa-user-plus" : "fa-bell") + '"></i>';
    const tx = document.createElement("div"); tx.className = "nf-tx"; const t = document.createElement("b"); t.textContent = it.title || ""; const bd = document.createElement("span"); bd.textContent = it.body || ""; const ag = document.createElement("div"); ag.className = "nf-ago"; ag.textContent = ago(it.created_at);
    tx.append(t, bd, ag); row.append(ic, tx);
    if (!it.read_at) { const dot = document.createElement("span"); dot.className = "nf-dot"; row.appendChild(dot); }
    row.onclick = () => openItem(it); list.appendChild(row);
  }
  refreshPushUI();
}
function ago(d) { const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000); if (!isFinite(s)) return ""; if (s < 60) return "Just now"; if (s < 3600) return Math.floor(s / 60) + "m"; if (s < 86400) return Math.floor(s / 3600) + "h"; if (s < 604800) return Math.floor(s / 86400) + "d"; return fmt(d); }
async function openItem(it) {
  if (!it.read_at && navigator.onLine) { const t = new Date().toISOString(); const { error } = await db.from("notifications").update({ read_at: t }).eq("id", it.id); if (!error) { it.read_at = t; saveCache(); } }
  $("notifDialog").close(); render(); go(it.link);
}
function go(link) {
  const target = String(link || "").replace("#", "");
  if (target === "accounts") { document.querySelector('[data-view="admin"]')?.click(); setTimeout(() => { [...document.querySelectorAll("#adminContent button")].find(b => /^\s*Accounts\s*$/.test(b.textContent))?.click(); }, 500); }
}
async function markAll() {
  if (!navigator.onLine) { toast("Connect to the internet to update notifications."); return; }
  const t = new Date().toISOString(); const { error } = await db.from("notifications").update({ read_at: t }).eq("user_id", uid).is("read_at", null);
  if (error) { toast("Could not mark all as read."); return; } items.forEach(n => n.read_at = n.read_at || t); saveCache(); render();
}
async function clearAll() {
  if (!navigator.onLine) { toast("Connect to the internet to clear history."); return; }
  if (!(await window.uecfConfirm({ title: "Clear all notifications?", message: "This only removes your own notification history and cannot be undone.", confirmText: "Clear all", danger: true }))) return;
  const { error } = await db.from("notifications").delete().eq("user_id", uid);
  if (error) { toast("Could not clear notifications."); return; } items = []; saveCache(); render();
}

/* ---- data ---- */
async function load() {
  try { items = JSON.parse(localStorage.getItem(LS.cache(uid)) || "[]"); } catch (e) { items = []; } render();
  if (!navigator.onLine) return;
  const { data, error } = await db.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
  if (!error && data) { items = data; saveCache(); }
  const { data: p } = await db.from("notification_prefs").select("*").eq("user_id", uid).maybeSingle(); if (p) prefs = p;
  render();
}
function subscribe() {
  if (channel) { db.removeChannel(channel); channel = null; }
  channel = db.channel("notifs-" + uid).on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: "user_id=eq." + uid }, ({ new: n }) => {
    if (items.some(x => x.id === n.id)) return; // no duplicates
    items.unshift(n); saveCache(); render(); toast(n.title);
    if (soundOn() && document.visibilityState === "visible") beep();
  }).subscribe();
}

/* ---- Web Push ---- */
const b64 = s => { const p = "=".repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); };
async function currentSub() { try { const reg = await navigator.serviceWorker.ready; return await reg.pushManager.getSubscription(); } catch (e) { return null; } }
async function refreshPushUI() {
  const btn = $("notifPushBtn"), msg = $("notifPushMsg"); if (!btn) return;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent), standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    btn.disabled = true; msg.textContent = ios && !standalone ? "On iPhone, first use Share → Add to Home Screen, then open the app from the Home Screen." : "Push notifications are not supported on this browser."; return;
  }
  if (VAPID_PUBLIC_KEY.startsWith("PASTE")) { btn.disabled = true; msg.textContent = "Push is not configured yet (VAPID public key missing)."; return; }
  const sub = await currentSub(); btn.disabled = false;
  btn.textContent = sub ? "Disable push notifications" : "Enable push notifications";
  msg.textContent = Notification.permission === "denied" ? "Notifications are blocked in your browser settings." : sub ? "Push is on for this device." : "";
}
async function togglePush() {
  try {
    const sub = await currentSub();
    if (sub) { await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint); await sub.unsubscribe(); toast("Push notifications turned off."); return refreshPushUI(); }
    if (!navigator.onLine) { toast("Connect to the internet first."); return; }
    const perm = await Notification.requestPermission(); // must come from this tap
    if (perm !== "granted") { toast("Permission was not granted."); return refreshPushUI(); }
    const reg = await navigator.serviceWorker.ready;
    const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID_PUBLIC_KEY) });
    const j = s.toJSON();
    const { error } = await db.from("push_subscriptions").upsert({ user_id: uid, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, device_label: (navigator.userAgent || "").slice(0, 120) }, { onConflict: "endpoint" });
    if (error) { await s.unsubscribe(); toast("Could not save this device for push."); return refreshPushUI(); }
    toast("Push notifications enabled on this device."); refreshPushUI();
  } catch (e) { toast("Could not change push settings."); refreshPushUI(); }
}

/* ---- session watcher ---- */
function tick() {
  if (!db) return; ensureUI();
  const id = S().user?.id || null, btn = $("notifBtn");
  btn.classList.toggle("hidden", !id);
  if (id === uid) return;
  uid = id; items = [];
  if (channel) { db.removeChannel(channel); channel = null; }
  if (uid) { load(); subscribe(); } else render();
}
if (db) {
  setInterval(tick, 1500); tick();
  window.addEventListener("online", () => uid && load());
  navigator.serviceWorker?.addEventListener("message", e => { if (e.data?.type === "NOTIF_CLICK") go(e.data.link); });
  const q = new URLSearchParams(location.search).get("open"); if (q) setTimeout(() => go(q), 2500);
}

/* ---- Share song (shares title + app link only; no private data) ---- */
new MutationObserver(() => {
  const p = $("printSong"); if (!p || $("shareSong")) return;
  const b = document.createElement("button"); b.id = "shareSong"; b.type = "button"; b.className = "btn btn-ghost"; b.innerHTML = '<i class="fa-solid fa-share-nodes mr-1"></i> Share';
  b.onclick = async () => {
    const t = S().currentSong?.title || "Worship song", data = { title: t, text: t + " — UECFI Worship Songbook", url: location.origin + location.pathname };
    try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(data.url); toast("Link copied."); } } catch (e) { /* cancelled */ }
  };
  p.after(b);
}).observe(document.body, { childList: true, subtree: true });
