# AUTOCLIPIN website

Static HTML/CSS/JavaScript marketing website with local video assets, chrome styling, shared-decoder 3D clip ribbon and a grain-to-$1M sequence. The app and its backend remain separate.

## Cloud Web Studio

All main action buttons now link directly to the Cloud Web Studio (`https://autoclipin.online`). Desktop EXE and portable ZIP downloads have been removed to deliver an instant zero-installation browser experience. No large ZIP staging or local binary downloads are required.

## Motion and media

The header uses the supplied AUTOCLIPIN logo. Thirty clip planes share five silent local Pexels video decoders. Playback pauses offscreen, when hidden, or through the motion control. The headline-to-number scene maps sampled text pixels to `$0`, then counts to `$1,000,000` while scrolling. This is an illustrative concept, not an earnings forecast. Reduced-motion mode provides static content. Footage credit links are in the page dialog; local fonts include OFL licenses.

## Disk-safe staging

Source preview links directly to the original app ZIP in `../dist`. Normal website builds do not copy the app ZIP. Use `node build.mjs --with-download` only when preparing a deployable archive that must include the ZIP. The app-server landing page keeps one download copy under `public/downloads`; repeated synchronization compares SHA-256 using a small streaming buffer and reuses that copy. No source-preview ZIP copy is needed under `website/downloads`.
