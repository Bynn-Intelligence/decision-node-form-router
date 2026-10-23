# Working in this repository

An example Next.js 16 app that routes form submissions with DecisionNode, by routing playbooks kept in a knowledge base. See `ARCHITECTURE.md` for the layout and the request flow.

## Commands

```sh
pnpm install
pnpm knowledge:setup  # loads knowledge/ into a knowledge base, writes ROUTER_KNOWLEDGE_BASE
pnpm dev              # http://localhost:3000, needs DECISIONNODE_API_KEY in .env.local
pnpm test             # Vitest, no network
pnpm lint
pnpm typecheck        # generates the route types, then tsc
pnpm build
```

Run lint, typecheck, tests and build before every commit; CI runs the same on every push.

## Rules

- Next.js 16 and React 19 differ from older versions. Read the guide in `node_modules/next/dist/docs/` before changing routing, server actions or caching.
- Call the API only through `@decisionnode/sdk`. Model ids are `decisionnode-flash` and `decisionnode-moe`.
- Keep the cascade as documented in the README: one threshold for every question, `|2p - 1|` for `truth`, only unsure questions re-sent, `fallback: false` on the DecisionNode call, the knowledge booster with `require: true` on every call when a knowledge base is set, and the safe actions.
- A form is data: one file in `src/lib/forms/registry/`, its sample pictures in `public/samples/<form>/`, its playbook in `knowledge/<form>/` with a document per team id and a pinned `always.md`. The tests check that all three agree.
- Sample pictures and playbooks are fictional and our own. Identity documents are marked SPECIMEN with invented names.
- Tests never call the API. Use the fakes in `test/fake-client.ts` and `test/knowledge.test.ts`.
- Submission fields and pictures are untrusted. They go into the request's state and images, never into the questions' instructions.
- The API key, the Resend key and the team inboxes stay on the server: read them only in server code, and never return them from the server action.
- Icons come from `@phosphor-icons/react` with the light weight. Text and controls meet WCAG AA contrast.
- Everything clickable shows the hand cursor (`src/app/globals.css` sets it for links, buttons, tabs, summaries and file pickers), and opening another form or going back to the picker lands at the top of the page.
