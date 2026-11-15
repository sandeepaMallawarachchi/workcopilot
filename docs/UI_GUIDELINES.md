# Interface conventions

Component styling uses Tailwind utilities directly in JSX. `src/app/globals.css` contains only the Tailwind import, semantic light/dark tokens, the font stack and minimal element defaults. Do not add page-specific selectors or another parallel CSS design system.

## Typography and branding

Manrope is the main interface font; Noto Sans Sinhala supplies Sinhala glyphs. Both variable fonts come from the official Google Fonts repository, retain their SIL Open Font Licenses in `src/app/fonts`, and are served locally through `next/font/local`. Builds and page loads do not contact Google Fonts. `display: swap` keeps text visible during loading; the Sinhala fallback is not preloaded on every Latin-only page.

Keep supplied logo artwork in `public/brand`. `BrandLogo` frames transparent margins using Tailwind utilities without modifying the source. `BrandMark` is used for the agent graphic. Brand colors are cyan, blue, purple and navy; semantic danger states have a separate light/dark color pair.

## Shared components

- `ui/button.tsx`: typed buttons and link styling, shared variants/sizes, keyboard focus and disabled states. Use `buttonStyles` for links and `Button` for local interactions.
- `ui/form.tsx`: fields, inputs, selects, textareas, checkboxes and switches. Native labels, constraints and autocomplete remain available.
- `forms/action-form.tsx`: enhanced administrative forms, retained entries on errors, inline announced feedback, disabled controls while pending and submitter-aware loading states. Authentication retains its native server-action form.
- `ui.tsx`: page titles, panels, badges, empty states, provider marks and accessible scrollable data tables.
- `layout/auth-layout.tsx`: shared sign-in/setup layout.
- `layout/theme-toggle.tsx`: persistent theme choice, system preference, cross-tab updates and a keyboard-accessible toggle.
- `dashboard/*`: focused overview components.
- `conversations/message.tsx`: isolated message rendering, allowed provider source links and expandable tool evidence.

Server Components handle protected data reads and compose client components only where interactivity is needed. Keep credentials and authorization in server modules/actions. Explicit form action results contain only safe user-facing text; never display raw exception messages.

## Layout and interaction

Use semantic `canvas`, `surface`, `ink`, `muted`, `border`, `accent`, `accent-soft` and danger colors so every page adapts to the same theme. Use the shared 12/16px component radii, 20/24px panel padding and 24px layout gaps. Body/control text is 14px, supporting text 12px, and page headings 30–32px. Use smaller type only for short metadata and eyebrow labels.

Primary controls are at least 44px tall; compact actions are at least 40px. Always include visible focus styling. Status labels include text so color is not the only signal. Provide an accessible name for icon-only buttons. Use ordinary links for navigation and buttons for actions.

Mobile navigation scrolls within its own container. Wide tables are keyboard-focusable named scroll regions. Keep cards `min-w-0` and long content wrapped. Mutations show pending feedback, and destructive contact/history actions require confirmation. Error and loading routes share the same tokens and spacing; animated indicators respect reduced-motion preferences.

## Formatting and verification

`.editorconfig` and `.prettierrc.json` specify two-space indentation, UTF-8, LF, semicolons, consistent quotes and a 90-column formatting target. Use `npm run format` before handing off changes, then run checks appropriate to the change:

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Browser visual and signed-in interaction checks require a browser runtime and a configured administrator. A successful build or HTTP response alone does not establish visual correctness or live Supabase behavior.
