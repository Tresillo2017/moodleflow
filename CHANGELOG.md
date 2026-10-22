# Changelog

## [Unreleased]

## [0.16.12] - 2026-10-22
### Fixed
- The file picker (and other dialogs) opened from inside an activity popout was see-through, so the submission form showed through it; dialogs are now opaque there.

## [0.16.11] - 2026-10-22
### Fixed
- Assignment pages on the classroom theme lost their description, attached files and "To do" box: the activity header lives outside the main region there and is now moved into the page with it.

## [0.16.10] - 2026-10-20
### Changed
- The dashboard's calendar is interactive: the week strip no longer opens the calendar page. Pick a day to list just its deadlines, page through weeks with the arrows, and jump back with "Today".

### Fixed
- The course grid and "Continue" were hidden on sites where the main region is wrapped twice (our own container was being hidden along with Moodle's); the site's own toolbar on the home page is hidden too.

## [0.16.9] - 2026-10-20
### Fixed
- The dashboard and the user-menu icons now work on this site's page markup: pages without `#region-main` use `#region-main-box`, and the user menu's icons (and the update dot) also match the classroom theme's `.usermenu` dropdown.

## [0.16.8] - 2026-10-20
### Changed
- The new dashboard now follows bleh's profile layout: the page header carries the greeting, the date and your numbers (courses, due, overdue, new); the main column has "Continue" and a cover grid of **all** your courses with All / In progress / Past / Favourites tabs and a filter; the sidebar column holds due soon (with the week strip), recently visited pages and shortcuts as flat sections with bleh's list rows.

## [0.16.7] - 2026-10-20
### Fixed
- "Copy page structure" no longer fails with "Clipboard blocked": it uses the script manager's clipboard, and otherwise shows the text in a box with Copy / Save as file buttons.

## [0.16.6] - 2026-10-20
### Fixed
- The new dashboard now also replaces the "current subjects" page (`/local/docencia/actual/`) that this site lands on after login.

## [0.16.5] - 2026-10-20
### Changed
- The in-app updater checks every 30 minutes (and when you come back to the tab) instead of every 12 hours, shows a dot on your avatar and an "Update to vX" entry in the user menu while an update is waiting, and walks you through it: Update opens the install dialog, then offers "Reload now" once it closes. "Later" snoozes the toast for 6 hours instead of forever.

## [0.16.4] - 2026-10-20
### Changed
- The new dashboard also loads on the site front page (when logged in), paints instantly from what it remembers (skeleton cards on the first visit), and has a polished look: drifting accent glow, staggered entrance, pointer-follow highlights, covers that zoom, progress bars that grow, clickable week days, and a course filter. All of it respects reduced motion.

## [0.16.3] - 2026-10-20
### Added
- New dashboard layout: a greeting with due / overdue / new counts and quick links, a "Continue where you left off" card, your courses as cover cards with progress, and a week strip above the due list. Toggle: "New dashboard layout" (off restores Moodle's blocks; edit mode always shows them).
- "What's new" dialog in bleh's newspaper style, built from this changelog: open it from the user menu or Settings → General, and after an update a toast offers it once.
- File type icons: file activities show a real file-type icon (PDF, PowerPoint, Excel, Word, SQL, ZIP, image, video, audio, code, text; Tabler Icons, MIT) in its own colour instead of the generic icon. Toggle: "File type icons".
- Icons in the user menu: every entry (profile, grades, calendar, messages, files, reports, preferences, language, log out) gets one of bleh's icons.

### Fixed
- Padding and alignment of our own text buttons (dashboard quick links, Resume, toasts, chips).
- Text buttons using the icon-only style showed nothing (download all, hidden courses, "mark read", file preview arrows).
- The "new" marker on an activity showed twice.

## [0.16.2] - 2026-10-20
### Added
- Activities (assignments, forums, pages, books …) open in a popout over the course instead of a new page; Ctrl/⌘/Shift-click still opens normally. Toggle: "Open activities in a popout".
- Submitting an assignment now shows a working state on the button, then pops the status and rains confetti when it lands (respects reduced motion). Toggle: "Celebrate submissions".

### Changed
- Course page layout: sections are single cards, activities are rows with an icon, sidebar blocks follow bleh's text hierarchy, and the assignment status table is a key / value card list.

## [0.16.0] - 2026-10-20

### Added
- Userscript 0.16.0: "Due soon" and "Continue" cards on the dashboard, scroll-position restore, "new" markers on activities and course cards, pin / rename / hide on course cards, "Download all files" in the section list (when the site offers it), and more keyboard shortcuts (`g` then `d c a g m p`, `j` `k`, `?`).
- Rubric ("Grade breakdown") restyled: criteria rows, level cards, points pills and a highlighted awarded level.

### Changed
- The repository is now the moodleflow userscript (a bleh port for Moodle). The web app it used to ship has been discontinued.
- This site is a static landing page (ported from bleh-www) with the install wizard and redirects for the old links.
