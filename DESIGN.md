---
version: alpha
name: "AUTOCLIPIN / Minimal"
description: "A local video clipping workspace with slate equipment trays and silver controls."
colors:
  background: "#0c1114"
  surface: "#18232a"
  raised: "#263740"
  field: "#101a20"
  primary: "#cbd3d1"
  on-primary: "#162126"
  text: "#f4f5f1"
  secondary: "#bac6c9"
  border: "#82979e40"
  focus: "#e0e9e7"
  danger: "#ffb6ac"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Segoe UI, sans-serif"
  sans:
    fontFamily: "Space Grotesk, Segoe UI, sans-serif"
  mono:
    fontFamily: "Consolas, Courier New, monospace"
rounded:
  DEFAULT: "10px"
  panel: "22px"
spacing:
  panel-gap: "12px"
components:
  button: {}
  card: {}
  dialog: {}
---

# AUTOCLIPIN design system

Current November 9 decision: KIO is retired and disconnected. Minimal now uses the user-supplied red-horse film as a full-window background, with dark translucent work surfaces and white text. Runtime owners: public/minimal-background.css and public/minimal-background.js. Motion is muted, loops locally, pauses when hidden or disabled, and respects reduced motion. The former KIO specification below is retained as historical design context, not an active UI option.

## Overview

### Creative North Star
KIO is a separately selectable UI, based on the user's November 8 moodboard: stacked dark slate slabs, equipment compartments, tactile controls and a large editing canvas. The character photos establish contrast and mood only. No mascot or decorative character is part of KIO.

### Product context and register
Creators import long recordings, choose AI framing, manually trim and split clips, review captions and prepare publishing. This is a desktop product surface, not a marketing page. English UI; user content is preserved. Windows Electron at 1440x920 and minimum 1080x700, plus the same local browser renderer. No new geographic or regulated-market assumptions.

Signature: broad labelled equipment dock, detached rounded editing trays, a continuous output-settings slab next to the source/framing desk. Avoid neon cyber styling, tiny pale type, animated characters and generic analytics cards.

Existing Modern Studio, Minimal and Retro IDs remain selectable. Their saved color theme/font preferences remain independent. Explicit custom font choices override KIO defaults.

Runtime ownership is Model B: `public/kio.css` owns `--kio-*` tokens; this document mirrors them. `--kio-*` → `--m-*` shared layout adapter → `--theme-*` and shared controls. `public/minimal-studio.css` contains the shared bounded layout, scoped to Minimal and KIO. `public/kio.css` supplies KIO composition and materials. Subframe is an editable design reference, not an auto-generated token source.

## Colors
The frontmatter records exact runtime values. Matte dark navy surfaces, silver action emphasis, warm white text, desaturated blue-grey secondary text. Active selection uses a border and state attributes, not color alone. Error/danger semantics stay tied to the original controls. Themes never recolor footage, captions or exported media.

## Typography
Bricolage Grotesque headings at 30–36px on Create and 17px in the editor. Space Grotesk controls at 11–13px. Existing local font assets; no runtime font download introduced. Monospaced timecodes. Custom font packs remain user-owned preferences.

## Layout
Labelled dock is 148px, reducing to126px below1180px. Topbar56px. Create uses a broad source/framing column and330px output tray, reducing to290px at small widths. Six framing choices in a three-by-two grid. Optional disclosures and launch actions span the desk. Recent Projects remains available through Project Library.

Editor keeps original media shelf, video controls, inspector and full-width timeline. Each owns its internal scrolling; no document overflow in the editing view. Focus mode and hide-media/properties controls remain original. Timeline height180px at short window heights; larger230–250px region on tall windows.

## Elevation & Depth
Inset upper highlights, tonal surface layers and restrained shadows. No continuous ambient animation. Footage remains the most prominent visual surface.

## Shapes
22px panel corners;10px controls. Panels feel like separate equipment trays; controls have short press/hover feedback. No decorative silhouette may cover content.

## Components
Existing DOM controls and event handlers are canonical. KIO reuses them instead of cloning actions. `ui-styles.js` owns selection/persistence. `minimal-studio.js` owns reversible setup/publishing composition. `kio.js` owns reversible heading copy and Customize relocation. Leaving KIO restores exact node positions and text.

Focus is visibly outlined. Selected controls retain aria state. Disabled controls remain readable and in place. Native select popups and date controls are intentionally OS-owned. Existing processing/error UI remains authoritative; this redesign adds no fake completion states. Reduce-motion removes transitions and animations; forced colors retains system borders.

## Verification
`work/check-kio-browser.cjs` exercises real browser layout, font loading, UI selection and repeated switching at1440x920 and1080x700. `work/check-minimal-setup.cjs` and `work/check-minimal.cjs` check exact identity/order restoration of original controls. `work/check-kio.cjs` checks KIO-specific restoration. Evidence screenshots live under `work/kio-*.png`.

Editable Subframe canvas: https://app.subframe.com/aca36521437f/canvas/8fef00ec-80b8-4018-b17f-1b0524a71517/edit

Do not claim exported-media verification from layout tests. The available project recording was unavailable in the isolated browser; its existing import/retry state was inspected instead.
