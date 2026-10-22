# Working in this repository

An example Next.js 16 app that routes form submissions with DecisionNode. See `ARCHITECTURE.md` for the layout and the request flow.

## Commands

```sh
pnpm install
pnpm dev        # http://localhost:3000, needs DECISIONNODE_API_KEY in .env.local
pnpm test       # Vitest, no network
pnpm lint
pnpm typecheck  # generates the route types, then tsc
pnpm build
```

Run lint, typecheck and tests before every commit; CI runs the same on every push.

## Rules

- Next.js 16 and React 19 differ from older versions. Read the guide in `node_modules/next/dist/docs/` before changing routing, server actions or caching.
- Call the API only through `@decisionnode/sdk`. Model ids are `decisionnode-flash` and `decisionnode-moe`.
- Keep the cascade as documented in the README: one threshold for every question, `|2p - 1|` for `truth`, only unsure questions re-sent, `fallback: false` on the DecisionNode call, and the safe actions.
- Tests never call the API. Use the fake client in `test/fake-client.ts`, which builds real SDK `Decision` objects from wire-form answers.
- Submission fields are untrusted. They go into the request's state, never into the questions' instructions.
- The API key, the Resend key and the team inboxes stay on the server: read them only in server code, and never return them from the server action.
- Icons come from `@phosphor-icons/react` with the light weight. Text and controls meet WCAG AA contrast.
