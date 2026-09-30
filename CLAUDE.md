# Engineering Rules

These rules apply to every task, whether written by a human or an AI assistant.
If a rule conflicts with a request, stop and ask before breaking it.

## 1. The Golden Rule: smallest correct change

- Change only what the task requires. Nothing else.
- Do not rename, reformat, reorder, or "improve" code outside the task.
- Do not refactor unrelated code. If you notice a problem elsewhere, mention it in the summary instead of fixing it.
- Delete code only when it becomes unused because of this task.
- Never rewrite a whole file to change a few lines.

## 2. Workflow for every task

1. **Read first.** Open the files involved and understand the existing pattern before writing anything.
2. **Plan.** List the files you will change and what changes in each, in 3–7 lines. If more than 5 files or more than ~200 lines change, split the task and say so.
3. **Implement** following the existing patterns in that module.
4. **Verify.** Run `pnpm lint`, `pnpm typecheck`, `pnpm test` (and `go test ./...` for the engine). All must pass.
5. **Summarize.** Short list: what changed, why, anything noticed but not touched.

## 3. Size limits (enforced by linters)

| Item | Limit |
|---|---|
| Function / method | 40 lines |
| React component | 150 lines |
| File | 300 lines |
| Function parameters | 3 (use an options object beyond that) |
| Nesting depth | 3 levels |
| Cyclomatic complexity | 10 |
| Pull request | ~400 changed lines (excluding generated files and migrations) |

When a limit is reached, split into smaller named functions or files. Do not raise the limit.

## 4. Readability

- Names say what things are: `startAttempt`, `isStreakActive`, `challengeVersion`. No `data`, `tmp`, `handle2`, `utils2`.
- Prefer early returns over nested `if/else`.
- One function does one thing. If its name needs "and", split it.
- No clever one-liners. Plain code beats short code.
- Comments explain **why**, not what. Delete comments that repeat the code.
- No commented-out code. Git keeps history.
- No magic numbers: name them as constants in `packages/shared/constants`.

## 5. Don't break existing code

- Every new behavior gets at least one test. Every bug fix gets a test that fails before the fix.
- Do not change a public function signature, API route, or event payload unless the task says so. If you must, keep the old one working and mark it deprecated.
- API changes are additive: new optional fields are fine; removing or renaming fields needs a new version.
- Database migrations are additive (expand, then contract in a later task):
  add column → backfill → switch code → remove old column later.
- Never edit an existing migration. Create a new one.
- Never edit a published challenge version. Create a new version.

## 6. Architecture boundaries

- `apps/*` may import from `packages/*`. Apps never import from each other.
- API modules talk to each other through their exported service, never through another module's internal files or tables.
- API never controls containers. It only puts jobs on the queue; the sandbox engine does the rest.
- Shared types and zod schemas live in `packages/shared`. Do not duplicate types.
- Database access only through `packages/db` (Drizzle). No raw SQL strings in business logic.

## 7. Dependencies

- Do not add a new library if the existing stack can do it in under ~30 lines.
- If a new dependency is needed, state why in the summary and prefer well-maintained, widely used packages.
- Never add a library to do something another installed library already does.

## 8. TypeScript

- `strict` mode on. No `any`, no `@ts-ignore`. Use `unknown` and narrow it.
- Validate all external input (requests, queue messages, env vars) with zod at the boundary.
- `async/await` only, no `.then()` chains.
- Errors: throw typed errors from `packages/shared/errors`; never swallow errors silently.

## 9. Go (sandbox engine)

- `gofmt` and `golangci-lint` must pass.
- Always handle errors; wrap with context: `fmt.Errorf("create sandbox %s: %w", id, err)`.
- Pass `context.Context` as the first parameter to anything that does I/O.
- No global mutable state.

## 10. Security (never negotiable)

- Never commit secrets, keys, or tokens. Use Key Vault and environment variables.
- Never weaken sandbox isolation (runtime, network, limits, capabilities) without an explicit task and review.
- Never log passwords, tokens, or full session contents.
- Every endpoint checks authentication and authorization explicitly.

## 11. Forbidden without explicit approval

- Rewriting or restructuring a whole module.
- Changing lint rules, size limits, or this file.
- Changing CI/CD, Terraform, or production configuration.
- Deleting tests.
- Upgrading major versions of frameworks.

## 12. Definition of Done

- [ ] Only task-related code changed
- [ ] Lint, typecheck, and tests pass
- [ ] New behavior has tests
- [ ] No size limit exceeded
- [ ] No new `any`, `TODO` without an issue link, or commented-out code
- [ ] Summary lists changes and anything noticed but not touched

## Enforcement

These rules are enforced in CI, not just by good intentions.

ESLint (`packages/config/eslint`):

```js
rules: {
  "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
  "max-lines-per-function": ["error", { max: 40, skipBlankLines: true, skipComments: true }],
  "max-params": ["error", 3],
  "max-depth": ["error", 3],
  "complexity": ["error", 10],
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/ban-ts-comment": "error",
  "no-restricted-imports": ["error", { patterns: ["apps/*", "**/modules/*/internal/*"] }]
}
```

golangci-lint (`apps/sandbox-engine/.golangci.yml`): enable `funlen` (40 lines), `gocyclo` (10), `nestif`, `errcheck`, `wrapcheck`.

CI blocks merge if lint, typecheck, tests, or the PR size check fail. Husky runs lint and typecheck before every commit.
