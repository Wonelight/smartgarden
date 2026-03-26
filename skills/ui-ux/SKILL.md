---
name: ui-ux
description: Audit, redesign, and implement better product UI/UX for web interfaces, dashboards, forms, navigation, responsive layouts, and state-heavy screens. Use when Codex needs to review an existing screen, improve clarity or usability, restructure a flow, tighten hierarchy and accessibility, or translate UX goals into React/Tailwind code without breaking the current design system.
---

# UI/UX

## Overview

Improve product interfaces by starting from user intent, fixing the interaction path, and then refining visuals. Preserve the current design language by default and escalate to broader redesign only when the user asks for it or when the current structure blocks usability.

## Workflow

### 1. Build context first

Read the target screen and its neighbors before changing anything.

For this repository, inspect these paths first when they are relevant:

- `frontend/smart-garden-frontend/src/pages`
- `frontend/smart-garden-frontend/src/layouts`
- `frontend/smart-garden-frontend/src/components`
- `frontend/smart-garden-frontend/src/components/ui`
- `frontend/smart-garden-frontend/src/index.css`
- `frontend/smart-garden-frontend/src/App.css`

Extract the essentials:

- user goal
- primary action
- secondary actions
- critical data and status signals
- constraints from existing components and styles

### 2. Choose the intervention level

Choose one of these modes before editing:

- Polish: adjust spacing, labels, hierarchy, affordance, and states without changing the flow.
- Refactor: reorganize sections, cards, forms, filters, or navigation while preserving the feature set.
- Redesign: change layout language, interaction model, or visual direction. Do this only when explicitly requested or when the current structure prevents a usable result.

State the chosen level in your own reasoning so the scope stays disciplined.

### 3. Diagnose before editing

Review the screen as a task flow, not a bag of components.

Check:

- what the user notices first
- what the user can do next
- what confirms success or failure
- what breaks on narrow screens
- what requires too much scanning, clicking, or memory

Use [references/ux-review-checklist.md](references/ux-review-checklist.md) for a structured pass.

### 4. Implement with the existing stack

Prefer reusing established primitives before introducing new ones.

In this repository, assume:

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- Radix primitives in selected controls
- shared components such as `Button`, `Input`, and `components/ui/*`

Implementation rules:

- Edit page composition before inventing new base components.
- Keep new shared components composable, accessible, and variant-driven.
- Centralize repeated visual tokens instead of hardcoding the same values in many files.
- Add the full interaction set: loading, empty, error, success, disabled, hover, and focus states when they matter.
- Preserve keyboard access and visible focus.
- Keep mobile usable, especially for dashboards, tables, and forms.

Use [references/frontend-delivery-patterns.md](references/frontend-delivery-patterns.md) when choosing patterns for forms, headers, cards, filters, tables, and empty states.

### 5. Validate the result

Run a quick quality pass after implementation:

- desktop and mobile layout
- text hierarchy and scan order
- CTA clarity
- keyboard and focus behavior
- contrast and hit targets
- empty, loading, and error states
- consistency with adjacent screens

If the change affects a flow, test the flow end to end instead of only checking isolated components.

## Interface heuristics

- Put one clear primary action in each section.
- Use progressive disclosure on dense monitoring or control screens.
- Keep status, trend, exception, and next action visible on dashboard surfaces.
- Use color to reinforce meaning, not to carry structure by itself.
- Reduce decorative noise when live data and alerts already compete for attention.
- Prefer shorter labels and clearer grouping over adding more borders and boxes.

## Repository-specific guidance

- Reuse `Button`, `Input`, and existing `components/ui/*` primitives before creating alternatives.
- Preserve the current emerald, slate, and zinc direction unless the user asks for a new visual language.
- Remove or neutralize leftover starter styles such as generic Vite demo CSS when they interfere with production layouts.
- Keep animations purposeful and sparse. Use them to clarify transitions, not to decorate every element.
- Place summary metrics above dense detail views. Keep filters close to the content they affect.

## Deliverables

When the user asks for UI/UX help, aim to produce one or more of these outcomes:

- a concise usability diagnosis
- a stronger layout or interaction structure
- concrete code changes in the relevant frontend files
- responsive and accessible states that were previously missing

Do not write long theory unless the user asks for it. Convert UX intent into specific interface decisions.
