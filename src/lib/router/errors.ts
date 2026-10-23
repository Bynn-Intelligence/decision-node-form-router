import {
  AuthenticationError,
  BadRequestError,
  ConnectionError,
  DecisionNodeError,
  InsufficientCreditError,
  NotFoundError,
  OverloadedError,
  PermissionDeniedError,
  RateLimitError,
  RefusalError,
  ServerError,
  TimeoutError,
} from "@decisionnode/sdk";
import { MODEL_NAMES, type ModelKey } from "./config";

export interface DescribedError {
  message: string;
  /** Whether trying the submission again can help. */
  retryable: boolean;
  /** Whether the next model can take the questions over. A fault of the routing rules or the key fails every model alike. */
  passOn: boolean;
  /**
   * Set when the model could not answer for a while (busy, too slow, unreachable,
   * a server error): what happened, in words, with the API's reason when it gave
   * one. The last model failing like this leaves its questions to their safe action
   * rather than failing the submission.
   */
  unavailable?: string;
}

function withReason(text: string, err: DecisionNodeError): string {
  const reason = err.reason || err.message;
  return reason && !/^HTTP \d+/.test(reason) ? `${text} (${reason.replace(/\.$/, "")})` : text;
}

function reasonOf(err: DecisionNodeError): string | null {
  const detail = err.details?.reason;
  return (typeof detail === "string" && detail) || err.reason || err.message || null;
}

const SETUP = "Run pnpm knowledge:setup to load the routing rules.";

/** A failed call in words for the result view, whether trying again can help, and whether the next model may try. */
export function describeError(model: ModelKey, err: unknown): DescribedError {
  const name = MODEL_NAMES[model];
  if (err instanceof DecisionNodeError) {
    // the routing rules: never route without them
    if (err instanceof OverloadedError && err.errorType === "booster_unavailable") {
      const reason = reasonOf(err);
      return {
        message: `The routing rules could not be read${reason ? ` (${reason})` : ""}. Try again in a moment.`,
        retryable: true,
        passOn: false,
      };
    }
    if (err.errorType === "knowledge_collection_empty") {
      return { message: `The knowledge base has no ready routing rules. ${SETUP}`, retryable: false, passOn: false };
    }
    if (err.errorType === "collection_not_found" || (err instanceof NotFoundError && /collection/i.test(err.message))) {
      return { message: `ROUTER_KNOWLEDGE_BASE names no knowledge base of this workspace. ${SETUP}`, retryable: false, passOn: false };
    }
    if (err.errorType === "key_scope_denied") {
      return {
        message: "This key may not read the routing rules' text. Use a Full access key, or a key of that workspace.",
        retryable: false,
        passOn: false,
      };
    }
    if (err.errorType === "booster_not_enabled") {
      return { message: "Knowledge is turned off for this workspace.", retryable: false, passOn: false };
    }
  }
  if (err instanceof TimeoutError) {
    return { message: `${name} did not answer in time.`, retryable: true, passOn: true, unavailable: `${name} did not answer in time` };
  }
  if (err instanceof ConnectionError) {
    return { message: `${name} could not be reached.`, retryable: true, passOn: true, unavailable: `${name} could not be reached` };
  }
  if (err instanceof AuthenticationError) {
    return { message: "The API key was not accepted. Check DECISIONNODE_API_KEY.", retryable: false, passOn: false };
  }
  if (err instanceof InsufficientCreditError) {
    return { message: "The workspace is out of credit or past its free tier for today.", retryable: false, passOn: false };
  }
  if (err instanceof RefusalError) {
    return { message: "The request was refused under the usage policy.", retryable: false, passOn: false };
  }
  if (err instanceof PermissionDeniedError) return { message: `This key may not call ${name}.`, retryable: false, passOn: true };
  if (err instanceof RateLimitError) return { message: `${name} is rate limited right now.`, retryable: true, passOn: true };
  if (err instanceof OverloadedError) {
    return { message: `${name} is busy right now.`, retryable: true, passOn: true, unavailable: withReason(`${name} was busy`, err) };
  }
  if (err instanceof ServerError) {
    return { message: `${name} had a server error.`, retryable: true, passOn: true, unavailable: withReason(`${name} had a server error`, err) };
  }
  if (err instanceof BadRequestError) {
    const detail = err.message ? `: ${err.message.replace(/\.$/, "")}` : "";
    return { message: `${name} could not read the request${detail}.`, retryable: false, passOn: false };
  }
  if (err instanceof DecisionNodeError) {
    const message = `${name} failed${err.status ? ` with HTTP ${err.status}` : ""}.`;
    const server = err.status !== null && err.status >= 500;
    return { message, retryable: true, passOn: true, ...(server ? { unavailable: withReason(`${name} had a server error`, err) } : {}) };
  }
  return { message: `${name} failed.`, retryable: true, passOn: true };
}
