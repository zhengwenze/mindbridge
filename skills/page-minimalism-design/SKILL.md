---
name: page-minimalism-design
description: Simplify frontend pages and UI components with page-element minimalism. Use when Codex is asked to reduce visual clutter, remove explanatory copy, make a page cleaner or more focused, audit noisy UI, redesign a dashboard/chat/tool page for minimalism, or decide which labels, helper text, headings, cards, badges, buttons, and status elements should remain visible.
---

# Page Minimalism Design

Use this skill to turn a working interface into a quieter, more focused interface without removing necessary functionality.

## Core Rule

Maximize task signal and remove presentation noise.

Keep an element only if it directly helps the user do one of these:

1. Decide what to do now.
2. Complete the primary task.
3. Understand current state, error, or risk.
4. Recover from a problem.

Everything else must be removed, collapsed, moved behind interaction, or rewritten.

## Workflow

1. Identify the page's primary task in one short phrase.
   - Chat page: send and read messages.
   - Admin list: scan, compare, inspect, act.
   - Form page: complete required fields and submit.

2. Rank visible elements by task value:
   - Primary controls and content.
   - Required state and feedback.
   - Navigation needed for this task.
   - Secondary shortcuts.
   - Explanatory, decorative, or marketing content.

3. Delete or collapse low-value elements first:
   - Breadcrumbs on single-purpose work surfaces.
   - Eyebrows like product name, feature name, or category when already clear from context.
   - Paragraphs that explain obvious behavior.
   - Repeated headings that restate nav, route, card title, or placeholder.
   - Decorative cards around a single tool.
   - Disabled menu items that advertise unfinished features.
   - Status metadata that is useful only for debugging.

4. Rewrite remaining copy to be functional:
   - Prefer button labels, field placeholders, and short state text.
   - Use verbs for actions: Send, Upload, Retry, Refresh.
   - Use nouns for destinations: Reports, Cases, Knowledge.
   - Avoid instructional sentences unless a user can reasonably get stuck.

5. Preserve necessary affordances:
   - Keep visible submit/send action.
   - Keep error and loading states.
   - Keep empty states, but make them short.
   - Keep destructive or irreversible action confirmation.
   - Keep labels for ambiguous inputs.

6. Verify the page still works without the removed text.
   - A new user can find the main action in under 3 seconds.
   - The most important content has the highest visual weight.
   - No essential state is hidden.
   - Keyboard and screen-reader meaning did not get worse.

## Element Decisions

### Headings

Keep one heading only when it orients the user in a multi-section page.

Remove headings when:

- The route, nav, or page shell already names the view.
- The page contains a single obvious tool.
- The heading repeats the card title or sidebar label.

For minimal work surfaces, a toolbar plus content often beats a heading block.

### Descriptions and Helper Text

Default to removal.

Keep helper text only when it prevents likely mistakes:

- File type or size constraints.
- Dangerous action consequences.
- Field-specific format requirements.
- Empty/error recovery instructions.

Do not keep text that explains obvious interactions, such as “type a message and press send” when a text area and Send button are visible.

### Empty States

Use a short noun or imperative:

- “开始对话”
- “暂无报告”
- “选择报告”
- “上传文件”

Avoid motivational or explanatory paragraphs unless the empty state blocks progress.

### Status

Show status only at the granularity needed for the task.

Good:

- READY / THINKING / ERROR on a chat.
- 服务正常 / 服务 DOWN in a global header.
- Uploading / Failed / Done near a file action.

Bad:

- Long session IDs in primary visual areas.
- Repeating backend model details on every work surface.
- Debug metadata that competes with primary content.

### Cards and Containers

Use a card when it frames a real module: list, form, detail, message panel.

Avoid:

- A page section inside a card inside another card.
- Cards used only to make a page feel designed.
- Large bordered containers around a single obvious control.

### Navigation

Hide or remove unavailable destinations. Do not show disabled future features unless the product explicitly needs a roadmap signal.

For single-page MVPs, one active nav item is better than multiple disabled placeholders.

## Frontend Implementation Guidance

- Prefer deleting JSX over hiding with CSS.
- Preserve existing hooks, API calls, and state machines unless the user asks for behavior changes.
- Keep component changes narrowly scoped to presentation files.
- Do not remove accessibility labels just because visible text is removed.
- If removing visible labels from icon-only controls, add `aria-label` and tooltip.
- Run typecheck and lint after edits.
- For visual changes, inspect desktop and mobile layouts when a browser tool is available.

## Review Checklist

Before finalizing, answer:

- What is the page's primary task?
- Which visible text was removed?
- Which visible text remains, and why?
- Did any removed element contain necessary state, constraints, or recovery information?
- Does the page look quieter without becoming cryptic?
- Do loading, error, empty, and success states still communicate enough?

## Source Principles

This skill follows mature UX principles:

- NN/g aesthetic and minimalist design: irrelevant or rarely needed information competes with relevant information.
- NN/g signal-to-noise framing: maximize task signal and reduce decorative or low-value noise.
- Material content design: calls to action should be concise, specific, and actionable.
- Apple HIG writing guidance: interface text should use clear names and small writing changes to improve experience.
