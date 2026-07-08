# Design system

| Setting | Value |
| --- | --- |
| Mode | `redesign` |
| Level | `complex` |
| Fidelity | `describe` |
| Generated with | `reconstruct@1.3.0` |

This is a UI product (Next.js + React), so it has a design-system contract — but a
**deliberately minimal** one. The source ships no custom theme: there is no
`tailwind.config.*`, no `globals.css`, no CSS-in-JS, no `className` usage, and no
color/spacing/typography tokens of its own. The visual contract is therefore
"**browser + Tailwind defaults, unstyled**". The redesign keeps that brand-empty
baseline; the only invariant to preserve is the single `Button` primitive and the
semantic HTML the pages emit.

## Design-system source files

_No design-system config or token files exist (`tailwind.config.*` and any global
stylesheet are absent). `tailwindcss@^3.4.0` is a declared dependency but is
never configured or applied — no `@tailwind` directives, no utility classes. Tokens
below are therefore Tailwind's out-of-the-box defaults, none of which are actually
referenced by the source yet._

## Design tokens

The source defines **no custom tokens**. The token source of record is Tailwind
CSS's default theme (v3.4), available but unused. The buildable contract is: *do not
invent brand tokens; if styling is added, use Tailwind's default scale unchanged.*

| Token group | Value / source | Used in source? |
| --- | --- | --- |
| Color palette | Tailwind default palette (`slate`, `gray`, `blue`, …, 50–950 steps) | No — no color is applied anywhere |
| Type scale | Tailwind default (`text-xs` 0.75rem … `text-base` 1rem … `text-4xl` 2.25rem) | No — headings use the browser UA default sizes |
| Spacing scale | Tailwind default 4px base (`1` = 0.25rem, `2` = 0.5rem, …) | No |
| Radii | Tailwind default (`rounded` 0.25rem, `rounded-md` 0.375rem, …) | No |
| Shadows | Tailwind default (`shadow-sm` … `shadow-2xl`) | No |
| Z-index | Tailwind default (`z-0` … `z-50`) | No |
| Breakpoints | Tailwind default (see below) | No |

Because nothing is applied, a faithful rebuild renders **unstyled** semantic HTML
(UA default styles). Reproducing the source exactly means *not* adding classes.

## Theming

**No theming.** There is no light/dark mode, no `data-theme` attribute, no `.dark`
class, no `:root` CSS variables, and no theme persistence. The app renders in the
browser's default appearance only.

## Typography

**No custom typography.** No `next/font`, no `@font-face`, no Google Fonts link, no
self-hosted fonts. Text uses the browser's default UA font stack. Headings (`h1`,
`h2`) and paragraphs (`p`) inherit UA default weights and sizes.

## Breakpoints & responsive

**No responsive rules are authored.** No media queries and no responsive utility
classes appear in the source, so layout is single-column at every width (UA flow).
For reference, the available (unused) Tailwind defaults are: `sm` 640px, `md` 768px,
`lg` 1024px, `xl` 1280px, `2xl` 1536px — mobile-first — but none is applied.

## Iconography

**None.** No icon set or library is present; no SVGs or icon components are used.

## Motion & animation

**None.** No transitions, animations, or duration/easing tokens are defined. There
is no `prefers-reduced-motion` handling because there is no motion to reduce.

## Component library

| Component | Source | Variants | States |
| --- | --- | --- | --- |
| `Button` | `components/Button.tsx` | One, only — no variants (no `variant`/`size`/`intent` props) | One, only — static. No hover/focus/disabled/loading/error styling is defined (renders the UA default button appearance) |

`Button` contract:

- **Props:** `{ label: string }` — required, no default. No `onClick`, no `disabled`, no `type` override, no children.
- **Renders:** `<button type="button">{label}</button>`. The `type="button"` is hardcoded (it never submits a form).
- **Tokens consumed:** none — no `className`, no inline styles.
- **States to render:** only the default state. There is no empty/loading/error/disabled state because the component accepts no such inputs; a faithful rebuild must not add them.
- **Accessibility:** it is a native `<button>` with a visible text label, so it is keyboard-focusable and screen-reader-labeled by default; no `aria-*` is (or needs to be) set.

## Accessibility

- **Target:** WCAG 2.1 A/AA as afforded by native semantic HTML — the source relies entirely on native elements (`main`, `section`, `h1`, `h2`, `p`, `button`) and adds no ARIA, so the baseline is "native semantics, no regressions."
- **Keyboard navigation:** the only interactive element is the native `<button>`, which is focusable and activatable via Enter/Space by default.
- **Focus management:** UA default focus ring; no custom focus handling and none removed.
- **Contrast:** UA default text-on-white; no custom colors are introduced that could fail contrast.
- **Required ARIA:** none. Do not add roles/labels — the native elements are already correctly labeled by their text content. Preserve heading order (`h1` on `/`, `h2` on `/dashboard`).
