# Changelog

All notable changes to MoodleFlow. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [Semantic Versioning](https://semver.org/) (0.x: minor = features, patch = fixes).

To release: move the `Unreleased` entries under a new `## [x.y.z] - YYYY-MM-DD` heading, then run `bun pm version <patch|minor|major>`.

## [Unreleased]

### Added
- Wikis: read pages, switch between class/group/user wikis, follow wiki links in the app, and see attached files.
- Wikis: create pages and edit existing ones (the page is locked in Moodle while you edit; pages in non-HTML markup open in Moodle instead).

## [0.14.0] - 2026-10-07

### Added
- In-app updater (Settings > General): check for a newer deploy, see its version, and reload into it; the Settings tab shows a dot while an update is waiting.
- Settings redesigned after bleh: tabs (General, Visual, Interface, Notifications, Seasonal, Accessibility, Advanced), search, and Import / Export / Reset of your settings.
- Visual settings: theme picker with previews, noise overlay opacity and card background vibrancy sliders, live colour palette.
- Seasonal timeline with the current season's start and end dates, and the particle options alongside it.
- Export and import your settings as a JSON file; the Settings sidebar also shows the running build.
- Dashboard: cover-flow course carousel, a sidebar with quick links and deadlines, and the page content now sits in a glass panel.

### Changed
- The default content width is wider (80rem).

## [0.13.0] - 2026-10-01

### Added
- File preview: Print, "Ask AI" (Claude, ChatGPT, T3 Chat, Gemini with a prefilled explain / summarise / quiz / code-review prompt, plus a copyable Claude Code command) and "Open in…" (VS Code, Cursor, Zed, JetBrains and more for code; suggested apps and the system share sheet for other files). Nothing is sent anywhere until you click, and your Moodle token never goes into an AI link.

## [0.12.0] - 2026-09-30

### Added
- Quizzes: overview with rules, attempts and best grade; take an attempt (autosave, navigation panel, timer, flag questions, summary and submit); review attempts as far as the quiz's review options allow. Unsupported question types show read-only with a link to Moodle.
- Lessons: branching pages, question pages, progress, grade and review.
- Workshops: phase planner, submissions with files, peer assessment forms, received assessments and grades.
- Choice, Feedback and Survey activities: vote and see results, multi-page feedback forms with analysis, and survey answers.
- H5P activities (embedded player and attempts), SCORM 1.2 packages (sandboxed player that saves tracks) and external tools (LTI launch in a new tab).

## [0.11.2] - 2026-09-29

### Security
- Upgraded Next.js to 16.3.x and the OpenNext Cloudflare adapter to 1.20.x, fixing all open dependency advisories.

## [0.11.1] - 2026-09-29

### Fixed
- Message people search also finds classmates and teachers from your courses, not only the people Moodle's own search exposes.

## [0.11.0] - 2026-09-29

### Added
- Forums: read discussions and threaded posts, start discussions, reply, edit, delete and attach files. Subscribe, star, pin and lock per discussion, and rate posts. Course pages open forums inside MoodleFlow.
- Messages: conversations with live polling, unread badge in the sidebar, people search, contacts, requests and blocking, star, mute and delete.
- Notification preferences in Settings (per type and channel).
- Notifications: paging, course and type filters, and links that open the matching MoodleFlow page instead of Moodle.
- Chat activities: live room with participant list and past sessions.
- BigBlueButton meetings: join and watch recordings.

## [0.10.4] - 2026-09-29

### Added
- Right-click a course block to hide it in this course or in all courses; a "Show hidden blocks" button brings them back.

## [0.10.3] - 2026-09-29

### Changed
- Dashboard activity heatmap counts what you did (activities completed, work submitted, items graded) instead of only graded items.
- Redesigned course cards: taller banner with a readable overlay, "Done" marker for finished courses.

### Fixed
- Course blocks no longer flash and vanish: only known-noisy blocks (Navigation, Timeline, Info, notes, ...) and blocks with unreadable escaped markup are hidden, instead of showing only a short allowlist.
- Course banners load from your Moodle site (also when the course list omits them) and course images use the authenticated file URL.

## [0.10.2] - 2026-09-29

### Changed
- Course blocks now live in the sidebar under the section list (below the content on small screens) instead of above the sections.

## [0.10.1] - 2026-09-29

### Fixed
- Course blocks: only announcements, upcoming events, recent activity, HTML and online-users blocks are shown; Navigation, Timeline, Info and third-party blocks no longer clutter every course.

## [0.10.0] - 2026-09-29

### Added
- Page, book, folder and IMS package activities open in an in-app reader (book chapters with previous/next).
- URL activities open the external link directly.
- File previews for Word (.docx), Markdown, CSV, Jupyter notebooks, audio and video.
- Manual "mark as done" on activities, completion requirements, and a course completion card with self-complete.
- Participants tab with search, role and group filters.
- Course side blocks (announcements, latest news, upcoming events).
- "Updated" badge on activities changed since your last visit.
- Restricted activities and sections show Moodle's availability message.
- Grades and Participants tabs follow what your Moodle allows.

## [0.9.0] - 2026-09-29

### Added
- Rich-text editor for online-text submissions (bold, italic, lists); existing submissions keep their formatting when edited.
- Rubric and marking-guide results in "Grade and feedback".
- Granted extensions become the due date, shown as "extended from …".
- Group assignments use the shared team submission and say so on the detail page.
- Assignments list: course filter and due-date sort.

### Fixed
- Demo mode showed "isn't enabled" on every gated page (Assignments, Grades, …).

## [0.8.0] - 2026-09-29

### Added
- Developer mode: tap the version number in Settings > About seven times to unlock a Developer tools page with a toast tester (every type, position, duration, promise and stacking scenarios), UI state previews and diagnostics.

### Changed
- Toasts have more contrast on dark and OLED themes: a lighter surface, a hairline ring and a deeper shadow.

## [0.7.1] - 2026-09-29

### Fixed
- The changelog page returned an internal server error in production; releases are now built into the app instead of read from disk.

## [0.7.0] - 2026-09-29

### Added
- After you reload for an update, a popout shows what's new in that version.

### Changed
- Notifications now use the Sileo toast library, including the update prompt.
- The courses and dashboard pages show a not-enabled state when the site lacks the courses function.

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
