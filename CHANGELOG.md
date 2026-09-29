# Changelog

All notable changes to MoodleFlow. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [Semantic Versioning](https://semver.org/) (0.x: minor = features, patch = fixes).

To release: move the `Unreleased` entries under a new `## [x.y.z] - YYYY-MM-DD` heading, then run `bun pm version <patch|minor|major>`.

## [Unreleased]

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
