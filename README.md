# Huddle

MISMO's own Doodle, for facilitators and staff, so nobody needs a Doodle subscription. The organizer offers some
times, sends the poll from their own Outlook, sees who can make which time, picks one, and sends their own calendar
invite. Nothing reads anyone's calendar, and nothing is ever emailed to the people being polled.
Live at **https://resources.mismo.org/huddle/**, behind the shared resources.mismo.org sign-in.
The page people answer on, **poll.html**, needs no sign-in.

This repository is **public** and holds **no records**, only the pages. Polls and answers live in the **private**
repository `GitMISMO/huddle-data`, read and saved through the save relay under the project key `huddle`.
No token, key or record is ever kept here.

| File | What it is |
|---|---|
| `index.src.html` → `index.html` | The staff tool's shell: sign-in gate (`requireAccess('huddle')`), masthead, left rail. |
| `huddle.js` | The staff tool: My Polls, New Poll (week picker), the poll panel (answers grid, pick a time, Outlook invite, .ics), System Health, Help. |
| `huddle.css` | Styles. Everything above the `HUDDLE` line is the Scheduler's stylesheet, copied unchanged so the two read as siblings. |
| `rail.js` | The left rail, search and theme button (the Scheduler's, with its own search). |
| `poll.src.html` → `poll.html` | The page people open from the link to mark which times work. No sign-in. |
| `build.py` | Builds `index.html` and `poll.html` and stamps the version. Run `python3 build.py` after any change. |

Opened anywhere other than resources.mismo.org, or with `?preview=1`, both pages run as a **preview** with made-up
polls and save nothing.

## Where things live

| What | Where |
|---|---|
| Polls | `huddle-data/data/polls.json`, `{docs:{<id>:{…}}}`. **Members-only by sign-in** (relay request 9): each person reads and saves only the polls they made (their sign-in email is the poll's only member). My Polls is always just the person's own. Only the see-all list on the polls file in projects.json (Jonna and Vanessa) reads every poll, shown on the Admin Dashboard; the page's `ADMINS` list only decides whether that page shows and must name the same people. Saved by this page. |
| Answers | `huddle-data/votes/votes.json`, `{docs:{<poll id>:{voters:{<voter id>:{…}}}}}`. Written **only** by the relay's no-sign-in routes (relay request 12) when someone answers through a link. Outside the project's `writable` folders, so no page can read or write it around those routes. The staff page reads it through `GET /huddle/group-poll/votes` and never writes it, so a save from the page can never land on an answer it hasn't seen. |
| Answers typed in by hand, people taken off | On the poll itself (`manual`, `hiddenVoters`). Nothing is ever deleted: archived polls and removed answers can be brought back. |
| Email when someone answers | Sent by the relay through the platform's Power Automate mail flow, to the poll's organizer only, unless the organizer turned it off on that poll. |
| Emails to people being polled, calendar invites | Never sent from here. Buttons open a draft in Outlook on the web (or the person's email app), or download an `.ics` file; the organizer presses Send. |

A person needs **Huddle** access (Edit) in People & Access.

## Links

- Shared link: `poll.html#p=<poll id>&k=<poll code>`
- Personal link for one invited person: `poll.html#p=<poll id>&i=<invitee id>.<code>` (name and email filled in)
- Edit link, handed back after answering: `poll.html#p=<poll id>&v=<voter id>.<code>` (also remembered in that browser)

Codes are random, made in the organizer's browser (voters' by the relay), kept only in the private data repository
(voters' codes only as hashes), and sit after the `#`, so they are never in an address a server logs.

## Relay routes (relay request 12)

`GET /group-poll/ready`, `POST /group-poll/view`, `POST /group-poll/answer` (no sign-in) and `GET /group-poll/votes`
(signed in). Switched on by `"groupPolls": true` on the `huddle` entry in projects.json. Until then the page
says so on System Health and organizers type answers in by hand. The patch and its tests are in
`_internal/relay-request-12/`.

## Updating

Before uploading a new copy of a page, download the current one from GitHub first and make your changes to that
copy. Uploading an older copy silently undoes everything that changed since. Run `python3 build.py` and add a line
to `CHANGELOG.md`.

Storage keys are `tools:huddle:<name>`. The pages never call `localStorage.clear()`.
