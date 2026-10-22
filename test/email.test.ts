import { OverloadedError } from "@decisionnode/sdk";
import { describe, expect, it, vi } from "vitest";
import { FORMS } from "@/lib/forms/definitions";
import type { Submission } from "@/lib/forms/types";
import { deliverEmail, readEmailSettings, type Sender } from "@/lib/email/deliver";
import { buildEmail } from "@/lib/email/message";
import { route } from "@/lib/router/cascade";
import type { RoutingResult } from "@/lib/router/types";
import { submit, type SubmitDeps } from "@/lib/submit";
import { choiceAnswer, fakeDeciders, scoreAnswer, truthAnswer, type WireAnswers } from "./fake-client";

const form = FORMS.support;
const submission: Submission = { ...form.samples[0].values };
const sure: WireAnswers = {
  destination: choiceAnswer("billing", 0.93),
  urgency: scoreAnswer(2.1, 0.81),
  spam: truthAnswer(0.02),
};
const settings = { apiKey: "re_test", from: "Router <router@example.com>" };

async function routed(answers: WireAnswers = sure, values = submission): Promise<RoutingResult> {
  const { clients } = fakeDeciders({ flash: answers });
  const outcome = await route({ form, submission: values, config: { models: ["flash"], threshold: 0.7 }, clients });
  if (!outcome.ok) throw new Error(outcome.error.message);
  return outcome.result;
}

function fakeSender(fail = false) {
  const send = vi.fn(async () => {
    if (fail) throw new Error("domain not verified");
    return { id: "em_1" };
  });
  return { sender: { send } as Sender, send };
}

describe("the email", () => {
  it("carries the routing and the submission, in HTML and plain text", async () => {
    const result = await routed();
    const message = await buildEmail(form, submission, result, "billing@example.com");
    expect(message.subject).toBe("[High] Customer contact: Charged twice for October");
    expect(message.to).toBe("billing@example.com");
    expect(message.replyTo).toBe(submission.email);
    expect(message.html).toContain("Billing");
    expect(message.html).toContain("INV-20931");
    expect(message.text).toContain("Charged twice for October");
    expect(message.text).toContain("Not spam");
  });

  it("escapes what the submitter typed", async () => {
    const values = { ...submission, message: '<img src=x onerror="alert(1)">' };
    const message = await buildEmail(form, values, await routed(sure, values), null);
    expect(message.html).not.toContain("<img src=x");
    expect(message.html).toContain("&lt;img");
  });

  it("shows unsure urgency and a spam check marked for review", async () => {
    const result = await routed({ ...sure, urgency: scoreAnswer(1, 0.2), spam: truthAnswer(0.5) });
    const message = await buildEmail(form, submission, result, null);
    expect(message.subject.startsWith("[Unsure]")).toBe(true);
    expect(message.text).toContain("Unsure, review it");
  });
});

describe("sending", () => {
  it("needs both Resend settings", () => {
    expect(readEmailSettings({})).toBeNull();
    expect(readEmailSettings({ RESEND_API_KEY: "re_x" })).toBeNull();
    expect(readEmailSettings({ RESEND_API_KEY: "re_x", RESEND_FROM: "a@b.example" })).toEqual({
      apiKey: "re_x",
      from: "a@b.example",
    });
  });

  it("sends to the team's inbox when opted in, replying to the submitter", async () => {
    const { sender, send } = fakeSender();
    const result = await routed();
    const outcome = await deliverEmail({ form, submission, result, optIn: true, settings, inbox: "billing@example.com", sender });
    expect(outcome.status).toBe("sent");
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ from: settings.from, to: "billing@example.com", replyTo: submission.email }),
    );
  });

  it("previews without the opt-in", async () => {
    const { sender, send } = fakeSender();
    const outcome = await deliverEmail({ form, submission, result: await routed(), optIn: false, settings, inbox: "b@example.com", sender });
    expect(outcome.status).toBe("preview");
    expect(send).not.toHaveBeenCalled();
  });

  it("previews when email is not configured", async () => {
    const outcome = await deliverEmail({ form, submission, result: await routed(), optIn: true, settings: null, inbox: "b@example.com", sender: null });
    expect(outcome).toMatchObject({ status: "preview", reason: expect.stringMatching(/RESEND_API_KEY/) });
  });

  it("previews when the team has no inbox", async () => {
    const { sender, send } = fakeSender();
    const outcome = await deliverEmail({ form, submission, result: await routed(), optIn: true, settings, inbox: null, sender });
    expect(outcome).toMatchObject({ status: "preview", reason: expect.stringMatching(/no inbox is set for Billing/) });
    expect(send).not.toHaveBeenCalled();
  });

  it("holds a submission settled as spam", async () => {
    const { sender, send } = fakeSender();
    const result = await routed({ ...sure, spam: truthAnswer(0.98) });
    const outcome = await deliverEmail({ form, submission, result, optIn: true, settings, inbox: "b@example.com", sender });
    expect(outcome.status).toBe("held");
    expect(send).not.toHaveBeenCalled();
  });

  it("reports a failed send without losing the routing", async () => {
    const { sender } = fakeSender(true);
    const outcome = await deliverEmail({ form, submission, result: await routed(), optIn: true, settings, inbox: "b@example.com", sender });
    expect(outcome).toMatchObject({ status: "failed", reason: expect.stringMatching(/domain not verified/) });
  });
});

describe("a submit", () => {
  function formData(values: Record<string, string>, extra: Record<string, string> = {}) {
    const data = new FormData();
    data.set("form_id", "support");
    for (const [k, v] of Object.entries({ ...values, ...extra })) data.set(k, v);
    return data;
  }

  function deps(scripts: Parameters<typeof fakeDeciders>[0], env: Record<string, string> = {}) {
    const fake = fakeDeciders(scripts);
    const { sender, send } = fakeSender();
    const makeDeciders = vi.fn(() => fake.clients);
    const value: SubmitDeps = {
      env: { DECISIONNODE_API_KEY: "dn_test", ...env },
      makeDeciders,
      makeSender: () => sender,
      inboxFor: () => "billing@example.com",
    };
    return { deps: value, calls: fake.calls, send, makeDeciders };
  }

  it("routes nothing without an API key", async () => {
    const d = deps({ flash: sure });
    const state = await submit(formData(submission), { ...d.deps, env: {} });
    expect(state).toMatchObject({ status: "error", retryable: false });
    expect(d.makeDeciders).not.toHaveBeenCalled();
  });

  it("returns field errors and calls nothing for an invalid submission", async () => {
    const d = deps({ flash: sure });
    const state = await submit(formData({ ...submission, email: "nope" }), d.deps);
    expect(state).toMatchObject({ status: "invalid", errors: { email: expect.any(String) } });
    expect(d.calls).toHaveLength(0);
  });

  it("rejects an unknown form", async () => {
    const d = deps({ flash: sure });
    const data = formData(submission);
    data.set("form_id", "admin");
    expect(await submit(data, d.deps)).toMatchObject({ status: "error", message: "Unknown form." });
  });

  it("sends no email when routing failed", async () => {
    const d = deps(
      { flash: { ...sure, destination: choiceAnswer("billing", 0.3) }, moe: new OverloadedError("busy") },
      { RESEND_API_KEY: "re_x", RESEND_FROM: "a@b.example" },
    );
    const state = await submit(formData(submission, { send_email: "on" }), d.deps);
    expect(state).toMatchObject({ status: "error", retryable: true });
    expect(d.send).not.toHaveBeenCalled();
  });

  it("routes and sends when opted in", async () => {
    const d = deps({ flash: sure }, { RESEND_API_KEY: "re_x", RESEND_FROM: "a@b.example" });
    const state = await submit(formData(submission, { send_email: "on" }), d.deps);
    expect(state.status).toBe("result");
    if (state.status === "result") expect(state.email.status).toBe("sent");
    expect(d.send).toHaveBeenCalledTimes(1);
  });

  it("routes and previews without the opt-in", async () => {
    const d = deps({ flash: sure }, { RESEND_API_KEY: "re_x", RESEND_FROM: "a@b.example" });
    const state = await submit(formData(submission), d.deps);
    if (state.status !== "result") throw new Error(state.status);
    expect(state.email.status).toBe("preview");
    expect(d.send).not.toHaveBeenCalled();
  });
});
