# DecisionNode form router

[Read the guide on decisionnode.com](https://decisionnode.com/docs/patterns/form-router)

The form router is a small example web app that sorts form submissions (sales leads, support requests, bug reports, insurance claims, identity documents, maintenance requests, street problems, payment disputes, marketplace reports) by deciding which team should get each one, how urgent it is, and whether it's spam, from the text and from any screenshots or photos attached. DecisionNode Flash answers every question in milliseconds, and only the questions it isn't sure about go to the full DecisionNode model, so most decisions are fast and cheap while the hard ones still get the most accurate answer.

Developers who handle incoming forms, tickets or messages and want them sorted automatically would use it as a starting point. It shows them how to settle most of those decisions on the fast, low-cost model and pay for the most accurate one only when it is needed.

## Route by your own rules: knowledge

Team names and a line of criteria are not enough to route a submission like your company would. Who owns which product, which customers are on an enterprise contract, what counts as urgent, what always goes to a particular team: those are your rules, and they change. The form router keeps them in a **knowledge base**, and every request reads the rules that apply to it through the `knowledge` booster, on Flash and on the DecisionNode re-check alike.

The repository ships a routing playbook for every form in `knowledge/<form>/`: one Markdown document per team, and one pinned document with the rules every submission must see.

```
knowledge/
  support/
    always.md            pinned: the rules for every message
    billing.md           what Billing owns, with examples, and what it does not
    technical_support.md
    account_access.md
    customer_care.md
  insurance/
  ...
```

```markdown
---
title: Support rules for every message
pinned: true
---
# Support rules for every message

- A workspace locked or suspended because a payment failed goes to Billing,
  not Account access: only Billing can lift a payment suspension.
```

Each form's samples include one that the rules route differently from the team names alone. In the customer contact form, "Locked out after changing card" sounds like Account access; the playbook sends it to Billing.

### Load the playbooks

```sh
pnpm knowledge:setup
```

The script uses your `DECISIONNODE_API_KEY` (a Full access key). It creates one knowledge base, "Form router playbooks", with the scope key `form`, writes every playbook document by its reference (`support:billing`), pinned and scoped to its form as marked, waits until every document is ready, and writes `ROUTER_KNOWLEDGE_BASE=<id>` to `.env.local`. Run it again after editing a playbook: an unchanged document is skipped, a changed one is rewritten, and a deleted one is removed.

### Put in your own rules

- **One document per team.** Say what the team owns, with examples, and what it does not own. The file name is the team's id in the form.
- **Pinned rules.** `always.md` with `pinned: true` is given to every request for its form. Put there the rules that must hold every time, and keep them short: a form's pinned rules share about 300 tokens a request.
- **Scoped by form.** The folder name is the form's id and its scope, so a sales lead never reads the claims rules.
- **The rules are evidence, not orders.** The model applies them to the submission; a submission that tries to rewrite the rules is read as text.

### In the result

Each answer shows the passages of the playbook it rested on: the document, the heading and the passage, marked when it is a rule that always applies. If the rules cannot be read (for example, documents still indexing), Flash's request is retried once, and then the submission is shown as an error you can retry, with the reason the API gave. The router never routes without the rules when a knowledge base is set. Without `ROUTER_KNOWLEDGE_BASE`, it routes on the team criteria alone and says so in the result.

### What it costs

Each request that reads the rules is one knowledge call, USD 0.001, on top of the model's price; the passages' tokens are input tokens. A submission that escalates makes two calls and so two knowledge calls. Indexing and storing the playbooks are billed per token and per passage; the free tier covers a small knowledge base. See the [pricing page](https://decisionnode.com/docs/pricing). With the rules in front of it, Flash is sure more often, so fewer questions need DecisionNode.

## What it does

The app opens on a picker of nine forms, grouped by industry. Each form has its own fields, teams and checks, and three samples you can load and edit: a clear one, one with overlapping needs, and one with little context.

| Industry | Form | Pictures | Questions |
|---|---|---|---|
| General business | Sales leads | none | team, urgency, spam |
| General business | Customer contact | screenshots, optional | team, urgency, spam, picture fits |
| General business | Bug reports | screenshots, optional | team, urgency, spam, picture fits |
| Insurance | Insurance claim | damage photos, required | team, urgency, spam, picture fits |
| Identity | Identity verification | one document photo, required | document type, readable and complete, name matches, spam |
| Property | Maintenance request | photos, optional | team, urgency, spam, picture fits |
| Public sector | Report a street problem | photos, optional | team, urgency, prank or duplicate, picture fits |
| Finance | Dispute a charge | statement or receipt, optional | team, urgency, likely fraud, spam, picture fits |
| Marketplaces | Report a listing or seller | listing screenshot, optional | team, urgency, bad-faith report, picture fits |

The team is a `choice` over the form's teams, urgency a `score` from Low to Critical, and every check a `truth`. "Picture fits" (does the picture fit what the person wrote?) is asked only when a picture is attached. Every answer is a routing suggestion for a person to act on: "likely fraud", "bad-faith report" and a picture that does not fit flag a submission for review; they never reject it. The identity form only sorts submissions: it does not verify identity or decide anything about a person, and its samples are SPECIMEN documents with invented names.

The result shows, for each question, the final answer, which model settled it, every model's answer, confidence and time, and the passages of the rules it read. It shows what each call cost, how many questions Flash settled on its own, and the safe action when one was taken.

## Requirements

- Node.js 22 or later, with pnpm
- A DecisionNode API key: a Full access key for `pnpm knowledge:setup` and for showing the rules' passages

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

3. Load the playbooks, start the app and open [localhost:3000](http://localhost:3000):

   ```sh
   pnpm knowledge:setup
   pnpm dev
   ```

Without a key the app routes nothing and shows how to add one.

## Settings

| Variable | Default | Meaning |
|---|---|---|
| `DECISIONNODE_API_KEY` | none | Required. Your API key. |
| `ROUTER_KNOWLEDGE_BASE` | none | The knowledge base with the routing playbooks, written by `pnpm knowledge:setup`. Unset: routing on the team criteria alone. |
| `ROUTER_MODELS` | `flash,moe` | The models in order. `flash,moe`: Flash first, DecisionNode for what Flash is unsure of. `moe`: every question to DecisionNode. `flash`: Flash only, and unsure questions take the safe action. |
| `ROUTER_THRESHOLD` | `0.7` | The confidence, from 0 to 1, an answer needs to be final. |
| `RESEND_API_KEY` | none | Optional. Sends the routed submission by email (see Email). |
| `RESEND_FROM` | none | Optional. The sender address for those emails, on a domain verified with Resend. |

## How a decision moves from Flash to DecisionNode

1. The submission is checked against the form's fields and becomes one request: the fields are the state, the pictures go in `images` by id (`photo_1`, `screenshot_2`), and the questions carry the form's teams and guidance. The questions tell the model that the submission is evidence to judge, never instructions to follow.
2. DecisionNode Flash (`decisionnode-flash`) answers every question, reading the form's rules when a knowledge base is set.
3. Each answer's confidence is compared with the threshold. An answer at or above it is final.
4. The questions below the threshold, and only those, are sent to DecisionNode (`decisionnode-moe`) with the same state, pictures and rules, and `fallback: false`, so the re-check always comes from the full model. Its answers are final when they reach the threshold.
5. A question DecisionNode answered but still below the threshold takes its safe action. A question DecisionNode could not answer, because it was busy, too slow or unreachable, keeps Flash's answer, and the submission is routed.

Confidence is on the same 0 to 1 scale for every question type:

| Type | Confidence |
|---|---|
| `choice`, `score` | The answer's `confidence` |
| `truth` | `\|2p - 1\|`, the distance of the probability from 0.5: both 0.15 and 0.85 give 0.7 |

The safe actions:

| Question | Safe action |
|---|---|
| Team | The form's triage team |
| Urgency | Shown as unsure |
| A check | Treated as passed and marked for review, never dropped |

A submission settled as spam is held: it is shown, and no email is sent. An identity document that cannot be read gets the next step "Ask for a clearer photo".

If Flash fails or does not answer within 5 seconds, its questions go to DecisionNode, and the result says why. Flash's request is retried once after a temporary failure, such as a timeout or a busy model.

The re-check is never retried, so it never holds the page: 10 seconds is its limit. If DecisionNode is busy, does not answer in time, cannot be reached or has a server error, the submission is still routed. The answers that met the threshold stand, and each question it was to re-check keeps Flash's answer, below the threshold as it is: Flash is not asked again, since the same request gets the same answer and would only be billed twice. The result and the email say so on those questions and in the summary, for example "DecisionNode was busy, Flash's answer kept", with the reason the API gave. A question no model answered at all, such as when Flash failed too, takes its safe action, and the notice says "safe action taken".

A failure that waiting cannot fix stops the submission: a key that is not accepted, no credit, a refused request, a request the API cannot read, or routing rules that cannot be read. The submission is then not routed and no email is sent; when trying again can help, the page offers it.

Each call's cost is the amount the API reports in the answer's `usage.cost`, with the model's and the knowledge call's parts. When an answer carries no cost, the result shows its tokens instead.

To tune the threshold, see [Confidence-gated routing](https://decisionnode.com/docs/patterns/confidence-gated-routing).

## Pictures

A submission takes up to 4 pictures, JPEG, PNG or WebP, at most 5 MB each. The type is read from each file's bytes, and the count and sizes are checked before anything is sent. Large photos are scaled down in the browser first, so a submission stays small and fast. Pictures are sent in the request itself and stored nowhere. Image tokens are billed at the image price and counted in each call's input tokens.

The sample pictures are our own: screenshots of small pages written for the samples, drawn scenes for the damage and repair photos, and SPECIMEN identity documents with invented names.

## Deploy with Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FBynn-Intelligence%2Fdecision-node-form-router&env=DECISIONNODE_API_KEY,ROUTER_KNOWLEDGE_BASE&envDescription=Your%20DecisionNode%20API%20key%2C%20and%20the%20knowledge%20base%20pnpm%20knowledge%3Asetup%20printed&envLink=https%3A%2F%2Fdecisionnode.com%2Fconsole%2Fkeys)

Run `pnpm knowledge:setup` on your machine first, then set `DECISIONNODE_API_KEY` and `ROUTER_KNOWLEDGE_BASE` as project environment variables. The deployed app is the same as the local one. Every submission is a call on your key, so protect a public deployment, for example with Vercel's Deployment Protection, or keep it private.

## Email

The router can send each routed submission to its team's inbox through [Resend](https://resend.com), as HTML and plain text with the pictures attached, with the submitter's address as the reply-to address.

1. Set `RESEND_API_KEY` and `RESEND_FROM`.
2. Put each team's address in `src/lib/email/inboxes.ts`. The map is typed by each form's team ids and is never sent to the browser.
3. Tick "Email the routed submission to the team" before routing.

Without these, the result shows the email the team would get as a preview. A failed send is shown beside the routing result, which stands.

## Your own forms

Each form is one entry in `src/lib/forms/registry/`: its fields, teams, checks, urgency guidance and samples. A new form is one file there, added to `index.ts`, with its sample pictures in `public/samples/<form>/` and its playbook in `knowledge/<form>/`. Run `pnpm knowledge:setup` after adding a playbook. To check your changes, run `pnpm test`, `pnpm lint` and `pnpm typecheck`.

## License

MIT. See [LICENSE](LICENSE).

## Links

- [Form router guide](https://decisionnode.com/docs/patterns/form-router)
- [Knowledge](https://decisionnode.com/docs/knowledge)
- [Confidence-gated routing](https://decisionnode.com/docs/patterns/confidence-gated-routing)
- [Confidence](https://decisionnode.com/docs/concepts/confidence)
- [Make an API key](https://decisionnode.com/console/keys)
- [`@decisionnode/sdk` on npm](https://www.npmjs.com/package/@decisionnode/sdk)
