# Architecture

A single-page Next.js app. The page reads the settings on every request; a server action validates a submission, routes it through the cascade with `@decisionnode/sdk`, and sends or previews the email. Nothing is stored.

## Request flow

1. `src/app/page.tsx` reads `DECISIONNODE_API_KEY`, `ROUTER_MODELS` and `ROUTER_THRESHOLD`. Without a key it renders the setup screen; otherwise the forms.
2. Submitting a form calls the server action in `src/app/actions.ts`, which passes the real SDK clients, the Resend sender and the inbox map to `submit` in `src/lib/submit.ts`.
3. `submit` validates the fields with the form's zod schema, calls `route`, then `deliverEmail`. It returns plain data for the result view.
4. `route` in `src/lib/router/cascade.ts` asks the first model all three questions, keeps each answer at or above the threshold, sends the rest to the next model with `fallback: false`, and gives every question still unsure its safe action.

## Files

| Path | What it holds |
|---|---|
| `src/lib/forms/definitions.ts` | The three forms: fields, teams with criteria, triage team, urgency guidance, samples |
| `src/lib/forms/schema.ts` | The zod schema built from a form's fields |
| `src/lib/router/config.ts` | Settings, model ids, timeouts and retries |
| `src/lib/router/questions.ts` | The state and the three questions sent for a submission |
| `src/lib/router/confidence.ts` | One confidence scale for `choice`, `score` and `truth` |
| `src/lib/router/cascade.ts` | The cascade and the safe actions |
| `src/lib/router/clients.ts` | One SDK client per model, server only |
| `src/lib/router/errors.ts` | SDK errors in words, and whether a retry can help |
| `src/lib/email/` | The email (React Email render), the send rules, the Resend sender and the inbox map |
| `src/lib/submit.ts` | Validation, routing and email for one submit, with its dependencies passed in |
| `src/components/` | The page: header, setup screen, form tabs, form, result view |
| `test/` | Vitest tests with a fake API client |

## Design choices

- **One client per model.** Flash and DecisionNode have their own timeouts (5 s and 10 s per attempt), set on each client, with one retry by the SDK.
- **Only unsure questions move on.** The second call carries only the questions the first model was unsure of, so its cost follows how hard the submission is.
- **Dependencies are passed in.** `route` takes its clients and `submit` its clients, sender and inbox lookup, so the tests run the same code with fakes and no network.
- **Cost as reported.** The result shows each call's `usage.cost` as the API sent it, and tokens when it sent none. The app computes no prices.
