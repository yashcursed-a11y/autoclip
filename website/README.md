# AUTOCLIPIN website

Static HTML/CSS/JavaScript marketing website with local video assets, chrome styling, shared-decoder 3D clip ribbon and a grain-to-$1M sequence. The app and its backend remain separate.

## Download

All main download buttons use `./downloads/AUTOCLIPIN-Windows-v1.0.1.zip`. This is the exact ZIP supplied at `../dist/AUTOCLIPIN-Windows-v1.0.1.zip`, containing the portable EXE and Setup EXE. No GitHub release lookup, platform chooser, Mac/Linux placeholders or source-code ZIP download remains.

`stage-download.cjs` stages that file for the canonical website, static build and local app-server landing page. It attempts hard links to avoid duplication and falls back to copying when the filesystem does not support them. Large ZIP staging folders are excluded from Git; the app installer also excludes `public/downloads` to prevent embedding its own distribution archive.

Run `npm run build:website` from the app root, or `node build.mjs` here. Run `node scripts/sync-website.cjs` from the app root to update `public/landing.html` and its assets. The original ZIP (or an already staged copy) must be present before building. Host the generated HTML, assets and downloads together for a public website; a local ZIP path is not a public upload.

The retained private Site identity in `.openai/hosting.json` is unchanged. No new deployment has been performed by this change.

## Motion and media

The header uses the supplied AUTOCLIPIN logo. Thirty clip planes share five silent local Pexels video decoders. Playback pauses offscreen, when hidden, or through the motion control. The headline-to-number scene maps sampled text pixels to `$0`, then counts to `$1,000,000` while scrolling. This is an illustrative concept, not an earnings forecast. Reduced-motion mode provides static content. Footage credit links are in the page dialog; local fonts include OFL licenses.
