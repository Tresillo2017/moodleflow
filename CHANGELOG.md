# Changelog

All notable changes to MoodleFlow. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [Semantic Versioning](https://semver.org/) (0.x: minor = features, patch = fixes).

To release: move the `Unreleased` entries under a new `## [x.y.z] - YYYY-MM-DD` heading, then run `bun pm version <patch|minor|major>`.

## [Unreleased]

## [0.6.0] - 2026-09-29

### Added
- Pages that need a web service function your Moodle hasn't enabled now say so instead of failing (`client.supports()`).
- Stale-while-revalidate cache persisted in IndexedDB: pages show instantly on reload, even offline, and refresh in the background.
- Opening a course, assignment or activity in MoodleFlow now tells Moodle, so view-based completion updates.
- File uploads show progress and check the site's size limit before sending.
- Site name from Moodle shown in the sidebar; several requests are batched into one when the site supports it.
- Optional CORS proxy for Moodle sites without CORS headers, and a Manage tokens link to revoke tokens in Moodle. See `docs/security.md`.
- Expired tokens sign you out and return to the login page with your site pre-filled.

### Changed
- Moodle error text no longer reaches the UI; errors map to friendly messages, and failed reads are retried.

### Security
- Files served through the CORS proxy can no longer run script on the app's origin: responses get `nosniff`, and HTML/SVG/XML are forced to download under a sandboxed CSP.
- Moodle rich content drops `<form>` and its controls, so teacher HTML can't post your input to another site.

## [0.5.2] - 2026-09-29

### Fixed
- Page transitions never played (the animation referenced a missing keyframe). Pages now fade and rise 6px in 200ms; reduced motion keeps the fade only.

### Changed
- README rewritten with features, screenshots, Moodle setup, privacy notes, deployment and release steps.
- Repository description, homepage and topics set on GitHub.

## [0.5.1] - 2026-09-29

### Fixed
- Course text with hard-coded colours (black on black) is readable again: teacher colours are stripped so the theme decides.

## [0.5.0] - 2026-09-29

### Added
- In-app updater: open tabs are prompted to reload when a new version is deployed.

## [0.4.1] - 2026-09-29

### Fixed
- Cloudflare builds failing at deploy: `bun run build` now runs the full OpenNext build, not just `next build`.

## [0.4.0] - 2026-09-29

### Added
- Grades page: overall, best, needs-attention and items-graded stats; recently graded list; search and sort (name, highest, lowest); per-item graded date and teacher feedback.

### Changed
- Light mode: tinted page background, crisper card borders and shadows, and stronger muted text contrast.

### Fixed
- Grades page showing no course names on sites whose grade report omits them.
- Activity showing graded items from past courses instead of current ones.

## [0.3.1] - 2026-09-29

### Fixed
- Settings rows squeezing their label into a narrow column next to wide controls (Season).

## [0.3.0] - 2026-09-29

### Added
- Course page sidebar: jump between sections, per-section progress, follows the section in view.
- Section details: summary, item and file counts, next due date, activity descriptions and "text and media" blocks.
- Versioning and this changelog, with a What's new page (`/changelog`) and the version in Settings.

### Fixed
- Grades and Activity failing with "Invalid parameter value detected" on sites that require a course id.

## [0.2.1] - 2026-09-29

### Fixed
- Backdrop blur missing on popovers, cards and tooltips.

### Changed
- Preferences are also backed up in a cookie, and persistent storage is requested, so settings survive cleared site data.

## [0.2.0] - 2026-09-29

### Added
- bleh-inspired redesign: themes, seasons, glass blur, motion and snow.
- Drag and drop files to submit, confetti on submission, notification menu with read all and clear.
- Assignment detail page with status, completion, comments, grade and remove submission.
- In-app viewer for PDFs, images and code; course files, grades and forums; sidebar with pinned courses.

## [0.1.0] - 2026-09-16

### Added
- Initial MoodleFlow: Moodle login, dashboard, courses, calendar, assignments and grades.
