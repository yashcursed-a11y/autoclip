# AUTOCLIPIN website

Canonical marketing source is here. No runtime dependencies or accounts are required.

Run `node build.mjs` in this directory to generate `dist/`. Serve the result with any static server. Run `node scripts/sync-website.cjs` from the application root to copy this design to `public/landing.html`.

The download button resolves the latest stable published GitHub release at runtime, selects an uploaded Windows installer, and shows its version/date/size. If GitHub is unavailable, it opens the release page. Drafts and prereleases are excluded. The requested free offer is 300 clips; paid prices remain pending until the owner supplies confirmed plans. This website change does not alter the app quota or license backend.

## Release setup

The root `.github/workflows/windows-release.yml` builds a version tag (for example `v1.0.2`) into a Windows NSIS installer and publishes a GitHub release after a successful build. The tag must match `package.json`. Push the workflow and required app sources to GitHub before using it. This local work does not publish an app release.

The website's download lookup follows published releases automatically, with no website rebuild required. Website design changes still need a fresh deployment. The private Sites preview has its own source repository and hosting identity in `.openai/hosting.json`; keep that identity intact.

## Media

Local, silent eight-second Pexels demo clips are compressed for web delivery. They illustrate creative possibilities, not actual AutoClip output. Sources and license are listed in the Footage credits dialog. Fonts are bundled with their OFL licenses. No analytics or cookies are added by this static site; hosting authentication is handled by the host.

## Motion system

The hero renders 30 live tiles from five shared local videos. The AUTOCLIP button launches a bounded burst of 16 live-frame canvases and removes them after 1.7 seconds.

The quantity/quality headline dissolves into grain and reforms into `$0` in the same pinned section. Further scrolling counts up to exactly `$1,000,000`; scrolling back reverses the sequence. The number uses a fine grain mask. Cars, watches, the earlier collage, and the separate account-balance section are removed from the page. The amount is an illustrative visual concept, not an earnings forecast.

Reduced-motion/manual-pause mode shows the headline and final amount as static content. Canvas sampling is capped at 1440px with 11,500 desktop or 6,500 mobile particles. Rendering stops when scroll easing settles. No external artwork is needed for this sequence.

## Chrome ribbon edition

Uses the supplied AUTOCLIPIN logo, encoded locally as `marketing/media/autoclipin-logo.webp`. The palette is graphite black, chrome silver and cool white. The earlier lookbook/style-preview section is removed.

The supplied 9.344-second recording was inspected at one-second and quarter-second intervals. Its layered, flowing 3D ribbon informed an original opening composed of 30 real sample-video planes, with shared decoders, animated wave positions, chrome edge lighting, and pointer-controlled perspective. It is an interpretation of the motion direction, not a copy of the source website. Playback and motion pause when hidden/offscreen or when manually paused; reduced-motion mode uses a fixed ribbon pose. The existing grain-to-$1M story remains below.
