# Working on Huddle

Huddle is MISMO's own Doodle, for facilitators and staff, so nobody needs a Doodle subscription. An organizer offers some
times, sends the poll from their own Outlook, sees who can make which time, picks one, and sends their own calendar
invite. It is deliberately **not automatic** like Vanessa's Scheduler: it never reads anyone's calendar and never emails
the people being polled. It lives at **resources.mismo.org/huddle/**; the page people answer on is
**resources.mismo.org/huddle/poll.html** (no sign-in). Owner: Jonna Critchley. Read this file first, then the **Help**
page inside the tool (`renderHelp` in `huddle.js`), which is the user guide and must be updated with every change people
would notice.

## What Is Where

| File | What it is |
| --- | --- |
| `index.src.html` | The staff tool's shell: sign-in gate, masthead, left rail. **Edit this, not `index.html`.** |
| `huddle.js` | The staff tool: My Polls, New Poll, the poll panel, Admin Dashboard, System Health, Help, saving, the preview's made-up polls. |
| `huddle.css` | Styles. Everything above the `HUDDLE` line is the Scheduler's stylesheet, copied unchanged so the two read as siblings; Huddle's own rules are below it. |
| `rail.js` | The left rail, search and theme button (the Scheduler's, with Huddle's own search and tab list). |
| `poll.src.html` | The page people answer on, styles and script in one file. **Edit this, not `poll.html`.** |
| `build.py` | Builds `index.html` (version stamp and `?v=` on the scripts) and `poll.html` (puts the logo in). Run after every change. |
| `tests/` | The automatic checks (`npm test`); see `tests/README.md`. |
| `.github/workflows/checks.yml` | Runs the checks on every upload and publishes the site only if they pass. |
| `_internal/relay-request-12/` | The relay change Huddle needs for answering through links, its tests, and the request to Perry. |
| `CHANGELOG.md` | One line per change people would notice. Add one with every upload. |

`_internal/` is not served by the website (GitHub Pages skips folders starting with `_`), but this repository is public:
nothing private ever goes anywhere in it.

## Where the Data Lives

All data is in the **private** repository `GitMISMO/huddle-data`, reached only through Perry's save relay under the project
key `huddle` (entry in `GitMISMO.github.io/_internal/projects.json`), after the shared resources.mismo.org sign-in
(`/assets/session.js`).

| File | Written by | Shape |
| --- | --- | --- |
| `data/polls.json` | This page (`PUT /huddle/data/polls`) | `{docs:{<poll id>:{…}}}`, **members-only** |
| `votes/votes.json` | Only the relay's answer route | `{docs:{<poll id>:{voters:{<voter id>:{…}}, updatedAt}}}` |

**A poll** (`data/polls.json`): `id`, `members` (the organizer's sign-in email; the relay filters on it), `owner`,
`ownerName`, `title`, `about`, `where`, `duration` (minutes), `tz` (the zone it was made in), `options` (`{id, s, e}` in
milliseconds, or `{id, d:'YYYY-MM-DD'}` for a whole day), `settings` (`ifNeedBe`, `hidden`, `oneVote`, `limit`,
`askEmail` = `required`|`optional`|`off`, `comments`, `deadline` ms or null, `notify`), `code` (the shared link's code),
`invitees` (`{id, name, email, code, addedAt, removed?}`), `status` (`open`|`closed`|`scheduled`), `chosen`, `scheduledAt`,
`inviteAt`, `manual` (answers typed in by hand, keyed like voters), `hiddenVoters` (answers taken off, by id),
`archived`, `createdAt`, `updatedAt`, `updatedBy`, `log`.

**An answer** (`votes/votes.json`): `name`, `email`, `answers` (`{<option id>: 'y'|'m'|'n'}`), `comment`, `at`, `created`,
`invitee` (when they came through a personal link), `codeHash` (sha-256 of their edit code; the plain code exists only
in their link and their browser).

**Who sees what.** `data/polls.json` is members-only (relay request 9): each person reads and saves only polls listing
their sign-in email. The see-all list on that file in projects.json is Jonna and Vanessa (both their @mismo.org and
@mba.org addresses); they see every poll on the **Admin Dashboard**, and My Polls is still only their own. The page's
`ADMINS` list in `huddle.js` only decides whether the Admin Dashboard shows; it must name the same people, but the relay
is what actually decides. People answering never see an email address, and in a hidden poll no one else's answers.

**Saving never loses work.** A change is kept in the browser (`tools:huddle:unsaved:<email>`) until the relay has it.
Each save reads the file as it is now and lays this page's changed polls over it, so a poll saved elsewhere is kept.
The page never writes `votes/votes.json`, so a save from here can never land on an answer that arrived meanwhile (the
reason the Scheduler's guest links shipped switched off). An expired sign-in brings up "Sign in to finish saving" and
the same save goes again.

**Archive first; Delete only on purpose.** Polls are archived (`archived:true`) and brought back; answers are taken off
with `hiddenVoters` and brought back. **Delete** (Jonna's decision, Nov 22, 2026) removes a poll from `data/polls.json`
for good after a confirmation: the page queues the poll as `null` in its pending changes and the save drops it from the
file. Its link then answers 404. Its answers stay in `votes/votes.json` (the page can't write that file) but nothing
shows them once the poll is gone; GitHub's history of `huddle-data` still holds the deleted poll if it's ever needed.

## Links

- Shared link: `poll.html#p=<poll id>&k=<poll code>`
- Personal link: `poll.html#p=<poll id>&i=<invitee id>.<code>` (name and email filled in; ties their answer to them)
- Edit link: `poll.html#p=<poll id>&v=<voter id>.<code>`, handed back by `/answer` and remembered in that browser
  (`tools:huddle:me:<poll id>`), so the shared link shows them their own answers next time.

Codes are random (18 bytes, base64url), made in the organizer's browser (the voter's by the relay), and sit after the
`#`, so they are never sent to a server in an address, never logged and never passed on as a referrer.

## Relay Routes (relay request 12)

| Route | Sign-in | What it does |
| --- | --- | --- |
| `GET /huddle/group-poll/ready` | No | `{ok:true}`: the staff page's System Health uses it to show whether answering through links is live |
| `POST /huddle/group-poll/view` `{p, k?, i?, v?}` | No | What someone answering needs: title, description, where, times, settings, others' names and answers (none in a hidden poll), which times are full, their own answer |
| `POST /huddle/group-poll/answer` `{p, k?, i?, v?, name, email, answers, comment, startedAt, website}` | No | Saves that one person's answer; respects every setting; hands back an edit link; emails the organizer unless they turned it off |
| `GET /huddle/group-poll/votes` | Yes | The answers to the caller's own polls (every poll for the see-all list), never the codes |

They are switched on by `"groupPolls": true` on the `huddle` entry in projects.json (done) **and** the relay code being
deployed (relay request 12, Perry). Until then they answer 404; the staff page says so on System Health and in the poll
panel, and organizers type answers in by hand. Guards match the Scheduler's guest routes: Origin required, a honeypot
field, a 2-second minimum, hourly limits per address (120 views, 20 answers) and overall (400 answers), 16 kB cap.

## Emails

- **The only automatic email**: the relay emails a poll's **organizer** when someone answers (`kind: huddle-answer`,
  through the platform's Power Automate mail flow), unless the organizer turned it off on that poll. Jonna asked for it
  (Nov 22, 2026); it goes to the organizer only.
- **Nothing is ever emailed to the people being polled.** Email the Poll, Remind, Email Everyone the Time and the
  calendar invite all open a draft in the organizer's own Outlook (Outlook on the web deep links, or `mailto:`, or an
  `.ics` download for classic Outlook); the organizer presses Send. Keep it that way: Jonna's rule is no automatic sends.

## How It Connects

Every connection is in the **MISMO Connections Map** (Claude Doc `UcBYh3aakukXcjYvjnWBY7`): read it before changing a
connection and update it in the same session. Huddle's rows: people's answers (relay → `votes/votes.json`), the email to
the organizer (relay mail flow), and the Team HQ tile (Team HQ reads `/huddle/`'s title, description, theme color, the
figure boxes and the At a Glance line; it only reads).

Access: each person needs **Huddle** (Edit) in People & Access (Admin Console). Staff are administrators of every tool;
facilitators are added by name. The tool is listed in `GitMISMO.github.io/assets/tools.json`.

## Building, Checking, Publishing

1. Change the sources (`index.src.html`, `poll.src.html`, `huddle.js`, `huddle.css`, `rail.js`).
2. `python3 build.py`.
3. `npm test` (fourteen checks; `tests/README.md`).
4. Add a line to `CHANGELOG.md`.
5. Upload to `main`. GitHub runs **Huddle Checks and Publish**: if every check passes it publishes the site; if one fails
   the site stays on the version before. Emergency only: Actions > Huddle Checks and Publish > Run workflow > Skip the checks.

**Before uploading, download the current copy from GitHub and change that.** Uploading an older copy silently undoes
everything since. Opened anywhere other than resources.mismo.org, or with `?preview=1`, both pages run as a preview with
made-up polls and save nothing; the checks and the Claude artifact preview ("Artifact - Huddle") use that.

## Design Rules (Jonna's)

MISMO brand (navy #0d314c, sky #74bfeb, IBM Plex Sans, never a monospace face), light and dark checked; squared-off
buttons, tags and chips (no pills, the checks enforce a 12px maximum radius); no big empty areas (short lists are
followed by the person's other polls, and the side column carries At a Glance, Latest Answers and Coming Up); each
section is its own page in the left rail; a record opens in the wide right-hand panel; dates are typeable with a
calendar button beside them; explicit Save; Chicago title case on headings and labels; plain language.
Browser tab icon: both pages' `<head>` have exactly one icon line, the shared mismo.org icon
(`<link rel="icon" type="image/png" sizes="48x48" href="https://resources.mismo.org/assets/favicon-48x48.png">`, CN-030);
never a copy of the image in this repository and never an app-specific tab icon.
Masthead (CN-053): Certification Management's, to the pixel, on both pages: a 68px navy bar (`--hq-h:68px`; padding
13px 22px), the logo box 9px 13px with 5px corners and the logo 24px tall, 14px gaps, a 1px divider 42px tall, the name
at 16px/500 in #94c8e9. The rail, the poll panel and anything sticky line up from `var(--hq-h)`, never a fixed pixel
value. On phones (520px and under) only the sides and the logo shrink; the bar stays 68px. No December hat here: the
shared `/assets/holiday.js` (loaded by session.js) does that for every tool.
The browser's Back button (CN-033): `index.src.html` loads the shared `<script src="/assets/back.js"></script>` right
after the session.js line (never a copy in this repository, never Huddle's own `history.pushState`). Each left-menu page,
and Help (`data-back-page="help"`), is a Back step; `huddle.js` registers the poll panel and then a dialog with
`MismoBack.layer` (beside `closePane`), so Back closes the top one first with the same close as its X. Any new panel or
drawer must be registered there too. The check "Back button" covers it.

## Decisions

- Nov 22, 2026: Jonna asked for a Doodle replacement for facilitators and staff, working exactly like Doodle, not
  automatic like the Scheduler, reading no calendars.
- Nov 22, 2026: everyone sees only their own polls, by sign-in; Jonna and Vanessa see everything on an Admin Dashboard.
- Nov 22, 2026: named Huddle (was Meeting Polls during the build); repositories `huddle` and `huddle-data`.
- Nov 22, 2026: organizers (and Jonna and Vanessa from the Admin Dashboard) can Delete a poll for good, after a
  confirmation; Archive stays the gentle choice.
- Nov 22, 2026: access for staff (administrators) and the facilitators Erin Bittenbender, Kellie Stoll, Meghan
  Tidgewell, Leeann Walker, Kathryn Williams and Tessa Bocanegra.
