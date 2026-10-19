#!/bin/sh
# builds ./moodleflow.user.js (single file, metadata block on top)
# 1) build.mjs turns bleh's stylesheets (vendor/bleh, untouched copies) into dist/core.css + lazy chunks
# 2) src/ is bundled with that css + our adapter css inlined as text
set -e
cd "$(dirname "$0")"
bun build.mjs
esbuild src/main.ts --bundle --target=es2022 --loader:.css=text \
  --define:__VERSION__="\"$(sed -n 's|^// @version *||p' meta.txt)\"" \
  --banner:js="$(cat meta.txt)" --outfile=moodleflow.user.js --log-level=warning
