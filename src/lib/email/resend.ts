import "server-only";
import { Resend } from "resend";
import type { EmailSettings, Sender } from "./deliver";

export function resendSender(settings: EmailSettings): Sender {
  const resend = new Resend(settings.apiKey);
  return {
    async send({ from, to, replyTo, subject, html, text }) {
      const { data, error } = await resend.emails.send({ from, to, replyTo, subject, html, text });
      if (error || !data) throw new Error(error?.message ?? "Resend returned no id");
      return { id: data.id };
    },
  };
}
