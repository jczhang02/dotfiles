# Design principles

JC's design taste and trade-offs for any interface: websites, apps, tools. Apply them when designing, building or reviewing a UI. A project's own `DESIGN.md` (exact tokens and components) and an explicit request from JC take precedence.

Each rule is either **hard** (keep it unless JC says otherwise) or a **default** (start here; depart when the project gives a reason, and say so).

## Visual

**Quiet.** *Default.* Clean, modern, restrained, in the spirit of Cloudflare and Anthropic: generous whitespace, a calm neutral background, hairline rules instead of boxes, and content as the most prominent thing on the screen. Decoration earns its place by helping the reader.

**One accent.** *Default.* A single accent color, used sparingly for links, the current state and focus. Everything else is neutrals. Rarity is what makes the accent work.

**Type roles.** *Default.* Serif for long reading text, sans-serif for UI chrome (navigation, labels, dates, buttons), monospace for code. Each role keeps one family, so the role is legible from the type alone. Interfaces with no long reading may be sans-serif throughout.

**One floating surface.** *Hard.* Everything that floats above the page (popovers, hover cards, tooltips, menus) shares one style: the same background, radius and shadow. Readers learn it once.

**Dark mode.** *Hard.* Provide light and dark themes; follow the system setting until the user picks one, remember that choice, and apply it before the first paint so the page never flashes. Dark mode is designed (lighter accent, a faint ring for edges where shadows vanish), not inverted.

## CJK typography

**Mixed script.** *Hard.* In Chinese text, put a space between Chinese and adjacent Latin words or numbers (`2026 年 10 月 10 日`, `约 8 分钟`, `3 个文件`).

**ASCII punctuation.** *Hard.* Chinese UI copy uses ASCII punctuation with English spacing (`还没有文章.`, `方程, 模型, 以及其他.`), matching JC's writing convention.

**Latin first.** *Hard.* In font stacks, list the Latin font before the CJK font, so Latin letters and digits never come from the CJK font.

**Justify with care.** *Default.* Justify Chinese body text only in wide columns; leave narrow columns (mobile, side columns, cards) ragged, where justification spreads short lines.

## Interaction

**Look in place.** *Default.* When a link points to related content on the same page or nearby (a definition, a reference, a note), show that content where the reader is, in a card or in the margin, instead of moving them away. Navigation remains one step further for those who want it. Cut long previews with a fade rather than scrolling inside the card.

**Change form, not size.** *Default.* When space runs out, switch to a different presentation that fits instead of shrinking the wide one: margin content becomes inline or end content, a side panel becomes a hidden one, a hover card becomes a tap card.

**Input parity.** *Hard.* Whatever hover shows, keyboard focus shows too, and Escape dismisses it. Touch gets its own design rather than emulated hover: the first tap previews, a second tap acts. Hover cards open after a short rest (about 200 ms) and stay open while the pointer moves into them.

**Signal overflow.** *Default.* Content that scrolls sideways (wide formulas, tables, code) shows an edge fade on the side that has more, and takes keyboard focus so it can be scrolled without a pointer.

**Fewer things.** *Default.* Build pages and features when there is a clear need, not in advance. Prefer one line to a page, one control to a menu, and removing an element to styling it.

## Accessibility

**Contrast.** *Hard.* Text meets WCAG AA (4.5:1; 3:1 for large text) in both themes, including secondary text and syntax colors. Fix a failing color by adjusting it within its hue, so the design keeps its identity.

**Tap targets.** *Hard.* Every tap target is at least 44 × 44 px; extend small links with padding and matching negative margins so the visual layout stays the same.

**Motion.** *Hard.* Respect `prefers-reduced-motion`: keep fades, drop movement.

**Names.** *Hard.* Every control has an accessible name in the page's language; purely visual previews are hidden from assistive technology while the element they preview stays readable.

## Process

**Refine, don't redesign.** *Hard.* Once JC approves a look, later work repairs and extends it within that look. Propose a redesign only when asked.

**Find a reference first.** *Default.* Before inventing a pattern, look for a well-made existing one (a product, a library, a known site) and adapt it.

**Show, then decide.** *Default.* For visual choices JC cannot picture, build the recommended option and show screenshots (light and dark, desktop and mobile) rather than describing alternatives.
