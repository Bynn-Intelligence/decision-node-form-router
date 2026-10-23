import {
  AuthenticationError,
  BadRequestError,
  ChoiceAnswer,
  ConnectionError,
  DecisionNodeError,
  InsufficientCreditError,
  OverloadedError,
  RefusalError,
  ScoreAnswer,
  ServerError,
  TimeoutError,
  TruthAnswer,
} from "@decisionnode/sdk";
import { clientOptions } from "@/lib/router/clients";
import { describe, expect, it } from "vitest";
import { FORMS } from "@/lib/forms/definitions";
import type { Picture, Submission } from "@/lib/forms/types";
import { route } from "@/lib/router/cascade";
import { confidenceOf, isSure } from "@/lib/router/confidence";
import { readConfig, type ModelKey } from "@/lib/router/config";
import { buildQuestions, buildState, questionsFor } from "@/lib/router/questions";
import type { RoutingResult } from "@/lib/router/types";
import { PASSAGES, choiceAnswer, fakeDeciders, scoreAnswer, truthAnswer, type WireAnswers } from "./fake-client";

const form = FORMS.support;
const textOnly: Submission = { values: { ...form.samples[0].values }, pictures: [] };
const picture: Picture = { id: "screenshot_1", field: "screenshots", mediaType: "image/png", base64: "iVBORw0KGgo=", bytes: 8 };
const withPicture: Submission = { ...textOnly, pictures: [picture] };

const sure: WireAnswers = {
  team: choiceAnswer("billing", 0.93),
  urgency: scoreAnswer(2.1, 0.81),
  spam: truthAnswer(0.02),
  matches: truthAnswer(0.95),
};

interface RunOptions {
  models?: ModelKey[];
  threshold?: number;
  knowledgeBase?: string | null;
  submission?: Submission;
}

function run(scripts: Parameters<typeof fakeDeciders>[0], opts: RunOptions = {}) {
  const fake = fakeDeciders(scripts);
  const outcome = route({
    form,
    submission: opts.submission ?? textOnly,
    config: { models: opts.models ?? ["flash", "moe"], threshold: opts.threshold ?? 0.7, knowledgeBase: opts.knowledgeBase ?? null },
    clients: fake.clients,
  });
  return { outcome, calls: fake.calls };
}

async function ok(p: ReturnType<typeof run>) {
  const outcome = await p.outcome;
  if (!outcome.ok) throw new Error(`expected a result, got ${outcome.error.message}`);
  return { result: outcome.result, calls: p.calls };
}

function q(result: RoutingResult, id: string) {
  const found = result.questions.find((x) => x.id === id);
  if (!found) throw new Error(`no question ${id}`);
  return found;
}

describe("confidence", () => {
  it("reads confidence for choice and score answers", () => {
    expect(confidenceOf(new ChoiceAnswer(choiceAnswer("billing", 0.64)))).toBe(0.64);
    expect(confidenceOf(new ScoreAnswer(scoreAnswer(1.2, 0.88)))).toBe(0.88);
  });

  it("reads |2p - 1| for truth answers", () => {
    expect(confidenceOf(new TruthAnswer(truthAnswer(0.5)))).toBe(0);
    expect(confidenceOf(new TruthAnswer(truthAnswer(0.85)))).toBe(0.7);
    expect(confidenceOf(new TruthAnswer(truthAnswer(0.15)))).toBe(0.7);
    expect(confidenceOf(new TruthAnswer(truthAnswer(1)))).toBe(1);
    expect(confidenceOf(new TruthAnswer(truthAnswer(0)))).toBe(1);
  });

  it("is sure at the threshold and not below it", () => {
    expect(isSure(0.7, 0.7)).toBe(true);
    expect(isSure(0.6999, 0.7)).toBe(false);
  });

  it("reads a missing answer as not sure", () => {
    expect(confidenceOf(undefined)).toBe(0);
  });
});

describe("the cascade", () => {
  it("settles every question on Flash when it is sure", async () => {
    const { result, calls } = await ok(run({ flash: sure, moe: new Error("must not be called") }));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ model: "decisionnode-flash", questions: ["team", "urgency", "spam"] });
    expect(calls[0].fallback).toBeUndefined();
    expect(result.settledByFlash).toBe(3);
    expect(result.safeActionTaken).toBe(false);
    expect(result.outcome).toMatchObject({ teamId: "billing", queue: "Billing", deliver: true, review: false });
    expect(q(result, "urgency").final).toEqual({ kind: "urgency", label: "High", level: 2 });
    expect(q(result, "spam").final).toEqual({ kind: "flag", value: false, label: "Not spam", raised: false });
  });

  it("sends only the unsure questions to DecisionNode, with fallback false", async () => {
    const { result, calls } = await ok(
      run({ flash: { ...sure, urgency: scoreAnswer(1.6, 0.41) }, moe: { urgency: scoreAnswer(2.9, 0.9) } }),
    );
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(expect.objectContaining({ model: "decisionnode-moe", questions: ["urgency"], fallback: false }));
    expect(calls[1].state).toEqual(calls[0].state);
    expect(q(result, "urgency").settledBy).toBe("moe");
    expect(q(result, "urgency").attempts.map((a) => [a.model, a.sure])).toEqual([
      ["flash", false],
      ["moe", true],
    ]);
    expect(q(result, "urgency").final).toEqual({ kind: "urgency", label: "Critical", level: 3 });
    expect(result.settledByFlash).toBe(2);
  });

  it("escalates a truth answer near 0.5 and holds what is sure to be spam", async () => {
    const { calls, result } = await ok(run({ flash: { ...sure, spam: truthAnswer(0.6) }, moe: { spam: truthAnswer(0.97) } }));
    expect(calls[1].questions).toEqual(["spam"]);
    expect(q(result, "spam").final).toMatchObject({ value: true, raised: true });
    expect(result.outcome.deliver).toBe(false);
  });

  it("takes the safe action when no model is sure", async () => {
    const unsure: WireAnswers = { team: choiceAnswer("billing", 0.4), urgency: scoreAnswer(1, 0.3), spam: truthAnswer(0.55) };
    const { result, calls } = await ok(run({ flash: unsure, moe: unsure }));
    expect(calls.map((c) => c.questions.length)).toEqual([3, 3]);
    expect(result.safeActionTaken).toBe(true);
    expect(result.settledByFlash).toBe(0);
    expect(q(result, "team").settledBy).toBe("safe");
    expect(result.outcome).toMatchObject({ teamId: "customer_care", queue: "Customer care", deliver: true, review: true });
    expect(q(result, "urgency").final).toEqual({ kind: "urgency", label: "Unsure", level: null });
    // never silently dropped: an unsure spam check goes through, marked for review
    expect(q(result, "spam").final).toEqual({ kind: "flag", value: null, label: "Unsure", raised: false });
  });

  it("treats a destination that is not one of the form's teams as unsure", async () => {
    const { result, calls } = await ok(
      run({ flash: { ...sure, team: choiceAnswer("marketing", 0.99) }, moe: { team: choiceAnswer("legal", 0.97) } }),
    );
    expect(calls[1].questions).toEqual(["team"]);
    expect(q(result, "team").attempts[0]).toMatchObject({
      answer: { kind: "destination_unregistered", value: "marketing" },
      confidence: 0,
      sure: false,
    });
    expect(q(result, "team").settledBy).toBe("safe");
    expect(result.outcome.teamId).toBe("customer_care");
  });

  it("treats a missing answer as unsure", async () => {
    const { calls, result } = await ok(
      run({ flash: { team: sure.team, urgency: sure.urgency }, moe: { spam: truthAnswer(0.01) } }),
    );
    expect(calls[1].questions).toEqual(["spam"]);
    expect(q(result, "spam").attempts[0].answer).toEqual({ kind: "none" });
    expect(q(result, "spam").settledBy).toBe("moe");
  });

  it("passes every question to DecisionNode when Flash times out", async () => {
    const { result, calls } = await ok(run({ flash: new TimeoutError("timed out"), moe: sure }));
    expect(calls.map((c) => [c.model, c.questions.length])).toEqual([
      ["decisionnode-flash", 3],
      ["decisionnode-moe", 3],
    ]);
    expect(result.calls[0].error).toEqual({ message: "DecisionNode Flash did not answer in time.", retryable: true });
    expect(result.calls[0].usage).toBeNull();
    expect(result.settledByFlash).toBe(0);
    expect(q(result, "team").settledBy).toBe("moe");
  });

  it("passes every question to DecisionNode when Flash fails", async () => {
    const { result } = await ok(run({ flash: new ConnectionError("socket hang up"), moe: sure }));
    expect(result.calls[0].error?.message).toBe("DecisionNode Flash could not be reached.");
    expect(q(result, "spam").settledBy).toBe("moe");
  });

  it("routes with safe actions when DecisionNode is busy, keeping what Flash settled", async () => {
    const { result, calls } = await ok(
      run({
        flash: { ...sure, team: choiceAnswer("billing", 0.2) },
        moe: new OverloadedError("No ready worker.", { status: 529, retryAfter: 2, reason: "no ready worker" }),
      }),
    );
    expect(calls.map((c) => c.model)).toEqual(["decisionnode-flash", "decisionnode-moe"]);
    expect(result.unavailable).toBe("DecisionNode was busy (no ready worker), safe action taken");
    expect(q(result, "team")).toMatchObject({
      settledBy: "safe",
      unanswered: "DecisionNode was busy (no ready worker), safe action taken",
    });
    expect(result.outcome.teamId).toBe("customer_care");
    // the answers that met the threshold stand
    expect(q(result, "urgency")).toMatchObject({ settledBy: "flash", unanswered: null });
    expect(q(result, "spam").settledBy).toBe("flash");
    expect(result.calls[1].error?.message).toBe("DecisionNode is busy right now.");
  });

  it("routes with safe actions when DecisionNode does not answer in time", async () => {
    const { result } = await ok(run({ flash: { ...sure, urgency: scoreAnswer(1, 0.3) }, moe: new TimeoutError("timed out") }));
    expect(result.unavailable).toBe("DecisionNode did not answer in time, safe action taken");
    expect(q(result, "urgency").final).toEqual({ kind: "urgency", label: "Unsure", level: null });
    expect(result.outcome).toMatchObject({ teamId: "billing", deliver: true });
  });

  it("routes with safe actions when DecisionNode has a server error or cannot be reached", async () => {
    for (const err of [new ServerError("bad gateway", { status: 502 }), new ConnectionError("reset")]) {
      const { result } = await ok(run({ flash: { ...sure, spam: truthAnswer(0.5) }, moe: err }));
      expect(q(result, "spam").settledBy).toBe("safe");
      expect(result.unavailable).toMatch(/safe action taken$/);
    }
  });

  it("gives every question its safe action when Flash and DecisionNode both time out", async () => {
    const { result } = await ok(run({ flash: new TimeoutError("t"), moe: new TimeoutError("t") }));
    expect(result.questions.every((x) => x.settledBy === "safe")).toBe(true);
    expect(result.outcome.teamId).toBe("customer_care");
    expect(result.calls.map((c) => c.error?.message)).toEqual([
      "DecisionNode Flash did not answer in time.",
      "DecisionNode did not answer in time.",
    ]);
  });

  it("still fails when the last model refuses for a reason waiting cannot fix", async () => {
    const unsure = { ...sure, team: choiceAnswer("billing", 0.2) };
    const failures = [
      new InsufficientCreditError("out of credit", { status: 402 }),
      new AuthenticationError("bad key", { status: 401 }),
      new RefusalError("refused", { status: 403 }),
      new BadRequestError("bad", { status: 400 }),
      new OverloadedError("booster unavailable", { status: 529, errorType: "booster_unavailable" }),
    ];
    for (const err of failures) {
      const result = await run({ flash: unsure, moe: err }).outcome;
      expect(result.ok, err.constructor.name).toBe(false);
    }
  });

  it("records the cost and tokens of each call as the API sent them", async () => {
    const { result } = await ok(run({ flash: sure }));
    expect(result.calls[0]).toMatchObject({
      model: "flash",
      version: "decisionnode-flash-test",
      serverMs: 19,
      requestId: "req_flash_1",
      knowledge: null,
      usage: { inputTokens: 420, outputTokens: 0, costUsd: 0.000002604, modelUsd: 0.000002604, boostersUsd: 0, freeTier: false },
    });
  });

  it("records tokens without a cost when the API sends none", async () => {
    const fake = fakeDeciders({ flash: sure }, { input_tokens: 300, output_tokens: 0 });
    const outcome = await route({
      form,
      submission: textOnly,
      config: { models: ["flash", "moe"], threshold: 0.7, knowledgeBase: null },
      clients: fake.clients,
    });
    expect(outcome.ok && outcome.result.calls[0].usage).toMatchObject({ inputTokens: 300, costUsd: null, freeTier: null });
  });
});

describe("pictures", () => {
  it("sends the pictures by id and names their field in the state", async () => {
    const { calls } = await ok(run({ flash: sure }, { submission: withPicture }));
    expect(calls[0].images).toEqual(["screenshot_1"]);
    expect(calls[0].state).toMatchObject({ pictures: [{ id: "screenshot_1", field: "Screenshots" }] });
  });

  it("asks whether the picture fits only when there is one", async () => {
    expect(questionsFor(form, false).map((x) => x.id)).toEqual(["team", "urgency", "spam"]);
    expect(questionsFor(form, true).map((x) => x.id)).toEqual(["team", "urgency", "spam", "matches"]);
    const { calls } = await ok(run({ flash: sure }, { submission: withPicture }));
    expect(calls[0].questions).toContain("matches");
  });

  it("marks a picture that does not fit for review, without holding it", async () => {
    const { result } = await ok(run({ flash: { ...sure, matches: truthAnswer(0.05) } }, { submission: withPicture }));
    expect(q(result, "matches").final).toMatchObject({ value: false, raised: true });
    expect(result.outcome).toMatchObject({ deliver: true, review: true });
  });

  it("asks an identity document's own questions, and asks for a clearer photo when it cannot be read", async () => {
    const fake = fakeDeciders({
      flash: {
        document_type: choiceAnswer("passport", 0.9),
        readable: truthAnswer(0.04),
        name_matches: truthAnswer(0.97),
        spam: truthAnswer(0.01),
      },
    });
    const outcome = await route({
      form: FORMS.identity,
      submission: { values: { ...FORMS.identity.samples[0].values }, pictures: [{ ...picture, id: "document", field: "document" }] },
      config: { models: ["flash"], threshold: 0.7, knowledgeBase: null },
      clients: fake.clients,
    });
    expect(fake.calls[0].questions).toEqual(["document_type", "readable", "name_matches", "spam"]);
    if (!outcome.ok) throw new Error(outcome.error.message);
    expect(outcome.result.outcome).toMatchObject({ queue: "Document check", teamName: "Passport", nextStep: "Ask for a clearer photo" });
  });
});

describe("knowledge", () => {
  const kb = "col_test";

  it("reads the form's rules on every call, Flash and the re-check alike", async () => {
    const { calls } = await ok(
      run({ flash: { ...sure, urgency: scoreAnswer(1.5, 0.3) }, moe: { urgency: scoreAnswer(3, 0.9) } }, { knowledgeBase: kb }),
    );
    const booster = [{ name: "knowledge", require: true, options: { collection: kb, scope: "support", include_text: true } }];
    expect(calls.map((c) => c.boosters)).toEqual([booster, booster]);
  });

  it("shows the passages each call cited, and their cost", async () => {
    const { result } = await ok(run({ flash: sure }, { knowledgeBase: kb }));
    expect(result.knowledge).toBe(true);
    expect(result.calls[0].knowledge?.passages).toEqual([
      { n: 1, pinned: true, title: "Always", heading: "Locked accounts", reference: "support:always", text: PASSAGES[0].text },
      { n: 2, pinned: false, title: "Billing", heading: "Double charges", reference: "support:billing", text: PASSAGES[1].text },
    ]);
    expect(result.calls[0].usage).toMatchObject({ boostersUsd: 0.001, knowledgeTokens: 30 });
  });

  it("routes on the criteria alone without a knowledge base, and says so", async () => {
    const { result, calls } = await ok(run({ flash: sure }));
    expect(calls[0].boosters).toBeUndefined();
    expect(result.knowledge).toBe(false);
  });

  it("fails as retryable, naming the reason, when the rules cannot be read, and never routes without them", async () => {
    const unavailable = new OverloadedError("booster unavailable", {
      status: 529,
      errorType: "booster_unavailable",
      reason: "documents still indexing",
    });
    const result = await run({ flash: unavailable, moe: sure }, { knowledgeBase: kb }).outcome;
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.retryable).toBe(true);
    expect(result.error.message).toMatch(/routing rules could not be read \(documents still indexing\)/);
    // the next model is not asked: it would have to route without the rules
    expect(result.error.calls.map((c) => c.model)).toEqual(["flash"]);
  });

  it("explains an empty or missing knowledge base", async () => {
    const empty = new DecisionNodeError("empty", { status: 409, errorType: "knowledge_collection_empty" });
    const missing = new DecisionNodeError("not found", { status: 404, errorType: "collection_not_found" });
    for (const [err, text] of [
      [empty, /no ready routing rules/],
      [missing, /names no knowledge base/],
    ] as const) {
      const result = await run({ flash: err }, { knowledgeBase: kb }).outcome;
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatchObject({ retryable: false, message: expect.stringMatching(text) });
    }
  });
});

describe("ROUTER_MODELS", () => {
  it("flash,moe re-checks on DecisionNode", async () => {
    const { calls } = await ok(run({ flash: { ...sure, spam: truthAnswer(0.5) }, moe: { spam: truthAnswer(0) } }));
    expect(calls.map((c) => c.model)).toEqual(["decisionnode-flash", "decisionnode-moe"]);
  });

  it("moe sends every question to DecisionNode, with fallback false", async () => {
    const { calls, result } = await ok(run({ flash: new Error("must not be called"), moe: sure }, { models: ["moe"] }));
    expect(calls).toEqual([expect.objectContaining({ model: "decisionnode-moe", fallback: false })]);
    expect(calls[0].questions).toHaveLength(3);
    expect(result.settledByFlash).toBe(0);
  });

  it("flash alone takes the safe action for unsure questions", async () => {
    const { calls, result } = await ok(
      run({ flash: { ...sure, team: choiceAnswer("billing", 0.5) }, moe: new Error("must not be called") }, { models: ["flash"] }),
    );
    expect(calls).toHaveLength(1);
    expect(q(result, "team").settledBy).toBe("safe");
    expect(result.settledByFlash).toBe(2);
  });

  it("flash alone not answering in time takes the safe action for every question", async () => {
    const { result } = await ok(run({ flash: new TimeoutError("t") }, { models: ["flash"] }));
    expect(result.unavailable).toBe("DecisionNode Flash did not answer in time, safe action taken");
    expect(result.safeActionTaken).toBe(true);
  });

  it("flash alone failing on credit is an error", async () => {
    const result = await run({ flash: new InsufficientCreditError("out", { status: 402 }) }, { models: ["flash"] }).outcome;
    expect(result.ok).toBe(false);
  });
});

describe("the clients", () => {
  it("retry Flash once and never the re-check, within each model's timeout", () => {
    expect(clientOptions("k", "flash")).toMatchObject({ model: "decisionnode-flash", timeout: 5_000, maxRetries: 1 });
    expect(clientOptions("k", "moe")).toMatchObject({ model: "decisionnode-moe", timeout: 10_000, maxRetries: 0 });
  });
});

describe("the threshold", () => {
  it("decides what is final", async () => {
    const strict = await ok(run({ flash: sure, moe: sure }, { threshold: 0.9 }));
    expect(strict.calls[1].questions).toEqual(["urgency"]);
    const loose = await ok(run({ flash: sure, moe: sure }, { threshold: 0.5 }));
    expect(loose.calls).toHaveLength(1);
  });
});

describe("configuration", () => {
  it("requires an API key", () => {
    expect(readConfig({})).toEqual({ ok: false, reason: "missing_key" });
    expect(readConfig({ DECISIONNODE_API_KEY: "  " })).toEqual({ ok: false, reason: "missing_key" });
  });

  it("defaults to flash,moe, 0.7 and no knowledge base", () => {
    expect(readConfig({ DECISIONNODE_API_KEY: "dn_test" })).toEqual({
      ok: true,
      config: { apiKey: "dn_test", models: ["flash", "moe"], threshold: 0.7, knowledgeBase: null },
    });
  });

  it("reads ROUTER_KNOWLEDGE_BASE", () => {
    const c = readConfig({ DECISIONNODE_API_KEY: "k", ROUTER_KNOWLEDGE_BASE: " col_abc " });
    expect(c.ok && c.config.knowledgeBase).toBe("col_abc");
  });

  it("reads each ROUTER_MODELS setting", () => {
    const models = (v: string) => {
      const c = readConfig({ DECISIONNODE_API_KEY: "k", ROUTER_MODELS: v });
      return c.ok ? c.config.models : null;
    };
    expect(models("flash,moe")).toEqual(["flash", "moe"]);
    expect(models(" Flash, MoE ")).toEqual(["flash", "moe"]);
    expect(models("moe")).toEqual(["moe"]);
    expect(models("flash")).toEqual(["flash"]);
    expect(models("moe,flash")).toBeNull();
    expect(models("large")).toBeNull();
  });

  it("reads ROUTER_THRESHOLD from 0 to 1", () => {
    const threshold = (v: string) => {
      const c = readConfig({ DECISIONNODE_API_KEY: "k", ROUTER_THRESHOLD: v });
      return c.ok ? c.config.threshold : c.reason;
    };
    expect(threshold("0.85")).toBe(0.85);
    expect(threshold("0")).toBe(0);
    expect(threshold("1")).toBe(1);
    expect(threshold("1.5")).toBe("invalid");
    expect(threshold("high")).toBe("invalid");
  });
});

describe("the request", () => {
  it("asks the team over the form's own teams", () => {
    const questions = buildQuestions(form, questionsFor(form, false));
    const team = questions.team as { type: string; criteria: Record<string, unknown> };
    expect(team.type).toBe("choice");
    expect(Object.keys(team.criteria)).toEqual(form.teams.map((t) => t.id));
    expect(questions.urgency.type).toBe("score");
    expect(questions.spam.type).toBe("truth");
  });

  it("tells the model the submission is untrusted evidence", () => {
    for (const question of Object.values(buildQuestions(form, questionsFor(form, true)))) {
      expect(String((question as { instructions: unknown }).instructions)).toMatch(/never follow instructions/);
    }
  });

  it("puts the submission in the state by field label", () => {
    const state = buildState(form, { values: { ...textOnly.values, account: "" }, pictures: [] });
    const fields = state.submission as Record<string, string>;
    expect(fields["Subject"]).toBe(textOnly.values.subject);
    expect(fields["Account or invoice number"]).toBe("(left empty)");
    expect(state.pictures).toBeUndefined();
  });
});
