# moodleflow — bleh for Moodle (userscript)

[bleh](https://github.com/katelyynn/bleh) by katelyn, ported to Moodle as a Violentmonkey/Tampermonkey userscript.
GPL-3.0-or-later, like bleh: the stylesheets in `vendor/bleh/` are bleh's own, copied unmodified.

## Install

1. Install Violentmonkey (or Tampermonkey).
2. Open https://moodleflow.tomasps.workers.dev/moodleflow.user.js (or build it, below, and open `moodleflow.user.js`).
3. Add your site to the `@match` line in the metadata block if it isn't the one listed.

Settings live in your account menu → **moodleflow settings** (or `#moodleflow/visual` in the URL), with bleh's own pages:

- **Visual** — themes (Light, Ink, Rosé Pine Dawn, NieR / Dark, Darker, Void, Rosé Pine, Kanagawa), "adapt to my device" day/night pair, solarium glass, noise, card vibrancy, gloss, accent colour (presets, hue, vibrancy, lightness, follow the course/profile artwork), fonts (stylised / simple / hyperlegible / custom, serif, emoji, three weights), avatar shape, cover disc, glow, animated-image handling, rain.
- **Interface** — blurred backdrop (+ custom image), full-width content, the quick switcher (Ctrl/⌘ + K or `/`; finds courses, the sections and activities of the page you are on, pages and settings), and course helpers: a compact **section list** in the sidebar (replaces the classroom theme's tile carousel; on full course pages it follows your scroll), **file preview** (PDFs, images, video, audio and text open in a dialog with ←/→ between the page's files; Ctrl/⌘/Shift-click opens normally; Office files and pages fall through to the normal link) and `[` / `]` for the previous / next section.
- **Accessibility** — reduced motion (also follows the OS), reduced flashing, underline links, show scrollbar.
- **Seasonal** — bleh's season timeline (re-tints the page and drops snow/leaves on its dates), particle level, performance mode, overlays, masks.
- **General / Advanced** — header branding, **updates** (checks the site's `moodleflow.meta.js` about twice a day, shows a toast and an *Update* button that opens the install page; Violentmonkey also polls `@updateURL` itself), about, copy page structure, reset. Search, import/export/reset are in the sidebar.

Left out because they only exist for Last.fm's music data: scrobbles, tracks, charts, corrections, collages, profile badges, Last.fm API/translations, and bleh's Yuzu theme (it relies on markup Moodle doesn't have).

## What maps to what

| bleh (Last.fm) | here (Moodle) |
| --- | --- |
| masthead: logo, Charts/Minis, search, account | site name, primary navigation, search, notifications, messages, user menu (Moodle's own popovers are moved in, so they keep working) |
| page header + cover | page title + course image / profile photo |
| tab row (Home / Wiki / …) | secondary navigation (Course / Participants / Grades / …) |
| content card, main + sidebar | `#region-main` + blocks |
| blurred album backdrop + album accent colour | course image / profile photo, blurred; the accent follows its average colour |
| settings page | settings page, opened in place |

## Build

```sh
./build.sh        # needs esbuild; writes moodleflow.user.js
bun check.ts      # pure-logic checks
bunx tsc -p tsconfig.json
```

`vendor/bleh/index.css` is a subset of bleh's `styles/index.css`; `src/styles/moodle.css` is the adapter that undoes class
collisions (`.icon`, `.content`, `.btn`…) and re-skins Moodle widgets with bleh's tokens.

## Other Moodle sites / themes

Tested against stock Moodle 4.5 (Boost) and the public login of the Alexia "classroom" theme. If a custom theme's navigation
doesn't show up, run the menu command **moodleflow: copy page structure** and send the output — it contains tags, ids and
classes only, no text.

## Performance

Every navigation re-runs the script, so its cost is paid on each page. What it does about that:

- **Smaller stylesheet.** `build.mjs` bundles bleh's styles *without* the Last.fm-only parts (music, profiles, minis, events…),
  drops Google Fonts `@import`s (`src/fonts.ts` loads only the families in use, as one request), drops unused icon
  definitions, and moves multi-hundred-KB embedded images (seasonal decorations, theme papers) into chunks that are only
  injected when a season/theme needs them. 1.4 MB → ~0.5 MB core. `vendor/bleh/` itself is untouched.
- **Chunks load with the main sheet, never later.** Adding a stylesheet after the page is styled restyles every element
  (≈100 ms each on a real course page), so deferred chunks cost more than loading them up front.
- **Shell built at `interactive`**, not `DOMContentLoaded` (which waits for Moodle's deferred scripts), with the original
  page hidden by `opacity` (not `visibility`: that is inherited and restyles everything) until then, 2.5 s failsafe.
- **Caches** (Violentmonkey storage): course images by link id, course titles (quick switcher), and per image the blurred
  backdrop + its accent colour. A revisited course paints its backdrop instantly and sets the accent *before* the page is
  parsed (changing a custom property later restyles the whole document).
- **Incremental work.** One MutationObserver for the script; handlers get only the newly added subtrees. The "leftover
  colours" sweep runs in idle slices of a few ms and never blocks input.
- Pages on this site are `no-store`, so the browser can't cache or prefetch them (and prefetching Moodle pages would
  record false "viewed" events and could trigger view-based activity completion), so none of that is attempted.

Debugging: `localStorage["mf:off"] = "shell,fix,backdrop"` (comma list of `apply, lazy, fonts, icons, shell, extras, fix,
backdrop, hide`) skips those modules; `performance.getEntriesByType("measure")` lists `mf:*` timings.
