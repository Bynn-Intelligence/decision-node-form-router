import { InsufficientCreditError, OverloadedError } from "@decisionnode/sdk";
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
const values = { ...form.samples[0].values };
const submission: Submission = { values, pictures: [] };
const sure: WireAnswers = {
  team: choiceAnswer("billing", 0.93),
  urgency: scoreAnswer(2.1, 0.81),
  spam: truthAnswer(0.02),
  matches: truthAnswer(0.97),
};
const settings = { apiKey: "re_test", from: "Router <router@example.com>" };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

async function routed(answers: WireAnswers = sure, s: Submission = submission): Promise<RoutingResult> {
  const { clients } = fakeDeciders({ flash: answers });
  const outcome = await route({ form, submission: s, config: { models: ["flash"], threshold: 0.7, knowledgeBase: null }, clients });
  if (!outcome.ok) throw new Error(outcome.error.message);
  return outcome.result;
}

function fakeSender(fail = false) {
  const send = vi.fn<Sender["send"]>(async () => {
    if (fail) throw new Error("domain not verified");
    return { id: "em_1" };
  });
  return { sender: { send } as Sender, send };
}

describe("the email", () => {
  it("carries the routing and the submission, in HTML and plain text", async () => {
    const message = await buildEmail(form, submission, await routed(), "billing@example.com");
    expect(message.subject).toBe("[High] Customer contact: Charged twice for October");
    expect(message.to).toBe("billing@example.com");
    expect(message.replyTo).toBe(values.email);
    expect(message.html).toContain("Billing");
    expect(message.html).toContain("INV-20931");
    expect(message.text).toContain("Charged twice for October");
    expect(message.text).toContain("Not spam");
  });

  it("keeps the subject on one line", async () => {
    const s = { values: { ...values, subject: "Refund\r\nBcc: someone@example.com" }, pictures: [] };
    const message = await buildEmail(form, s, await routed(sure, s), null);
    expect(message.subject).toBe("[High] Customer contact: Refund");
  });

  it("escapes what the submitter typed", async () => {
    const s = { values: { ...values, message: '<img src=x onerror="alert(1)">' }, pictures: [] };
    const message = await buildEmail(form, s, await routed(sure, s), null);
    expect(message.html).not.toContain("<img src=x");
    expect(message.html).toContain("&lt;img");
  });

  it("shows unsure urgency and a check marked for review", async () => {
    const message = await buildEmail(form, submission, await routed({ ...sure, urgency: scoreAnswer(1, 0.2), spam: truthAnswer(0.5) }), null);
    expect(message.subject.startsWith("[Unsure]")).toBe(true);
    expect(message.text).toContain("Unsure, review it");
  });

  it("lists the pictures as attachments", async () => {
    const s: Submission = {
      values,
      pictures: [{ id: "screenshot_1", field: "screenshots", mediaType: "image/png", base64: "iVBORw0KGgo=", bytes: 8 }],
    };
    const message = await buildEmail(form, s, await routed(sure, s), null);
    expect(message.attachments).toEqual(["screenshot_1.png"]);
  });
});

describe("sending", () => {
  it("needs both Resend settings", () => {
    expect(readEmailSettings({})).toBeNull();
    expect(readEmailSettings({ RESEND_API_KEY: "re_x" })).toBeNull();
    expect(readEmailSettings({ RESEND_API_KEY: "re_x", RESEND_FROM: "a@b.example" })).toEqual({ apiKey: "re_x", from: "a@b.example" });
  });

  it("sends to the team's inbox when opted in, replying to the submitter, with the pictures attached", async () => {
    const { sender, send } = fakeSender();
    const s: Submission = {
      values,
      pictures: [{ id: "screenshot_1", field: "screenshots", mediaType: "image/png", base64: "iVBORw0KGgo=", bytes: 8 }],
    };
    const outcome = await deliverEmail({ form, submission: s, result: await routed(sure, s), optIn: true, settings, inbox: "billing@example.com", sender });
    expect(outcome.status).toBe("sent");
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: settings.from,
        to: "billing@example.com",
        replyTo: values.email,
        files: [{ filename: "screenshot_1.png", content: "iVBORw0KGgo=" }],
      }),
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
    const outcome = await deliverEmail({ form, submission, result: await routed({ ...sure, spam: truthAnswer(0.98) }), optIn: true, settings, inbox: "b@example.com", sender });
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
  function formData(v: Record<string, string>, extra: Record<string, string> = {}) {
    const data = new FormData();
    data.set("form_id", "support");
    for (const [k, value] of Object.entries({ ...v, ...extra })) data.set(k, value);
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
    const state = await submit(formData(values), { ...d.deps, env: {} });
    expect(state).toMatchObject({ status: "error", retryable: false });
    expect(d.makeDeciders).not.toHaveBeenCalled();
  });

  it("returns field errors and calls nothing for an invalid submission", async () => {
    const d = deps({ flash: sure });
    const state = await submit(formData({ ...values, email: "nope" }), d.deps);
    expect(state).toMatchObject({ status: "invalid", errors: { email: expect.any(String) } });
    expect(d.calls).toHaveLength(0);
  });

  it("refuses a file that is not a picture", async () => {
    const d = deps({ flash: sure });
    const data = formData(values);
    data.append("screenshots", new File(["%PDF-1.7"], "statement.pdf", { type: "image/png" }));
    const state = await submit(data, d.deps);
    expect(state).toMatchObject({ status: "invalid", errors: { screenshots: expect.stringMatching(/statement\.pdf/) } });
    expect(d.calls).toHaveLength(0);
  });

  it("sends the pictures with the request", async () => {
    const d = deps({ flash: sure });
    const data = formData(values);
    data.append("screenshots", new File([PNG], "billing.png", { type: "image/png" }));
    const state = await submit(data, d.deps);
    expect(state.status).toBe("result");
    expect(d.calls[0].images).toEqual(["screenshot_1"]);
    expect(d.calls[0].questions).toContain("matches");
  });

  it("reads the knowledge base from the settings", async () => {
    const d = deps({ flash: sure }, { ROUTER_KNOWLEDGE_BASE: "col_rules" });
    await submit(formData(values), d.deps);
    expect(d.calls[0].boosters).toEqual([
      { name: "knowledge", require: true, options: { collection: "col_rules", scope: "support", include_text: true } },
    ]);
  });

  it("rejects an unknown form", async () => {
    const d = deps({ flash: sure });
    const data = formData(values);
    data.set("form_id", "admin");
    expect(await submit(data, d.deps)).toMatchObject({ status: "error", message: "Unknown form." });
  });

  it("sends no email when routing failed", async () => {
    const d = deps(
      { flash: { ...sure, team: choiceAnswer("billing", 0.3) }, moe: new InsufficientCreditError("out of credit", { status: 402 }) },
      { RESEND_API_KEY: "re_x", RESEND_FROM: "a@b.example" },
    );
    const state = await submit(formData(values, { send_email: "on" }), d.deps);
    expect(state).toMatchObject({ status: "error", retryable: false });
    expect(d.send).not.toHaveBeenCalled();
  });

  it("routes and sends when DecisionNode was busy, the email saying so", async () => {
    const d = deps(
      { flash: { ...sure, team: choiceAnswer("billing", 0.3) }, moe: new OverloadedError("busy", { status: 529 }) },
      { RESEND_API_KEY: "re_x", RESEND_FROM: "a@b.example" },
    );
    const state = await submit(formData(values, { send_email: "on" }), d.deps);
    if (state.status !== "result") throw new Error(state.status);
    expect(state.result.unavailable).toMatch(/^DecisionNode was busy/);
    expect(state.email.status).toBe("sent");
    expect(state.email.message.text).toMatch(/DecisionNode was busy/);
  });

  it("routes and sends when opted in", async () => {
    const d = deps({ flash: sure }, { RESEND_API_KEY: "re_x", RESEND_FROM: "a@b.example" });
    const state = await submit(formData(values, { send_email: "on" }), d.deps);
    expect(state.status).toBe("result");
    if (state.status === "result") expect(state.email.status).toBe("sent");
    expect(d.send).toHaveBeenCalledTimes(1);
  });

  it("routes and previews without the opt-in", async () => {
    const d = deps({ flash: sure }, { RESEND_API_KEY: "re_x", RESEND_FROM: "a@b.example" });
    const state = await submit(formData(values), d.deps);
    if (state.status !== "result") throw new Error(state.status);
    expect(state.email.status).toBe("preview");
    expect(d.send).not.toHaveBeenCalled();
  });
});
