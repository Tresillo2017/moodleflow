# moodleflow

**bleh for Moodle.** moodleflow is a Violentmonkey / Tampermonkey userscript that brings [bleh](https://github.com/katelyynn/bleh)'s themes, glass, motion and layout to Moodle course pages.

> The moodleflow web app has been discontinued. Old links and bookmarks no longer open an app; install the userscript instead.

This repository holds the userscript (in [`userscript/`](userscript/README.md)) and the landing site it is published from (everything else, a static [Next.js](https://nextjs.org) export deployed to Cloudflare).

**Install:** [moodleflow.tomasps.workers.dev](https://moodleflow.tomasps.workers.dev/), or open [`/moodleflow.user.js`](https://moodleflow.tomasps.workers.dev/moodleflow.user.js) directly once you have Violentmonkey or Tampermonkey.

## Supported sites

The script only runs on the sites listed in its `@match` line (a school Moodle, at the time of writing). To use it on your own Moodle, add your site's address to the `@match` line of the script in your userscript manager, or fork the script and change it there.

## Features

- **Themes**: a range from light to dark, an "adapt to my device" day/night pair, solarium glass, card vibrancy.
- **Accent colour** from presets, or following the course image or profile photo.
- **Redesigned navigation**: the course sidebar and in-course navigation are restructured to match bleh's layout.
- **Quick switcher**: Ctrl/⌘ + K to jump to any course, page or setting.
- **Settings page** with every bleh option that applies to Moodle, opened in place, with import, export and reset.
- **Seasonal effects** that re-tint the page and drop snow or leaves on their dates.
- **In-app file preview** for course files.
- **Update notifications** when a new release is out.
- **Performance**: only the parts of the stylesheet Moodle uses are shipped, and large decorations load on demand.

## Screenshots

Screenshots are generated for the landing page and will be added under `public/shots/`:

| File | Shows |
| --- | --- |
| `/shots/hero.webp` | the hero image |
| `/shots/themes.webp`, `/shots/accent.webp`, `/shots/fonts.webp` | themes, accent colour, fonts |
| `/shots/sidebar.webp`, `/shots/switcher.webp` | navigation, quick switcher |
| `/shots/settings.webp`, `/shots/seasonal.webp` | settings page, seasonal effects |
| `/shots/glass.webp`, `/shots/preview.webp`, `/shots/performance.webp` | glass, file preview, performance |

Until then each one is a 1x1 placeholder.

## Build

Requires [Bun](https://bun.sh).

```sh
bun install
bun run build     # builds the userscript, copies it to public/, then `next build` into out/
bun run dev       # the site only, at http://localhost:3000
```

`bun run build` runs [`userscript/build.sh`](userscript/build.sh) and [`scripts/userscript.mjs`](scripts/userscript.mjs), which writes `public/moodleflow.user.js` and `public/moodleflow.meta.js` (the metadata block on its own, used by the userscript's update check). Both are generated and git-ignored. Cloudflare serves `out/` as static assets; redirects are in [`public/_redirects`](public/_redirects) and headers in [`public/_headers`](public/_headers).

The userscript has its own checks: `cd userscript && bun check.ts`.

## Credits and licence

moodleflow is a port of **bleh** by katelyn and contributors ([katelyynn/bleh](https://github.com/katelyynn/bleh)). The stylesheets in the userscript are bleh's own, copied unmodified. The landing site is adapted from [katelyynn/bleh-www](https://github.com/katelyynn/bleh-www).

Licensed under the GNU General Public License v3.0 or later, see [LICENSE](LICENSE).

Userscript details (how it is built, what is left out, performance notes): [userscript/README.md](userscript/README.md).
