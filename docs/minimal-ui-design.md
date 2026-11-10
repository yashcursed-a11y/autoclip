# November 8 moodboard revision

The current implementation supersedes the paper palette described below. Minimal now uses a compact graphite workspace: base #101619, slate panels #1a2227, raised controls #252f35, silver selection #c5d7df, and restrained inset shadows. The character photographs are mood references only; no mascot was added.

Create combines source and settings in one desk, six compact framing choices, three optional disclosures and a shared launch row. The original Recent Projects list opens through Project Library. Navigation follows Create, Edit, Finish, Publish. The editor retains the original player, inspectors and manual editing controls in bounded panels above its timeline. All moved controls restore to their original positions when leaving Minimal.

Verified in the live browser at 1080x700 and 1440x920. At 1080x700, the complete creation desk ends at 684px and the editor timeline ends at 667px. Five repeated layout round trips preserve original element identities, IDs, handlers and child order. The Figma link below documents an earlier iteration and has not been updated for this revision.

---
# Minimal / Edit → Finish → Publish

## Reference mapping

The four user sketches define the structure, rather than an additional color theme.

- Sketches 1 and 4: portrait preview at left with previous/next clip controls; channels and scheduling above post title, description and tags on the right.
- Sketch 2: portrait review at left, caption and identity tools at right, export information and corrections below.
- Sketch 3: clip library, large player, contextual inspector and a separate manual timeline.

Editable Figma reference: https://www.figma.com/design/EJP32vtTgplzN2L36LMf1d

Frames: `3:2` Edit; `2:2` Finish; `2:53` Publish. These use editable text and auto-layout containers. Footage areas are deliberately labeled placeholders, not supplied product footage.

## Visual system

Paper `#f7f7f2`, white panels, ink `#202723`, muted text `#626d65`, sage selection `#e3e9e1`, forest action `#253e32`. Inter UI text; existing monospaced timecodes remain independent. Fine borders, 6–10px corners, restrained motion, visible focus. No moving decorative backgrounds.

## Connected research

Parallel research informed safe-zone and aspect-ratio placement from https://screen.studio/ and the separation of channel choice, composition and scheduling from https://support.buffer.com/article/600-getting-started-with-buffers-publishing-features . These are pattern references, not copied artwork or layouts.

## App integration

Choose **Customize → UI Styles → Minimal**. The saved UI ID is `minimal`; color themes and font preferences are stored separately. The removed globe UI files remain disconnected.

- `minimal-studio.css` supplies the scoped layout and appearance.
- `minimal-studio.js` supplies three-stage navigation, finishing shortcuts, selected-clip rendering, publishing composition and previous/next clip navigation.
- Publishing moves existing controls and leaves comment anchors at their original positions. Switching to Modern or Retro restores those same elements. No duplicate IDs or cloned event handlers.
- Finishing shortcuts select the current feed clip and open its existing editor inspector. They do not claim to run a new AI correction service.
- Media, caption rendering, backend analysis and export logic are unchanged.

## Verification status

Passed:

- Syntax checks and five publishing-layout round trips preserving all publishing IDs, element identity and original order.
- Figma Edit, Finish and Publish frames visually reviewed at 1440×920.
- Live app checks at 1440×920 and 1080×700. The compact editor timeline bottom was 655px within 700px; Finish's preview and next button remained on screen; Publish's four panels ended at or before 684px. Publishing had no document overflow at either size.
- Minimal persisted after reload. Modern restored both original publishing cards and removed the alternate desk. Switching back to Minimal restored the desk.
- Customize, UI Styles and Minimal opened through real buttons. Escape closed Customize and returned focus to its trigger.
- Finish displayed all five current-project clips. The active source reached readyState 4 with 1280px decoded video and active playback. Next selected Manual clip 2. Watermark opened the actual editor watermark inspector.
- Publishing selected an existing rendered clip; Next changed the selection and preview media URL to the following rendered file. No post was submitted.
- Focused tests verified lexical state access, encoded source media paths, selected-clip delegation through the existing editor exporter, scope restoration and the busy guard. No export was launched during verification.

Two existing feed integration defects were fixed as part of making the layout usable: the feed had read window.state even though app.js declares a lexical state binding, and had requested a nonexistent stream URL instead of the editor's existing /incoming source. Single-clip export now delegates to the existing editor export controls rather than sending an unsupported clipIds payload. Backend and analyzer code remain untouched.

The first native-browser observations were unreliable; final checks used the working in-app browser against the actual localhost:4173 app. Only a real export/publish operation remains outside this UI verification; the change does not claim new export or publishing capabilities.

KIO (November 9) is a separate UI option. Shared bounded layout now supports both Minimal and KIO; KIO tokens and composition live in public/kio.css and public/kio.js. See DESIGN.md for the new UI's material/font specification. Minimal retains its original presentation.

November 9 update: KIO removed from the live UI registry and its assets disconnected. Saved KIO preferences and old preview links migrate to Minimal. Minimal uses public/assets/backgrounds/minimal-motion.mp4 (the supplied red-horse clip) as a fixed full-window muted looping video. public/minimal-background.css owns backdrop/translucency tokens; public/minimal-background.js owns pause, saved motion preference, visibility and reduced-motion behavior. Browser verification passed: video decoded at624x624, full viewport coverage, no audio, pause persistence, UI switching and1080px fit. This supersedes the KIO notes above.
