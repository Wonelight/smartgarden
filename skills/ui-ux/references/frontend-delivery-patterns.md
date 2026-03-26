# Frontend Delivery Patterns

Use this file when translating UX decisions into code changes in this repository.

## Stack assumptions

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- Radix on selected controls
- Shared utility styling with `clsx` and `tailwind-merge`

## File placement

- Put route-level composition in `frontend/smart-garden-frontend/src/pages`.
- Put layout shells in `frontend/smart-garden-frontend/src/layouts`.
- Put reusable product components in `frontend/smart-garden-frontend/src/components`.
- Put low-level primitives in `frontend/smart-garden-frontend/src/components/ui`.
- Put global tokens, resets, and cross-cutting animation rules in `frontend/smart-garden-frontend/src/index.css`.

## Change order

When a screen is weak, change it in this order:

1. Fix layout and section order.
2. Tighten copy, labels, and CTA text.
3. Improve state handling and feedback.
4. Extract or extend shared components only if duplication becomes real.
5. Centralize repeated styling decisions.

## Page structure patterns

### Page header

Use a header that answers three questions quickly:

- Where am I?
- What is the current status?
- What can I do next?

Include:

- title
- short supporting sentence only if it adds decision value
- primary action
- optional secondary actions kept visually quieter

### Form screens

- Put the most irreversible choices first only when they change the rest of the form.
- Break long forms into clear sections with local headings.
- Keep inline validation close to the field.
- Prefer a stable submit area over moving controls.

### Dashboard screens

- Start with summary signals.
- Follow with trends, logs, or detailed controls.
- Keep operational actions close to the data they affect.
- Avoid mixing configuration UI into real-time status blocks unless the relationship is direct.

### Table or log views

- Keep filters above the content they filter.
- Expose the strongest sort or filter first.
- Keep row actions predictable and compact.
- Add an empty state that suggests the next useful action.

## Component guidance

- Reuse `Button` and `Input` patterns before creating alternatives.
- Keep variant naming semantic and predictable.
- Prefer composition over deeply parameterized mega-components.
- Add comments only when the structure is hard to infer from the code itself.

## Styling guidance

- Preserve the current emerald, slate, and zinc palette direction unless redesign is requested.
- Remove demo or starter CSS that fights real layouts.
- Use motion sparingly and tie it to state changes, panel reveals, or page transitions.
- Prefer consistent spacing rhythm over decorative separators.

## Definition of done

Treat a UI/UX change as complete only when:

- the primary flow is clearer than before
- the changed screen works on mobile and desktop
- states are handled explicitly
- the result fits adjacent screens instead of looking like an isolated mockup
