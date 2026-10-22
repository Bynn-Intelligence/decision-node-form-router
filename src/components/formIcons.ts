import {
  Briefcase,
  Bug,
  ChatCircleText,
  CreditCard,
  IdentificationCard,
  RoadHorizon,
  Storefront,
  Umbrella,
  Wrench,
  type Icon,
} from "@phosphor-icons/react";
import type { FormId } from "@/lib/forms/definitions";

export const FORM_ICONS: Record<FormId, Icon> = {
  sales: Briefcase,
  support: ChatCircleText,
  bugs: Bug,
  insurance: Umbrella,
  identity: IdentificationCard,
  maintenance: Wrench,
  street: RoadHorizon,
  dispute: CreditCard,
  marketplace: Storefront,
};
