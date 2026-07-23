# ProPickle Buddy Cinematic Landing Storyboard

## Review Gate

This folder documents the desktop previz now used by the homepage's still-frame cinematic.
The dashboard, extension, scrapers, and booking links remain unchanged. Do not generate paid
video or a mobile portrait chain until the real-footage plan and render budget are approved.

## Visual Sources

- `../../web/public/cinematic/desktop-concept-board.png`: generated composition previz. It is not the real ProPickle
  building or court and must never be presented as documentary venue footage.
- `../../web/public/cinematic/interface-dashboard-desktop.png`: real browser capture of the deployed ProPickle Buddy
  dashboard. The final transition must use the live interface or an exact browser capture,
  never generated UI.
- Real venue footage: not supplied yet. Exterior, gate, court, equipment, rally, and lighting
  shots remain replacement requirements before production.

## Direction

- Grounded premium sports commercial with natural lenses, practical light, restrained grain,
  and realistic materials.
- Preserve the existing Kinetic Grid language: dark surfaces, electric blue, pickleball lime,
  crisp white court lines, square geometry, and restrained radii.
- No generated branding, fake availability, venue signage, testimonials, crowds, close faces,
  close hands, clay, miniatures, glossy CGI, or baked-in interface text.
- Camera architecture: one continuous forward journey. Each shot settles into a slow forward
  drift so a later production chain can hand off frame-identically without a visible cut.

## Desktop Journey

| Beat | Visual and camera | Live copy | Production source |
| --- | --- | --- | --- |
| 1. Before play | Blue-hour exterior. Slow push toward the real venue gate, with the building still quiet. | `Open courts should not be hard to find.` | Licensed/supplied real ProPickle exterior footage required. |
| 2. Enter the court | Continue through the gate and doorway toward an empty indoor court. Court lines become the dominant geometry. | `One view across the days ahead.` | Licensed/supplied real entrance and empty-court footage required. |
| 3. The details | Low macro track past a worn paddle edge, perforated lime ball, net tape, and court texture. No hands. | `Read-only availability, without the daily clicking.` | Licensed/supplied equipment and court-detail footage required. |
| 4. In play | Distant rear view of a short two-player rally. Players stay small and unidentifiable. | `Pick a time. Bring your people.` | Licensed/supplied rally footage required. |
| 5. Data bridge | Camera rises toward practical court lights and an unbranded scoreboard shape. White lines extend into electric-blue grid lines; lime blocks echo available intervals. | `Fresh reads become clear choices.` | Real lighting plate plus a restrained generated/composited connector. |
| 6. Product reveal | The grid aligns with the actual dashboard geometry, then the real interface replaces the plate. The video stops; the interface and CTA remain live HTML. | `Find an available court.` | Real dashboard UI or exact browser capture only. CTA links to `/app`. |

Copy remains HTML outside the media so it is selectable, responsive, accessible, and easy to
revise. Nothing should be rendered into the footage.

## Scroll Rhythm

- Beat 1: 120vh, slow establishing push.
- Beat 2: 140vh, forward entrance and court reveal.
- Beat 3: 110vh, shorter tactile detail pass.
- Beat 4: 130vh, one concise rally exchange.
- Beat 5: 140vh, longest transition so court lines can become interface geometry.
- Beat 6: 100vh, camera settles and yields to the live CTA.

The visitor may scroll backward, so every handoff must also read cleanly in reverse. No scene
may depend on audio or a one-way narrative reveal.

## Reduced Motion And Accessibility

- `prefers-reduced-motion: reduce` receives one approved still per beat and normal document
  scrolling. No scrubbed video, parallax, pulsing, or camera movement.
- Provide a concise text narrative matching the six beats; decorative stills use empty alt text.
- The final heading and `Find an available court` link remain semantic live HTML with visible
  keyboard focus and at least a 44 by 44 pixel target.
- Maintain WCAG AA contrast independently of the footage with a controlled text scrim.
- Do not autoplay sound. Any future audio is optional, muted by default, and not required to
  understand the page.

## Performance Gate

- Desktop-first QA at 1440x900, 1280x800, and 1024x768.
- Load an optimized first-frame poster before video. Defer later clips until the visitor nears
  the cinematic section.
- Keep the current homepage content and CTA usable while media initializes or fails.
- Coalesce scroll seeks and avoid React state updates per animation frame.
- On iPhone during desktop approval, show the reduced-motion/poster experience only. Verify no
  horizontal overflow, blocked navigation, autoplay loop, or page-height jump.
- A native 9:16 chain is a separate approval and render budget. Do not center-crop the desktop
  chain and call it mobile production.

## Approval Checklist

- Story order and copy feel accurate to the existing product.
- Concept framing is approved without treating it as real venue footage.
- Real ProPickle footage is supplied or licensed for beats 1 through 5.
- The interface destination is the actual deployed dashboard.
- Desktop stills pass before any paid video calibration or generation.
- Mobile portrait generation remains off until desktop is approved.
