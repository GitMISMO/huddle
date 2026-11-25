/* ============================================================================
   HUDDLE, resources.mismo.org/huddle/
   MISMO's own Doodle, for facilitators and staff. The organizer offers some times, sends the poll from their own
   Outlook, sees who can make which time, picks one, and sends their own calendar invite. Nothing reads anyone's
   calendar, and nothing is ever emailed automatically to the people being polled.

   Where things live (all in the PRIVATE repository GitMISMO/huddle-data, through the save relay, project key
   "huddle"):
     data/polls.json   the polls. Members-only, by sign-in: each person reads and saves only the polls they made.
                       Only the see-all list in projects.json (Jonna and Vanessa) sees every poll, on the Admin
                       Dashboard; My Polls is always just their own (Jonna, Nov 22, 2026). Saved by this page.
     votes/votes.json  people's answers. Written only by the relay's no-sign-in routes when someone answers through
                       a link; read here through GET /huddle/group-poll/votes. This page never writes it, so a
                       save from here can never land on an answer it hasn't seen. Answers typed in by hand and people
                       taken off the list are kept on the poll itself (manual, hiddenVoters).
   The relay emails the organizer when someone answers (their own setting, on by default).

   BEFORE UPLOADING A NEW COPY: download the current file from GitHub first and change that copy.
   Storage keys: tools:huddle:<name>. Never localStorage.clear().
   Opened anywhere other than resources.mismo.org, or with ?preview=1, it runs as a PREVIEW with made-up polls.
   ========================================================================== */
(function () {
'use strict';

var RELAY_URL = 'https://rgvdi67cg27o5kcmiytcqbqnrm0hmztx.lambda-url.us-east-1.on.aws';
var PROJECT = 'huddle', TOOL = 'Huddle';
var PREVIEW = !!window.MP_PREVIEW;
var SITE = PREVIEW ? '' : 'https://resources.mismo.org/huddle/';
var BUILD = window.MP_BUILD || 'dev';
var KEY = function (n) { return 'tools:huddle:' + n; };
var ET = 'America/New_York';
/* who gets the Admin Dashboard. Only decides whether the page shows it: what anyone can actually read is decided by the
   relay, from the see-all list on the polls file in projects.json, which must list the same people. */
var ADMINS = ['jcritchley@mismo.org', 'jcritchley@mba.org', 'vrios@mismo.org', 'vrios@mba.org'];
function isAdmin() { return ADMINS.indexOf(me().email) >= 0; }

/* ---------------- small helpers ---------------- */
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
function rid(n) { var a = new Uint8Array(n || 10); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]; }).join(''); }
function linkCode() { var a = new Uint8Array(18); crypto.getRandomValues(a); return btoa(String.fromCharCode.apply(null, a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function lsGet(n, d) { try { var v = localStorage.getItem(KEY(n)); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
function lsSet(n, v) { try { if (v == null) localStorage.removeItem(KEY(n)); else localStorage.setItem(KEY(n), JSON.stringify(v)); } catch (e) {} }
function first(n) { return String(n || '').trim().split(/[\s,]+/)[0] || ''; }
function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
var toastT;
function toast(msg) { var t = $('.toast'); if (!t) { t = el('div', 'toast'); t.setAttribute('role', 'status'); document.body.appendChild(t); } t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 4200); }
function copy(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
  fallbackCopy(text); return Promise.resolve();
}
function fallbackCopy(text) { var t = el('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) {} t.remove(); }
var ICON = {
  mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  link: '<svg viewBox="0 0 24 24"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  pen: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
  dup: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  box: '<svg viewBox="0 0 24 24"><path d="M3 7h18v3H3zM5 10v10h14V10M10 14h4"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M12 4v12M6 10l6 6 6-6M5 20h14"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1L3.2 9.4l6.1-.8z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  fwd: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  undo: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>'
};
/* the three answers, drawn the way Doodle draws them: a check, a check in brackets, a cross */
var MARK = {
  y: '<svg class="mk" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5l5 5L19.5 7"/></svg>',
  m: '<svg class="mk" viewBox="0 0 32 24" aria-hidden="true"><path d="M7 3C3.5 7 3.5 17 7 21M25 3c3.5 4 3.5 14 0 18"/><path d="M10.5 12.5l4 4L22 8.5"/></svg>',
  n: '<svg class="mk" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>'
};
var WORD = { y: 'Yes', m: 'If need be', n: 'No' };

/* ---------------- time ---------------- */
var ZONES = [
  { v: 'America/New_York', n: 'Eastern' }, { v: 'America/Chicago', n: 'Central' }, { v: 'America/Denver', n: 'Mountain' },
  { v: 'America/Phoenix', n: 'Arizona' }, { v: 'America/Los_Angeles', n: 'Pacific' }, { v: 'America/Anchorage', n: 'Alaska' },
  { v: 'Pacific/Honolulu', n: 'Hawaii' }, { v: 'Europe/London', n: 'London' }, { v: 'Europe/Paris', n: 'Central Europe' },
  { v: 'Asia/Kolkata', n: 'India' }, { v: 'UTC', n: 'UTC' }
];
function zoneName(tz) { var z = ZONES.find(function (x) { return x.v === tz; }); return z ? z.n : String(tz).replace(/^.*\//, '').replace(/_/g, ' '); }
function localZone() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ET; } catch (e) { return ET; } }
(function () { var z = localZone(); if (!ZONES.some(function (x) { return x.v === z; })) ZONES.unshift({ v: z, n: zoneName(z) }); })();
function parts(t, tz) {
  var f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' });
  var o = {}; f.formatToParts(new Date(t)).forEach(function (p) { o[p.type] = p.value; });
  return { y: +o.year, mo: +o.month, d: +o.day, h: (+o.hour) % 24, mi: +o.minute, iso: o.year + '-' + o.month + '-' + o.day, wd: o.weekday };
}
function offsetOf(tz, t) { var p = parts(t, tz); return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) - Math.floor(t / 60000) * 60000; }
/* a wall-clock day and minute in a zone, to a moment */
function at(iso, mins, tz) {
  var y = +iso.slice(0, 4), mo = +iso.slice(5, 7), d = +iso.slice(8, 10);
  var guess = Date.UTC(y, mo - 1, d, Math.floor(mins / 60), mins % 60);
  var t = guess - offsetOf(tz, guess);
  return guess - offsetOf(tz, t);
}
function fmtTime(t, tz) { return new Date(t).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }); }
function fmtDay(t, tz, long) { return new Date(t).toLocaleDateString('en-US', { timeZone: tz, weekday: long ? 'long' : 'short', month: long ? 'long' : 'short', day: 'numeric' }); }
function fmtRange(s, e, tz) { var a = fmtTime(s, tz), b = fmtTime(e, tz); if (a.slice(-2) === b.slice(-2)) a = a.slice(0, -3); return a + '–' + b; }
function tzAbbr(t, tz) { try { return new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date(t)).find(function (p) { return p.type === 'timeZoneName'; }).value; } catch (e) { return ''; } }
function isoDay(iso, long) { return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: long ? 'long' : 'short', month: long ? 'long' : 'short', day: 'numeric' }); }
function isoAdd(iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function dow(iso) { return new Date(iso + 'T12:00:00Z').getUTCDay(); }
function todayISO(tz) { return parts(Date.now(), tz || ET).iso; }
function mondayOf(iso) { var w = dow(iso); return isoAdd(iso, w === 0 ? -6 : 1 - w); }
function optStart(o) { return o.d ? Date.parse(o.d + 'T00:00:00Z') : o.s; }
function optLabel(o, tz, long) { return o.d ? isoDay(o.d, long) + ' · All day' : fmtDay(o.s, tz, long) + ', ' + fmtRange(o.s, o.e, tz) + ' ' + tzAbbr(o.s, tz); }
function optHead(o, tz) {
  if (o.d) return { day: isoDay(o.d), time: 'All day' };
  return { day: fmtDay(o.s, tz), time: fmtRange(o.s, o.e, tz) };
}
function optPast(o) { return o.d ? o.d < todayISO(ET) : o.e < Date.now(); }
function whenAgo(t) { var m = Math.round((Date.now() - t) / 60000); if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; var h = Math.round(m / 60); if (h < 24) return plural(h, 'hour') + ' ago'; var d = Math.round(h / 24); if (d < 7) return plural(d, 'day') + ' ago'; return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
function mdy(iso) { return iso ? (+iso.slice(5, 7)) + '/' + (+iso.slice(8, 10)) + '/' + iso.slice(2, 4) : ''; }
/* a typed date: 9/30/26, 9/30/2026, 2026-09-30, Sep 30 2026, Sept 30 */
function parseDate(txt) {
  var s = String(txt || '').trim(); if (!s) return null; var m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) return fixISO(+m[1], +m[2], +m[3]);
  if ((m = /^(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?$/.exec(s))) { var y = m[3] ? +m[3] : +todayISO().slice(0, 4); if (y < 100) y += 2000; return fixISO(y, +m[1], +m[2]); }
  var t = Date.parse(s + (/\d{4}/.test(s) ? '' : ' ' + todayISO().slice(0, 4)));
  if (!isNaN(t)) { var d = new Date(t); return fixISO(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
  return null;
}
function fixISO(y, mo, d) { if (mo < 1 || mo > 12 || d < 1 || d > 31) return null; var x = new Date(Date.UTC(y, mo - 1, d)); if (x.getUTCMonth() !== mo - 1) return null; return x.toISOString().slice(0, 10); }
/* a typed time: 9, 9am, 9:30, 9:30 pm, 14:00, noon */
function parseTime(txt) {
  var s = String(txt || '').trim().toLowerCase().replace(/\s+/g, ''); if (!s) return null;
  if (s === 'noon') return 720; if (s === 'midnight') return 0;
  var m = /^(\d{1,2})(?::?(\d{2}))?(a|am|p|pm)?$/.exec(s); if (!m) return null;
  var h = +m[1], mi = m[2] ? +m[2] : 0; if (mi > 59) return null;
  if (m[3]) { if (h < 1 || h > 12) return null; if (m[3][0] === 'p' && h < 12) h += 12; if (m[3][0] === 'a' && h === 12) h = 0; }
  else if (h < 7) h += 12;            /* "3" alone means 3 in the afternoon, as people mean it */
  if (h > 23) return null; return h * 60 + mi;
}
function minsLabel(m) { var h = Math.floor(m / 60), mi = m % 60; return ((h + 11) % 12 + 1) + (mi ? ':' + String(mi).padStart(2, '0') : '') + (h < 12 ? ' AM' : ' PM'); }

/* ---------------- the session ---------------- */
function RS() { return window.ResourcesSession || null; }
function me() {
  if (PREVIEW) return { email: 'jcritchley@mismo.org', name: 'Jonna Critchley' };
  var s = RS() && RS().current(); return s ? { email: String(s.email || '').toLowerCase(), name: s.name || s.email } : { email: '', name: '' };
}
function canEdit() { return PREVIEW || !!(RS() && RS().canEdit(PROJECT)); }

/* ---------------- talking to the relay ---------------- */
function err(code, msg, status) { var e = new Error(msg || code); e.code = code; e.status = status || 0; return e; }
function call(path, method, body) {
  var headers = {}, tok = RS() && RS().token();
  if (!tok) return Promise.reject(err('SIGNED_OUT', 'Your sign-in has ended.', 401));
  headers.Authorization = 'Bearer ' + tok;
  if (body) headers['Content-Type'] = 'application/json';
  return fetch(RELAY_URL + '/' + PROJECT + path, { method: method, cache: 'no-store', headers: headers, body: body ? JSON.stringify(body) : undefined })
    .then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) {
        if (r.ok) return b;
        var e = err((b && b.error) || ('HTTP_' + r.status), b && b.message, r.status); e.body = b; throw e;
      });
    }, function () { throw err('OFFLINE', 'Could not reach resources.mismo.org', 0); });
}
function noAccess(e) { if (e && (e.code === 'NO_ACCESS') && RS()) RS().signIn({ reason: 'no-access', toolName: 'Huddle', gated: true }); }

/* ---------------- the polls: read, keep, save ---------------- */
var DB = { docs: {}, sha: null, loaded: false, pending: {}, at: 0, error: '' };
var VOTES = { docs: {}, loaded: false, at: 0, off: false, error: '' };
var HEALTH = { ready: null, readyAt: 0, lastSave: 0, lastSaveError: '' };
function polls() { var d = Object.assign({}, DB.docs, DB.pending); return Object.keys(d).map(function (k) { return d[k]; }).filter(Boolean); }
function getPoll(id) { return (id in DB.pending ? DB.pending[id] : DB.docs[id]) || null; }
function isMine(p) { return String(p.owner || '').toLowerCase() === me().email; }
function saveState(text, bad) { var s = $('#savestate'); if (s) { s.textContent = text || ''; s.className = 'savestate' + (bad ? ' bad' : ''); } }
function loadPolls() {
  if (PREVIEW) { DB.loaded = true; return Promise.resolve(false); }
  return call('/data/polls', 'GET').then(function (b) {
    var before = JSON.stringify(DB.docs);
    DB.docs = (b && b.data && b.data.docs) || {}; DB.sha = (b && b.sha) || null; DB.loaded = true; DB.at = Date.now(); DB.error = '';
    restoreUnsaved();
    return before !== JSON.stringify(DB.docs);
  }, function (e) { DB.error = e.code || e.message; noAccess(e); throw e; });
}
function loadVotes() {
  if (PREVIEW) { VOTES.loaded = true; VOTES.at = Date.now(); return Promise.resolve(false); }
  return call('/group-poll/votes', 'GET').then(function (b) {
    var before = JSON.stringify(VOTES.docs);
    VOTES.docs = (b && b.docs) || {}; VOTES.loaded = true; VOTES.off = false; VOTES.at = Date.now(); VOTES.error = '';
    return before !== JSON.stringify(VOTES.docs);
  }, function (e) {
    VOTES.loaded = true;
    /* the relay hasn't switched the links on yet: answers can still be typed in by hand */
    if (e.status === 404) { VOTES.off = true; return false; }
    VOTES.error = e.code || e.message; return false;
  });
}
function checkReady() {
  if (PREVIEW) { HEALTH.ready = true; HEALTH.readyAt = Date.now(); return Promise.resolve(); }
  return fetch(RELAY_URL + '/' + PROJECT + '/group-poll/ready', { cache: 'no-store' }).then(function (r) { HEALTH.ready = r.ok; HEALTH.readyAt = Date.now(); }, function () { HEALTH.ready = false; HEALTH.readyAt = Date.now(); });
}
/* A change is kept in the browser until the relay has it, so a closed tab or an expired sign-in never loses it. */
function keepUnsaved() { if (!PREVIEW) lsSet('unsaved:' + me().email, Object.keys(DB.pending).length ? DB.pending : null); }
function restoreUnsaved() {
  var kept = lsGet('unsaved:' + me().email, null);
  if (kept && !Object.keys(DB.pending).length && Object.keys(kept).length) { DB.pending = kept; saveState('Finishing an earlier save…'); schedule(); }
}
function put(p, why) {
  if (!canEdit()) { toast('You can look at Huddle but not change it. Ask Jonna for Edit access.'); return; }
  p.updatedAt = Date.now(); p.updatedBy = me().name;
  if (why) { p.log = (p.log || []).concat({ at: Date.now(), by: me().name, what: why }).slice(-80); }
  DB.pending[p.id] = clone(p);
  keepUnsaved(); render();
  if (PREVIEW) { DB.docs[p.id] = clone(p); delete DB.pending[p.id]; saveState('Preview · nothing is saved'); render(); return; }
  saveState('Saving…'); schedule();
}
var saveT, chain = Promise.resolve(), tries = 0;
function schedule() { clearTimeout(saveT); saveT = setTimeout(flush, 300); }
function flush() {
  chain = chain.then(function () {
    var ids = Object.keys(DB.pending); if (!ids.length) return;
    var sending = clone(DB.pending);
    if (!(RS() && RS().token())) {
      /* the four-hour session ran out: sign in again, then send the same save */
      return RS().signIn({ reason: 'expired' }).then(function () { schedule(); }, function () { saveState('Not saved: sign in to finish saving', true); });
    }
    /* read the file as it is now and lay this page's changes over it, so a poll saved elsewhere in the meantime is kept */
    return call('/data/polls', 'GET').then(function (b) {
      var docs = Object.assign({}, (b && b.data && b.data.docs) || {});
      Object.keys(sending).forEach(function (id) { if (sending[id] === null) delete docs[id]; else docs[id] = sending[id]; });   /* null = deleted for good */
      return call('/data/polls', 'PUT', { content: { docs: docs }, sha: (b && b.sha) || null });
    }).then(function (res) {
      DB.docs = (res && res.data && res.data.docs) || DB.docs; DB.sha = (res && res.sha) || DB.sha;
      Object.keys(sending).forEach(function (id) { if (JSON.stringify(DB.pending[id]) === JSON.stringify(sending[id])) delete DB.pending[id]; });
      keepUnsaved(); tries = 0; HEALTH.lastSave = Date.now(); HEALTH.lastSaveError = '';
      saveState(Object.keys(DB.pending).length ? 'Saving…' : 'Saved'); setTimeout(function () { if ($('#savestate') && $('#savestate').textContent === 'Saved') saveState(''); }, 2500);
      if (Object.keys(DB.pending).length) schedule();
      render();
    }, function (e) {
      HEALTH.lastSaveError = e.code || e.message;
      if (e.code === 'VIEW_ONLY') { saveState('Not saved: your access is view only', true); DB.pending = {}; keepUnsaved(); render(); return; }
      if (e.code === 'TOKEN_EXPIRED' || e.code === 'SIGNED_OUT' || e.status === 401) { return RS().signIn({ reason: 'expired' }).then(function () { schedule(); }, function () { saveState('Not saved: sign in to finish saving', true); }); }
      noAccess(e);
      tries++;
      saveState('Not saved yet. Trying again…', true);
      if (tries < 6) setTimeout(schedule, Math.min(30000, 1500 * tries)); else saveState('Not saved. Your change is kept in this browser; reload to try again.', true);
    });
  });
  return chain;
}

/* ---------------- answers ---------------- */
/* everyone who answered a poll: through a link, or typed in by the organizer; less anyone taken off */
function everyone(p, withRemoved) {
  var gone = {}; (p.hiddenVoters || []).forEach(function (id) { gone[id] = 1; });
  var out = [], v = (VOTES.docs[p.id] && VOTES.docs[p.id].voters) || {};
  Object.keys(v).forEach(function (id) { var x = v[id]; if (x && (withRemoved || !gone[id])) out.push(Object.assign({ id: id, removed: !!gone[id] }, x)); });
  var man = p.manual || {};
  Object.keys(man).forEach(function (id) { var x = man[id]; if (x && (withRemoved || !gone[id])) out.push(Object.assign({ id: id, manual: true, removed: !!gone[id] }, x)); });
  out.sort(function (a, b) { return (a.created || a.at || 0) - (b.created || b.at || 0); });
  return out;
}
function tally(p) {
  var ppl = everyone(p), t = {};
  (p.options || []).forEach(function (o) { t[o.id] = { y: 0, m: 0, n: 0 }; });
  ppl.forEach(function (x) { Object.keys(x.answers || {}).forEach(function (id) { if (t[id] && t[id][x.answers[id]] != null) t[id][x.answers[id]]++; }); });
  var best = 0; Object.keys(t).forEach(function (id) { var s = t[id].y * 2 + t[id].m; if (s > best) best = s; });
  var bestIds = best ? Object.keys(t).filter(function (id) { return t[id].y * 2 + t[id].m === best; }) : [];
  return { t: t, best: bestIds, people: ppl };
}
function waitingOn(p) {
  var ppl = everyone(p), answered = {};
  ppl.forEach(function (x) { if (x.invitee) answered['i:' + x.invitee] = 1; if (x.email) answered['e:' + String(x.email).toLowerCase()] = 1; });
  return (p.invitees || []).filter(function (i) { return !i.removed && !answered['i:' + i.id] && !(i.email && answered['e:' + i.email.toLowerCase()]); });
}
var SEEN = {};
function seenKey() { return 'seen:' + me().email; }
function markSeen(p) { SEEN[p.id] = Date.now(); lsSet(seenKey(), SEEN); }
function newAnswers(p) { var s = SEEN[p.id] || 0; return everyone(p).filter(function (x) { return !x.manual && (x.at || 0) > s; }); }
function statusOf(p) {
  if (p.archived) return 'archived';
  if (p.status === 'scheduled') return 'scheduled';
  if (p.status === 'closed') return 'closed';
  var dl = p.settings && p.settings.deadline; if (dl && Date.now() > dl) return 'closed';
  return 'open';
}
var STATUS_WORD = { open: 'Open', closed: 'Closed', scheduled: 'Scheduled', archived: 'Archived' };
var STATUS_CLS = { open: 'p-collect', closed: 'p-draft', scheduled: 'p-booked', archived: 'p-cancel' };
function shareLink(p) { return SITE + 'poll.html#p=' + p.id + '&k=' + p.code; }
function personalLink(p, i) { return SITE + 'poll.html#p=' + p.id + '&i=' + i.id + '.' + i.code; }

/* ---------------- state and routing ---------------- */
var STATE = { tab: 'mine', filter: null, pane: null, tz: lsGet('tz', null) || localZone(), draft: null, week: null, allDay: false, weekends: false, addingManual: false, showRemoved: false };
function go(tab, id) {
  if (tab === 'new' && !id) { STATE.draft = blankPoll(); STATE.week = null; }
  if (tab === 'edit') { var p = getPoll(id); if (!p) return; STATE.draft = clone(p); STATE.week = null; tab = 'new'; closePane(); }
  STATE.tab = tab;
  if (window.__railMark) window.__railMark(tab === 'new' ? 'new' : tab);
  var h = tab === 'mine' ? '' : '#' + tab; if (location.hash !== h && !(tab === 'mine' && !location.hash)) history.replaceState(null, '', location.pathname + location.search + h);
  render(); window.scrollTo(0, 0);
}
window.go = go;

function blankPoll() {
  var u = me();
  return { id: rid(10), members: [u.email], owner: u.email, ownerName: u.name, title: '', about: '', where: '', duration: 60, tz: STATE.tz || ET,
    options: [], settings: { ifNeedBe: true, hidden: false, oneVote: false, limit: 0, askEmail: 'required', comments: true, deadline: null, notify: true },
    code: linkCode(), invitees: [], status: 'open', manual: {}, hiddenVoters: [], archived: false, isNew: true };
}

/* ---------------- render ---------------- */
function render() {
  var app = $('#app'); if (!app) return;
  var y = window.scrollY;
  app.innerHTML = '';
  if (PREVIEW) app.appendChild(el('div', 'preview-band', '<b>Preview.</b> Made-up polls; nothing you do here is saved or sent. <a href="poll.html">See the page people answer on</a>.'));
  if (!DB.loaded) { app.appendChild(loading()); return; }
  if (STATE.tab === 'new') renderEditor(app);
  else if (STATE.tab === 'health') renderHealth(app);
  else if (STATE.tab === 'help') renderHelp(app);
  else renderList(app, STATE.tab === 'admin' && isAdmin());
  var ab = $('[data-hq="admin"]'); if (ab) ab.hidden = !isAdmin();
  if (STATE.pane) renderPane();
  window.scrollTo(0, y);
}
function loading() { return el('div', 'mp-loading', '<div class="spinner"></div><span>Loading your polls…</span>'); }

/* ----- My Polls / All Polls ----- */
function renderList(app, all) {
  var list = polls().filter(function (p) { return all ? true : isMine(p); });
  var cnt = { open: 0, closed: 0, scheduled: 0, archived: 0, fresh: 0, ready: 0 };
  list.forEach(function (p) {
    var s = statusOf(p); cnt[s]++;
    if (s !== 'archived' && newAnswers(p).length) cnt.fresh++;
    if ((s === 'open' || s === 'closed') && everyone(p).length) cnt.ready++;
  });
  /* never an empty view: open polls first, otherwise whatever there is */
  var f = STATE.filter;
  if (!f) f = cnt.open ? 'open' : cnt.fresh ? 'new' : cnt.scheduled ? 'scheduled' : 'all';
  var head = el('div', 'pagehead');
  head.innerHTML = '<div class="grow"><h1>' + (all ? 'Admin Dashboard' : 'My Polls') + '</h1></div>';
  var nb = el('button', 'btn big', ICON.plus + ' New Poll'); nb.onclick = function () { go('new'); }; head.appendChild(nb);
  app.appendChild(head);

  var stats = el('div', 'stats');
  [['open', cnt.open, 'Open Polls', ''], ['new', cnt.fresh, 'Polls With New Answers', cnt.fresh ? 'hot' : ''], ['ready', cnt.ready, 'Answered, Time Not Picked', ''], ['scheduled', cnt.scheduled, 'Scheduled', 'good']].forEach(function (s) {
    var b = el('button', 'stat ' + s[3], '<b>' + s[1] + '</b><span>' + s[2] + '</span>'); b.type = 'button';
    b.setAttribute('aria-pressed', String(f === s[0])); b.onclick = function () { STATE.filter = s[0]; render(); };
    stats.appendChild(b);
  });
  app.appendChild(stats);
  if (all) app.appendChild(organizers(list));

  var bar = el('div', 'filters');
  var seg = el('div', 'seg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Show');
  [['open', 'Open'], ['new', 'New Answers'], ['ready', 'Time Not Picked'], ['scheduled', 'Scheduled'], ['closed', 'Closed'], ['archived', 'Archived'], ['all', 'All']].forEach(function (x) {
    var b = el('button', '', x[1]); b.type = 'button'; b.setAttribute('aria-pressed', String(f === x[0])); b.onclick = function () { STATE.filter = x[0]; render(); }; seg.appendChild(b);
  });
  bar.appendChild(seg);
  if (VOTES.off) bar.appendChild(el('span', 'mp-flag', 'Answering through links starts once Perry deploys his relay update. Until then, add answers by hand.'));
  app.appendChild(bar);

  var shown = list.filter(function (p) {
    var s = statusOf(p);
    if (f === 'all') return s !== 'archived';
    if (f === 'new') return s !== 'archived' && newAnswers(p).length;
    if (f === 'ready') return (s === 'open' || s === 'closed') && everyone(p).length;
    return s === f;
  });
  shown.sort(function (a, b) {
    var na = newAnswers(a).length ? 1 : 0, nb2 = newAnswers(b).length ? 1 : 0; if (na !== nb2) return nb2 - na;
    return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
  });
  if (!shown.length) {
    var e = el('div', 'mp-empty');
    e.innerHTML = list.length ? '<span><b>Nothing here.</b> Pick another view above, or start a new poll with New Poll at the top.</span>' : '<span><b>No polls yet.</b> Press New Poll at the top to pick a few times, send the link, and see who can make it.</span>';
    var sp = el('div', 'mp-split'); sp.appendChild(e); sp.appendChild(sideColumn(list)); app.appendChild(sp); return;
  }
  var split = el('div', 'mp-split'), box = el('div', 'mp-list');
  shown.forEach(function (p) { box.appendChild(pollRow(p, all)); });
  /* a short list leaves no empty well: the rest of the polls follow, lighter */
  if (shown.length < 4 && f !== 'all' && f !== 'archived') {
    var rest = list.filter(function (p) { return shown.indexOf(p) < 0 && statusOf(p) !== 'archived'; })
      .sort(function (a, b) { return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0); }).slice(0, 6 - shown.length);
    if (rest.length) { box.appendChild(el('div', 'mp-also', all ? 'Other Polls' : 'Your Other Polls')); rest.forEach(function (p) { var r = pollRow(p, all); r.classList.add('dim'); box.appendChild(r); }); }
  }
  split.appendChild(box); split.appendChild(sideColumn(list));
  app.appendChild(split);
}
/* Admin Dashboard: who is using Huddle, one row per organizer, alphabetical */
function organizers(list) {
  var by = {};
  list.forEach(function (p) {
    var k = String(p.owner || '').toLowerCase(), o = by[k] || (by[k] = { name: p.ownerName || p.owner, open: 0, scheduled: 0, total: 0, answers: 0, last: 0 });
    var s = statusOf(p); if (s === 'archived') return;
    o.total++; if (s === 'open') o.open++; if (s === 'scheduled') o.scheduled++;
    o.answers += everyone(p).length; o.last = Math.max(o.last, p.updatedAt || p.createdAt || 0);
  });
  var rows = Object.keys(by).map(function (k) { return by[k]; }).filter(function (o) { return o.total; }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
  var sec = el('section', 'panel');
  sec.innerHTML = '<div class="panel-h"><h2>By Organizer</h2><span class="sub">' + plural(rows.length, 'person', 'people') + ' using Huddle</span></div>';
  var t = el('table', 'guests mp-org');
  t.innerHTML = '<thead><tr><th>Organizer</th><th>Open</th><th>Scheduled</th><th>All Polls</th><th>Answers</th><th>Last Used</th></tr></thead><tbody>' +
    rows.map(function (o) { return '<tr><td><b>' + esc(o.name) + '</b></td><td>' + o.open + '</td><td>' + o.scheduled + '</td><td>' + o.total + '</td><td>' + o.answers + '</td><td>' + esc(o.last ? whenAgo(o.last) : '—') + '</td></tr>'; }).join('') + '</tbody>';
  var w = el('div', 'gridwrap'); w.appendChild(t); sec.appendChild(w);
  return sec;
}
/* beside the list: the latest answers across these polls, and what's been scheduled */
function sideColumn(list) {
  var side = el('aside', 'mp-side');
  /* At a Glance: one plain sentence on what to do next (Team HQ's tile reads it too) */
  var live = list.filter(function (p) { var s = statusOf(p); return s === 'open' || s === 'closed'; });
  var fresh = live.filter(function (p) { return newAnswers(p).length; }).sort(function (a, b) { return newAnswers(b).length - newAnswers(a).length; });
  var noInvite = list.filter(function (p) { return statusOf(p) === 'scheduled' && !p.inviteAt; });
  var ready = live.filter(function (p) { return everyone(p).length && !waitingOn(p).length && (p.invitees || []).some(function (i) { return !i.removed; }); });
  var line = noInvite.length ? 'Send the calendar invite for “' + esc(noInvite[0].title) + '”: the time is picked but the invite hasn’t gone out.'
    : fresh.length ? plural(newAnswers(fresh[0]).length, 'new answer') + ' on “' + esc(fresh[0].title) + '”' + (fresh.length > 1 ? ', and new answers on ' + plural(fresh.length - 1, 'other poll') : '') + '. Start there.'
    : ready.length ? 'Everyone has answered “' + esc(ready[0].title) + '”. Time to pick the time.'
    : live.length ? plural(live.length, 'poll') + ' waiting on answers. Nothing needs you right now.'
    : 'No polls waiting. Start one when you need to find a time.';
  var ag = el('section', 'panel mp-glance');
  ag.innerHTML = '<div class="panel-h"><h2>At a Glance</h2></div><p class="mp-sidep">' + line + '</p>';
  side.appendChild(ag);
  var recent = [];
  list.forEach(function (p) { if (p.archived) return; everyone(p).forEach(function (x) { if (!x.manual) recent.push({ p: p, x: x }); }); });
  recent.sort(function (a, b) { return (b.x.at || 0) - (a.x.at || 0); });
  var la = el('section', 'panel');
  la.innerHTML = '<div class="panel-h"><h2>Latest Answers</h2></div>';
  if (recent.length) {
    var ul = el('ul', 'mp-feed');
    recent.slice(0, 8).forEach(function (r) {
      var y = Object.keys(r.x.answers || {}).filter(function (k) { return r.x.answers[k] === 'y'; }).length, n = (r.p.options || []).length;
      var isNew = (r.x.at || 0) > (SEEN[r.p.id] || 0);
      var li = el('li'), b = el('button', '', '<b>' + esc(r.x.name || r.x.email) + (isNew ? ' <span class="tagbox hot">New</span>' : '') + '</b><span>' + esc(r.p.title || 'Untitled poll') + '</span><small>' + y + ' of ' + n + ' work · ' + esc(whenAgo(r.x.at || 0)) + '</small>');
      b.type = 'button'; b.onclick = function () { openPane(r.p.id); }; li.appendChild(b); ul.appendChild(li);
    });
    la.appendChild(ul);
  } else la.appendChild(el('p', 'mp-sidep muted', 'Answers show here as they come in. You also get an email each time someone answers.'));
  side.appendChild(la);
  var up = list.filter(function (p) { return statusOf(p) === 'scheduled'; }).map(function (p) { return { p: p, o: (p.options || []).find(function (o) { return o.id === p.chosen; }) }; })
    .filter(function (x) { return x.o && !optPast(x.o); }).sort(function (a, b) { return optStart(a.o) - optStart(b.o); });
  var cu = el('section', 'panel');
  cu.innerHTML = '<div class="panel-h"><h2>Coming Up</h2></div>';
  if (up.length) {
    var ul2 = el('ul', 'mp-feed');
    up.slice(0, 6).forEach(function (x) {
      var li = el('li'), b = el('button', '', '<b>' + esc(x.p.title || 'Meeting') + '</b><span>' + esc(optLabel(x.o, STATE.tz)) + '</span><small>' + (x.p.inviteAt ? 'Invite sent' : '<span class="mp-warnt">Invite not sent yet</span>') + '</small>');
      b.type = 'button'; b.onclick = function () { openPane(x.p.id); }; li.appendChild(b); ul2.appendChild(li);
    });
    cu.appendChild(ul2);
  } else {
    cu.innerHTML = '<div class="panel-h"><h2>How It Works</h2></div>';
    cu.appendChild(el('ol', 'mp-how', '<li><b>Offer times.</b> New Poll, then click the calendar.</li><li><b>Send the link</b> from your own Outlook.</li><li><b>Watch the answers</b> come in; you get an email each time.</li><li><b>Pick a time</b> and send your Outlook invite.</li>'));
  }
  side.appendChild(cu);
  return side;
}
function pollRow(p, all) {
  var s = statusOf(p), tl = tally(p), ppl = tl.people, fresh = newAnswers(p), wait = waitingOn(p), inv = (p.invitees || []).filter(function (i) { return !i.removed; });
  var r = el('button', 'mp-row' + (STATE.pane === p.id ? ' on' : '')); r.type = 'button';
  var best = tl.best.length ? (p.options || []).filter(function (o) { return tl.best.indexOf(o.id) >= 0; }).sort(function (a, b) { return optStart(a) - optStart(b); })[0] : null;
  var chosen = s === 'scheduled' ? (p.options || []).find(function (o) { return o.id === p.chosen; }) : null;
  var pct = inv.length ? Math.round(100 * (inv.length - wait.length) / inv.length) : 0;
  r.innerHTML =
    '<span class="mp-r1"><b class="mp-t">' + esc(p.title || 'Untitled poll') + '</b>' +
      '<span class="pill ' + STATUS_CLS[s] + '">' + STATUS_WORD[s] + '</span>' + (fresh.length ? '<span class="pill p-due">' + plural(fresh.length, 'new answer') + '</span>' : '') + '</span>' +
    '<span class="mp-r2">' + [all && !isMine(p) ? esc(p.ownerName || p.owner) : '', plural((p.options || []).length, 'time'), p.duration ? p.duration + ' min' : '', esc(p.where || '')].filter(Boolean).join(' · ') + '</span>' +
    '<span class="mp-r3">' +
      '<span class="mp-k"><small>Answers</small><b>' + ppl.length + '</b></span>' +
      '<span class="mp-k"><small>Invited</small><b>' + (inv.length ? (inv.length - wait.length) + ' of ' + inv.length : '—') + '</b>' + (inv.length ? '<i class="bar"><i style="width:' + pct + '%"></i></i>' : '') + '</span>' +
      '<span class="mp-k wide"><small>' + (chosen ? 'Scheduled For' : 'Best So Far') + '</small><b>' + (chosen ? esc(optLabel(chosen, STATE.tz)) : best ? esc(optLabel(best, STATE.tz)) + ' <span class="muted">· ' + tl.t[best.id].y + ' yes</span>' : '<span class="muted">No answers yet</span>') + '</b></span>' +
      '<span class="mp-k"><small>' + (p.settings && p.settings.deadline && s === 'open' ? 'Closes' : 'Updated') + '</small><b>' + (p.settings && p.settings.deadline && s === 'open' ? esc(new Date(p.settings.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })) : esc(whenAgo(p.updatedAt || p.createdAt || Date.now()))) + '</b></span>' +
    '</span>';
  r.onclick = function () { openPane(p.id); };
  return r;
}

/* ---------------- the right-hand panel: one poll ---------------- */
function paneEl() {
  var pn = $('#mp-pane');
  if (!pn) {
    pn = el('aside', 'pane'); pn.id = 'mp-pane'; pn.setAttribute('aria-label', 'Poll');
    pn.innerHTML = '<div class="pane-h"><div><h2 id="mp-pane-t"></h2><div class="ps" id="mp-pane-s"></div></div><button class="pane-x" type="button" aria-label="Close">×</button></div><div class="pane-b" id="mp-pane-b"></div>';
    document.body.appendChild(pn);
    $('.pane-x', pn).onclick = closePane;
  }
  return pn;
}
function openPane(id) {
  STATE.pane = id; STATE.addingManual = false; STATE.showRemoved = false;
  var p = getPoll(id); STATE.prevSeen = p ? (SEEN[id] || 0) : 0; if (p) markSeen(p);
  if (location.hash !== '#p=' + id) history.replaceState(null, '', location.pathname + location.search + '#p=' + id);
  render(); requestAnimationFrame(function () { paneEl().classList.add('on'); });
  if (window.MismoBack) MismoBack.check();
}
function closePane() {
  STATE.pane = null; var pn = $('#mp-pane'); if (pn) pn.classList.remove('on');
  if (/^#p=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search + (STATE.tab === 'mine' ? '' : '#' + STATE.tab));
  $$('.mp-row.on').forEach(function (r) { r.classList.remove('on'); });
  if (window.MismoBack) MismoBack.check();
}
window.__pane = { close: closePane };
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && STATE.pane && !$('.scrim')) closePane(); });
/* The browser's Back button (CN-033, the shared /assets/back.js): Back closes what is open first, top layer first,
   exactly as its own X does, then goes to the last left-menu page. Bottom layer first: the poll panel, then a dialog. */
if (window.MismoBack) {
  MismoBack.layer({ isOpen: function () { return !!STATE.pane; }, close: closePane });
  MismoBack.layer({ isOpen: function () { return !!$('.scrim'); }, close: function () { var x = $$('.scrim .dlg .x'); if (x.length) x[x.length - 1].click(); } });
}

function renderPane() {
  var p = getPoll(STATE.pane); if (!p) { closePane(); return; }
  var pn = paneEl(), b = $('#mp-pane-b', pn), s = statusOf(p), mine = isMine(p) || PREVIEW, edit = canEdit() && (mine || !isMine(p));
  var keepScroll = b.scrollTop;
  $('#mp-pane-t', pn).textContent = p.title || 'Untitled poll';
  $('#mp-pane-s', pn).innerHTML = '<span class="pill ' + STATUS_CLS[s] + '">' + STATUS_WORD[s] + '</span> ' +
    [p.duration ? p.duration + ' minutes' : '', esc(p.where || ''), 'Organized by ' + esc(p.ownerName || p.owner), p.createdAt ? 'Started ' + esc(new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })) : ''].filter(Boolean).join(' · ');
  b.innerHTML = '';
  if (!isMine(p) && !PREVIEW) b.appendChild(el('div', 'notice', 'This is <b>' + esc(p.ownerName || p.owner) + '</b>’s poll. You can see it from the Admin Dashboard; anything you change here is saved to their poll.'));

  /* --- what to do next --- */
  var tl = tally(p), wait = waitingOn(p);
  var next = el('div', 'mp-next');
  if (s === 'scheduled') {
    var c = (p.options || []).find(function (o) { return o.id === p.chosen; });
    next.className = 'mp-next done';
    next.innerHTML = '<div class="mp-next-t"><small>Scheduled For</small><b>' + esc(c ? optLabel(c, STATE.tz, true) : 'the chosen time') + '</b>' +
      '<span>' + (p.inviteAt ? 'Calendar invite opened ' + esc(whenAgo(p.inviteAt)) + '. People see this time when they open the poll.' : 'Next: send your calendar invite. People who open the poll now see this time.') + '</span></div>';
    var acts = el('div', 'mp-acts');
    acts.appendChild(btn('Create Outlook Invite', ICON.cal, '', function () { outlookInvite(p); }));
    acts.appendChild(btn('Download Invite (.ics)', ICON.down, 'ghost', function () { downloadIcs(p); }));
    acts.appendChild(btn('Email Everyone the Time', ICON.mail, 'ghost', function () { draftFinal(p); }));
    if (edit) acts.appendChild(btn('Pick a Different Time', ICON.undo, 'ghost', function () { var q = clone(p); q.status = 'closed'; q.chosen = null; put(q, 'Took the chosen time off'); }));
    next.appendChild(acts);
  } else {
    var nm = !tl.people.length ? (VOTES.off ? 'Answers through links start once Perry deploys his relay update; until then, type answers in by hand.' : 'Send the poll: copy the link or email it from Outlook. You’ll get an email each time someone answers.')
      : s === 'closed' ? 'The poll is closed to new answers. Pick a time below, or reopen it.'
      : wait.length ? 'Waiting on ' + plural(wait.length, 'person', 'people') + ': ' + esc(wait.map(function (i) { return i.name || i.email; }).slice(0, 4).join(', ')) + (wait.length > 4 ? '…' : '') + '. When you’re ready, pick a time below.'
      : 'Everyone you invited has answered. Pick a time below.';
    next.innerHTML = '<div class="mp-next-t"><small>What’s Next</small><span>' + nm + '</span></div>';
    var acts2 = el('div', 'mp-acts');
    acts2.appendChild(btn('Copy Poll Link', ICON.link, s === 'open' && !tl.people.length ? '' : 'ghost', function () { copy(shareLink(p)).then(function () { toast('Poll link copied. Paste it into an email, a Teams chat or a calendar note.'); }); }));
    acts2.appendChild(btn('Email the Poll', ICON.mail, 'ghost', function () { draftPoll(p); }));
    if (wait.length && s === 'open') acts2.appendChild(btn('Remind ' + (wait.length === 1 ? first(wait[0].name) || 'Them' : 'Those Waiting'), ICON.bell, 'ghost', function () { draftRemind(p); }));
    next.appendChild(acts2);
  }
  b.appendChild(next);

  /* --- the results --- */
  b.appendChild(resultsPanel(p, s, edit));

  /* --- invited --- */
  b.appendChild(invitedPanel(p, edit));

  /* --- comments --- */
  var com = tl.people.filter(function (x) { return x.comment; });
  if (com.length) {
    var cp = el('section', 'panel');
    cp.innerHTML = '<div class="panel-h"><h2>Comments</h2><span class="sub">' + plural(com.length, 'comment') + '</span></div>';
    var ul = el('ul', 'mp-comments');
    com.forEach(function (x) { ul.appendChild(el('li', '', '<b>' + esc(x.name) + '</b><span class="muted small"> · ' + esc(whenAgo(x.at || 0)) + '</span><p>' + esc(x.comment) + '</p>')); });
    cp.appendChild(ul); b.appendChild(cp);
  }

  /* --- the poll itself and what's been done --- */
  var meta = el('section', 'panel');
  var st = p.settings || {};
  meta.innerHTML = '<div class="panel-h"><h2>Poll Details</h2><div class="acts"></div></div>' +
    '<div class="mp-facts">' +
      fact('Description', p.about ? esc(p.about).replace(/\n/g, '<br>') : '<span class="muted">None</span>') +
      fact('Location', esc(p.where || '—')) +
      fact('Time Zone It Was Made In', esc(zoneName(p.tz || ET))) +
      fact('Answers Allowed', st.ifNeedBe !== false ? 'Yes, If Need Be, No' : 'Yes, No') +
      fact('Who Sees Answers', st.hidden ? 'Only you (hidden poll)' : 'Everyone who opens the poll') +
      fact('Choices per Person', st.oneVote ? 'One' : 'As many as work') +
      fact('Limit per Time', st.limit ? plural(st.limit, 'person', 'people') : 'No limit') +
      fact('Email Address', st.askEmail === 'off' ? 'Not asked' : st.askEmail === 'optional' ? 'Optional' : 'Required') +
      fact('Comments', st.comments !== false ? 'Allowed' : 'Off') +
      fact('Closes', st.deadline ? esc(new Date(st.deadline).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })) : 'When you close it') +
      fact('Email When Someone Answers', st.notify !== false ? 'On' : 'Off') +
      fact('Poll Link', '<a href="' + esc(shareLink(p)) + '" target="_blank" rel="noopener">Open the poll as others see it</a>') +
    '</div>';
  var ma = $('.acts', meta);
  if (edit) {
    ma.appendChild(btn('Edit Poll', ICON.pen, 'ghost sm', function () { go('edit', p.id); }));
    if (s === 'open') ma.appendChild(btn('Close Poll', ICON.lock, 'ghost sm', function () { var q = clone(p); q.status = 'closed'; if (q.settings.deadline && q.settings.deadline < Date.now()) q.settings.deadline = null; put(q, 'Closed the poll'); }));
    if (s === 'closed') ma.appendChild(btn('Reopen Poll', ICON.undo, 'ghost sm', function () { var q = clone(p); q.status = 'open'; if (q.settings.deadline && q.settings.deadline < Date.now()) q.settings.deadline = null; put(q, 'Reopened the poll'); }));
    ma.appendChild(btn('Duplicate', ICON.dup, 'ghost sm', function () { duplicate(p); }));
    if (s !== 'archived') ma.appendChild(btn('Archive', ICON.box, 'ghost sm', function () { var q = clone(p); q.archived = true; put(q, 'Archived the poll'); closePane(); toast('Archived. Find it under Archived to bring it back.'); }));
    else ma.appendChild(btn('Bring Back', ICON.undo, 'ghost sm', function () { var q = clone(p); q.archived = false; put(q, 'Brought the poll back from the archive'); }));
    ma.appendChild(btn('Delete', ICON.x, 'danger sm', function () { deletePoll(p); }));
  }
  b.appendChild(meta);
  if ((p.log || []).length) {
    var lg = el('section', 'panel');
    lg.innerHTML = '<div class="panel-h"><h2>Activity</h2></div>';
    var ul2 = el('ul', 'log');
    (p.log || []).slice().reverse().slice(0, 25).forEach(function (l) { ul2.appendChild(el('li', '', '<span>' + esc(whenAgo(l.at)) + '</span> <b>' + esc(l.by) + '</b> ' + esc(l.what))); });
    lg.appendChild(ul2); b.appendChild(lg);
  }
  b.scrollTop = keepScroll;
}
function fact(k, v) { return '<div><small>' + esc(k) + '</small><span>' + v + '</span></div>'; }
function btn(label, icon, cls, fn) { var b = el('button', 'btn ' + (cls || ''), (icon || '') + '<span>' + esc(label) + '</span>'); b.type = 'button'; b.onclick = fn; return b; }
function tzSelect(onchange) {
  var s = el('select', 'mp-tz'); s.setAttribute('aria-label', 'Show times in');
  ZONES.forEach(function (z) { var o = el('option'); o.value = z.v; o.textContent = z.n; s.appendChild(o); });
  s.value = STATE.tz; s.onchange = function () { STATE.tz = s.value; lsSet('tz', s.value); onchange(); }; return s;
}

/* the results grid: everyone down the side, the times across, Doodle's check / (check) / cross in each square */
function resultsPanel(p, s, edit) {
  var tl = tally(p), opts = (p.options || []).slice().sort(function (a, b) { return optStart(a) - optStart(b); });
  var sec = el('section', 'panel');
  sec.innerHTML = '<div class="panel-h"><h2>Answers</h2><span class="sub">' + plural(tl.people.length, 'person', 'people') + ' · ' + plural(opts.length, 'time') + '</span><div class="acts"><label class="mp-tzl">Show times in </label></div></div>';
  $('.mp-tzl', sec).appendChild(tzSelect(render));
  var wrap = el('div', 'gridwrap'), tb = el('table', 'av mp-grid');
  var h = '<thead><tr><th scope="col">Name</th>';
  opts.forEach(function (o) {
    var hd = optHead(o, STATE.tz), best = tl.best.indexOf(o.id) >= 0, chosen = s === 'scheduled' && p.chosen === o.id;
    h += '<th scope="col" class="' + (chosen ? 'chosen' : best ? 'best' : '') + (optPast(o) ? ' past' : '') + '">' + (best && !chosen ? '<span class="mp-star" title="Most people can make this">' + ICON.star + '</span>' : '') +
      '<span class="d">' + esc(hd.day) + '</span>' + esc(hd.time) + '</th>';
  });
  h += '</tr></thead><tbody>';
  if (!tl.people.length) h += '<tr><td colspan="' + (opts.length + 1) + '" class="mp-none">No answers yet. ' + (VOTES.off ? 'Type answers in by hand below.' : 'They show here as people answer, and you get an email each time.') + '</td></tr>';
  tl.people.forEach(function (x) {
    h += '<tr data-v="' + esc(x.id) + '"><td><span class="mp-who"><b>' + esc(x.name || x.email || 'No name') + '</b>' +
      (x.email ? '<small>' + esc(x.email) + '</small>' : '') + (x.manual ? '<span class="tagbox">Typed In</span>' : '') +
      (x.invitee ? '<span class="tagbox">Invited</span>' : '') + (!x.manual && (x.at || 0) > (STATE.prevSeen || 0) ? '<span class="tagbox hot">New</span>' : '') + '</span>' +
      (edit ? '<button class="linkbtn mp-rm" type="button" data-rm="' + esc(x.id) + '">Remove</button>' : '') + '</td>';
    opts.forEach(function (o) { var a = (x.answers || {})[o.id]; h += '<td class="c"><span class="mp-cell ' + (a === 'y' ? 'c-yes' : a === 'm' ? 'c-maybe' : a === 'n' ? 'c-no' : 'c-none') + '" title="' + esc(a ? WORD[a] : 'No answer') + '">' + (a ? MARK[a] : '—') + '</span></td>'; });
    h += '</tr>';
  });
  h += '</tbody><tfoot><tr><td>Yes' + (p.settings && p.settings.ifNeedBe !== false ? ' <span class="muted">(If Need Be)</span>' : '') + '</td>';
  opts.forEach(function (o) { var t = tl.t[o.id] || { y: 0, m: 0 }; h += '<td class="c"><b>' + t.y + '</b>' + (t.m ? ' <span class="muted">(' + t.m + ')</span>' : '') + '</td>'; });
  h += '</tr>';
  if (edit && s !== 'scheduled' && opts.length) {
    h += '<tr class="mp-pickrow"><td>Pick the Time</td>';
    opts.forEach(function (o) { h += '<td class="c"><button class="btn sm ' + (tl.best.indexOf(o.id) >= 0 ? '' : 'ghost') + '" type="button" data-pick="' + esc(o.id) + '">Pick</button></td>'; });
    h += '</tr>';
  }
  h += '</tfoot>';
  tb.innerHTML = h; wrap.appendChild(tb); sec.appendChild(wrap);
  $$('[data-rm]', tb).forEach(function (bt) { bt.onclick = function () {
    var id = bt.getAttribute('data-rm'), x = tl.people.find(function (y) { return y.id === id; });
    ask('Remove ' + (x && x.name || 'This Person') + '?', 'Their answers come off the poll. You can bring them back any time from the removed list under the grid.', 'Remove', function () {
      var q = clone(p); q.hiddenVoters = (q.hiddenVoters || []).concat(id); put(q, 'Took ' + (x && x.name || 'an answer') + ' off the poll');
    });
  }; });
  $$('[data-pick]', tb).forEach(function (bt) { bt.onclick = function () {
    var o = opts.find(function (y) { return y.id === bt.getAttribute('data-pick'); });
    ask('Pick This Time?', '<b>' + esc(optLabel(o, STATE.tz, true)) + '</b><br><br>The poll closes, and anyone who opens it sees this time. Next you send your calendar invite from Outlook.', 'Pick This Time', function () {
      var q = clone(p); q.status = 'scheduled'; q.chosen = o.id; q.scheduledAt = Date.now(); put(q, 'Picked ' + optLabel(o, ET));
    });
  }; });

  /* answers typed in by hand, for someone who replied by email or phone */
  var foot = el('div', 'mp-gridfoot');
  if (edit && s !== 'scheduled') {
    if (!STATE.addingManual) foot.appendChild(btn('Add an Answer by Hand', ICON.plus, 'ghost sm', function () { STATE.addingManual = true; render(); }));
    else foot.appendChild(manualForm(p, opts));
  }
  var removed = everyone(p, true).filter(function (x) { return x.removed; });
  if (removed.length) {
    var rb = el('button', 'linkbtn', (STATE.showRemoved ? 'Hide' : 'Show') + ' ' + plural(removed.length, 'removed answer')); rb.type = 'button';
    rb.onclick = function () { STATE.showRemoved = !STATE.showRemoved; render(); }; foot.appendChild(rb);
    if (STATE.showRemoved) {
      var ul = el('ul', 'mp-removed');
      removed.forEach(function (x) {
        var li = el('li', '', '<span>' + esc(x.name || x.email) + (x.email ? ' <small class="muted">' + esc(x.email) + '</small>' : '') + '</span>');
        if (edit) li.appendChild(btn('Bring Back', ICON.undo, 'ghost sm', function () { var q = clone(p); q.hiddenVoters = (q.hiddenVoters || []).filter(function (i) { return i !== x.id; }); put(q, 'Brought back ' + (x.name || 'an answer')); }));
        ul.appendChild(li);
      });
      foot.appendChild(ul);
    }
  }
  if (foot.childNodes.length) sec.appendChild(foot);
  sec.appendChild(el('div', 'legend mp-legend', '<span><i class="c-yes">' + MARK.y + '</i> Yes</span>' + (p.settings && p.settings.ifNeedBe !== false ? '<span><i class="c-maybe">' + MARK.m + '</i> If need be</span>' : '') + '<span><i class="c-no">' + MARK.n + '</i> No</span><span><i class="c-none">—</i> No answer</span><span class="mp-star">' + ICON.star + '</span> Most people can make it'));
  return sec;
}
function manualForm(p, opts) {
  var f = el('div', 'mp-manual'), ans = {};
  f.innerHTML = '<div class="form"><label class="f w4"><span>Name</span><input type="text" id="mm-name" autocomplete="off"></label><label class="f w4"><span>Email (Optional)</span><input type="email" id="mm-email" autocomplete="off"></label></div><div class="mp-mrow"></div>';
  var row = $('.mp-mrow', f), ifnb = p.settings && p.settings.ifNeedBe !== false;
  opts.forEach(function (o) {
    var c = el('div', 'mp-mopt', '<small>' + esc(optLabel(o, STATE.tz)) + '</small>'), tri = el('div', 'tri');
    ['y', 'm', 'n'].forEach(function (a) {
      if (a === 'm' && !ifnb) return;
      var b = el('button', a, MARK[a]); b.type = 'button'; b.title = WORD[a]; b.setAttribute('aria-label', WORD[a]); b.setAttribute('aria-pressed', 'false');
      b.onclick = function () { ans[o.id] = a; $$('button', tri).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); };
      tri.appendChild(b);
    });
    c.appendChild(tri); row.appendChild(c);
  });
  var acts = el('div', 'mp-acts');
  acts.appendChild(btn('Save Answer', ICON.check, '', function () {
    var name = $('#mm-name', f).value.trim(), email = $('#mm-email', f).value.trim().toLowerCase();
    if (!name) { toast('Add their name.'); $('#mm-name', f).focus(); return; }
    if (!Object.keys(ans).length) { toast('Mark at least one time.'); return; }
    var q = clone(p); q.manual = q.manual || {}; var id = 'm' + rid(8);
    q.manual[id] = { name: name, email: email, answers: ans, at: Date.now(), created: Date.now(), by: me().name };
    STATE.addingManual = false; put(q, 'Typed in ' + name + '’s answers');
  }));
  acts.appendChild(btn('Cancel', '', 'ghost', function () { STATE.addingManual = false; render(); }));
  f.appendChild(acts);
  return f;
}
function invitedPanel(p, edit) {
  var inv = (p.invitees || []).filter(function (i) { return !i.removed; }), wait = waitingOn(p), waitIds = {};
  wait.forEach(function (i) { waitIds[i.id] = 1; });
  var sec = el('section', 'panel');
  sec.innerHTML = '<div class="panel-h"><h2>People Invited</h2><span class="sub">' + (inv.length ? (inv.length - wait.length) + ' of ' + inv.length + ' answered' : 'Optional: add people to see who hasn’t answered and remind them') + '</span><div class="acts"></div></div>';
  if (edit) $('.acts', sec).appendChild(btn('Add People', ICON.plus, 'ghost sm', function () { addPeopleDialog(p); }));
  if (inv.length) {
    var t = el('table', 'guests mp-inv');
    t.innerHTML = '<thead><tr><th>Name</th><th>Email</th><th>Status</th><th></th></tr></thead>';
    var tb = el('tbody');
    inv.slice().sort(function (a, b) { return String(a.name || a.email).localeCompare(String(b.name || b.email)); }).forEach(function (i) {
      var tr = el('tr');
      tr.innerHTML = '<td><b>' + esc(i.name || '—') + '</b></td><td>' + esc(i.email || '') + '</td><td>' + (waitIds[i.id] ? '<span class="pill p-wait">Waiting</span>' : '<span class="pill p-yes">Answered</span>') + '</td><td class="acts"></td>';
      var a = $('.acts', tr);
      a.appendChild(btn('Copy Personal Link', ICON.link, 'ghost sm', function () { copy(personalLink(p, i)).then(function () { toast('Personal link for ' + (i.name || i.email) + ' copied. Their name and email are filled in for them.'); }); }));
      if (i.email) a.appendChild(btn('Email', ICON.mail, 'ghost sm', function () { draftOne(p, i); }));
      if (edit) { var rm = el('button', 'linkbtn', 'Remove'); rm.type = 'button'; rm.onclick = function () { var q = clone(p); q.invitees.forEach(function (x) { if (x.id === i.id) x.removed = true; }); put(q, 'Took ' + (i.name || i.email) + ' off the invite list'); }; a.appendChild(rm); }
      tb.appendChild(tr);
    });
    t.appendChild(tb); sec.appendChild(t);
  }
  return sec;
}
function addPeopleDialog(p) {
  var rows = [{ name: '', email: '' }, { name: '', email: '' }, { name: '', email: '' }];
  dialog('Add People', function (b) {
    b.innerHTML = '<p class="muted small" style="margin-top:0">Add the people you’re polling so you can see who hasn’t answered and remind them. Adding someone here doesn’t email them; you send the poll yourself.</p><div id="ap-rows"></div>';
    var box = $('#ap-rows', b);
    function draw() { box.innerHTML = ''; rows.forEach(function (r, ix) { box.appendChild(personRow(r, function () { rows.splice(ix, 1); draw(); })); }); }
    draw();
    var more = el('div', 'mp-acts');
    more.appendChild(btn('Add Another', ICON.plus, 'ghost sm', function () { rows.push({ name: '', email: '' }); draw(); }));
    more.appendChild(btn('Paste a List', '', 'ghost sm', function () { pasteList(function (list) { rows = rows.filter(function (r) { return r.name || r.email; }).concat(list); draw(); }); }));
    b.appendChild(more);
  }, [['Add', '', function () {
    var add = rows.filter(function (r) { return r.name.trim() || r.email.trim(); });
    var bad = add.filter(function (r) { return r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email.trim()); });
    if (bad.length) { toast('Check the email address for ' + (bad[0].name || bad[0].email) + '.'); return false; }
    if (!add.length) return true;
    var q = clone(p); q.invitees = (q.invitees || []).concat(add.map(newInvitee));
    put(q, 'Added ' + add.map(function (r) { return r.name || r.email; }).join(', ') + ' to the invite list'); return true;
  }]]);
}
function newInvitee(r) { return { id: 'i' + rid(7), name: String(r.name || '').trim(), email: String(r.email || '').trim().toLowerCase(), code: linkCode(), addedAt: Date.now() }; }
function personRow(r, onRemove) {
  var d = el('div', 'mp-prow');
  d.innerHTML = '<label class="f"><span>Name</span><input type="text" autocomplete="off"></label><label class="f"><span>Email</span><input type="email" autocomplete="off"></label>';
  var ins = $$('input', d); ins[0].value = r.name; ins[1].value = r.email;
  ins[0].oninput = function () { r.name = ins[0].value; }; ins[1].oninput = function () { r.email = ins[1].value; };
  var x = el('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Remove this person'); x.onclick = onRemove; d.appendChild(x);
  return d;
}
/* "Pat Lee <pat@x.com>; sam@y.com, Jo Smith jo@z.org" or an Outlook To: line, into people */
function pasteList(done) {
  dialog('Paste a List', function (b) {
    b.innerHTML = '<p class="muted small" style="margin-top:0">Paste names and emails from Outlook, Excel or anywhere else. One person per line, or separated by commas or semicolons.</p><textarea id="pl-t" rows="8" placeholder="Pat Lee &lt;pat@lender.com&gt;; Sam Roe &lt;sam@servicer.com&gt;"></textarea>';
  }, [['Add These', '', function () {
    var txt = $('#pl-t').value, out = [];
    txt.split(/[\n;,]+/).forEach(function (bit) {
      var s = bit.trim(); if (!s) return;
      var m = /([^\s<>"']+@[^\s<>"']+\.[^\s<>"']+)/.exec(s); var email = m ? m[1].toLowerCase() : '';
      var name = s.replace(/<[^>]*>/, '').replace(email, '').replace(/["'()\t]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!name && email) name = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      if (email || name) out.push({ name: name, email: email });
    });
    done(out); return true;
  }]]);
}
/* Delete for good (Jonna, Nov 22, 2026). Archive stays the gentle choice; this one can't be undone. */
function deletePoll(p) {
  if (!canEdit()) { toast('You can look at Huddle but not change it. Ask Jonna for Edit access.'); return; }
  var n = everyone(p).length;
  ask('Delete This Poll?', '<b>' + esc(p.title || 'Untitled poll') + '</b><br><br>The poll' + (n ? ' and its ' + plural(n, 'answer') : '') + ' are removed for good, and its link stops working. This can’t be undone. To put it away instead, use <b>Archive</b>.', 'Delete for Good', function () {
    closePane();
    if (PREVIEW) { delete DB.docs[p.id]; delete DB.pending[p.id]; render(); toast('Poll deleted.'); return; }
    DB.pending[p.id] = null; keepUnsaved(); render(); saveState('Saving…'); schedule(); toast('Poll deleted.');
  }, true);
}
function duplicate(p) {
  var q = clone(p), u = me();
  q.id = rid(10); q.code = linkCode(); q.title = (p.title || 'Poll') + ' (Copy)'; q.status = 'open'; q.chosen = null; q.scheduledAt = null; q.inviteAt = null;
  q.manual = {}; q.hiddenVoters = []; q.archived = false; q.log = []; q.owner = u.email; q.ownerName = u.name; q.members = [u.email]; q.isNew = true;
  q.options = (q.options || []).filter(function (o) { return !optPast(o); });
  q.invitees = (q.invitees || []).filter(function (i) { return !i.removed; }).map(function (i) { return newInvitee(i); });
  if (q.settings) q.settings.deadline = null;
  STATE.draft = q; STATE.week = null; closePane(); STATE.tab = 'new'; if (window.__railMark) window.__railMark('new'); render();
  toast('A copy, ready to change. Times already past were left off.');
}

/* ---------------- email drafts: the organizer sends them, from their own Outlook ---------------- */
function signoff() { return first(me().name) || ''; }
function deadlineLine(p) { var d = p.settings && p.settings.deadline; return d ? '\n\nPlease answer by ' + new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + '.' : ''; }
function draftPoll(p) {
  var to = (p.invitees || []).filter(function (i) { return !i.removed && i.email; }).map(function (i) { return i.email; });
  draft({ title: 'Email the Poll', to: to.join('; '), subject: 'Please pick times: ' + (p.title || 'meeting'),
    body: 'Hello,\n\nI’m finding a time for ' + (p.title || 'our meeting') + (p.duration ? ' (' + p.duration + ' minutes' + (p.where ? ', ' + p.where : '') + ')' : '') + '. Please mark the times that work for you here:\n\n' + shareLink(p) +
      (p.about ? '\n\n' + p.about : '') + '\n\nIt takes a minute and you don’t need an account. The times show in your own time zone.' + deadlineLine(p) + '\n\nThank you,\n' + signoff(),
    note: 'Everyone gets the same link. To see exactly who has answered, also add them under People Invited.', poll: p, what: 'Opened an email draft with the poll link' });
}
function draftOne(p, i) {
  draft({ title: 'Email ' + (i.name || i.email), to: i.email, subject: 'Please pick times: ' + (p.title || 'meeting'),
    body: 'Hello ' + (first(i.name) || '') + ',\n\nI’m finding a time for ' + (p.title || 'our meeting') + '. Please mark the times that work for you here:\n\n' + personalLink(p, i) +
      '\n\nIt takes a minute and you don’t need an account.' + deadlineLine(p) + '\n\nThank you,\n' + signoff(),
    note: 'This is ' + (first(i.name) || 'their') + '’s own link: their name and email are already filled in.', poll: p, what: 'Opened an email draft to ' + (i.name || i.email) });
}
function draftRemind(p) {
  var w = waitingOn(p).filter(function (i) { return i.email; });
  draft({ title: 'Remind Those Waiting', to: w.map(function (i) { return i.email; }).join('; '), subject: 'Reminder: please pick times for ' + (p.title || 'our meeting'),
    body: 'Hello,\n\nA quick reminder to mark the times that work for you for ' + (p.title || 'our meeting') + ':\n\n' + shareLink(p) + deadlineLine(p) + '\n\nThank you,\n' + signoff(),
    note: 'Only the people who haven’t answered yet are in the To line.', poll: p, what: 'Opened a reminder draft to ' + w.map(function (i) { return i.name || i.email; }).join(', ') });
}
function attendees(p) {
  var seen = {}, out = [];
  everyone(p).concat((p.invitees || []).filter(function (i) { return !i.removed; })).forEach(function (x) { var e = String(x.email || '').toLowerCase(); if (e && !seen[e] && e !== me().email) { seen[e] = 1; out.push(e); } });
  return out;
}
function draftFinal(p) {
  var c = (p.options || []).find(function (o) { return o.id === p.chosen; });
  draft({ title: 'Email Everyone the Time', to: attendees(p).join('; '), subject: (p.title || 'Meeting') + ': ' + (c ? optLabel(c, p.tz || ET) : 'time chosen'),
    body: 'Hello,\n\nThank you for answering. ' + (p.title || 'The meeting') + ' will be ' + (c ? optLabel(c, p.tz || ET, true) : 'at the chosen time') + '.' + (p.where ? '\n\nWhere: ' + p.where : '') + '\n\nA calendar invitation is on its way.\n\nThank you,\n' + signoff(),
    note: 'Optional. Your calendar invite already tells people the time.', poll: p, what: 'Opened an email draft with the chosen time' });
}
function draft(o) {
  dialog(o.title, function (b) {
    b.innerHTML = '<div class="form">' +
      '<label class="f"><span>To</span><input type="text" id="dr-to" autocomplete="off" placeholder="Add email addresses, separated by semicolons"></label>' +
      '<label class="f"><span>Subject</span><input type="text" id="dr-sub" autocomplete="off"></label>' +
      '<label class="f"><span>Message</span><textarea id="dr-body" rows="11"></textarea></label></div>' +
      '<p class="muted small">' + esc(o.note || '') + ' Nothing is sent from here: it opens in Outlook so you can check it and press Send.</p>';
    $('#dr-to', b).value = o.to || ''; $('#dr-sub', b).value = o.subject || ''; $('#dr-body', b).value = o.body || '';
  }, [
    ['Open in Outlook', ICON.mail, function () { var v = vals(); window.open('https://outlook.office.com/mail/deeplink/compose?to=' + encodeURIComponent(v.to) + '&subject=' + encodeURIComponent(v.sub) + '&body=' + encodeURIComponent(v.body), '_blank', 'noopener'); logOnly(o); return true; }],
    ['Open in My Email App', '', function () { var v = vals(); location.href = 'mailto:' + encodeURIComponent(v.to).replace(/%40/g, '@').replace(/%3B/g, ';') + '?subject=' + encodeURIComponent(v.sub) + '&body=' + encodeURIComponent(v.body); logOnly(o); return true; }, 'ghost'],
    ['Copy Message', '', function () { var v = vals(); copy(v.body).then(function () { toast('Message copied.'); }); return false; }, 'ghost']
  ]);
  function vals() { return { to: $('#dr-to').value.split(/[;,\s]+/).filter(Boolean).join(';'), sub: $('#dr-sub').value, body: $('#dr-body').value }; }
}
function logOnly(o) { if (o.poll && canEdit()) { var q = clone(getPoll(o.poll.id)); put(q, o.what); } }

/* ---------------- the calendar invite: Outlook on the web, or a file for classic Outlook ---------------- */
function inviteBody(p) { return (p.about ? p.about + '\n\n' : '') + (p.where ? 'Where: ' + p.where + '\n\n' : '') + 'Time picked with MISMO Huddle.'; }
function outlookInvite(p) {
  var c = (p.options || []).find(function (o) { return o.id === p.chosen; }); if (!c) return;
  var q = 'path=%2Fcalendar%2Faction%2Fcompose&rru=addevent&subject=' + encodeURIComponent(p.title || 'Meeting') + '&body=' + encodeURIComponent(inviteBody(p)) + '&location=' + encodeURIComponent(p.where || '') + '&to=' + encodeURIComponent(attendees(p).join(','));
  if (c.d) q += '&allday=true&startdt=' + c.d + '&enddt=' + isoAdd(c.d, 1);
  else q += '&startdt=' + encodeURIComponent(new Date(c.s).toISOString()) + '&enddt=' + encodeURIComponent(new Date(c.e).toISOString());
  window.open('https://outlook.office.com/calendar/0/deeplink/compose?' + q, '_blank', 'noopener');
  var x = clone(p); x.inviteAt = Date.now(); put(x, 'Opened the calendar invite in Outlook');
  toast('Your invite opened in Outlook with everyone added. Check it, add your Zoom link, and press Send.');
}
function icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, function (c) { return '\\' + c; }); }
function icsTime(t) { return new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
function fold(line) { var out = [], s = line; while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74); } out.push(s); return out.join('\r\n'); }
function downloadIcs(p) {
  var c = (p.options || []).find(function (o) { return o.id === p.chosen; }); if (!c) return;
  var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MISMO//Huddle//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', 'UID:' + p.id + '-' + c.id + '@resources.mismo.org', 'DTSTAMP:' + icsTime(Date.now())];
  if (c.d) L.push('DTSTART;VALUE=DATE:' + c.d.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + isoAdd(c.d, 1).replace(/-/g, ''));
  else L.push('DTSTART:' + icsTime(c.s), 'DTEND:' + icsTime(c.e));
  L.push('SUMMARY:' + icsEsc(p.title || 'Meeting'), 'DESCRIPTION:' + icsEsc(inviteBody(p)));
  if (p.where) L.push('LOCATION:' + icsEsc(p.where));
  L.push('ORGANIZER;CN=' + icsEsc(me().name) + ':mailto:' + me().email);
  attendees(p).forEach(function (e) { L.push('ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:' + e); });
  L.push('END:VEVENT', 'END:VCALENDAR');
  var blob = new Blob([L.map(fold).join('\r\n') + '\r\n'], { type: 'text/calendar' }), a = el('a');
  a.href = URL.createObjectURL(blob); a.download = (p.title || 'meeting').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') + '.ics';
  document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  var x = clone(p); x.inviteAt = Date.now(); put(x, 'Downloaded the calendar invite');
  toast('Open the file to add it to Outlook with everyone on it, then press Send.');
}

/* ---------------- a dialog ---------------- */
function ask(title, text, okLabel, fn, danger) {
  dialog(title, function (b) { b.innerHTML = '<p style="margin:0">' + text + '</p>'; }, [[okLabel, '', function () { fn(); return true; }, danger ? 'danger' : '']]);
}
function dialog(title, fill, actions) {
  var sc = el('div', 'scrim'), d = el('div', 'dlg'); d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', title);
  d.innerHTML = '<div class="dlg-h"><h2>' + esc(title) + '</h2><button class="x" type="button" aria-label="Close">×</button></div><div class="dlg-b"></div><div class="dlg-f"></div>';
  fill($('.dlg-b', d));
  var f = $('.dlg-f', d);
  (actions || []).forEach(function (a) { f.appendChild(btn(a[0], a[1], a[3] || '', function () { if (a[2]() !== false) shut(); })); });
  f.appendChild(btn('Cancel', '', 'ghost', shut));
  function shut() { sc.remove(); document.removeEventListener('keydown', k); }
  function k(e) { if (e.key === 'Escape') shut(); }
  $('.x', d).onclick = shut; sc.onclick = function (e) { if (e.target === sc) shut(); };
  document.addEventListener('keydown', k);
  sc.appendChild(d); document.body.appendChild(sc);
  var fi = $('input,textarea', d); if (fi) fi.focus();
}

/* ---------------- New Poll / Edit Poll ---------------- */
var HOURS = { from: 6 * 60, to: 21 * 60, step: 30 };
function renderEditor(app) {
  var p = STATE.draft || (STATE.draft = blankPoll()), isNew = !!p.isNew;
  var tz = p.tz || ET;
  if (!STATE.week) {
    var firstOpt = (p.options || []).filter(function (o) { return !optPast(o); }).sort(function (a, b) { return optStart(a) - optStart(b); })[0];
    var startIso = firstOpt ? (firstOpt.d || parts(firstOpt.s, tz).iso) : todayISO(tz);
    if (!firstOpt && (dow(startIso) === 6 || dow(startIso) === 0)) startIso = isoAdd(startIso, 2);
    STATE.week = mondayOf(startIso);
  }
  var head = el('div', 'pagehead');
  head.innerHTML = '<div class="grow"><h1>' + (isNew ? 'New Poll' : 'Edit Poll') + '</h1></div>';
  app.appendChild(head);

  /* --- about --- */
  var about = el('section', 'panel');
  about.innerHTML = '<div class="panel-h"><h2>About the Meeting</h2></div><div class="panel-b"><div class="form">' +
    '<label class="f w8"><span>Title</span><input type="text" id="ed-title" maxlength="200" placeholder="e.g. Commercial eNotes DWG: Kickoff Call"></label>' +
    '<label class="f w4"><span>Location</span><input type="text" id="ed-where" maxlength="300" placeholder="Zoom, phone or a place"></label>' +
    '<label class="f"><span>Description (Optional)</span><textarea id="ed-about" rows="3" maxlength="3000" placeholder="What it’s for, and anything people should know before they pick."></textarea></label>' +
    '<div class="f w8"><span>How Long</span><div class="seg" id="ed-dur"></div></div>' +
    '<label class="f w4"><span>Time Zone for Picking Times</span><select id="ed-tz"></select></label>' +
    '</div></div>';
  app.appendChild(about);
  $('#ed-title').value = p.title || ''; $('#ed-where').value = p.where || ''; $('#ed-about').value = p.about || '';
  $('#ed-title').oninput = function () { p.title = this.value; };
  $('#ed-where').oninput = function () { p.where = this.value; };
  $('#ed-about').oninput = function () { p.about = this.value; };
  var dur = $('#ed-dur'), DUR = [15, 30, 45, 60, 90, 120];
  DUR.forEach(function (m) { var b = el('button', '', m < 60 ? m + ' Min' : (m / 60) + (m === 60 ? ' Hour' : ' Hours')); b.type = 'button'; b.setAttribute('aria-pressed', String(p.duration === m)); b.onclick = function () { p.duration = m; render(); }; dur.appendChild(b); });
  var other = el('button', '', DUR.indexOf(p.duration) < 0 ? p.duration + ' Min' : 'Other'); other.type = 'button'; other.setAttribute('aria-pressed', String(DUR.indexOf(p.duration) < 0));
  other.onclick = function () {
    dialog('How Long?', function (b) { b.innerHTML = '<label class="f"><span>Minutes</span><input type="number" id="dur-min" min="5" max="720" step="5"></label>'; $('#dur-min', b).value = p.duration || 60; },
      [['Use This', '', function () { var n = parseInt($('#dur-min').value, 10); if (!(n >= 5 && n <= 720)) { toast('Between 5 and 720 minutes.'); return false; } p.duration = n; render(); return true; }]]);
  };
  dur.appendChild(other);
  var tzs = $('#ed-tz'); ZONES.forEach(function (z) { var o = el('option'); o.value = z.v; o.textContent = z.n; tzs.appendChild(o); }); tzs.value = tz;
  tzs.onchange = function () { p.tz = tzs.value; render(); };

  /* --- times --- */
  var times = el('section', 'panel');
  times.innerHTML = '<div class="panel-h"><h2>Times to Offer</h2><span class="sub">Click the calendar to add a time; click a time again to take it off.</span></div>';
  var tb = el('div', 'panel-b mp-picker');
  var left = el('div', 'mp-pk-l'), right = el('div', 'mp-pk-r');
  var bar = el('div', 'mp-wkbar');
  var days = []; for (var i = 0; i < 7; i++) { var iso = isoAdd(STATE.week, i); if (STATE.weekends || (dow(iso) !== 0 && dow(iso) !== 6)) days.push(iso); }
  bar.appendChild(iconBtn(ICON.back, 'Previous week', function () { STATE.week = isoAdd(STATE.week, -7); render(); }));
  bar.appendChild(el('b', 'mp-wk', esc(isoDay(days[0]).replace(/^\w+, /, '')) + ' – ' + esc(isoDay(days[days.length - 1]).replace(/^\w+, /, '')) + ', ' + STATE.week.slice(0, 4)));
  bar.appendChild(iconBtn(ICON.fwd, 'Next week', function () { STATE.week = isoAdd(STATE.week, 7); render(); }));
  bar.appendChild(btn('This Week', '', 'ghost sm', function () { STATE.week = mondayOf(todayISO(tz)); render(); }));
  var jump = el('span', 'mp-jump'); var ji = el('input'); ji.type = 'text'; ji.placeholder = 'Go to a date'; ji.setAttribute('aria-label', 'Go to a date'); jump.appendChild(ji);
  datePicker(ji, function (iso) { STATE.week = mondayOf(iso); render(); }); ji.onkeydown = function (e) { if (e.key === 'Enter') { var d = parseDate(ji.value); if (d) { STATE.week = mondayOf(d); render(); } } };
  bar.appendChild(jump);
  var sw = el('div', 'seg mp-mode');
  [['times', 'Times'], ['days', 'Whole Days']].forEach(function (m) { var b = el('button', '', m[1]); b.type = 'button'; b.setAttribute('aria-pressed', String((m[0] === 'days') === STATE.allDay)); b.onclick = function () { STATE.allDay = m[0] === 'days'; render(); }; sw.appendChild(b); });
  bar.appendChild(sw);
  var wk = el('label', 'mp-chk'); wk.innerHTML = '<input type="checkbox"' + (STATE.weekends ? ' checked' : '') + '><span>Weekends</span>'; $('input', wk).onchange = function () { STATE.weekends = this.checked; render(); };
  bar.appendChild(wk);
  left.appendChild(bar);

  var grid = el('div', 'mp-cal' + (STATE.allDay ? ' days' : '')); grid.style.setProperty('--n', days.length);
  var hdr = '<div class="mp-cal-h"><span></span>' + days.map(function (d) {
    var on = (p.options || []).some(function (o) { return o.d === d; }), past = d < todayISO(tz);
    return '<button type="button" class="mp-dayh' + (on ? ' on' : '') + (past ? ' past' : '') + (d === todayISO(tz) ? ' today' : '') + '" data-day="' + d + '"' + (STATE.allDay && !past ? '' : ' tabindex="-1"') + '><small>' + esc(isoDay(d).split(',')[0]) + '</small><b>' + (+d.slice(8, 10)) + '</b>' + (on ? '<i>All day</i>' : '') + '</button>';
  }).join('') + '</div>';
  grid.innerHTML = hdr;
  if (!STATE.allDay) {
    var body = el('div', 'mp-cal-b'), rowsN = (HOURS.to - HOURS.from) / HOURS.step;
    var col = '<div class="mp-hrs">';
    for (var r = 0; r < rowsN; r++) { var mm = HOURS.from + r * HOURS.step; col += '<span>' + (mm % 60 === 0 ? minsLabel(mm).replace(':00', '') : '') + '</span>'; }
    col += '</div>';
    var cols = days.map(function (d) {
      var cells = ''; for (var r2 = 0; r2 < rowsN; r2++) { var m2 = HOURS.from + r2 * HOURS.step; var past = at(d, m2, tz) < Date.now(); cells += '<button type="button" class="mp-slot' + (past ? ' past' : '') + (m2 % 60 === 0 ? ' hr' : '') + '" data-d="' + d + '" data-m="' + m2 + '" aria-label="' + esc(isoDay(d) + ' ' + minsLabel(m2)) + '"' + (past ? ' disabled' : '') + '></button>'; }
      return '<div class="mp-col" data-col="' + d + '">' + cells + '</div>';
    }).join('');
    body.innerHTML = col + '<div class="mp-cols">' + cols + '</div>';
    grid.appendChild(body);
    /* the times already offered, drawn over the grid */
    (p.options || []).forEach(function (o) {
      if (o.d) return; var pr = parts(o.s, tz); var c = $('[data-col="' + pr.iso + '"]', body); if (!c) return;
      var startM = pr.h * 60 + pr.mi, len = Math.max(15, Math.round((o.e - o.s) / 60000));
      var top = (startM - HOURS.from) / HOURS.step, h = len / HOURS.step;
      var blk = el('button', 'mp-blk' + (optPast(o) ? ' past' : ''), '<b>' + esc(fmtRange(o.s, o.e, tz)) + '</b>'); blk.type = 'button';
      blk.style.top = 'calc(' + top + ' * var(--row))'; blk.style.height = 'calc(' + h + ' * var(--row) - 2px)';
      blk.title = 'Take this time off'; blk.setAttribute('aria-label', 'Take off ' + optLabel(o, tz));
      blk.onclick = function () { removeOpt(p, o.id); };
      c.appendChild(blk);
    });
  }
  left.appendChild(grid);
  /* typed times, for someone who'd rather type */
  var typed = el('div', 'mp-typed');
  typed.innerHTML = '<span class="mp-typed-l">Or Type One</span><label class="f"><span>Date</span><input type="text" id="ty-d" placeholder="12/3/26"></label>' + (STATE.allDay ? '' : '<label class="f"><span>Start</span><input type="text" id="ty-t" placeholder="10:30 am"></label>');
  var ab = btn('Add', ICON.plus, 'ghost', function () {
    var d = parseDate($('#ty-d').value); if (!d) { toast('Type the date like 12/3/26.'); $('#ty-d').focus(); return; }
    if (STATE.allDay) { addDay(p, d); } else { var m = parseTime($('#ty-t').value); if (m == null) { toast('Type the start time like 10:30 am.'); $('#ty-t').focus(); return; } addOpt(p, d, m); }
    STATE.week = mondayOf(d); render(); setTimeout(function () { var x = $('#ty-d'); if (x) x.focus(); }, 0);
  });
  typed.appendChild(ab); left.appendChild(typed);
  datePicker($('#ty-d', typed));

  /* the times chosen so far, by day */
  var opts = (p.options || []).slice().sort(function (a, b) { return optStart(a) - optStart(b); });
  right.innerHTML = '<div class="mp-chosen-h"><b>' + plural(opts.length, 'Time') + ' Offered</b>' + (opts.length ? '<button type="button" class="linkbtn" id="ed-clear">Clear All</button>' : '') + '</div>';
  if (!opts.length) right.appendChild(el('p', 'muted small', 'Nothing yet. Click the calendar to add times. Doodle-style, offer a handful across a few days; people mark every one that works.'));
  var lastDay = '', ul = null;
  opts.forEach(function (o) {
    var d = o.d || parts(o.s, tz).iso;
    if (d !== lastDay) { right.appendChild(el('div', 'mp-cday', esc(isoDay(d, true)))); ul = el('div', 'mp-copts'); right.appendChild(ul); lastDay = d; }
    var chip = el('span', 'chip mp-ochip' + (optPast(o) ? ' past' : ''), '<span>' + esc(o.d ? 'All day' : fmtRange(o.s, o.e, tz) + ' ' + tzAbbr(o.s, tz)) + '</span>');
    var x = el('button', 'mp-ox', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Take off ' + optLabel(o, tz)); x.onclick = function () { removeOpt(p, o.id); }; chip.appendChild(x);
    ul.appendChild(chip);
  });
  var clr = $('#ed-clear', right); if (clr) clr.onclick = function () { if (!answeredOn(p).length) { p.options = []; render(); return; } ask('Clear Every Time?', 'Some people have already answered. Their answers to these times go too.', 'Clear All', function () { p.options = []; render(); }, true); };
  tb.appendChild(left); tb.appendChild(right); times.appendChild(tb);
  app.appendChild(times);
  /* clicking the grid */
  $$('.mp-slot', grid).forEach(function (c) { c.onclick = function () { addOpt(p, c.getAttribute('data-d'), +c.getAttribute('data-m')); render(); }; });
  if (STATE.allDay) $$('.mp-dayh', grid).forEach(function (c) { if (c.classList.contains('past')) return; c.onclick = function () { var d = c.getAttribute('data-day'); var had = (p.options || []).find(function (o) { return o.d === d; }); if (had) removeOpt(p, had.id); else { addDay(p, d); render(); } }; });
  /* open on the working day, not at 6 in the morning */
  var cb = $('.mp-cal-b', grid); if (cb) requestAnimationFrame(function () { cb.scrollTop = ((7.5 * 60 - HOURS.from) / HOURS.step) * parseFloat(getComputedStyle(cb).getPropertyValue('--row') || 22); });

  /* --- settings --- */
  var st = p.settings = p.settings || {};
  var set = el('section', 'panel');
  set.innerHTML = '<div class="panel-h"><h2>Settings</h2></div><div class="panel-b mp-settings">' +
    chk('st-ifnb', st.ifNeedBe !== false, 'Allow “If Need Be” Answers', 'People can say a time would work if it really has to.') +
    chk('st-hidden', !!st.hidden, 'Hide Answers From Each Other', 'Only you see names and answers. People still see which times are full.') +
    chk('st-one', !!st.oneVote, 'One Choice per Person', 'For sign-ups where each person takes one time.') +
    '<div class="mp-set"><label class="mp-chk"><input type="checkbox" id="st-limit-on"' + (st.limit ? ' checked' : '') + '><span><b>Limit People per Time</b><small>A time is full once this many say yes.</small></span></label><input type="number" min="1" max="500" id="st-limit" value="' + (st.limit || 1) + '"' + (st.limit ? '' : ' disabled') + ' aria-label="People per time"></div>' +
    '<div class="mp-set"><span class="mp-chk"><span><b>Ask for Email Address</b><small>Lets you send the calendar invite to everyone who answered.</small></span></span><div class="seg" id="st-email"></div></div>' +
    chk('st-com', st.comments !== false, 'Allow Comments', 'People can leave you a note with their answers.') +
    '<div class="mp-set"><label class="mp-chk"><input type="checkbox" id="st-dl-on"' + (st.deadline ? ' checked' : '') + '><span><b>Close Automatically</b><small>No new answers after the end of this day.</small></span></label><span class="mp-dl"><input type="text" id="st-dl" placeholder="12/5/26"' + (st.deadline ? '' : ' disabled') + ' aria-label="Close on"></span></div>' +
    chk('st-notify', st.notify !== false, 'Email Me When Someone Answers', 'Sent to ' + esc(p.owner || me().email) + '.') +
    '</div>';
  app.appendChild(set);
  $('#st-ifnb').onchange = function () { st.ifNeedBe = this.checked; };
  $('#st-hidden').onchange = function () { st.hidden = this.checked; };
  $('#st-one').onchange = function () { st.oneVote = this.checked; };
  $('#st-com').onchange = function () { st.comments = this.checked; };
  $('#st-notify').onchange = function () { st.notify = this.checked; };
  $('#st-limit-on').onchange = function () { $('#st-limit').disabled = !this.checked; st.limit = this.checked ? (parseInt($('#st-limit').value, 10) || 1) : 0; };
  $('#st-limit').oninput = function () { var n = parseInt(this.value, 10); if (n > 0) st.limit = n; };
  var es = $('#st-email');
  [['required', 'Required'], ['optional', 'Optional'], ['off', 'Don’t Ask']].forEach(function (x) { var b = el('button', '', x[1]); b.type = 'button'; b.setAttribute('aria-pressed', String((st.askEmail || 'required') === x[0])); b.onclick = function () { st.askEmail = x[0]; $$('button', es).forEach(function (y) { y.setAttribute('aria-pressed', String(y === b)); }); }; es.appendChild(b); });
  var dl = $('#st-dl'); if (st.deadline) dl.value = mdy(parts(st.deadline, tz).iso);
  function setDl() { var d = parseDate(dl.value); st.deadline = d ? at(isoAdd(d, 1), 0, tz) - 1 : null; }
  dl.onchange = setDl; datePicker(dl, function () { setDl(); });
  $('#st-dl-on').onchange = function () { dl.disabled = !this.checked; if (!this.checked) st.deadline = null; else { if (!dl.value) dl.value = mdy(isoAdd(todayISO(tz), 7)); setDl(); dl.focus(); } };

  /* --- people --- */
  var ppl = el('section', 'panel');
  var inv = (p.invitees || []).filter(function (i) { return !i.removed; });
  ppl.innerHTML = '<div class="panel-h"><h2>People to Invite (Optional)</h2><span class="sub">So you can see who hasn’t answered and remind them. Nobody is emailed from here: you send the poll yourself.</span></div><div class="panel-b" id="ed-ppl"></div>';
  app.appendChild(ppl);
  var box = $('#ed-ppl');
  if (!p._rows) p._rows = inv.length ? null : [{ name: '', email: '' }];
  if (inv.length) {
    var tbl = el('div', 'mp-plist');
    inv.forEach(function (i) {
      var r = el('div', 'mp-prow done', '<span><b>' + esc(i.name || '—') + '</b> <span class="muted">' + esc(i.email || '') + '</span></span>');
      var x = el('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Take ' + (i.name || i.email) + ' off'); x.onclick = function () { i.removed = true; render(); }; r.appendChild(x);
      tbl.appendChild(r);
    });
    box.appendChild(tbl);
  }
  var rows = p._rows || (p._rows = []);
  rows.forEach(function (r, ix) { box.appendChild(personRow(r, function () { rows.splice(ix, 1); render(); })); });
  var pa = el('div', 'mp-acts');
  pa.appendChild(btn('Add Person', ICON.plus, 'ghost sm', function () { rows.push({ name: '', email: '' }); render(); setTimeout(function () { var ins = $$('#ed-ppl .mp-prow:not(.done) input'); if (ins.length) ins[ins.length - 2].focus(); }, 0); }));
  pa.appendChild(btn('Paste a List', '', 'ghost sm', function () { pasteList(function (list) { p._rows = rows.filter(function (r) { return r.name || r.email; }).concat(list); render(); }); }));
  box.appendChild(pa);

  /* --- save --- */
  var foot = el('div', 'mp-savebar');
  foot.appendChild(btn(isNew ? 'Create Poll' : 'Save Changes', ICON.check, 'big', function () { saveDraft(p); }));
  foot.appendChild(btn('Cancel', '', 'ghost big', function () { var back = !isNew ? p.id : null; STATE.draft = null; go('mine'); if (back) openPane(back); }));
  app.appendChild(foot);
}
function chk(id, on, title, sub) { return '<div class="mp-set"><label class="mp-chk"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '><span><b>' + esc(title) + '</b><small>' + sub + '</small></span></label></div>'; }
function iconBtn(icon, label, fn) { var b = el('button', 'btn ghost sm mp-ib', icon); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label; b.onclick = fn; return b; }
function addOpt(p, iso, mins) {
  var tz = p.tz || ET, s = at(iso, mins, tz), e = s + (p.duration || 60) * 60000;
  if (s < Date.now()) { toast('That time has already passed.'); return; }
  if ((p.options || []).some(function (o) { return o.s === s; })) return;
  p.options = (p.options || []).concat({ id: 'o' + rid(6), s: s, e: e });
}
function addDay(p, iso) { if ((p.options || []).some(function (o) { return o.d === iso; })) return; p.options = (p.options || []).concat({ id: 'o' + rid(6), d: iso }); }
function answeredOn(p, oid) { var saved = DB.docs[p.id]; if (!saved) return []; return everyone(saved).filter(function (x) { return x.answers && (oid ? x.answers[oid] : Object.keys(x.answers).length); }); }
function removeOpt(p, oid) {
  var n = answeredOn(p, oid).length;
  function drop() { p.options = (p.options || []).filter(function (o) { return o.id !== oid; }); render(); }
  if (!n) { drop(); return; }
  ask('Take This Time Off?', (n === 1 ? '1 person has' : n + ' people have') + ' answered this time. Their answers to it go too.', 'Take It Off', drop, true);
}
function saveDraft(p) {
  var problems = [];
  if (!String(p.title || '').trim()) problems.push('Give the poll a title.');
  if (!(p.options || []).length) problems.push('Offer at least one time.');
  var rows = (p._rows || []).filter(function (r) { return String(r.name || '').trim() || String(r.email || '').trim(); });
  var bad = rows.filter(function (r) { return r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(r.email).trim()); });
  if (bad.length) problems.push('Check the email address for ' + (bad[0].name || bad[0].email) + '.');
  if (problems.length) { toast(problems.join(' ')); if (!String(p.title || '').trim()) { var t = $('#ed-title'); if (t) t.focus(); } return; }
  var q = clone(p), isNew = !!q.isNew; delete q.isNew; delete q._rows;
  q.title = q.title.trim(); q.invitees = (q.invitees || []).concat(rows.map(newInvitee));
  if (isNew) { q.createdAt = Date.now(); q.createdBy = me().name; }
  STATE.draft = null;
  put(q, isNew ? 'Started the poll' : 'Changed the poll');
  STATE.tab = 'mine'; STATE.filter = null; if (window.__railMark) window.__railMark('mine');
  openPane(q.id);
  toast(isNew ? 'Poll created. Now send it: copy the link, or Email the Poll.' : 'Changes saved.');
}

/* a typeable date box with a month calendar on a button beside it */
function datePicker(input, onPick) {
  if (!input || input._dp) return; input._dp = 1;
  var wrap = el('span', 'mp-dp'); input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
  var b = el('button', 'mp-dpb', ICON.cal); b.type = 'button'; b.setAttribute('aria-label', 'Pick a date from a calendar'); b.title = 'Pick from a calendar'; wrap.appendChild(b);
  var pop = null, month = null;
  b.onclick = function (e) { e.stopPropagation(); if (pop) { shut(); return; } if (input.disabled) return; month = (parseDate(input.value) || todayISO()).slice(0, 7); open(); };
  function shut() { if (pop) { pop.remove(); pop = null; document.removeEventListener('click', outside); } }
  function outside(e) { if (pop && !pop.contains(e.target) && e.target !== b) shut(); }
  function open() {
    shut(); pop = el('div', 'mp-dpop'); wrap.appendChild(pop); draw(); setTimeout(function () { document.addEventListener('click', outside); }, 0);
  }
  function draw() {
    var y = +month.slice(0, 4), m = +month.slice(5, 7), firstIso = month + '-01', start = isoAdd(firstIso, -dow(firstIso)), sel = parseDate(input.value), today = todayISO();
    var h = '<div class="mp-dph"><button type="button" data-mv="-1" aria-label="Previous month">‹</button><b>' + new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }) + '</b><button type="button" data-mv="1" aria-label="Next month">›</button></div><div class="mp-dpg">';
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(function (d) { h += '<i>' + d + '</i>'; });
    for (var i = 0; i < 42; i++) { var d = isoAdd(start, i); h += '<button type="button" data-iso="' + d + '" class="' + (d.slice(0, 7) !== month ? 'out ' : '') + (d === sel ? 'on ' : '') + (d === today ? 'today' : '') + '">' + (+d.slice(8, 10)) + '</button>'; }
    pop.innerHTML = h + '</div>';
    $$('[data-mv]', pop).forEach(function (x) { x.onclick = function (e) { e.stopPropagation(); var mm = m + (+x.getAttribute('data-mv')), yy = y; if (mm < 1) { mm = 12; yy--; } if (mm > 12) { mm = 1; yy++; } month = yy + '-' + String(mm).padStart(2, '0'); draw(); }; });
    $$('[data-iso]', pop).forEach(function (x) { x.onclick = function (e) { e.stopPropagation(); var iso = x.getAttribute('data-iso'); input.value = mdy(iso); shut(); if (onPick) onPick(iso); input.dispatchEvent(new Event('change')); }; });
  }
}

/* ---------------- System Health ---------------- */
function renderHealth(app) {
  app.appendChild(el('div', 'pagehead', '<div class="grow"><h1>System Health</h1></div>'));
  function row(name, ok, what, where) { return '<tr><td><span class="hdot' + (ok === true ? '' : ok === false ? ' warn' : ' unk') + '"></span> <b>' + esc(name) + '</b></td><td>' + what + '</td><td class="muted">' + where + '</td></tr>'; }
  var mineN = polls().filter(isMine).length, allN = polls().length;
  var t = el('section', 'panel');
  t.innerHTML = '<div class="panel-h"><h2>Connections</h2><div class="acts"></div></div><div class="gridwrap"><table class="guests"><thead><tr><th>What</th><th>Status</th><th>Where</th></tr></thead><tbody>' +
    row('Saving polls', DB.error ? false : HEALTH.lastSaveError ? false : true, DB.error ? 'Couldn’t read polls: ' + esc(DB.error) : HEALTH.lastSaveError ? 'Last save failed: ' + esc(HEALTH.lastSaveError) : 'Working. ' + plural(allN, 'poll') + ' loaded ' + esc(whenAgo(DB.at || Date.now())) + (HEALTH.lastSave ? '; last saved ' + esc(whenAgo(HEALTH.lastSave)) : '') + '.', 'Save relay, project <span class="kbd">huddle</span> → GitMISMO/huddle-data, data/polls.json') +
    row('Answers through links', HEALTH.ready === null ? null : HEALTH.ready, HEALTH.ready ? 'Switched on. People can open poll links and answer.' : HEALTH.ready === false ? 'Not live yet. It starts as soon as Perry deploys relay request 12 (the setting in projects.json is already on). Until then, type answers in by hand.' : 'Checking…', 'Relay routes /group-poll/view and /group-poll/answer → votes/votes.json') +
    row('Reading answers', VOTES.error ? false : VOTES.off ? null : true, VOTES.error ? 'Couldn’t read answers: ' + esc(VOTES.error) : VOTES.off ? 'Waiting on the same switch as above.' : 'Working. Checked ' + esc(whenAgo(VOTES.at || Date.now())) + ' and every minute while this page is open.', 'Relay route /group-poll/votes (signed in; only your own polls)') +
    row('Email when someone answers', HEALTH.ready ? true : null, 'Sent by the relay to the poll’s organizer through the platform’s Power Automate mail flow, unless the organizer turned it off on that poll. Never sent to the people answering.', 'Relay → Power Automate mail flow (MAIL_FLOW_URL)') +
    '</tbody></table></div>';
  $('.acts', t).appendChild(btn('Check Again', '', 'ghost sm', function () { Promise.all([checkReady(), loadPolls().catch(function () {}), loadVotes()]).then(render); }));
  app.appendChild(t);
  var v = el('section', 'panel');
  v.innerHTML = '<div class="panel-h"><h2>This Copy</h2></div><div class="mp-facts">' + fact('Version', esc(BUILD)) + fact('Signed In As', esc(me().name + ' (' + me().email + ')')) + fact('Your Polls', String(mineN)) + fact('Polls You Can See', String(allN)) + fact('Unsaved Changes', String(Object.keys(DB.pending).length)) + '</div>';
  app.appendChild(v);
}

/* ---------------- Help ---------------- */
function renderHelp(app) {
  app.appendChild(el('div', 'pagehead', '<div class="grow"><h1>Help</h1></div>'));
  var h = el('section', 'panel help');
  h.innerHTML = '<div class="panel-b">' +
  '<h2>What Huddle Is</h2><p>MISMO’s own version of Doodle, for facilitators and staff, so nobody needs a Doodle subscription. It works the way Doodle does: you offer some times, send the poll, people mark which times work, you pick one, and you send your own calendar invite. It never looks at anyone’s calendar and never emails the people you’re polling; you send everything from your own Outlook. (Vanessa’s Scheduler is the automatic one; Huddle is the do-it-yourself one.)</p>' +
  '<h2>Start a Poll</h2><ol><li>Press <b>New Poll</b>. Give it a title, and a location and description if you like.</li><li>Pick how long the meeting is (or Other for any length), and the time zone you’re picking times in.</li><li>Click the calendar to add times. Each click adds a time that long; click a time again to take it off. Use the arrows or Go to a Date to move between weeks, or type a date and start time under the calendar. Tick Weekends to show Saturday and Sunday. Switch to <b>Whole Days</b> to offer days instead of times.</li><li>Pick the settings you want (see Settings).</li><li>Optionally add the people you’re polling, so you can see who hasn’t answered and remind them. Paste a List takes names and emails straight from an Outlook To line or Excel.</li><li>Press <b>Create Poll</b>. It opens, ready to send.</li></ol>' +
  '<h2>Send It</h2><p><b>Copy Poll Link</b> copies the link to paste anywhere: an email, a Teams chat, a calendar note. <b>Email the Poll</b> opens a ready-to-send email in Outlook with the link and everyone you invited; check it and press Send (Open in My Email App does the same in your own email program). Under People Invited, each person also has a <b>personal link</b> with their name and email filled in, and an <b>Email</b> button for just them. People don’t need an account.</p>' +
  '<h2>What People See When They Answer</h2><p>The poll’s title, description, location and length, and the times in <b>their own time zone</b> (they can switch it). For each time they tap Yes, If Need Be or No; anything left unmarked counts as No, as in Doodle. Unless the poll is hidden, they see other people’s names and answers, never anyone’s email address. They can add a comment. After sending, they get their own link to change their answers later, and their browser remembers it. Once you pick a time, anyone who opens the poll sees the chosen time.</p>' +
  '<h2>See Who Can Make It</h2><p>Open a poll from My Polls. The grid shows each person’s answers: a check for yes, a check in brackets for if need be, a cross for no. The bottom row counts the yeses (if-need-be in brackets), and a star marks the time most people can make. Show Times In changes the time zone the grid is shown in. Answers that arrived since you last looked are tagged New. Someone replied by email or phone instead? Use <b>Add an Answer by Hand</b>. Need to take someone off? <b>Remove</b> sets their answers aside; Show Removed Answers lets you bring them back.</p>' +
  '<h2>Knowing When Someone Answers</h2><p>You get an email each time someone answers your poll, with how many times work for them, their comment and who you’re still waiting on (turn it off in the poll’s settings). Huddle also checks every minute while it’s open, pops up a note when an answer comes in, moves that poll to the top of My Polls and counts it under Polls With New Answers. Latest Answers, on the right, lists the newest answers across your polls.</p>' +
  '<h2>Remind People</h2><p>If you added people under People Invited, <b>Remind Those Waiting</b> opens an Outlook email to just the people who haven’t answered. Huddle knows someone has answered when they used their personal link or answered with the same email address.</p>' +
  '<h2>Pick the Time and Send the Invite</h2><p>Press <b>Pick</b> under the time you want and confirm. The poll closes and anyone who opens it sees the chosen time. Then press <b>Create Outlook Invite</b>: Outlook on the web opens a new meeting with the title, time, location and everyone who answered or was invited already on it. Add your Zoom link and press Send. On classic Outlook, use <b>Download Invite (.ics)</b> and open the file instead. <b>Email Everyone the Time</b> is optional. Changed your mind? <b>Pick a Different Time</b>. Coming Up, on the right, shows scheduled meetings and flags any whose invite hasn’t been sent.</p>' +
  '<h2>Settings</h2><ul><li><b>Allow “If Need Be” Answers</b>: a third answer, for times that would work if they have to.</li><li><b>Hide Answers From Each Other</b>: only you see who answered what. People still see which times are full.</li><li><b>One Choice per Person</b> and <b>Limit People per Time</b>: for sign-ups, like booking office-hours slots; a full time can’t be picked by anyone else.</li><li><b>Ask for Email Address</b>: required, optional or not asked. Emails let the invite go to everyone who answered.</li><li><b>Allow Comments</b>: people can leave you a note.</li><li><b>Close Automatically</b>: no new answers after the end of that day.</li><li><b>Email Me When Someone Answers</b>: on unless you turn it off.</li></ul><p>Change settings, times or people any time with <b>Edit Poll</b>. Taking a time off that people already answered asks first, because their answers to it go too.</p>' +
  '<h2>Close, Reopen, Duplicate, Archive, Delete</h2><p><b>Close Poll</b> stops new answers; <b>Reopen Poll</b> starts them again. <b>Duplicate</b> starts a new poll from this one (times already past are left off, and invited people get new personal links). <b>Archive</b> puts a poll away; find it under Archived and press <b>Bring Back</b>. <b>Delete</b> removes a poll and its answers for good and its link stops working; it asks first, and it can’t be undone, so use Archive when you might want it again.</p>' +
  '<h2>My Polls</h2><p>The boxes across the top count your open polls, polls with new answers, polls with answers whose time isn’t picked yet, and scheduled meetings; click one to show just those. The buttons under them filter the same way. At a Glance says what needs you first.</p>' +
  '<h2>The Back Button</h2><p>Your browser’s <b>Back</b> button goes to the last page you were on in Huddle, and closes an open poll or box first. It never undoes a change.</p>' +
  '<h2>Admin Dashboard (Jonna and Vanessa)</h2><p>Every poll, from everyone, for support. By Organizer shows who is using Huddle: their open and scheduled polls, how many answers they’ve had, and when they last used it. Click any poll to open it; changes you make there are saved to that person’s poll. Your own My Polls still shows only your own.</p>' +
  '<h2>Who Sees What</h2><p>Huddle knows you by your sign-in and shows you only the polls you made. Other facilitators and staff don’t see them. Jonna and Vanessa see every poll on the Admin Dashboard. People answering see the poll as described above; never anyone’s email address.</p>' +
  '<h2>If a Link Won’t Open for Someone</h2><p>A few company networks block the service that saves answers. The poll page tells them so and suggests replying to your email with the times that work, or opening the link on their phone using mobile data. Then type their answer in by hand.</p>' +
  '<h2>Getting Access</h2><p>Huddle uses the shared resources.mismo.org sign-in. Each person needs Huddle (Edit) in People &amp; Access; staff have it as administrators. Ask Jonna to add someone.</p>' +
  '<h2>How It Connects</h2><table class="guests"><thead><tr><th>What</th><th>How</th></tr></thead><tbody>' +
  '<tr><td>Sign-in and access</td><td>The shared resources.mismo.org sign-in; Huddle (Edit) in People &amp; Access. Listed in the platform’s tool list (assets/tools.json).</td></tr>' +
  '<tr><td>Your polls</td><td>Saved through the save relay (project <span class="kbd">huddle</span>) to <span class="kbd">data/polls.json</span> in the private repository GitMISMO/huddle-data. Members-only by sign-in: each person reads and saves only the polls they made. Only the see-all list in projects.json (Jonna and Vanessa) reads every poll, on the Admin Dashboard. A change is kept in your browser until it’s saved, and a save never overwrites someone else’s poll.</td></tr>' +
  '<tr><td>People’s answers</td><td>The poll page (<span class="kbd">poll.html</span>) sends them to relay routes that need no sign-in (<span class="kbd">/group-poll/view</span>, <span class="kbd">/group-poll/answer</span>, relay request 12), which check the link’s code and save to <span class="kbd">votes/votes.json</span>. This page reads them through <span class="kbd">/group-poll/votes</span> and never writes that file, so a save here can never overwrite an answer. Answers you type in and people you remove are kept on the poll itself.</td></tr>' +
  '<tr><td>Email when someone answers</td><td>Sent by the relay through the platform’s Power Automate mail flow, to the organizer only. The only email Huddle sends by itself.</td></tr>' +
  '<tr><td>Emails to the people you poll, and calendar invites</td><td>Never sent from here. Each button opens a draft in your own Outlook (Outlook on the web), your email app, or an .ics file for classic Outlook; you press Send.</td></tr>' +
  '<tr><td>Team HQ</td><td>A dashboard tile (Add a Tile) reads this page’s name, description, the boxes on My Polls and the At a Glance line. Team HQ only reads.</td></tr>' +
  '<tr><td>Connections Map</td><td>Every hand-off above is written down in the MISMO Connections Map.</td></tr>' +
  '</tbody></table>' +
  '<h2>If Something’s Wrong</h2><p><b>System Health</b> shows whether saving, answering through links and reading answers are working, and when they last ran. If a change hasn’t saved, it’s kept in your browser and tried again; the top bar says so. Questions: Jonna Critchley.</p>' +
  '<h2>For Whoever Maintains Huddle</h2><p>The developer guide is DEVELOPING.md in the GitMISMO/huddle repository: files, data shapes, relay routes, building, the thirteen automatic checks and publishing (GitHub publishes the site only after every check passes).</p>' +
  '<p class="muted small">Version ' + esc(BUILD) + '</p></div>';
  app.appendChild(h);
}

/* ---------------- search, live answers, start ---------------- */
window.__polls = {
  STATE: STATE,
  open: function (id) { if (STATE.tab !== 'mine' && STATE.tab !== 'admin') { STATE.tab = isMine(getPoll(id) || {}) || !isAdmin() ? 'mine' : 'admin'; } openPane(id); },
  searchable: function () { return polls().filter(function (p) { return !p.archived; }).map(function (p) {
    var ppl = everyone(p).concat((p.invitees || []).filter(function (i) { return !i.removed; }));
    return { id: p.id, title: p.title, where: [STATUS_WORD[statusOf(p)], isMine(p) ? '' : p.ownerName, p.where].filter(Boolean).join(' · '), people: ppl,
      hay: [p.title, p.about, p.where, p.ownerName, p.owner, ppl.map(function (x) { return [x.name, x.email].join(' '); }).join(' ')].join(' ') }; }); }
};
function announce(beforeIds) {
  /* a toast for answers that arrived while the page was open */
  var fresh = [];
  polls().forEach(function (p) { everyone(p).forEach(function (x) { if (!x.manual && !beforeIds[p.id + '|' + x.id + '|' + x.at]) fresh.push({ p: p, x: x }); }); });
  if (fresh.length === 1) toast(fresh[0].x.name + ' answered “' + (fresh[0].p.title || 'your poll') + '”.');
  else if (fresh.length > 1) toast(plural(fresh.length, 'new answer') + ' just came in.');
}
function answerIds() { var o = {}; polls().forEach(function (p) { everyone(p).forEach(function (x) { o[p.id + '|' + x.id + '|' + x.at] = 1; }); }); return o; }
function tick() {
  if (document.hidden || PREVIEW || !DB.loaded) return;
  var ids = answerIds();
  Promise.all([loadVotes(), loadPolls().catch(function () { return false; })]).then(function (ch) {
    if (ch[0] || ch[1]) { announce(ids); if (STATE.pane) { var p = getPoll(STATE.pane); if (p) markSeen(p); } if (!$('.scrim') && STATE.tab !== 'new') render(); }
  });
}
function fromHash() {
  var h = location.hash.replace(/^#/, ''), m = /^p=([a-z0-9]+)/.exec(h);
  if (m && getPoll(m[1])) { STATE.tab = isMine(getPoll(m[1])) || !isAdmin() ? 'mine' : 'admin'; openPane(m[1]); return; }
  if (['new', 'admin', 'health', 'help'].indexOf(h) >= 0) go(h);
}
function start() {
  SEEN = lsGet(seenKey(), {}) || {};
  render(); fromHash();
  setInterval(tick, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
}
window.addEventListener('beforeunload', function (e) { if (Object.keys(DB.pending).length && !PREVIEW) { e.preventDefault(); e.returnValue = ''; } });

function boot() {
  if (PREVIEW) { seed(); DB.loaded = true; VOTES.loaded = true; HEALTH.ready = true; start(); return; }
  var rs = RS();
  if (!rs) { $('#app').innerHTML = '<div class="notice bad">Couldn’t load the sign-in. Reload the page.</div>'; return; }
  render();
  rs.requireAccess(PROJECT, { toolName: TOOL }).then(function () {
    return Promise.all([loadPolls(), loadVotes(), checkReady()]).then(start, function (e) {
      $('#app').innerHTML = '';
      $('#app').appendChild(el('div', 'notice bad', e && e.code === 'UNKNOWN_PROJECT'
        ? '<b>Huddle isn’t connected to saving yet.</b> The <span class="kbd">huddle</span> entry in projects.json and the huddle-data repository are needed first (see the README).'
        : 'Couldn’t load Huddle (' + esc(e && (e.message || e.code)) + '). Reload the page to try again.'));
    });
  });
}

/* ---------------- preview: made-up polls ---------------- */
function seed() {
  var tz = ET, base = mondayOf(isoAdd(todayISO(tz), 7)), H = 3600000;
  function o(id, dayOff, h, len) { var s = at(isoAdd(base, dayOff), h * 60, tz); return { id: id, s: s, e: s + (len || 60) * 60000 }; }
  var p1 = { id: 'demo1abcde', members: ['jcritchley@mismo.org'], owner: 'jcritchley@mismo.org', ownerName: 'Jonna Critchley', title: 'Commercial eNotes DWG: Kickoff Call', about: 'First call for the new Commercial eNotes Development Workgroup. We’ll go over the charter and pick a regular meeting time.', where: 'Zoom', duration: 60, tz: tz,
    options: [o('o1', 0, 11), o('o2', 0, 14), o('o3', 1, 13), o('o4', 2, 11), o('o5', 3, 15)], settings: { ifNeedBe: true, hidden: false, oneVote: false, limit: 0, askEmail: 'required', comments: true, deadline: null, notify: true },
    code: 'DemoShareCode123456789', status: 'open', createdAt: Date.now() - 3 * 86400000, updatedAt: Date.now() - 2 * H,
    invitees: [{ id: 'i1', name: 'Pat Lee', email: 'pat.lee@examplelender.com', code: 'DemoInviteCode12345678' }, { id: 'i2', name: 'Sam Roe', email: 'sroe@exampleservicer.com', code: 'DemoInviteCode22345678' }, { id: 'i3', name: 'Dana Ortiz', email: 'dortiz@examplebank.com', code: 'DemoInviteCode32345678' }, { id: 'i4', name: 'Chris Wu', email: 'cwu@exampletitle.com', code: 'DemoInviteCode42345678' }],
    manual: { m1: { name: 'Lee Grant', email: 'lgrant@examplecu.org', answers: { o1: 'n', o2: 'y', o3: 'y', o4: 'n', o5: 'm' }, at: Date.now() - 86400000, created: Date.now() - 86400000, by: 'Jonna Critchley' } }, hiddenVoters: [],
    log: [{ at: Date.now() - 3 * 86400000, by: 'Jonna Critchley', what: 'Started the poll' }, { at: Date.now() - 3 * 86400000 + 60000, by: 'Jonna Critchley', what: 'Opened an email draft with the poll link' }, { at: Date.now() - 86400000, by: 'Jonna Critchley', what: 'Typed in Lee Grant’s answers' }] };
  var p2 = { id: 'demo2abcde', members: ['jcritchley@mismo.org'], owner: 'jcritchley@mismo.org', ownerName: 'Jonna Critchley', title: 'Summit Planning: Workshop Leads', about: '', where: 'Teams', duration: 30, tz: tz,
    options: [o('a1', 1, 10, 30), o('a2', 1, 10.5, 30), o('a3', 2, 15, 30), o('a4', 4, 9, 30)], settings: { ifNeedBe: false, hidden: false, oneVote: false, limit: 0, askEmail: 'optional', comments: true, deadline: at(isoAdd(base, -1), 0, tz) - 1, notify: true },
    code: 'DemoShareCode223456789', status: 'open', createdAt: Date.now() - 86400000, updatedAt: Date.now() - 5 * H, invitees: [{ id: 'j1', name: 'Kelly Bradshaw', email: 'kbradshaw@mismo.org', code: 'DemoInviteCode52345678' }, { id: 'j2', name: 'Mark Kleingers', email: 'mkleingers@mismo.org', code: 'DemoInviteCode62345678' }], manual: {}, hiddenVoters: [], log: [] };
  var p3 = { id: 'demo3abcde', members: ['jcritchley@mismo.org'], owner: 'jcritchley@mismo.org', ownerName: 'Jonna Critchley', title: 'Certification Assessor Training', about: 'Two-hour walkthrough for new assessors.', where: 'Zoom', duration: 120, tz: tz,
    options: [o('b1', 0, 13, 120), o('b2', 2, 13, 120), { id: 'b3', d: isoAdd(base, 3) }], settings: { ifNeedBe: true, hidden: false, oneVote: false, limit: 0, askEmail: 'required', comments: true, deadline: null, notify: true },
    code: 'DemoShareCode323456789', status: 'scheduled', chosen: 'b2', scheduledAt: Date.now() - 4 * H, createdAt: Date.now() - 6 * 86400000, updatedAt: Date.now() - 4 * H, invitees: [], manual: {}, hiddenVoters: [], log: [{ at: Date.now() - 4 * H, by: 'Jonna Critchley', what: 'Picked a time' }] };
  var p4 = { id: 'demo4abcde', members: ['jcritchley@mismo.org'], owner: 'jcritchley@mismo.org', ownerName: 'Jonna Critchley', title: 'Office Hours Sign-Up', about: 'Grab one 30-minute slot.', where: 'Zoom', duration: 30, tz: tz,
    options: [o('c1', 1, 13, 30), o('c2', 1, 13.5, 30), o('c3', 1, 14, 30), o('c4', 1, 14.5, 30)], settings: { ifNeedBe: false, hidden: true, oneVote: true, limit: 1, askEmail: 'required', comments: false, deadline: null, notify: true },
    code: 'DemoShareCode423456789', status: 'open', createdAt: Date.now() - 2 * 86400000, updatedAt: Date.now() - 20 * H, invitees: [], manual: {}, hiddenVoters: [], log: [] };
  function other(id, owner, name, title, opts, status, chosen, ago) { return { id: id, members: [owner], owner: owner, ownerName: name, title: title, about: '', where: 'Zoom', duration: 60, tz: tz, options: opts, settings: { ifNeedBe: true, hidden: false, oneVote: false, limit: 0, askEmail: 'required', comments: true, deadline: null, notify: true }, code: 'DemoShareCode' + id, status: status, chosen: chosen || null, createdAt: Date.now() - ago - 86400000, updatedAt: Date.now() - ago, invitees: [], manual: {}, hiddenVoters: [], log: [] }; }
  var p5 = other('demo5abcde', 'tbocanegra@mismo.org', 'Tessa Bocanegra', 'API COP: December Session', [o('d1', 1, 12), o('d2', 2, 12), o('d3', 3, 12)], 'open', null, 3 * H);
  var p6 = other('demo6abcde', 'kwilliams@mismo.org', 'Kathryn Williams', 'Servicing DWG: Q1 Planning', [o('e1', 0, 10), o('e2', 3, 10)], 'scheduled', 'e2', 26 * H);
  var p7 = other('demo7abcde', 'tbocanegra@mismo.org', 'Tessa Bocanegra', 'Housing Counseling: Kickoff', [o('f1', 1, 14), o('f2', 4, 11)], 'open', null, 50 * H);
  [p1, p2, p3, p4, p5, p6, p7].forEach(function (p) { DB.docs[p.id] = p; });
  var now = Date.now();
  VOTES.docs = {
    demo1abcde: { voters: {
      v1: { name: 'Pat Lee', email: 'pat.lee@examplelender.com', answers: { o1: 'y', o2: 'y', o3: 'm', o4: 'n', o5: 'y' }, comment: 'Afternoons are best for me.', at: now - 2 * H, created: now - 2 * 86400000, invitee: 'i1' },
      v2: { name: 'Dana Ortiz', email: 'dortiz@examplebank.com', answers: { o1: 'n', o2: 'y', o3: 'y', o4: 'y', o5: 'n' }, comment: '', at: now - 30 * 60000, created: now - 30 * 60000, invitee: 'i3' },
      v3: { name: 'Riley Shah', email: 'rshah@examplepartner.com', answers: { o1: 'y', o2: 'y', o3: 'n', o4: 'm', o5: 'y' }, comment: 'Kathryn passed the link along. Happy to join.', at: now - 20 * 60000, created: now - 20 * 60000, invitee: null } } },
    demo2abcde: { voters: { w1: { name: 'Kelly Bradshaw', email: 'kbradshaw@mismo.org', answers: { a1: 'y', a2: 'n', a3: 'y', a4: 'y' }, at: now - 6 * H, created: now - 6 * H }, w2: { name: 'Mark Kleingers', email: 'mkleingers@mismo.org', answers: { a1: 'y', a2: 'y', a3: 'n', a4: 'y' }, at: now - 5 * H, created: now - 5 * H } } },
    demo3abcde: { voters: { x1: { name: 'Jonathan Kearns', email: 'jkearns@mismo.org', answers: { b1: 'n', b2: 'y', b3: 'm' }, at: now - 2 * 86400000, created: now - 2 * 86400000 }, x2: { name: 'Perry Williams', email: 'pwilliams@mismo.org', answers: { b1: 'y', b2: 'y', b3: 'n' }, at: now - 86400000, created: now - 86400000 } } },
    demo5abcde: { voters: { z1: { name: 'Morgan Bell', email: 'mbell@examplevendor.com', answers: { d1: 'y', d2: 'n', d3: 'y' }, at: now - 3 * H, created: now - 3 * H } } },
    demo6abcde: { voters: { z2: { name: 'Jamie Ruiz', email: 'jruiz@exampleservicer.com', answers: { e1: 'n', e2: 'y' }, at: now - 30 * H, created: now - 30 * H }, z3: { name: 'Alex Fox', email: 'afox@examplebank.com', answers: { e1: 'y', e2: 'y' }, at: now - 28 * H, created: now - 28 * H } } },
    demo4abcde: { voters: { y1: { name: 'Avery Kim', email: 'akim@exampleco.com', answers: { c2: 'y' }, at: now - 20 * H, created: now - 20 * H } } }
  };
  SEEN = { demo2abcde: now - 4 * H, demo3abcde: now, demo4abcde: now };
  lsSet(seenKey(), SEEN);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
