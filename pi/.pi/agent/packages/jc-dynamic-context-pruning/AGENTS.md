# AGENTS.md — pi-dynamic-context-pruning

Reference for agentic coding agents operating in this repository.

---

## Project Overview

A **pi coding agent extension** (TypeScript/ESM) that implements Dynamic Context Pruning (DCP).
Pi loads extension `.ts` files directly — there is no build step and no compiled output.

**Runtime:** Bun (used to run tests and the extension).
**Package type:** `"type": "module"` — all files are ES modules.

---

## Commands

| Task | Command |
|------|---------|
| Run tests | `bun run pruner.test.ts` |
| Build | _(none — pi loads `.ts` directly)_ |
| Lint | _(no lint config present)_ |
| Format | _(no formatter config present)_ |

**Single test:** All tests live in `pruner.test.ts`. There is no test framework — tests use Node.js `assert` and plain `console.log`. To isolate one test scenario, comment out other `{}` blocks in that file.

---

## Module Structure

| File | Purpose |
|------|---------|
| `index.ts` | Extension entry point; registers all hooks with the pi `ExtensionAPI` |
| `config.ts` | JSONC config loading with 4-layer merge (defaults → global → env → project) |
| `state.ts` | `DcpState` type + `createState` / `resetState` / `createInputFingerprint` |
| `pruner.ts` | `applyPruning`, `injectNudge`, `getNudgeType`, `estimateTokens` |
| `compress-tool.ts` | Registers the `compress` tool with the pi tool registry |
| `commands.ts` | Registers `/dcp` slash commands |
| `prompts.ts` | All system prompt strings and nudge text constants |
| `pruner.test.ts` | Self-contained tests for `applyPruning` |

---

## Imports

- **Always use `.js` extension** for local imports, even when the source file is `.ts`:
  ```ts
  import { loadConfig } from "./config.js"
  ```
- **Use `import type`** for type-only imports:
  ```ts
  import type { DcpState } from "./state.js"
  import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
  ```
- Named imports preferred; default exports only for the extension entry point (`index.ts`).
- Import order: Node built-ins → external packages → local modules.

---

## Code Style

### Naming
| Kind | Convention | Examples |
|------|-----------|---------|
| Files | kebab-case or camelCase | `compress-tool.ts`, `pruner.ts` |
| Interfaces / Types | PascalCase | `DcpState`, `CompressionBlock`, `ToolRecord` |
| Functions | camelCase | `applyPruning`, `loadConfig`, `createState` |
| Constants (module-level) | UPPER_SNAKE_CASE | `ALWAYS_PROTECTED_DEDUP`, `DEFAULT_CONFIG`, `SYSTEM_PROMPT` |
| Variables / parameters | camelCase | `activeBlocks`, `toolCallId`, `contextPercent` |

### Section separators
Use the long-dash pattern with a label for logical sections within a file:
```ts
// ---------------------------------------------------------------------------
// Section Name
// ---------------------------------------------------------------------------
```
Use `// ── Label ──────────...` for subsections within `index.ts` event handler blocks.

### JSDoc
Add JSDoc comments to all exported functions and non-trivial interfaces. Keep them concise and factual.

### Type annotations
- Explicit return types on all exported functions.
- Use `unknown` instead of `any` when the shape is genuinely unknown, unless you are working with external API message shapes (message content arrays), where `any` is acceptable at the boundary.
- Prefer `as const` for literal arrays (e.g., `["compress", "write", "edit"] as const`).

### TypeBox schemas
Use `@sinclair/typebox` `Type.*` helpers for tool input schemas in `compress-tool.ts`.

---

## Error Handling

Two established patterns — do not mix them:

1. **Silent/best-effort** (config loading, file I/O):
   ```ts
   try {
     raw = fs.readFileSync(filePath, "utf8")
   } catch {
     return {}
   }
   ```
   Use when failure is non-fatal and a safe default can be returned.

2. **Throw domain errors** (ID resolution, invalid tool args):
   ```ts
   throw new Error(`Unknown message ID: ${id}`)
   ```
   Use when the caller must handle the failure explicitly.

- No silent swallowing of errors that indicate programming mistakes.
- `console.error` / `console.warn` are not used; errors surface via throws or safe returns.

---

## Key Architectural Constraints

- **Message timestamps are the stable identifier** for positioning compression blocks. Never use array indices as durable references; always use `timestamp`.
- **`assistant` + `toolResult` pairs must be removed atomically.** If a compression range covers a `toolResult`, the preceding `assistant` message (with the matching `toolCall` block) must be included in the range — see backward-expansion logic in `pruner.ts`.
- **State is mutated in-place** by `resetState` so all module references stay valid; do not replace `state` with a new object.
- **Config is read-only after `loadConfig`.** Never mutate the returned config object.
- **No external runtime dependencies** beyond `jsonc-parser`. Do not add new `dependencies`; prefer `peerDependencies` for pi-ecosystem packages.

---

## Dependencies

| Package | Role |
|---------|------|
| `jsonc-parser` | Parse JSONC config files |
| `@mariozechner/pi-coding-agent` | Peer — `ExtensionAPI`, event types |
| `@mariozechner/pi-tui` | Peer — `AutocompleteItem`, UI types |
| `@sinclair/typebox` | Peer — `Type.*` schema builders for tool registration |
