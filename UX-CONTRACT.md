# AUTOCLIPIN interface contract

Scope: KIO presentation. Backend, billing, deletion, export and scheduling policies remain in their existing owners. This document records UI consequences, not new business rules.

## Sources
User brief: named KIO UI based on supplied moodboard, no mascot, readable text, preserve controls. Product overview: README.md. UI IDs and actions: public/index.html, public/app.js, public/manual-editor.js. Selection and persistence: public/ui-styles.js. No permissions, payment or data-retention changes are authorized by this visual change.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Original native select elements in public/index.html | Existing app.js handlers | native OS popup; KIO field surface only | browser keyboard/popup and value retention |
| Date | Existing scheduler native date/time fields | Existing scheduler handlers in app.js | native | presentation only; no scheduling invoked |
| Form | Original upload/setup controls and app.js validation | public/index.html and public/app.js | existing validation; KIO composition only | identity/restoration tests |
| Scrollbar | public/kio.css | DESIGN.md runtime mapping | root and bounded panels | browser overflow measurements |
| Toast | Existing shared app feedback | public/app.js | original semantic states | unchanged by KIO |
| CRUD | Original project/clip actions | public/app.js and public/manual-editor.js | KIO reuses original elements | round-trip handlers/identity tests |

## Behavior
UI selection saves `autoclip.uiStyle` with style `kio`. Themes/fonts remain independent. Switching UI must restore original nodes rather than reconstruct controls. Customize remains visible in KIO's dock and returns to its original parent on leaving KIO. Project Library uses the existing project list in the shared native dialog; Escape closes it.

KIO navigation uses original labelled buttons and switchAppView. Player focus and panel visibility continue using original handlers. Keyboard editing and contextual menus stay owned by the editor modules. Create/export/publish labels and pending/disabled/error states remain tied to actual app state. No simulated progress or new external side effect.

## Recovery and accessibility
No destructive test actions during design verification. Source import retains its native picker alternative. Existing unavailable-media recovery remains Retry video / Import video. Native form controls preserve their keyboard and focus behavior. Visible focus, readable text, reduced motion and bounded scrolling are required. Timeline dragging retains original exact-time field alternatives.
