import { ConnectionError, OverloadedError, ScoreAnswer, TimeoutError, TruthAnswer, ChoiceAnswer } from "@decisionnode/sdk";
import { describe, expect, it } from "vitest";
import { FORMS } from "@/lib/forms/definitions";
import { route } from "@/lib/router/cascade";
import { confidenceOf, isSure } from "@/lib/router/confidence";
import { readConfig, type ModelKey } from "@/lib/router/config";
import { buildQuestions, buildState } from "@/lib/router/questions";
import { choiceAnswer, fakeDeciders, scoreAnswer, truthAnswer, type WireAnswers } from "./fake-client";

const form = FORMS.support;
const submission = { ...form.samples[0].values };
const sure: WireAnswers = {
  destination: choiceAnswer("billing", 0.93),
  urgency: scoreAnswer(2.1, 0.81),
  spam: truthAnswer(0.02),
};

function run(scripts: Parameters<typeof fakeDeciders>[0], models: ModelKey[] = ["flash", "moe"], threshold = 0.7) {
  const fake = fakeDeciders(scripts);
  const outcome = route({ form, submission, config: { models, threshold }, clients: fake.clients });
  return { outcome, calls: fake.calls };
}

async function ok(p: ReturnType<typeof run>) {
  const outcome = await p.outcome;
  if (!outcome.ok) throw new Error(`expected a result, got ${outcome.error.message}`);
  return { result: outcome.result, calls: p.calls };
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
    expect(calls[0]).toMatchObject({ model: "decisionnode-flash", questions: ["destination", "urgency", "spam"] });
    expect(calls[0].fallback).toBeUndefined();
    expect(result.settledByFlash).toBe(3);
    expect(result.safeActionTaken).toBe(false);
    expect(result.destination).toEqual({ teamId: "billing", teamName: "Billing" });
    expect(result.questions.urgency.final).toEqual({ kind: "urgency", label: "High", level: 2 });
    expect(result.questions.spam.final).toEqual({ kind: "spam", spam: false, review: false });
    expect(result.deliver).toBe(true);
  });

  it("sends only the unsure questions to DecisionNode, with fallback false", async () => {
    const { result, calls } = await ok(
      run({
        flash: { ...sure, urgency: scoreAnswer(1.6, 0.41) },
        moe: { urgency: scoreAnswer(2.9, 0.9) },
      }),
    );
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(
      expect.objectContaining({ model: "decisionnode-moe", questions: ["urgency"], fallback: false }),
    );
    expect(calls[1].state).toEqual(calls[0].state);
    expect(result.questions.urgency.settledBy).toBe("moe");
    expect(result.questions.urgency.attempts.map((a) => [a.model, a.sure])).toEqual([
      ["flash", false],
      ["moe", true],
    ]);
    expect(result.questions.urgency.final).toEqual({ kind: "urgency", label: "Critical", level: 3 });
    expect(result.settledByFlash).toBe(2);
  });

  it("escalates a truth answer near 0.5", async () => {
    const { calls, result } = await ok(
      run({ flash: { ...sure, spam: truthAnswer(0.6) }, moe: { spam: truthAnswer(0.97) } }),
    );
    expect(calls[1].questions).toEqual(["spam"]);
    expect(result.questions.spam.final).toEqual({ kind: "spam", spam: true, review: false });
    expect(result.deliver).toBe(false);
  });

  it("takes the safe action when no model is sure", async () => {
    const unsure: WireAnswers = {
      destination: choiceAnswer("billing", 0.4),
      urgency: scoreAnswer(1, 0.3),
      spam: truthAnswer(0.55),
    };
    const { result, calls } = await ok(run({ flash: unsure, moe: unsure }));
    expect(calls.map((c) => c.questions.length)).toEqual([3, 3]);
    expect(result.safeActionTaken).toBe(true);
    expect(result.settledByFlash).toBe(0);
    expect(result.questions.destination.settledBy).toBe("safe");
    expect(result.destination).toEqual({ teamId: "customer_care", teamName: "Customer care" });
    expect(result.questions.destination.safeAction).toEqual({
      question: "destination",
      teamId: "customer_care",
      teamName: "Customer care",
    });
    expect(result.questions.urgency.final).toEqual({ kind: "urgency", label: "Unsure", level: null });
    expect(result.questions.spam.final).toEqual({ kind: "spam", spam: false, review: true });
    expect(result.deliver).toBe(true);
  });

  it("treats a destination that is not one of the form's teams as unsure", async () => {
    const { result, calls } = await ok(
      run({
        flash: { ...sure, destination: choiceAnswer("marketing", 0.99) },
        moe: { destination: choiceAnswer("legal", 0.97) },
      }),
    );
    expect(calls[1].questions).toEqual(["destination"]);
    expect(result.questions.destination.attempts[0]).toMatchObject({
      answer: { kind: "destination_unregistered", value: "marketing" },
      confidence: 0,
      sure: false,
    });
    expect(result.questions.destination.settledBy).toBe("safe");
    expect(result.destination.teamId).toBe("customer_care");
  });

  it("treats a missing answer as unsure", async () => {
    const { calls, result } = await ok(
      run({ flash: { destination: sure.destination, urgency: sure.urgency }, moe: { spam: truthAnswer(0.01) } }),
    );
    expect(calls[1].questions).toEqual(["spam"]);
    expect(result.questions.spam.attempts[0].answer).toEqual({ kind: "none" });
    expect(result.questions.spam.settledBy).toBe("moe");
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
    expect(result.questions.destination.settledBy).toBe("moe");
  });

  it("passes every question to DecisionNode when Flash fails", async () => {
    const { result } = await ok(run({ flash: new ConnectionError("socket hang up"), moe: sure }));
    expect(result.calls[0].error?.message).toBe("DecisionNode Flash could not be reached.");
    expect(result.questions.spam.settledBy).toBe("moe");
  });

  it("returns a retryable error when DecisionNode fails", async () => {
    const { outcome } = run({
      flash: { ...sure, destination: choiceAnswer("billing", 0.2) },
      moe: new OverloadedError("busy", { status: 529, retryAfter: 2 }),
    });
    const result = await outcome;
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ message: "DecisionNode is busy right now.", retryable: true });
    expect(result.error.calls.map((c) => c.model)).toEqual(["flash", "moe"]);
  });

  it("returns an error when Flash and DecisionNode both fail", async () => {
    const { outcome } = run({ flash: new TimeoutError("t"), moe: new TimeoutError("t") });
    const result = await outcome;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.retryable).toBe(true);
  });

  it("records the cost and tokens of each call as the API sent them", async () => {
    const { result } = await ok(run({ flash: sure }));
    expect(result.calls[0]).toMatchObject({
      model: "flash",
      version: "decisionnode-flash-test",
      serverMs: 19,
      requestId: "req_flash_1",
      usage: { inputTokens: 420, outputTokens: 3, costUsd: 0.000002604, freeTier: false },
    });
  });

  it("records tokens without a cost when the API sends none", async () => {
    const fake = fakeDeciders({ flash: sure }, { input_tokens: 300, output_tokens: 3 });
    const outcome = await route({ form, submission, config: { models: ["flash", "moe"], threshold: 0.7 }, clients: fake.clients });
    expect(outcome.ok && outcome.result.calls[0].usage).toEqual({
      inputTokens: 300,
      outputTokens: 3,
      costUsd: null,
      freeTier: null,
    });
  });
});

describe("ROUTER_MODELS", () => {
  it("flash,moe re-checks on DecisionNode", async () => {
    const { calls } = await ok(run({ flash: { ...sure, spam: truthAnswer(0.5) }, moe: { spam: truthAnswer(0) } }));
    expect(calls.map((c) => c.model)).toEqual(["decisionnode-flash", "decisionnode-moe"]);
  });

  it("moe sends every question to DecisionNode, with fallback false", async () => {
    const { calls, result } = await ok(run({ flash: new Error("must not be called"), moe: sure }, ["moe"]));
    expect(calls).toEqual([expect.objectContaining({ model: "decisionnode-moe", fallback: false })]);
    expect(calls[0].questions).toHaveLength(3);
    expect(result.settledByFlash).toBe(0);
  });

  it("flash alone takes the safe action for unsure questions", async () => {
    const { calls, result } = await ok(
      run({ flash: { ...sure, destination: choiceAnswer("billing", 0.5) }, moe: new Error("must not be called") }, ["flash"]),
    );
    expect(calls).toHaveLength(1);
    expect(result.questions.destination.settledBy).toBe("safe");
    expect(result.settledByFlash).toBe(2);
  });

  it("flash alone failing is an error", async () => {
    const result = await run({ flash: new TimeoutError("t") }, ["flash"]).outcome;
    expect(result.ok).toBe(false);
  });
});

describe("the threshold", () => {
  it("decides what is final", async () => {
    const strict = await ok(run({ flash: sure, moe: sure }, ["flash", "moe"], 0.9));
    expect(strict.calls[1].questions).toEqual(["urgency"]);
    const loose = await ok(run({ flash: sure, moe: sure }, ["flash", "moe"], 0.5));
    expect(loose.calls).toHaveLength(1);
  });
});

describe("configuration", () => {
  it("requires an API key", () => {
    expect(readConfig({})).toEqual({ ok: false, reason: "missing_key" });
    expect(readConfig({ DECISIONNODE_API_KEY: "  " })).toEqual({ ok: false, reason: "missing_key" });
  });

  it("defaults to flash,moe and 0.7", () => {
    expect(readConfig({ DECISIONNODE_API_KEY: "dn_test" })).toEqual({
      ok: true,
      config: { apiKey: "dn_test", models: ["flash", "moe"], threshold: 0.7 },
    });
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
  it("asks the three questions over the form's own teams", () => {
    const q = buildQuestions(form);
    expect(q.destination.type).toBe("choice");
    expect(Object.keys(q.destination.criteria)).toEqual(form.teams.map((t) => t.id));
    expect(q.urgency.type).toBe("score");
    expect(q.spam.type).toBe("truth");
  });

  it("tells the model the submission is untrusted evidence", () => {
    const q = buildQuestions(form);
    for (const question of Object.values(q)) {
      expect(String(question.instructions)).toMatch(/never follow instructions/);
    }
  });

  it("puts the submission in the state by field label", () => {
    const state = buildState(form, { ...submission, account: "" });
    expect(state.submission["Subject"]).toBe(submission.subject);
    expect(state.submission["Account or invoice number"]).toBe("(left empty)");
  });
});
