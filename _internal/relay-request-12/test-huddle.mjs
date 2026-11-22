/* Huddle' respondent routes (relay request 12). Run: node test-huddle.mjs. A stand-in GitHub and mail flow, as test-scheduler.mjs. */
import { pbkdf2Sync } from 'node:crypto';
const ORIGIN = 'https://resources.example';
Object.assign(process.env, { GITHUB_TOKEN: 'ghp_test', AUTH_SECRET: 'polls-test-secret', PROJECTS_REPO: 'Org/Config', DIRECTORY_REPO: 'Org/Accounts', MAIL_FLOW_URL: 'https://flow.example/mail' });
let N = 100; const sha = () => (N++).toString(16).padEnd(40, 'c'); const repo = {};
const put = (key, data, message = 'seed') => { (repo[key] = repo[key] || []).push({ sha: sha(), data, message }); };
const pb = pw => { const s = 'cc'.repeat(16); return `pbkdf2$1000$${s}$${pbkdf2Sync(pw, Buffer.from(s, 'hex'), 1000, 32, 'sha256').toString('hex')}`; };
const ENTRY = { repo: 'Org/Polls', origin: ORIGIN, writable: ['data/'], membersOnly: { polls: ['jc@example.org'] } };
put('Org/Config:projects.json', { 'huddle': ENTRY, scheduler: { repo: 'Org/Sched', origin: ORIGIN, writable: ['data/'], guestLinks: true } });
put('Org/Accounts:access.json', { people: {
  'tessa@example.org': { name: 'Tessa B', hash: pb('tessa-pass-12345678'), access: { 'huddle': 'staff' }, group: 'facilitator' },
  'kathryn@example.org': { name: 'Kathryn W', hash: pb('kathryn-pass-1234567'), access: { 'huddle': 'staff' }, group: 'facilitator' },
  'jc@example.org': { name: 'Jonna C', hash: pb('jonna-pass-123456789'), access: { 'huddle': 'admin' }, group: 'staff' } } });
const SHARE = 'ShareCodeAbCdEfGhIjKlMn', INV = 'InviteCodeZyXwVuTsRqPo', T0 = Date.now() + 5 * 86400000;
const POLL = { id: 'pq7m2k9p4a', members: ['tessa@example.org'], owner: 'tessa@example.org', ownerName: 'Tessa Bocanegra', title: 'API COP Kickoff',
  about: 'Planning call.', where: 'Zoom', duration: 60, tz: 'America/New_York', code: SHARE, status: 'open',
  settings: { ifNeedBe: true, hidden: false, oneVote: false, limit: 0, askEmail: 'required', comments: true, notify: true },
  options: [{ id: 'o1', s: T0, e: T0 + 3600000 }, { id: 'o2', s: T0 + 86400000, e: T0 + 86400000 + 3600000 }, { id: 'o3', d: '2026-12-10' }],
  invitees: [{ id: 'i1', name: 'Pat Lee', email: 'pat@lender.example', code: INV }, { id: 'i2', name: 'Sam Roe', email: 'sam@lender.example', code: 'OtherInviteCode1234567' }],
  manual: { m1: { name: 'Called In', email: '', answers: { o1: 'y' }, at: 1 } }, log: [{ at: 1, by: 'Tessa', what: 'SECRET LOG' }], notes: 'PRIVATE NOTE' };
const OTHER = { ...POLL, id: 'kw00000001', members: ['kathryn@example.org'], owner: 'kathryn@example.org', ownerName: 'Kathryn W', title: 'Kathryn poll', code: 'KathrynShareCode123456', invitees: [], manual: {} };
put('Org/Polls:data/polls.json', { docs: { [POLL.id]: POLL, [OTHER.id]: OTHER } });
const mails = [];
const R = (status, j) => ({ status, ok: status < 300, headers: { get: () => null }, json: async () => j, text: async () => '' });
globalThis.fetch = async (url, opts = {}) => {
  const method = (opts.method || 'GET').toUpperCase();
  if (url === 'https://flow.example/mail') { mails.push(JSON.parse(opts.body)); return R(202, {}); }
  const m = url.match(/^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)\/contents\/([^?]+)/);
  if (!m) return R(404, {});
  const key = m[1] + ':' + decodeURIComponent(m[2]), h = repo[key];
  if (method === 'GET') { const v = h && h[h.length - 1]; if (!v) return R(404, {}); return R(200, { sha: v.sha, content: Buffer.from(JSON.stringify(v.data)).toString('base64') }); }
  if (method === 'PUT') { const body = JSON.parse(opts.body), cur = h && h[h.length - 1];
    if ((cur ? cur.sha : undefined) !== (body.sha || undefined)) return R(409, {});
    put(key, JSON.parse(Buffer.from(body.content, 'base64').toString()), body.message); return R(200, { content: { sha: repo[key].at(-1).sha } }); }
  return R(405, {});
};
const { handler, __resetProjectsCache, __resetGithubCache, __resetGroupPollLimits } = await import('./index.mjs');
let failed = 0; const ok = (n, c, d) => { if (!c) failed++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c || d === undefined ? '' : '  ' + JSON.stringify(d).slice(0, 400))); };
const J = r => JSON.parse(r.body);
const call = (m, path, { body, origin = ORIGIN, ip = '203.0.113.1', tok } = {}) => { __resetGithubCache(); return handler({ rawPath: path, requestContext: { http: { method: m, sourceIp: ip } },
  headers: { ...(origin ? { origin } : {}), 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); };
const votes = () => { const h = repo['Org/Polls:votes/votes.json']; return h ? h.at(-1).data.docs : {}; };
const vcount = () => (repo['Org/Polls:votes/votes.json'] || []).length;
const ago = () => Date.now() - 9000;
let r, d;

/* ---------- off until projects.json says groupPolls: true ---------- */
r = await call('GET', '/huddle/group-poll/ready'); ok('off by default: ready is 404', r.statusCode === 404);
r = await call('POST', '/huddle/group-poll/view', { body: { p: POLL.id, k: SHARE } }); ok('...view is 404', r.statusCode === 404);
r = await call('POST', '/huddle/group-poll/answer', { body: { p: POLL.id, k: SHARE, name: 'X', email: 'x@y.co', answers: { o1: 'y' }, startedAt: ago() } });
ok('...answer is 404, nothing written, nobody emailed', r.statusCode === 404 && vcount() === 0 && mails.length === 0);
put('Org/Config:projects.json', { 'huddle': { ...ENTRY, groupPolls: 'yes' }, scheduler: { repo: 'Org/Sched', origin: ORIGIN, writable: ['data/'], guestLinks: true, groupPolls: true } });
__resetProjectsCache();
r = await call('GET', '/huddle/group-poll/ready'); ok('anything but exactly true stays off', r.statusCode === 404);
r = await call('GET', '/scheduler/group-poll/ready'); ok('...and another project can never switch them on', r.statusCode === 404);
put('Org/Config:projects.json', { 'huddle': { ...ENTRY, groupPolls: true }, scheduler: { repo: 'Org/Sched', origin: ORIGIN, writable: ['data/'], guestLinks: true } });
__resetProjectsCache();

/* ---------- view ---------- */
r = await call('GET', '/huddle/group-poll/ready'); ok('on: ready 200', r.statusCode === 200 && J(r).ok === true);
r = await call('POST', '/huddle/group-poll/view', { body: { p: POLL.id, k: SHARE } }); d = J(r);
ok('shared link: the poll, its three options, the typed-in answer shown by name', r.statusCode === 200 && d.title === POLL.title && d.options.length === 3 && d.people.length === 1 && d.people[0].name === 'Called In' && d.me === null, d);
ok('...and nothing private: no emails, codes, invitees, log or notes', !/@|ShareCode|InviteCode|SECRET|PRIVATE|Pat Lee|Sam Roe|codeHash/.test(r.body.replace(/"organizerEmail":"tessa@example.org"/, '')), r.body);
r = await call('POST', '/huddle/group-poll/view', { body: { p: POLL.id, k: 'KathrynShareCode123456' } }); ok('another poll’s code: 404', r.statusCode === 404 && J(r).error === 'NOT_FOUND');
r = await call('POST', '/huddle/group-poll/view', { body: { p: 'zzzzzzzz', k: SHARE } }); ok('unknown poll: the same 404', r.statusCode === 404);
r = await call('POST', '/huddle/group-poll/view', { body: { p: POLL.id, k: 'short' } }); ok('malformed code: 404', r.statusCode === 404);
r = await call('POST', '/huddle/group-poll/view', { body: { p: POLL.id, k: SHARE }, origin: 'https://evil.example' }); ok('another site: 403', r.statusCode === 403);
r = await call('POST', '/huddle/group-poll/view', { body: { p: POLL.id, k: SHARE }, origin: null }); ok('no Origin: 403', r.statusCode === 403);
r = await call('POST', '/huddle/group-poll/view', { body: { p: POLL.id, i: 'i1.' + INV } }); d = J(r);
ok('personal link: name and email filled in for them', r.statusCode === 200 && d.me && d.me.name === 'Pat Lee' && d.me.email === 'pat@lender.example' && d.me.answers === null, d);
r = await call('POST', '/huddle/group-poll/view', { body: { p: POLL.id, i: 'i2.' + INV } }); ok('one invitee’s code for another: 404', r.statusCode === 404);

/* ---------- answer ---------- */
mails.length = 0;
r = await call('POST', '/huddle/group-poll/answer', { body: { p: POLL.id, k: SHARE, name: 'Jordan Park', email: 'Jordan@Bank.example', answers: { o1: 'y', o2: 'm', o3: 'n', bogus: 'y' }, comment: 'Mornings best', startedAt: ago(), website: '' } });
d = J(r); const V1 = d.v;
ok('shared link answer saved; hands back an edit link', r.statusCode === 200 && /^[a-z0-9]{10}\.[A-Za-z0-9_-]{24}$/.test(V1 || ''), d);
let vv = votes()[POLL.id].voters, vid = V1.split('.')[0];
ok('...stored with the email lower-cased, unknown times dropped, the code only as a hash', vv[vid].email === 'jordan@bank.example' && !('bogus' in vv[vid].answers) && vv[vid].answers.o2 === 'm' && vv[vid].codeHash && !JSON.stringify(vv).includes(V1.split('.')[1]), vv);
ok('...the poll file itself untouched', repo['Org/Polls:data/polls.json'].length === 1);
ok('...the organizer is emailed (not the respondent), with who is still waiting', mails.length === 1 && mails[0].to === 'tessa@example.org' && /Jordan Park answered/.test(mails[0].subject) && /Pat Lee, Sam Roe/.test(mails[0].text) && /huddle\/#p=pq7m2k9p4a/.test(mails[0].text), mails);
r = await call('POST', '/huddle/group-poll/view', { body: { p: POLL.id, v: V1 } }); d = J(r);
ok('edit link: their own answers come back, others still listed without them', r.statusCode === 200 && d.me.answers.o1 === 'y' && d.me.comment === 'Mornings best' && d.people.length === 1, d);
r = await call('POST', '/huddle/group-poll/answer', { body: { p: POLL.id, v: V1, name: 'Jordan Park', email: 'jordan@bank.example', answers: { o1: 'n', o2: 'y' }, startedAt: ago() } });
ok('changing answers keeps one entry, no new edit link', r.statusCode === 200 && J(r).v === null && Object.keys(votes()[POLL.id].voters).length === 1 && votes()[POLL.id].voters[vid].answers.o2 === 'y');
ok('...and the email says they changed them', /changed their answers/.test(mails.at(-1).text));
r = await call('POST', '/huddle/group-poll/answer', { body: { p: POLL.id, i: 'i1.' + INV, name: 'Pat Lee', email: 'pat@lender.example', answers: { o1: 'y' }, startedAt: ago() } });
const V2 = J(r).v;
r = await call('POST', '/huddle/group-poll/answer', { body: { p: POLL.id, i: 'i1.' + INV, name: 'Pat Lee', email: 'pat@lender.example', answers: { o1: 'n', o3: 'y' }, startedAt: ago() } });
vv = votes()[POLL.id].voters;
ok('personal link answered twice: still one entry, tied to the invitee', Object.values(vv).filter(x => x.invitee === 'i1').length === 1 && Object.keys(vv).length === 2 && vv[V2.split('.')[0]].answers.o3 === 'y', vv);
ok('...and Pat no longer listed as waiting', !/Still waiting on: Pat/.test(mails.at(-1).text) && /Sam Roe/.test(mails.at(-1).text));
r = await call('POST', '/huddle/group-poll/view', { body: { p: POLL.id, k: SHARE } }); d = J(r);
ok('everyone now sees three people, names only', d.people.length === 3 && !/jordan@|pat@/.test(r.body), d);

/* ---------- refusals ---------- */
const before = vcount();
r = await call('POST', '/huddle/group-poll/answer', { body: { p: POLL.id, k: SHARE, name: 'Bot', email: 'b@b.co', answers: { o1: 'y' }, startedAt: ago(), website: 'http://spam' } });
ok('honeypot filled: answered as accepted, kept nowhere', r.statusCode === 200 && vcount() === before);
r = await call('POST', '/huddle/group-poll/answer', { body: { p: POLL.id, k: SHARE, name: 'Fast', email: 'f@f.co', answers: { o1: 'y' }, startedAt: Date.now() } });
ok('sent under 2 seconds: kept nowhere', r.statusCode === 200 && vcount() === before);
r = await call('POST', '/huddle/group-poll/answer', { body: { p: POLL.id, k: SHARE, name: '', email: 'f@f.co', answers: { o1: 'y' }, startedAt: ago() } });
ok('no name: 400', r.statusCode === 400 && J(r).error === 'INVALID');
r = await call('POST', '/huddle/group-poll/answer', { body: { p: POLL.id, k: SHARE, name: 'No Email', answers: { o1: 'y' }, startedAt: ago() } });
ok('email required by the poll and missing: 400', r.statusCode === 400);
r = await call('POST', '/huddle/group-poll/answer', { body: { p: POLL.id, k: SHARE, name: 'Blank', email: 'b@b.co', answers: {}, startedAt: ago() } });
ok('nothing marked: 400', r.statusCode === 400);
r = await call('POST', '/huddle/group-poll/answer', { body: { p: POLL.id, k: 'KathrynShareCode123456', name: 'X', email: 'x@x.co', answers: { o1: 'y' }, startedAt: ago() } });
ok('wrong code: 404, nothing written', r.statusCode === 404 && vcount() === before);
r = await call('POST', '/huddle/group-poll/answer', { body: { p: POLL.id, v: vid + '.WrongCodeWrongCode123456', name: 'X', email: 'x@x.co', answers: { o1: 'y' }, startedAt: ago() } });
ok('someone else’s voter id with a guessed code: 404', r.statusCode === 404 && vcount() === before);

/* ---------- settings: if need be off, one choice, limits, hidden, deadline, closed ---------- */
const setPoll = (ch) => { const cur = repo['Org/Polls:data/polls.json'].at(-1).data; const p = JSON.parse(JSON.stringify(cur.docs[POLL.id])); ch(p); put('Org/Polls:data/polls.json', { docs: { ...cur.docs, [POLL.id]: p } }); };
setPoll(p => { p.settings.ifNeedBe = false; });
r = await call('POST', '/huddle/group-poll/answer', { body: { p: POLL.id, k: SHARE, name: 'Maybe Only', email: 'm@m.co', answers: { o1: 'm' }, startedAt: ago() } });
ok('"if need be" switched off: a maybe alone is refused as nothing marked', r.statusCode === 400);
setPoll(p => { p.settings.ifNeedBe = true; p.settings.oneVote = true; });
r = await call('POST', '/huddle/group-poll/answer', { body: { p: POLL.id, k: SHARE, name: 'Two', email: 't@t.co', answers: { o1: 'y', o2: 'y' }, startedAt: ago() } });
ok('one choice only: two yeses refused', r.statusCode === 400);
setPoll(p => { p.settings.oneVote = false; p.settings.limit = 2; });
r = await call('POST', '/huddle/group-poll/view', { body: { p: POLL.id, k: SHARE } }); d = J(r);
ok('limit 2: o2 (Jordan) not full, o1 full? (Called In + nobody else yes) no; o3 has Pat only', Array.isArray(d.full) && d.full.length === 0, d.full);
r = await call('POST', '/huddle/group-poll/answer', { body: { p: POLL.id, k: SHARE, name: 'Third', email: 't3@t.co', answers: { o2: 'y' }, startedAt: ago() } });
ok('o2 now has two', r.statusCode === 200);
r = await call('POST', '/huddle/group-poll/answer', { body: { p: POLL.id, k: SHARE, name: 'Fourth', email: 't4@t.co', answers: { o2: 'y' }, startedAt: ago() } });
ok('a third yes on a full time: 409 FULL naming it', r.statusCode === 409 && J(r).error === 'FULL' && J(r).options[0] === 'o2', J(r));
r = await call('POST', '/huddle/group-poll/answer', { body: { p: POLL.id, v: V1, name: 'Jordan Park', email: 'jordan@bank.example', answers: { o2: 'y', o1: 'n' }, startedAt: ago() } });
ok('...but someone already holding a place there can resave', r.statusCode === 200);
setPoll(p => { p.settings.limit = 0; p.settings.hidden = true; });
r = await call('POST', '/huddle/group-poll/view', { body: { p: POLL.id, k: SHARE } }); d = J(r);
ok('hidden poll: nobody else’s name or answer', r.statusCode === 200 && d.people.length === 0 && !/Jordan|Called In|Third/.test(r.body), d);
setPoll(p => { p.settings.hidden = false; p.hiddenVoters = ['m1']; });
r = await call('POST', '/huddle/group-poll/view', { body: { p: POLL.id, k: SHARE } }); d = J(r);
ok('someone the organizer removed is no longer shown', !d.people.some(x => x.name === 'Called In'), d.people);
setPoll(p => { p.settings.deadline = Date.now() - 1000; });
r = await call('POST', '/huddle/group-poll/view', { body: { p: POLL.id, k: SHARE } }); ok('deadline passed: closed', J(r).status === 'closed');
r = await call('POST', '/huddle/group-poll/answer', { body: { p: POLL.id, k: SHARE, name: 'Late', email: 'l@l.co', answers: { o1: 'y' }, startedAt: ago() } });
ok('...answers refused as CLOSED', r.statusCode === 409 && J(r).error === 'CLOSED');
setPoll(p => { p.settings.deadline = null; p.status = 'scheduled'; p.chosen = 'o3'; });
r = await call('POST', '/huddle/group-poll/view', { body: { p: POLL.id, k: SHARE } }); d = J(r);
ok('scheduled: says which time was chosen', d.status === 'scheduled' && d.chosen && d.chosen.d === '2026-12-10', d);
setPoll(p => { p.status = 'open'; p.chosen = null; p.settings.notify = false; });
const m0 = mails.length;
r = await call('POST', '/huddle/group-poll/answer', { body: { p: POLL.id, k: SHARE, name: 'Quiet', email: 'q@q.co', answers: { o1: 'y' }, startedAt: ago() } });
ok('organizer turned emails off: saved, nobody emailed', r.statusCode === 200 && mails.length === m0);
setPoll(p => { p.archived = true; });
r = await call('POST', '/huddle/group-poll/view', { body: { p: POLL.id, k: SHARE } }); ok('archived poll: 404', r.statusCode === 404);
setPoll(p => { p.archived = false; });

/* ---------- the organizer's read, signed in ---------- */
const login = async (email, password) => J(await call('POST', '/huddle/auth/login', { body: { email, password } })).token;
const tTessa = await login('tessa@example.org', 'tessa-pass-12345678'), tKath = await login('kathryn@example.org', 'kathryn-pass-1234567'), tJ = await login('jc@example.org', 'jonna-pass-123456789');
ok('three test sign-ins', !!(tTessa && tKath && tJ));
r = await call('GET', '/huddle/group-poll/votes', { tok: tTessa }); d = J(r);
ok('organizer reads her own poll’s answers, with emails, never the codes', r.statusCode === 200 && d.docs[POLL.id] && Object.keys(d.docs[POLL.id].voters).length >= 4 && !/codeHash/.test(r.body) && /jordan@bank.example/.test(r.body) && !d.docs[OTHER.id], Object.keys(d.docs));
r = await call('GET', '/huddle/group-poll/votes', { tok: tKath }); d = J(r);
ok('another facilitator sees none of it', r.statusCode === 200 && !d.docs[POLL.id] && !/jordan/.test(r.body));
r = await call('GET', '/huddle/group-poll/votes', { tok: tJ }); d = J(r);
ok('someone on the see-all list sees every poll', !!(d.docs[POLL.id] && d.docs[OTHER.id]));
r = await call('GET', '/huddle/group-poll/votes'); ok('signed out: refused', r.statusCode === 401 || r.statusCode === 403, r.statusCode);
r = await call('POST', '/huddle/group-poll/votes', { tok: tTessa, body: {} }); ok('only GET', r.statusCode === 405 || r.statusCode === 403);
r = await call('GET', '/huddle/file/' + encodeURIComponent('votes/votes.json'), { tok: tJ }); ok('the votes file can’t be read around the route', r.statusCode === 403, J(r));
r = await call('POST', '/huddle/commit', { tok: tJ, body: { files: [{ path: 'votes/votes.json', content: '{}' }], message: 'x' } }); ok('...or written around it', r.statusCode === 403, J(r));
r = await call('GET', '/huddle/data/polls', { tok: tKath }); d = J(r);
ok('polls file is members-only: Kathryn sees only hers', r.statusCode === 200 && d.data.docs[OTHER.id] && !d.data.docs[POLL.id]);

/* ---------- rate limits ---------- */
__resetGroupPollLimits();
let last; for (let i = 0; i < 22; i++) last = await call('POST', '/huddle/group-poll/answer', { body: { p: POLL.id, k: 'WrongWrongWrongWrong12', name: 'x', email: 'x@x.co', answers: { o1: 'y' }, startedAt: ago() }, ip: '198.51.100.9' });
ok('21st answer from one address in an hour: 429', last.statusCode === 429);
r = await call('POST', '/huddle/group-poll/view', { body: { p: POLL.id, k: SHARE }, ip: '198.51.100.10' }); ok('...another address is unaffected', r.statusCode === 200);
r = await call('PUT', '/huddle/group-poll/answer', { body: {} }); ok('wrong method: 405', r.statusCode === 405);

console.log(failed ? `\n${failed} FAILED` : '\nAll passed');
process.exit(failed ? 1 : 0);
