# DecisionNode form router

[Read the guide on decisionnode.com](https://decisionnode.com/docs/patterns/form-router)

The form router is a small example web app that sorts form submissions (sales leads, customer contacts, bug reports) by deciding which team should get each one, how urgent it is, and whether it's spam. DecisionNode Flash answers every question in milliseconds, and only the questions it isn't sure about go to the full DecisionNode model, so most decisions are fast and cheap while the hard ones still get the most accurate answer.

Developers who handle incoming forms, tickets or messages and want them sorted automatically would use it as a starting point. It shows them how to settle most of those decisions on the fast, low-cost model and pay for the most accurate one only when it is needed.

## What it does

The app has three forms: sales leads, customer contact and bug reports. Each has its own fields, its own teams with the criteria that decide what each team handles, and three samples you can load and edit: a clear one, one with overlapping needs, and one with little context.

Every submission is asked three questions in one request:

| Question | Type | Answer |
|---|---|---|
| Which team should handle it? | `choice` over the form's teams | The team, with its confidence |
| How urgent is it? | `score` from Low to Critical | The level, with its confidence |
| Is it spam? | `truth` | The probability that it is spam |

The result shows, for each question, the final answer, which model settled it, and every model's answer, confidence and time. It shows what each call cost, how many of the three questions Flash settled on its own, and the safe action when one was taken.

## Requirements

- Node.js 22 or later, with pnpm
- A DecisionNode API key

## Setup

1. Clone the repository and install:

   ```sh
   git clone https://github.com/Bynn-Intelligence/decision-node-form-router.git
   cd decision-node-form-router
   pnpm install
   ```

2. Make a key at [decisionnode.com/console/keys](https://decisionnode.com/console/keys) and put it in `.env.local`:

   ```sh
   cp .env.example .env.local
   # then set DECISIONNODE_API_KEY=your-api-key
   ```

3. Start the app and open [localhost:3000](http://localhost:3000):

   ```sh
   pnpm dev
   ```

Without a key the app routes nothing and shows how to add one.

## Settings

| Variable | Default | Meaning |
|---|---|---|
| `DECISIONNODE_API_KEY` | none | Required. Your API key. |
| `ROUTER_MODELS` | `flash,moe` | The models in order. `flash,moe`: Flash first, DecisionNode for what Flash is unsure of. `moe`: every question to DecisionNode. `flash`: Flash only, and unsure questions take the safe action. |
| `ROUTER_THRESHOLD` | `0.7` | The confidence, from 0 to 1, an answer needs to be final. |
| `RESEND_API_KEY` | none | Optional. Sends the routed submission by email (see Email). |
| `RESEND_FROM` | none | Optional. The sender address for those emails, on a domain verified with Resend. |

## How a decision moves from Flash to DecisionNode

1. The submission is checked against the form's fields and becomes one request: the submission is the state, and the three questions carry the form's teams and guidance. The questions tell the model that the submission is evidence to judge, never instructions to follow.
2. DecisionNode Flash (`decisionnode-flash`) answers all three questions.
3. Each answer's confidence is compared with the threshold. An answer at or above it is final.
4. The questions below the threshold, and only those, are sent to DecisionNode (`decisionnode-moe`) with the same state and `fallback: false`, so the re-check always comes from the full model. Its answers are final when they reach the threshold.
5. A question still below the threshold takes its safe action.

Confidence is on the same 0 to 1 scale for every question type:

| Type | Confidence |
|---|---|
| `choice`, `score` | The answer's `confidence` |
| `truth` | `\|2p - 1\|`, the distance of the probability from 0.5: both 0.15 and 0.85 give 0.7 |

The safe actions:

| Question | Safe action |
|---|---|
| Team | The form's triage team (Sales triage, Customer care, Bug triage) |
| Urgency | Shown as unsure |
| Spam | Treated as not spam and marked for review, never dropped |

A submission settled as spam is held: it is shown as spam and no email is sent.

If Flash fails or does not answer within 5 seconds, its questions go to DecisionNode, and the result says why. If DecisionNode fails or does not answer within 10 seconds, the submission is not routed and no email is sent; when trying again can help, the page offers it. Each call is retried once after a temporary failure, such as a timeout or a busy model.

Each call's cost is the amount the API reports in the answer's `usage.cost`. When an answer carries no cost, the result shows its tokens instead. Prices are on the [pricing page](https://decisionnode.com/docs/pricing).

To tune the threshold, see [Confidence-gated routing](https://decisionnode.com/docs/patterns/confidence-gated-routing).

## Deploy with Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FBynn-Intelligence%2Fdecision-node-form-router&env=DECISIONNODE_API_KEY&envDescription=Your%20DecisionNode%20API%20key&envLink=https%3A%2F%2Fdecisionnode.com%2Fconsole%2Fkeys)

The deployed app is the same as the local one, with the key as a project environment variable. Every submission is a call on your key, so protect a public deployment, for example with Vercel's Deployment Protection, or keep it private.

## Email

The router can send each routed submission to its team's inbox through [Resend](https://resend.com), as HTML and plain text, with the submitter's address as the reply-to address.

1. Set `RESEND_API_KEY` and `RESEND_FROM`.
2. Put each team's address in `src/lib/email/inboxes.ts`. The map is typed by each form's team ids and is never sent to the browser.
3. Tick "Email the routed submission to the team" before routing.

Without these, the result shows the email the team would get as a preview. A failed send is shown beside the routing result, which stands.

## Your own forms

The forms, their fields, teams, samples and urgency guidance are in `src/lib/forms/definitions.ts`. Change a team's criteria there to change what it receives. To check your changes, run `pnpm test`, `pnpm lint` and `pnpm typecheck`.

## License

MIT. See [LICENSE](LICENSE).

## Links

- [Form router guide](https://decisionnode.com/docs/patterns/form-router)
- [Confidence-gated routing](https://decisionnode.com/docs/patterns/confidence-gated-routing)
- [Confidence](https://decisionnode.com/docs/concepts/confidence)
- [Make an API key](https://decisionnode.com/console/keys)
- [`@decisionnode/sdk` on npm](https://www.npmjs.com/package/@decisionnode/sdk)
