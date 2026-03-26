# UX Review Checklist

Use this file when reviewing an existing interface before changing code.

## 1. Task clarity

- Can the user tell what this screen is for within a few seconds?
- Is the primary action visually obvious?
- Do labels describe the user's goal instead of internal system terms?

## 2. Information hierarchy

- Does the most important information appear first?
- Are related controls grouped together?
- Is the page forcing the user to scan too many equal-weight elements?
- Are cards, tables, charts, and side panels competing for attention?

## 3. Interaction path

- Is the next step obvious after each action?
- Are there dead ends, confusing redirects, or duplicated entry points?
- Are destructive actions clearly separated from routine actions?
- Does the interface confirm what changed after an action completes?

## 4. Forms and controls

- Are required fields obvious before submit?
- Are defaults sensible?
- Are helper texts placed where they matter?
- Are validation messages specific and actionable?
- Are toggles, dropdowns, and segmented controls the right control types for the job?

## 5. States

- Is there a distinct loading state?
- Is there an empty state that explains what to do next?
- Is the error state recoverable?
- Is disabled UI explained when the user cannot proceed?
- Is success visible without being noisy?

## 6. Accessibility

- Is focus visible on interactive elements?
- Can the main flow work with keyboard only?
- Do color choices still work without color perception?
- Are touch targets large enough on mobile?
- Are headings and landmarks clear enough for assistive technology?

## 7. Responsive behavior

- Does the core flow still work on narrow screens?
- Does horizontal scrolling appear only when it is genuinely necessary?
- Are stacked sections ordered by user priority on mobile?
- Do sticky controls or floating buttons cover important content?

## 8. Dashboard-specific checks

- Are critical statuses visible without scrolling?
- Are alerts and anomalies more prominent than normal values?
- Do charts answer a question or just occupy space?
- Can the user move from summary to action without hunting through the page?
- Is real-time data visually distinct from static configuration?

## 9. Final decision

After reviewing, classify the work:

- Polish: clarity and spacing issues, but flow is sound
- Refactor: structure is weak, but the feature model is still correct
- Redesign: interaction model is wrong or badly mismatched to user needs
