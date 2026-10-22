import { Gauge, ShieldCheck, Signpost, type Icon } from "@phosphor-icons/react";
import type { QuestionId } from "@/lib/router/questions";

export const QUESTION_META: Record<QuestionId, { title: string; icon: Icon; type: string }> = {
  destination: { title: "Team", icon: Signpost, type: "choice" },
  urgency: { title: "Urgency", icon: Gauge, type: "score" },
  spam: { title: "Spam check", icon: ShieldCheck, type: "truth" },
};

