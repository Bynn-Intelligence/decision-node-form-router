import { connection } from "next/server";
import { Header } from "@/components/Header";
import { Router } from "@/components/Router";
import { Setup } from "@/components/Setup";
import { readEmailSettings } from "@/lib/email/deliver";
import { describeModels, formatConfidence } from "@/lib/format";
import { readConfig } from "@/lib/router/config";

export default async function Home() {
  // the settings are read per request, so a deployed app picks up a new key without a rebuild
  await connection();
  const config = readConfig(process.env);

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-[1400px] px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Form router
          </h1>
          <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-muted">
            Flash answers three questions about each submission. Only the ones it is unsure of go on to DecisionNode.
          </p>
          {config.ok && (
            <p className="mt-5 inline-flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted">
              <span>
                ROUTER_MODELS <span className="text-text">{describeModels(config.config.models)}</span>
              </span>
              <span>
                ROUTER_THRESHOLD <span className="text-text">{formatConfidence(config.config.threshold)}</span>
              </span>
            </p>
          )}
        </div>

        <div className="mt-10">
          {config.ok ? (
            <Router
              settings={{
                models: [...config.config.models],
                threshold: config.config.threshold,
                emailOn: readEmailSettings(process.env) !== null,
              }}
            />
          ) : config.reason === "missing_key" ? (
            <Setup reason="missing_key" />
          ) : (
            <Setup reason="invalid" problems={config.problems} />
          )}
        </div>
      </main>
    </>
  );
}
