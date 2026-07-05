# Static 3D Animation Rules

## 1. Motion philosophy

NetScope Analyzer should feel alive without making operational content move.

The design uses **static 3D depth** plus **decorative motion**.

The following must stay fixed:

- page layout
- cards and panels
- table rows
- CLI text
- forms
- labels
- findings
- metric positions

The following may animate:

- background particles
- circuit/grid opacity
- light sweep overlays
- border energy gradients
- radar/hologram elements
- scanlines
- progress bars
- gauge/chart fills
- loading indicators

## 2. Forbidden continuous motion

Do not apply continuous animation using:

```css
transform: translate(...);
transform: translateY(...);
transform: scale(...);
transform: rotate(...);
transform: rotateX(...);
transform: rotateY(...);
```

on content components.

Forbidden patterns include:

- floating cards
- bobbing panels
- mouse-follow tilt
- automatic zoom
- parallax content
- camera movement
- rotating buttons
- pulsing the full card size
- hover movement that causes layout shift

Decorative pseudo-elements may use transform when they are independent overlays and never move the content.

## 3. Motion tokens

```css
:root {
  --motion-fast: 180ms;
  --motion-normal: 400ms;
  --motion-slow: 8s;
  --motion-very-slow: 16s;

  --glow-cyan-soft: 0 0 12px rgba(0, 217, 255, 0.12);
  --glow-cyan-medium: 0 0 20px rgba(0, 217, 255, 0.22);
  --glow-cyan-strong: 0 0 28px rgba(0, 217, 255, 0.34);
}
```

Use consistent tokens instead of unique durations across every component.

## 4. Light sweep

Use a pseudo-element over selected panels.

```css
.cyber-light-sweep::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: linear-gradient(
    110deg,
    transparent 0%,
    transparent 38%,
    rgba(105,225,255,.04) 44%,
    rgba(105,225,255,.14) 50%,
    rgba(105,225,255,.04) 56%,
    transparent 62%,
    transparent 100%
  );
  background-size: 240% 100%;
  animation: cyber-light-sweep 8s linear infinite;
}

@keyframes cyber-light-sweep {
  from { background-position: 140% 0; }
  to { background-position: -140% 0; }
}
```

Use on:

- hero/action panel
- CLI input frame
- security score
- subnet detail

Avoid applying it to every table row or small control.

## 5. Border energy

Use an overlay mask so the border appears to flow while the panel stays fixed.

```css
.cyber-border-energy::before {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  padding: 1px;
  pointer-events: none;
  background: linear-gradient(
    90deg,
    rgba(0,217,255,.18),
    rgba(0,217,255,.9),
    rgba(19,140,255,.3),
    rgba(0,217,255,.18)
  );
  background-size: 220% 100%;
  animation: cyber-border-flow 6s linear infinite;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
}

@keyframes cyber-border-flow {
  to { background-position: 220% 0; }
}
```

Keep the underlying border width constant to avoid layout shift.

## 6. Scanline

Use one faint global scanline and an optional editor scanline.

```css
.cyber-scanline {
  position: fixed;
  inset-inline: 0;
  top: -4px;
  height: 2px;
  pointer-events: none;
  background: linear-gradient(90deg, transparent, rgba(0,220,255,.36), transparent);
  filter: blur(.8px);
  animation: cyber-scanline-down 10s linear infinite;
}

@keyframes cyber-scanline-down {
  from { transform: translateY(-10px); }
  to { transform: translateY(100vh); }
}
```

Keep opacity low enough that it does not interfere with reading.

## 7. Particles

Guidelines:

- desktop: 30–50 particles maximum
- mobile: 12–20 particles maximum
- small radius and low alpha
- background only
- `pointer-events: none`
- deterministic positions when possible to avoid hydration mismatch
- prefer CSS or one lightweight canvas

Particles may drift slowly or pulse opacity. They must not pass over content with strong brightness.

## 8. Radar and hologram

The hologram container stays fixed. Only inner decorative parts animate.

Allowed:

- ring rotation: 12–20 seconds
- radar sweep: 10–16 seconds
- node opacity pulse
- core glow pulse

Avoid frequent flashing and fast rotation.

Suggested structure:

```tsx
<div className="hologram" aria-hidden="true">
  <div className="hologram__ring hologram__ring--one" />
  <div className="hologram__ring hologram__ring--two" />
  <div className="hologram__sweep" />
  <div className="hologram__core" />
</div>
```

## 9. Cards and metrics

Cards stay fixed.

Allowed:

- icon glow opacity
- number count-up once after analysis
- progress bar fill
- one-time update flash
- border-color and shadow transition on hover

Preferred hover transition:

```css
transition:
  border-color var(--motion-fast) ease,
  box-shadow var(--motion-fast) ease,
  background-color var(--motion-fast) ease;
```

Do not use hover scale or translate.

## 10. Buttons

Allowed:

- gradient background-position
- light sweep
- border energy
- icon opacity/pulse
- spinner

The button’s dimensions and position remain unchanged.

## 11. Tables

Table content must remain static.

Allowed:

- selected-row background fade
- one-time new-result highlight
- skeleton loading
- active-tab underline glow
- drawer fade/slide from a fixed overlay layer

Do not continuously animate rows, borders on every cell, or text.

## 12. Topology

Allowed:

- slow link data pulse
- health status glow
- one-time layout transition after explicit user action

Not allowed:

- continuously floating nodes
- automatic node movement after layout settles
- camera pan/zoom without user input

## 13. Motion levels

Add a persisted setting:

```ts
type AnimationLevel = "off" | "reduced" | "normal";
```

### Off

- no particles
- no scanline
- no light sweep
- no radar rotation
- static glow remains

### Reduced

- fewer particles
- slower border/radar effects
- no global scanline
- no count-up
- shorter one-time transitions

### Normal

- all approved decorative effects at restrained intensity

Expose the setting in the application Settings page.

## 14. Reduced motion

Support the platform preference:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

The UI must still look complete and layered when all animation is disabled.

## 15. Visibility and intersection handling

- pause expensive animation when `document.visibilityState !== "visible"`
- use IntersectionObserver for optional section effects below the fold
- stop canvas rendering when not visible
- do not interrupt the Web Worker analysis process

## 16. Mobile performance

At small breakpoints:

- reduce particle count
- remove large blur layers
- disable nonessential light sweeps
- simplify hologram detail
- avoid multiple animated gradients on the same screen

## 17. Review checklist

Before completing an animation change, verify:

- content position is unchanged during a full animation cycle
- no text flicker
- no layout shift
- no hover movement
- reduced-motion works
- animation-off setting works
- mobile frame rate remains usable
- parsing and table interaction remain responsive
