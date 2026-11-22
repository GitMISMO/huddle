# Relay Request 12: Huddle (for Perry)

Requested by Jonna, Nov 22, 2026. Huddle is MISMO's own Doodle for facilitators and staff, at
resources.mismo.org/huddle/. People outside MISMO answer a poll through a link with no sign-in, like the
Scheduler's guests, so the relay needs three no-sign-in routes and one signed-in read.

## What to do

1. **Add the data repo to the relay's GitHub token:** `GitMISMO/huddle-data` (private).
2. **Apply the patch** `relay-request-12-huddle.patch` to `initiative-hub/_dev/aws/index.mjs`, add
   `test-huddle.mjs` beside the other tests, and deploy. The patch is made against initiative-hub commit
   `330d7c1` (Nov 20, 2026). `node test-huddle.mjs`: 57 checks, all pass, and every existing test file still
   passes unchanged (test-relay 184, test-scheduler 32, and the rest).
3. **projects.json**: merge pull request #22 in GitMISMO.github.io (https://github.com/GitMISMO/GitMISMO.github.io/pull/22), which adds the `huddle` entry below. `"groupPolls": true`
   does nothing until the patch is deployed, then switches the routes on. The see-all list on the polls file is Jonna and
   Vanessa only (both their sign-in addresses): everyone else sees only their own polls (Jonna's decision, Nov 22, 2026).

```json
"huddle": {
  "repo": "GitMISMO/huddle-data",
  "branch": "main",
  "origin": "https://resources.mismo.org",
  "writable": ["data/"],
  "membersOnly": { "polls": ["jcritchley@mismo.org", "jcritchley@mba.org", "vrios@mismo.org", "vrios@mba.org"] },
  "groupPolls": true
}
```

## What the patch adds

- `GET /huddle/group-poll/ready`, `POST /group-poll/view`, `POST /group-poll/answer`: no sign-in, for poll.html.
  A respondent gets in with the poll's shared code (`k`), a personal invitee link (`i`), or the edit link `/answer`
  hands back (`v`). Codes are compared in constant time; voters' codes are stored only as sha-256 hashes; a wrong
  code answers exactly as a missing poll does (404).
- `GET /huddle/group-poll/votes`: signed in. Returns answers only for polls the caller is a member of (all of
  them for the polls file's see-all list: Jonna and Vanessa). Never the codes. View as sees none.
- Answers are written only to `votes/votes.json`, which sits outside `writable`, so `/data`, `/file` and `/commit`
  can't read or write it. The staff page saves `data/polls.json` (members-only) and never touches answers, so a page
  save can't land on an answer it hasn't seen (the issue that held back the Scheduler's guest links).
- Same guards as the Scheduler's guest routes: Origin required, honeypot field, 2-second minimum, per-address and
  overall hourly limits (120 views, 20 answers per address; 400 answers in all), 16 kB cap, every field checked.
  Respects the poll's settings: if need be on/off, one choice, limit per time (409 FULL), email required/optional/off,
  comments, deadline, closed/scheduled/archived.
- Emails the poll's organizer through `sendMail` (kind `huddle-answer`) when someone answers, unless the
  organizer turned that off on the poll. Nothing is ever emailed to a respondent.
- Only the `huddle` project, and only with `"groupPolls": true` exactly; anything else answers 404.
