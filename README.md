# MoodleFlow

A modern, fast, fully client-side web interface for your existing Moodle site. MoodleFlow talks directly to your Moodle's Web Services API from the browser — there is no backend, no account system, and no server that ever sees your Moodle credentials.

## Architecture

```
Browser (Next.js app on Cloudflare Workers)
   │  fetch() directly, in the browser
   ▼
Your Moodle site's REST web service (webservice/rest/server.php)
```

- Your Moodle site URL and web service token are entered once in the app and stored only in that browser's `localStorage`. They are never sent to any MoodleFlow server, because there isn't one — MoodleFlow ships as a static/edge-rendered app with no per-user backend state.
- Because the browser calls your Moodle site directly, **your Moodle site must allow cross-origin requests from the origin MoodleFlow is served from** (Site administration → Server → HTTP → *Allowed CORS origins*, available on Moodle 4.3+). Without this, requests will fail with a network/CORS error and MoodleFlow will show a "Moodle isn't responding" state.
- A built-in demo/mock mode (the "Try the demo instead" button on the connect screen) lets you explore the full UI with realistic sample data, no Moodle server required.

## Technology stack

- [Next.js](https://nextjs.org/) (App Router) + React + TypeScript
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) via [OpenNext](https://opennext.js.org/cloudflare) + Wrangler
- Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com/) (Radix primitives) + [Lucide](https://lucide.dev/) icons
- [Bun](https://bun.sh/) as the package manager and script runner

## Requirements

- [Bun](https://bun.sh/) 1.x
- A Cloudflare account (for deployment)
- A Moodle site (4.x recommended) with Web Services enabled, for real integration — optional, thanks to demo mode

## Installation

```bash
bun install
```

## Development

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll land on `/connect` — either paste a Moodle site URL + web service token, or click "Try the demo instead" to explore with mock data.

## Moodle setup

MoodleFlow is a Web Services client. On your Moodle site:

1. **Site administration → Advanced features**: enable *Web services*.
2. **Site administration → Server → Web services → Manage protocols**: enable the *REST protocol*.
3. **Site administration → Server → Web services → External services**: use the built-in "Moodle mobile web service" (it already exposes the functions below), or create a custom service and add the needed functions.
4. **Site administration → Server → Web services → Manage tokens**: create a token for the user who will sign into MoodleFlow, scoped to that service.
5. **Site administration → Server → HTTP → Allowed CORS origins**: add the origin MoodleFlow is served from (e.g. `http://localhost:3000` for local dev, your production URL for deployment). Required because the browser calls Moodle directly.

### Web service functions used

| Feature | Function |
| --- | --- |
| Site info / current user | `core_webservice_get_site_info` |
| Courses | `core_enrol_get_users_courses` |
| Course content | `core_course_get_contents` |
| Calendar | `core_calendar_get_calendar_upcoming_view` |
| Assignments | `mod_assign_get_assignments` |
| Grades | `gradereport_user_get_grade_items` |

Moodle installations vary by version and enabled plugins. If a function is unavailable, the affected page shows a graceful empty/error state rather than crashing — it never assumes every installation supports everything.

## Building

```bash
bun run build     # Next.js production build
bun run check     # build + full TypeScript check
```

## Cloudflare preview & deployment

```bash
bun run preview   # build with OpenNext and preview locally against the Workers runtime
bun run deploy    # build and deploy to Cloudflare Workers
```

Cloudflare configuration lives in `wrangler.jsonc`. No bindings (KV, D1, R2, etc.) are used — the app needs none, since all state lives in the browser.

## Environment variables

None are required. See `.env.example` — it's kept for parity with the base template and any future build-time config, but MoodleFlow has no server-side secrets to configure.

## Project structure

```text
src/
  app/
    (auth)/connect/       Moodle connection screen
    (app)/                Authenticated app shell: dashboard, courses, calendar,
                           assignments, grades, notifications, settings, profile
  components/
    ui/                   shadcn/ui primitives
    layout/                Sidebar, topbar, mobile nav, app shell
    navigation/            Command palette (⌘K)
    courses/ assignments/ activities/   Domain components
    providers/              Theme + Moodle connection context
  lib/
    moodle/
      client.ts            Real Moodle REST client (browser fetch)
      mock.ts               Demo-mode client with realistic sample data
      normalize.ts           Raw Moodle payload → MoodleFlow domain types
      connection.ts           localStorage-backed connection storage
  hooks/                    useMoodleQuery data-fetching hook
  types/moodle.ts            Domain models (MoodleCourse, MoodleAssignment, …)
```

## Security considerations

- Moodle tokens never leave the browser and are never logged.
- All Moodle API calls happen client-side over HTTPS to the URL you provide; MoodleFlow has no server component that stores or proxies your data.
- Disconnecting (Settings → Disconnect) clears the stored connection from `localStorage`.

## Versioning and changelog

Versions follow [SemVer](https://semver.org/) and live in `package.json`; the changelog is `CHANGELOG.md` (rendered in-app at `/changelog`). To release: add entries under `Unreleased`, rename it to the new version, then `bun pm version <patch|minor|major>` and deploy. A test fails if the newest changelog entry and `package.json` disagree.
