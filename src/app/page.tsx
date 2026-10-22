import { connection } from "next/server";
import { App } from "@/components/App";
import { Header } from "@/components/Header";
import { Setup } from "@/components/Setup";
import { readEmailSettings } from "@/lib/email/deliver";
import { isFormId } from "@/lib/forms/definitions";
import { describeModels, formatConfidence } from "@/lib/format";
import { readConfig } from "@/lib/router/config";

export default async function Home({ searchParams }: PageProps<"/">) {
  // the settings are read per request, so a deployed app picks up a new key without a rebuild
  await connection();
  const config = readConfig(process.env);
  const form = (await searchParams).form;

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-[1400px] px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">Form router</h1>
          <p className="mt-4 max-w-[62ch] text-lg leading-relaxed text-muted">
            Every submission is routed by your own rules. Flash answers first, and only the questions it is unsure of go on
            to DecisionNode.
          </p>
          {config.ok && (
            <p className="mt-5 inline-flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted">
              <span>
                ROUTER_MODELS <span className="text-text">{describeModels(config.config.models)}</span>
              </span>
              <span>
                ROUTER_THRESHOLD <span className="text-text">{formatConfidence(config.config.threshold)}</span>
              </span>
              <span>
                ROUTER_KNOWLEDGE_BASE <span className="text-text">{config.config.knowledgeBase ? "set" : "not set"}</span>
              </span>
            </p>
          )}
        </div>

        <div className="mt-10">
          {config.ok ? (
            <App
              initialForm={isFormId(form) ? form : null}
              settings={{
                models: [...config.config.models],
                threshold: config.config.threshold,
                emailOn: readEmailSettings(process.env) !== null,
                knowledge: config.config.knowledgeBase !== null,
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
