// Huddle checks. Run with:  npm test   (or: node tests/run.js)
// Every check opens the pages as a PREVIEW (any address other than resources.mismo.org is one), with the made-up
// polls built into huddle.js, so nothing real is read, saved or sent. The run fails (exit code 1) if any check
// fails; GitHub then emails whoever uploaded the change and the site stays on the version before.
const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const results = [];
const only = process.argv.slice(2);
async function check(name, fn) {
  if (only.length && !only.some(o => name.toLowerCase().includes(o.toLowerCase()))) return;
  try { await fn(); results.push({ name, ok: true }); console.log('  PASS  ' + name); }
  catch (e) { results.push({ name, ok: false }); console.log('  FAIL  ' + name + '\n        ' + String(e.message).split('\n').join('\n        ')); }
}
function expect(cond, msg) { if (!cond) throw new Error(msg); }
const files = (dir, out = []) => { for (const f of fs.readdirSync(dir)) { if (f === '.git' || f === 'node_modules') continue; const p = path.join(dir, f); fs.statSync(p).isDirectory() ? files(p, out) : out.push(p); } return out; };

/* a tiny web server for the repository, so the pages load the way GitHub Pages serves them */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].split('#')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const BASE = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME, args: ['--no-sandbox'] } : {});
  async function open(url, { width = 1440, theme = 'light' } = {}) {
    const ctx = await browser.newContext({ viewport: { width, height: 1000 }, acceptDownloads: true });
    const page = await ctx.newPage(), errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    /* fonts come from Google; offline runs shouldn't fail on them */
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.addInitScript(t => { try { localStorage.setItem('mismo.portal.theme', t); } catch (e) {} }, theme);
    await page.goto(BASE + url); await page.waitForTimeout(700);
    return { page, errs, close: () => ctx.close() };
  }

  /* 1. Scripts read as valid JavaScript */
  await check('Every script parses', async () => {
    const bad = [];
    for (const f of ['huddle.js', 'rail.js']) { try { new vm.Script(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f }); } catch (e) { bad.push(f + ': ' + e.message); } }
    for (const f of ['index.html', 'poll.html']) {
      const html = fs.readFileSync(path.join(ROOT, f), 'utf8'), re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g; let m, i = 0;
      while ((m = re.exec(html))) { i++; try { new vm.Script(m[1], { filename: f + ' script ' + i }); } catch (e) { bad.push(f + ' script ' + i + ': ' + e.message); } }
    }
    expect(!bad.length, bad.join('\n'));
  });

  /* 2. No token, key or password anywhere in this public repository */
  await check('No tokens, keys or passwords in the repository', async () => {
    const pats = [/ghp_[A-Za-z0-9]{36}/, /github_pat_[A-Za-z0-9_]{50,}/, /gho_[A-Za-z0-9]{36}/, /AKIA[0-9A-Z]{16}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /xox[bap]-[A-Za-z0-9-]{10,}/, /sk-ant-[A-Za-z0-9_-]{20,}/, /sig=[A-Za-z0-9%]{30,}/];
    const hits = [];
    for (const f of files(ROOT)) { const s = fs.readFileSync(f, 'utf8'); pats.forEach(p => { if (p.test(s)) hits.push(path.relative(ROOT, f) + ' matches ' + p); }); }
    expect(!hits.length, hits.join('\n'));
  });

  /* 3. The platform rules every tool keeps */
  await check('Storage keys are namespaced and nothing clears shared storage', async () => {
    const src = ['huddle.js', 'rail.js', 'poll.html', 'index.html'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '');   /* comments may say what never to do */
    expect(!/localStorage\.clear\s*\(/.test(src), 'localStorage.clear() is used: it wipes every other tool’s storage');
    const keys = [...src.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(\s*'([^']+)'/g)].map(m => m[1]);
    const bad = keys.filter(k => !/^tools:huddle:|^mismo\.portal\.theme$|^hq\.rail\.off$/.test(k));
    expect(!bad.length, 'storage keys outside tools:huddle: ' + bad.join(', '));
  });
  await check('The built pages match their sources', async () => {
    const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), src = fs.readFileSync(path.join(ROOT, 'index.src.html'), 'utf8');
    expect(!/__V__|__BUILD__/.test(idx), 'index.html still has build placeholders: run python3 build.py');
    expect(idx.replace(/\?v=[0-9a-f]{8}/g, '?v=__V__').replace(/window\.MP_BUILD = '[^']*'/, "window.MP_BUILD = '__BUILD__'") === src, 'index.html is out of date with index.src.html: run python3 build.py');
    const poll = fs.readFileSync(path.join(ROOT, 'poll.html'), 'utf8'), psrc = fs.readFileSync(path.join(ROOT, 'poll.src.html'), 'utf8');
    expect(!poll.includes('__LOGO__') && poll === psrc.replace('__LOGO__', fs.readFileSync(path.join(ROOT, '_internal/logo-symbol.svg'), 'utf8')), 'poll.html is out of date with poll.src.html: run python3 build.py');
  });
  await check('No pill-shaped buttons or tags in Huddle’s own styles', async () => {
    const css = fs.readFileSync(path.join(ROOT, 'huddle.css'), 'utf8'), mine = css.slice(css.indexOf('HUDDLE\n'));
    const pills = [...mine.matchAll(/border-radius:\s*(\d+)px/g)].map(m => +m[1]).filter(n => n > 12);
    expect(!pills.length, 'radius over 12px (reads as a pill): ' + pills.join(', '));
  });

  /* 4. Every page of the staff tool opens without errors, light and dark */
  for (const theme of ['light', 'dark']) await check('Every page opens without errors (' + theme + ')', async () => {
    const s = await open('index.html', { theme }), broken = [];
    for (const tab of ['mine', 'new', 'admin', 'health', 'help']) {
      const before = s.errs.length;
      await s.page.evaluate(t => window.go(t), tab); await s.page.waitForTimeout(300);
      const h1 = await s.page.textContent('.pagehead h1').catch(() => '');
      if (!h1) broken.push(tab + ': no heading');
      if (s.errs.length > before) broken.push(tab + ': ' + s.errs.slice(before).join(' | '));
    }
    await s.close(); expect(!broken.length, broken.join('\n'));
  });

  /* 5. An organizer's whole round: make a poll, email it, type in an answer, pick a time, the invite */
  await check('Make a poll, email it, add an answer, pick a time, make the invite', async () => {
    const s = await open('index.html#new'), p = s.page;
    await p.fill('#ed-title', 'Check Poll'); await p.fill('#ed-where', 'Zoom');
    await p.click('.mp-col:nth-child(2) .mp-slot[data-m="600"]');
    await p.click('.mp-col:nth-child(4) .mp-slot[data-m="780"]');
    expect(await p.locator('.mp-ochip').count() === 2, 'two times should be offered');
    const ins = p.locator('#ed-ppl .mp-prow input'); await ins.nth(0).fill('Pat Check'); await ins.nth(1).fill('pat@example.com');
    await p.click('.mp-savebar .btn'); await p.waitForTimeout(400);
    expect((await p.textContent('#mp-pane-t')) === 'Check Poll', 'the new poll did not open');
    await p.click('text=Email the Poll'); await p.waitForTimeout(200);
    expect(await p.inputValue('#dr-to') === 'pat@example.com', 'the email draft is not addressed to the invited person');
    expect((await p.inputValue('#dr-body')).includes('poll.html#p='), 'the email draft has no poll link');
    await p.click('.dlg .x');
    await p.click('text=Add an Answer by Hand'); await p.fill('#mm-name', 'Lee Check'); await p.click('.mp-mopt .tri button.y'); await p.click('text=Save Answer'); await p.waitForTimeout(300);
    expect(await p.locator('.mp-grid tbody tr').count() === 1, 'the typed-in answer is not in the grid');
    await p.click('[data-pick]'); await p.click('.dlg-f .btn >> nth=0'); await p.waitForTimeout(300);
    expect((await p.textContent('.mp-next-t')).includes('Scheduled For'), 'picking a time did not schedule the poll');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('text=Download Invite (.ics)')]);
    const ics = fs.readFileSync(await dl.path(), 'utf8');
    expect(/BEGIN:VEVENT[\s\S]*SUMMARY:Check Poll[\s\S]*ATTENDEE[^\n]*pat@example\.com[\s\S]*END:VEVENT/.test(ics), 'the .ics invite is missing the title or the attendee');
    expect(!s.errs.length, s.errs.join('\n')); await s.close();
  });

  /* 6. Archive, never delete; a removed answer can come back */
  await check('Archive and removed answers can be brought back', async () => {
    const s = await open('index.html#p=demo1abcde'), p = s.page; await p.waitForTimeout(300);
    const n = await p.locator('.mp-grid tbody tr').count();
    await p.locator('.mp-rm').first().click({ force: true }); await p.click('.dlg-f .btn >> nth=0'); await p.waitForTimeout(300);
    expect(await p.locator('.mp-grid tbody tr').count() === n - 1, 'Remove did not take the answer off');
    await p.click('text=/Show 1 removed answer/'); await p.click('.mp-removed .btn'); await p.waitForTimeout(300);
    expect(await p.locator('.mp-grid tbody tr').count() === n, 'Bring Back did not return the answer');
    await p.click('#mp-pane .panel-h .btn:has-text("Archive")'); await p.waitForTimeout(300);
    await p.evaluate(() => { window.__polls.STATE.filter = 'archived'; window.go('mine'); }); await p.waitForTimeout(300);
    expect((await p.textContent('.mp-list')).includes('Commercial eNotes'), 'the archived poll is not under Archived');
    expect(!s.errs.length, s.errs.join('\n')); await s.close();
  });

  /* 7. The page people answer on: their own time zone, three answers, send, and the edit link comes back */
  await check('Answering a poll works on a phone', async () => {
    const s = await open('poll.html', { width: 390 }), p = s.page; await p.waitForTimeout(500);
    expect(await p.locator('.opt').count() >= 3, 'the times did not load');
    await p.fill('#name', 'Sam Check'); await p.fill('#email', 'sam@example.com');
    await p.locator('.opt .tri button.y').first().click();
    await p.locator('.opt .tri button.m').nth(1).click();
    await p.click('#send'); await p.waitForTimeout(600);
    expect((await p.textContent('#state')).includes('Your answers are in'), 'no thank-you after sending');
    const kept = await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('tools:huddle:me:')).length);
    expect(kept === 1, 'the person’s own link was not remembered');
    const wide = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(!wide, 'the page scrolls sideways on a phone');
    expect(!s.errs.length, s.errs.join('\n')); await s.close();
  });
  await check('A poll link with a missing code says so plainly', async () => {
    const s = await open('poll.html?preview=1#p=abc'), t = await s.page.textContent('#state');
    expect(/isn.t complete/.test(t), 'expected the incomplete-link message, got: ' + t); await s.close();
  });

  /* 8. Search finds polls and people */
  await check('Search finds polls and people', async () => {
    const s = await open('index.html'), p = s.page;
    await p.fill('#rail-q', 'pat'); await p.waitForTimeout(300);
    const t = await p.textContent('#rail-hits');
    expect(/Pat Lee/.test(t) && /Commercial eNotes/.test(t), 'search for "pat" found: ' + t);
    await s.close();
  });

  await browser.close(); server.close();
  const failed = results.filter(r => !r.ok).length;
  console.log('\n' + (failed ? failed + ' of ' + results.length + ' checks FAILED' : 'All ' + results.length + ' checks passed'));
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
