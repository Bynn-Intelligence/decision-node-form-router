import {
  AuthenticationError,
  BadRequestError,
  ConnectionError,
  DecisionNodeError,
  InsufficientCreditError,
  OverloadedError,
  PermissionDeniedError,
  RateLimitError,
  RefusalError,
  ServerError,
  TimeoutError,
} from "@decisionnode/sdk";
import { MODEL_NAMES, type ModelKey } from "./config";
import type { CallError } from "./types";

/** A failed call in words for the result view, and whether trying again can help. */
export function describeError(model: ModelKey, err: unknown): CallError {
  const name = MODEL_NAMES[model];
  if (err instanceof TimeoutError) return { message: `${name} did not answer in time.`, retryable: true };
  if (err instanceof ConnectionError) return { message: `${name} could not be reached.`, retryable: true };
  if (err instanceof AuthenticationError) {
    return { message: "The API key was not accepted. Check DECISIONNODE_API_KEY.", retryable: false };
  }
  if (err instanceof InsufficientCreditError) {
    return { message: "The workspace is out of credit or past its free tier for today.", retryable: false };
  }
  if (err instanceof RefusalError) {
    return { message: "The request was refused under the usage policy.", retryable: false };
  }
  if (err instanceof PermissionDeniedError) {
    return { message: `This key may not call ${name}.`, retryable: false };
  }
  if (err instanceof RateLimitError) return { message: `${name} is rate limited right now.`, retryable: true };
  if (err instanceof OverloadedError) return { message: `${name} is busy right now.`, retryable: true };
  if (err instanceof ServerError) return { message: `${name} had a server error.`, retryable: true };
  if (err instanceof BadRequestError) {
    return { message: `${name} could not read the request${suffix(err)}.`, retryable: false };
  }
  if (err instanceof DecisionNodeError) {
    return { message: `${name} failed${err.status ? ` with HTTP ${err.status}` : ""}.`, retryable: true };
  }
  return { message: `${name} failed.`, retryable: true };
}

function suffix(err: DecisionNodeError): string {
  return err.message ? `: ${err.message.replace(/\.$/, "")}` : "";
}
