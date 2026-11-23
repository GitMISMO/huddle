# Huddle checks

`npm test` runs `tests/run.js`: thirteen checks against the pages in PREVIEW mode (made-up polls built into
huddle.js), so nothing real is read, saved or sent. GitHub runs them on every upload
(`.github/workflows/checks.yml`) and publishes the site only when they all pass.

| Check | What it catches |
|---|---|
| Every script parses | A typo that would stop a page loading |
| No tokens, keys or passwords | A secret pasted into this public repository |
| Storage keys namespaced, no localStorage.clear() | Breaking another tool's browser storage on the shared site |
| Built pages match their sources | Editing index.html or poll.html directly instead of the .src files, or forgetting `python3 build.py` |
| No pill-shaped buttons or tags | Jonna's design rule: squared-off corners only |
| Every page opens (light and dark) | A page that throws an error in either theme |
| Make a poll ... make the invite | The organizer's whole round: new poll, email draft, typed-in answer, pick a time, .ics |
| Archive and removed answers come back | Archive and Bring Back work |
| Delete removes a poll after asking | Delete warns first and the poll is gone |
| Answering works on a phone | The answer page: times load, three answers, send, the edit link is remembered, no sideways scroll |
| Incomplete link | The plain message when a link is cut short |
| Search | The rail search finds polls and people |

To run them on your own machine: `npm install`, `npx playwright install chromium`, `npm test`.
Run one check: `node tests/run.js search`.

The relay's own tests for Huddle's answer routes are in `_internal/relay-request-12/test-huddle.mjs`
(run beside the relay in initiative-hub `_dev/aws/`).
