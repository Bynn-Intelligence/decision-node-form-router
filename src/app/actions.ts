"use server";

import { inboxFor } from "@/lib/email/inboxes";
import { resendSender } from "@/lib/email/resend";
import { createDeciders } from "@/lib/router/clients";
import { submit, type SubmitState } from "@/lib/submit";

export async function routeSubmission(_previous: SubmitState, formData: FormData): Promise<SubmitState> {
  return submit(formData, {
    env: process.env,
    makeDeciders: createDeciders,
    makeSender: resendSender,
    inboxFor,
  });
}
