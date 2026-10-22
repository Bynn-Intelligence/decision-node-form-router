# Architecture

A single-page Next.js app. The page reads the settings on every request; a server action validates a submission, routes it through the cascade with `@decisionnode/sdk`, and sends or previews the email. Nothing is stored, pictures included.

## Request flow

1. `src/app/page.tsx` reads `DECISIONNODE_API_KEY`, `ROUTER_MODELS`, `ROUTER_THRESHOLD` and `ROUTER_KNOWLEDGE_BASE`. Without a key it renders the setup screen; otherwise the form picker, and the chosen form (`?form=<id>`).
2. Submitting a form calls the server action in `src/app/actions.ts`, which passes the real SDK clients, the Resend sender and the inbox map to `submit` in `src/lib/submit.ts`. The browser scales large photos down before sending.
3. `submit` validates the text fields with the form's zod schema and the pictures by type, size and count, calls `route`, then `deliverEmail`. It returns plain data for the result view.
4. `route` in `src/lib/router/cascade.ts` asks the first model every question the form asks (the picture checks only with a picture), with the pictures inline and, when a knowledge base is set, the `knowledge` booster scoped to the form with `require: true`. It keeps each answer at or above the threshold, sends the rest to the next model with `fallback: false`, gives every question still unsure its safe action, and works out where the submission goes.

## Files

| Path | What it holds |
|---|---|
| `src/lib/forms/registry/` | One file per form: fields, teams, checks, urgency guidance, samples. `index.ts` lists them and the picker's groups |
| `src/lib/forms/common.ts` | Fields, the urgency levels and the checks the forms share |
| `src/lib/forms/schema.ts`, `pictures.ts` | The zod schema built from a form's fields; the picture checks |
| `src/lib/router/config.ts` | Settings, model ids, timeouts and retries |
| `src/lib/router/questions.ts` | The questions a submission is asked, its state, and the questions in the API's form |
| `src/lib/router/confidence.ts` | One confidence scale for `choice`, `score` and `truth` |
| `src/lib/router/knowledge.ts` | The `knowledge` booster and the passages read from `evidence.knowledge` |
| `src/lib/router/cascade.ts` | The cascade, the safe actions and the outcome |
| `src/lib/router/clients.ts` | One SDK client per model, server only |
| `src/lib/router/errors.ts` | SDK errors in words, whether a retry can help, and whether the next model may try |
| `src/lib/knowledge/` | The playbook reader and `setupKnowledge`, used by `scripts/knowledge-setup.ts` |
| `knowledge/<form>/` | The routing playbooks, one Markdown document per team and a pinned `always.md` |
| `src/lib/email/` | The email (React Email render), the send rules, the Resend sender and the inbox map |
| `src/lib/submit.ts` | Validation, routing and email for one submit, with its dependencies passed in |
| `src/components/` | The page: header, setup screen, form picker, form, picture field, result view |
| `public/samples/<form>/` | The samples' pictures |
| `test/` | Vitest tests with a fake API client and a fake collections API |

## Design choices

- **One client per model.** Flash and DecisionNode have their own timeouts (5 s and 10 s per attempt), set on each client, with one retry by the SDK.
- **Only unsure questions move on.** The second call carries only the questions the first model was unsure of, so its cost follows how hard the submission is.
- **Never route without the rules.** With a knowledge base set, every call requires the booster. A failure of the rules fails the submission rather than passing it to the next model, which would read the same rules.
- **Pictures inline.** The SDK clients send every picture in the request, so nothing is uploaded or kept.
- **Dependencies are passed in.** `route` takes its clients, `submit` its clients, sender and inbox lookup, and `setupKnowledge` its collections API, so the tests run the same code with fakes and no network.
- **Cost as reported.** The result shows each call's `usage.cost` as the API sent it, and tokens when it sent none. The app computes no prices.
