# Stitch / Design Import Workflow

---

Use the Stitch MCP config the user has provided. Verify the connection is live by listing available projects. If it fails, report the exact error and stop.

Once connected, list all available Stitch projects and designs — name, ID, last modified, description if present. Show them numbered and wait for the user to pick one before doing anything else.

On confirmation, import the selected design via MCP. Fetch everything — component code, assets, layout, embedded styles. Save the raw import into `/imported` untouched before any modifications. This is the source of truth. Never recreate or infer the design from memory — only work from what the MCP returns. Show the full file tree after import completes and wait for user confirmation before proceeding.

---

**AUDIT — run this before writing a single line of new code**

Scan the entire imported codebase and output a numbered checklist with `✅ OK` / `⚠️ minor` / `❌ critical` for every item below. Skip any item not applicable to this project:

- Fonts — multiple families used inconsistently, weights hardcoded vs inherited, web font link tag missing or incomplete, heading font different across sections
- Heading sizes — h1/h2/h3 inconsistent across sections, mixed px/rem/Tailwind/inline units for the same semantic level
- Colors — hardcoded hex or rgb values scattered instead of a token/variable system, inconsistent use of the same visual color across components
- Animations — CSS transitions mixed with JS animation library props, inline style transitions conflicting with motion props, entrance animations missing on sections that clearly need them, stagger timing inconsistent, no exit animations where expected
- Interactive states — hover, focus, active states missing or inconsistent across buttons, links, and cards
- Spacing — padding and margin inconsistent between equivalent sections or components, mixed unit systems for the same purpose
- Z-index — values illogical or undocumented, anything potentially rendering behind an overlay or background incorrectly
- Responsive — mobile/md/lg breakpoints missing or inconsistently applied, any section that is desktop-only with no mobile consideration
- Component structure — missing `key` props in any mapped list, missing default prop values, broken or unnecessary prop drilling, components that should be extracted but are inlined
- State management — shared state handled locally when it should be global, race conditions in async data fetching
- Performance — large unoptimized assets, missing lazy loading on off-screen content, render-blocking resources, unnecessary re-renders from missing memoization
- Accessibility — interactive elements missing `aria-label`, buttons missing `type` attribute, images missing `alt`, no focus management on modals or drawers if present, color contrast issues on text over backgrounds
- Dead code — unused imports, commented-out blocks, duplicate component definitions, unreachable branches
- Environment — hardcoded API URLs, secrets, or environment-specific values that should be in `.env`
- Console errors — any obvious errors or warnings that would fire on first load including prop type mismatches, missing keys, and undefined references

Show total critical count and minor count after the checklist. Ask the user to confirm before touching anything.

---

**FIXES — build on top of the import, never rewrite from scratch**

Diff against `/imported` at every step. If a fix requires removing more than 20 lines of original imported code, flag it to the user and explain why before doing it. Apply fixes in this exact order. After each step, produce a discrete checkpoint summary; commit only if the user explicitly asked for commits:

**1 — Token system**
Extract every color, font-family, font-size, font-weight, spacing value, border-radius, shadow, and z-index into a single token file — CSS custom properties if the project is plain CSS or Tailwind, a `tokens.ts` const file if TypeScript, a `theme` object if the project uses a design system like Chakra or MUI. Replace every hardcoded value across all components with token references. No raw values anywhere after this step.

**2 — Typography**
Enforce one consistent type scale across the entire project. Identify the intended heading font, body font, and monospace font from the import — if ambiguous ask the user before assuming. Fix every heading, subheading, label, caption, and body copy instance to use the correct token. Normalize heading levels section by section so equivalent headings share a class or variant. Fix font-weight inconsistencies. Ensure all web fonts are correctly loaded and not causing a flash of unstyled text.

**3 — Color consistency**
Replace all remaining raw color values with tokens. Ensure dark/light mode variables are set up if the design uses both. Check text-on-background contrast for every color combination and flag any that fail WCAG AA.

**4 — Spacing and layout**
Normalize all padding, margin, and gap values to the token scale. Fix any sections where equivalent components have different spacing for no apparent reason. Ensure grid and flex layout is consistent and correct at all breakpoints.

**5 — Component cleanup**
Extract any inlined JSX blocks longer than 40 lines into named components. Remove all dead code. Fix all missing key props. Add missing default prop values. Replace any magic numbers in logic with named constants.

**6 — Animations and micro-interactions**

Identify every element in the project that transitions, appears, disappears, or responds to user interaction. Before writing anything, produce a list of every animatable element found in the import grouped by type — entrances, exits, hovers, scrolls, conditionals, loaders. Show this list to the user and confirm before implementing.

Standardize on one animation approach for the whole project. If the import already uses Framer Motion keep it. If it uses CSS only keep that. If it is mixed pick the dominant one and migrate the outliers. Never mix CSS transitions and Framer Motion on the same element.

Then implement the following micro-animations precisely and contextually — only apply what makes sense for the element type, never force an animation where it creates noise or feels out of place:

**Entrance animations — every section, card, heading, and content block that enters the viewport**
Mount-triggered if sections are full-screen panels. IntersectionObserver-triggered at 10% threshold if the project is a scroll page. Every entrance uses blur-slide-up: `initial: { opacity: 0, filter: 'blur(12px)', y: 28 }` → `animate: { opacity: 1, filter: 'blur(0px)', y: 0 }`, duration `0.7s`, ease `[0.25, 0.46, 0.45, 0.94]`. Never use a plain opacity fade alone — the blur component is what gives the premium feel.

**Word-by-word headline animation — any hero heading or large display text**
Split the text by spaces. Each word is a `motion.span` with `display: inline-block, marginRight: 0.28em`. Each word animates: `initial: { filter: 'blur(10px)', opacity: 0, y: 40 }` → keyframe 1 at `times[0.5]`: `{ filter: 'blur(4px)', opacity: 0.5, y: -4 }` → keyframe 2 at `times[1]`: `{ filter: 'blur(0px)', opacity: 1, y: 0 }`. Duration `0.7s`. Stagger delay `(i * 100) / 1000` seconds per word. Parent is `display: flex, flexWrap: wrap, rowGap: 0.1em`.

**Staggered lists and grids — any repeating set of cards, items, steps, or testimonials**
Wrap the parent in a stagger container that triggers on viewport entry. Each child staggers by `0.09s` per index. Each child uses the same blur-slide-up entrance. Never animate all children simultaneously — the stagger is what makes it feel intentional.

**Card hover — any card, panel, or tile that is interactive or clickable**`whileHover: { y: -7, scale: 1.018 }`, transition `type: spring, stiffness: 300, damping: 22`. If the card has an inner icon or image, give it a secondary `whileHover` that nudges it `y: -3` with a `0.15s` delay creating a layered depth effect.

**Button hover — any CTA, submit, or action button**`whileHover: { scale: 1.05 }`, `whileTap: { scale: 0.97 }`, transition `type: spring, stiffness: 400, damping: 20`. If the button contains an icon, animate the icon separately on hover — arrow icons translate `x: 3`, external link icons translate `x: 2, y: -2`.

**Link hover — nav links, footer links, inline text links**
No scale. `whileHover: { x: 3 }` on links with directional intent. For nav links with no direction, use an underline that draws left to right via `scaleX: 0 → 1` on a `::after` pseudo-element, `transformOrigin: left`, duration `0.25s`.

**Conditional elements — anything that appears or disappears based on state**
Wrap in `AnimatePresence mode="wait"`. Entering: `initial: { opacity: 0, scale: 0.9, filter: 'blur(8px)', y: 10 }` → `animate: { opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }`, duration `0.3s`. Exiting: `exit: { opacity: 0, scale: 0.95, filter: 'blur(4px)', y: -6 }`, duration `0.2s`. Applies to tooltips, dropdowns, modals, drawers, toasts, tab content, accordion content, and any element toggled by user action.

**Number counters — any stat, metric, or numeric display**
On viewport entry animate the number from 0 to its final value over `1.4s` using an easeOut curve via `requestAnimationFrame` or `useMotionValue` + `useTransform`. Do not snap the number in — the counting animation is a core micro-interaction for stat sections.

**Line reveals — any decorative horizontal rule or divider**`initial: { scaleX: 0, transformOrigin: 'left' }` → `animate: { scaleX: 1 }`, duration `0.9s`, ease `[0.76, 0, 0.24, 1]`. Triggered on viewport entry.

**Image and media entrance — any image, video thumbnail, or media block**`initial: { scale: 0.92, opacity: 0, filter: 'blur(10px)' }` → `animate: { scale: 1, opacity: 1, filter: 'blur(0px)' }`, duration `0.65s`, ease `[0.34, 1.56, 0.64, 1]` — slight spring overshoot so it feels like it snaps into place.

**Page or section transitions — if the project uses routing or full-screen panel navigation**
Wrap each page or panel in `AnimatePresence mode="wait"`. Forward navigation: entering from `{ opacity: 0, filter: 'blur(16px)', scale: 0.97, y: 40 }`, exiting to `{ opacity: 0, filter: 'blur(16px)', scale: 1.03, y: -40 }`. Backward navigation: reverse y values. Duration `0.65s`, ease `[0.25, 0.46, 0.45, 0.94]`. Lock all navigation input during transition via an `isTransitioning` ref — reset after `700ms`.

**Shared layout animations — any element that moves between positions across state changes**
Use Framer Motion `layoutId` for any pill, indicator, underline, or highlight that slides between positions — tab indicators, toggle pills, active nav markers. This makes position changes animate automatically as smooth shared-element transitions.

**Scroll-linked effects — if the project is a scroll page and has parallax or sticky elements**
Use `useScroll` + `useTransform` from Framer Motion. Background elements move at `0.4x` scroll speed. Foreground text moves at `0.85x`. Hero sections scale from `1` to `1.08` as they scroll out. Never use `position: fixed` hacks for parallax — always use motion values.

**Reduced motion — required on every project**
Wrap all Framer Motion variants in a `useReducedMotion()` check. If reduced motion is preferred, replace all blur-slide-up entrances with a simple `opacity: 0 → 1` fade at the same duration. Remove all scale transforms. Keep duration the same — only remove the physical motion and blur, not the timing.

---

**7 — Responsive pass**
Go through every section and component at 375px, 768px, and 1280px. Fix any layout breaks, overflowing text, incorrectly sized images, or missing breakpoint classes. Ensure tap targets on mobile are at least 44×44px.

**8 — Accessibility pass**
Add missing `aria-label` attributes. Fix button `type` attributes. Add `alt` text to all images. Ensure keyboard navigation works through all interactive elements in logical order. If any modal, drawer, or overlay exists ensure focus is trapped while open and returned on close.

**9 — Environment cleanup**
Move any hardcoded API URLs, keys, or environment-specific values to a `.env.example` file with placeholder values and load them via the appropriate environment variable system for the project's framework.

**10 — Final console audit**
Run the project in development mode and capture all console output. Fix every error. Suppress no warnings without explaining why suppression is appropriate.

---

**VERIFICATION**

After all fixes are applied, do a final diff between `/imported` and the current state. Produce a summary of every file changed, what was changed, and why. Show the final audit checklist again with all items re-evaluated. Every item must be `✅ OK` before proceeding. If anything is still `❌ critical` explain why it was not resolved and what the user needs to do manually.

---

**SERVER**

Once verification passes with zero critical issues, start a localhost development server on port 3000 using whatever dev server the project's framework provides — Vite, Next.js dev, CRA, plain http-server, etc. Print the local URL. Confirm the server is running and the project loads without errors in the terminal output. If port 3000 is in use try 3001 then 3002 and report which port was used.

---
