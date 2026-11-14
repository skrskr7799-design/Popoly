# Popoly UI Design System

The visual language for the current campaign interface. The goal is a coherent strategy-game command environment: restrained, information-dense, atmospheric, and readable on desktop and tablet.

## Visual principles

- **Strategic instrument, not a generic admin dashboard.** Use editorial page introductions, regional/system schematics, compact intelligence labels, and decision-focused information hierarchy.
- **One game, distinct destinations.** Command Center, Corporation, Markets & Intelligence, and Quarter Strategy share the same shell, navigation, typography, controls, surface language, and motion rules. Each destination keeps its own visual motif and data visualization.
- **Quiet hierarchy.** Reserve the mint accent for active decisions, positive states, and key actions. Use blue for secondary capital/data emphasis and amber for warnings. Avoid turning every metric into a brightly colored KPI.
- **Truthful information.** Distinguish known, reported, estimated, and unknown information. Never expose hidden simulation values through presentation components.
- **Responsive by design.** Desktop uses persistent side navigation; compact layouts use the four-item mobile navigation. Cards must reflow without horizontal scrolling.

## Shared tokens

Tokens are defined in `src/index.css` under `:root`.

| Token family | Purpose |
| --- | --- |
| `--pop-color-*` | Canvas, surfaces, borders, text, muted text, accents and warning |
| `--pop-radius-*` | Control, card, panel and hero corner radii |
| `--pop-space-*` | Four-point spacing scale |
| `--pop-motion-*` | Fast interaction, normal transition and page-entry timing |
| `--pop-ease-standard` | Shared interaction easing |

Prefer these tokens when introducing new UI styles. A destination may add a local accent variation, but should not redefine the shared shell.

## Component conventions

- **Navigation:** one active state at a time; active items use a restrained tinted surface and subtle border.
- **Page heading:** eyebrow label, clear destination title, quarter indicator and campaign status.
- **Hero:** concise strategic context with one meaningful SVG/system visualization; decorative motion must remain subtle.
- **Panels:** shared border and radius, clear section title, consistent internal spacing.
- **Data:** align numeric values, show units, and label freshness/confidence where applicable.
- **Actions:** primary mint action, secondary outlined action, quiet tertiary action. Disabled state must remain legible.
- **Focus:** visible keyboard focus on every interactive control. Form controls inherit the dark color scheme and accent.
- **Motion:** short transitions for hover/selection and a single light page-entry transition. Respect `prefers-reduced-motion`.

## Acceptance checklist

- [ ] All four destinations use the same shell and navigation states.
- [ ] Page title and quarter context remain visible and consistent.
- [ ] Shared panel, control, badge, and focus treatments are consistent.
- [ ] Destination-specific hero illustrations remain distinct, not duplicated templates.
- [ ] 1280 px, 768 px, and 390 px layouts have no horizontal overflow.
- [ ] Reduced-motion preference removes nonessential transitions and entrance animation.
- [ ] Text and numeric values remain readable at compact widths.
- [ ] No hidden simulation metrics are introduced into player-facing components.
