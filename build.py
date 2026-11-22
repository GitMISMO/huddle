#!/usr/bin/env python3
"""Builds the two pages from their sources. Run after changing anything: python3 build.py
index.src.html -> index.html   (stamps the version and the ?v= on huddle.js, huddle.css and rail.js)
poll.src.html  -> poll.html    (puts the MISMO logo in)
The version is the build time (UTC) and a fingerprint of the files, shown on System Health and Help."""
import hashlib, datetime, pathlib
here = pathlib.Path(__file__).parent
fp = hashlib.sha256(b''.join((here / f).read_bytes() for f in ['huddle.js', 'huddle.css', 'rail.js', 'poll.src.html', 'index.src.html'])).hexdigest()[:8]
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
v = fp
idx = (here / 'index.src.html').read_text().replace('__V__', v).replace('__BUILD__', f'{stamp} · {fp}')
(here / 'index.html').write_text(idx)
logo = (here / '_internal' / 'logo-symbol.svg').read_text()
(here / 'poll.html').write_text((here / 'poll.src.html').read_text().replace('__LOGO__', logo))
print('built', stamp, fp)
