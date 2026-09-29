# Security and the CORS proxy

## Where your token lives

MoodleFlow talks to your Moodle site straight from your browser. Your Moodle web service token is stored
in this browser's `localStorage` (`moodleflow.connection`) and is never sent to any MoodleFlow server,
with one opt-in exception: the proxy below.

Risks to know about:

- Anything that can run script on this origin (a browser extension, an XSS bug) can read the token.
  Teacher-written Moodle HTML is sanitised with DOMPurify before rendering to limit that.
- The token is added to file URLs (`pluginfile.php`) so images and downloads work. That only happens for
  the Moodle host; URLs on any other host are left untouched (covered by tests).
- Cached course data (IndexedDB) is cleared on sign-in, sign-out and when a session expires.
- Tokens don't expire on their own. Signing out removes the token from this browser but can't revoke it.
  To invalidate it everywhere, delete the mobile app key in Moodle under *Preferences > Security keys*
  (Settings > Account > Manage tokens opens that page).
- If Moodle reports the token as invalid, MoodleFlow signs you out and returns you to the login page
  with your site pre-filled.

## The optional CORS proxy

Browsers only let MoodleFlow call your Moodle if the site sends CORS headers (Site administration >
Server > HTTP > Allowed CORS origins). If it doesn't, tick *route traffic through MoodleFlow's proxy* on the
login page. Requests then go to `/api/moodle/...` on this deployment, which forwards them to your site.

The proxy is deliberately narrow so it can't be used as a general relay:

- Only `webservice/rest/server.php`, `webservice/upload.php`, `webservice/pluginfile.php/*` and
  `login/token.php` are forwarded.
- The target must be a public HTTPS host: no IP addresses, `localhost`, `.local`/`.internal`, ports or
  embedded credentials.
- Redirects are not followed, cookies are not forwarded, responses are `Cache-Control: no-store`, and
  nothing is logged or stored.

When the proxy is on, your token passes through this deployment's Worker for each request. Self-host
MoodleFlow if you don't want to trust a shared deployment with that.
