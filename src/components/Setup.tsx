import { ArrowSquareOut, Key, Warning } from "@phosphor-icons/react/ssr";
import { KEYS_URL } from "./links";

type SetupProps = { reason: "missing_key" } | { reason: "invalid"; problems: string[] };

export function Setup(props: SetupProps) {
  const missing = props.reason === "missing_key";
  return (
    <section
      aria-labelledby="setup-title"
      className="w-full max-w-2xl rounded-2xl border border-line bg-panel p-6 sm:p-10"
    >
      <div className="flex size-11 items-center justify-center rounded-xl bg-raised text-lime">
        {missing ? <Key size={24} weight="light" aria-hidden /> : <Warning size={24} weight="light" aria-hidden />}
      </div>
      <h2 id="setup-title" className="mt-6 text-2xl font-semibold tracking-tight">
        {missing ? "Add your API key to start routing" : "Fix the settings to start routing"}
      </h2>
      {missing ? (
        <p className="mt-3 max-w-[60ch] leading-relaxed text-muted">
          The form router sends every submission to the DecisionNode API, so it needs a key. Nothing is routed until
          one is set.
        </p>
      ) : (
        <ul className="mt-4 space-y-2 text-muted">
          {props.problems.map((p) => (
            <li key={p} className="font-mono text-sm leading-relaxed">
              {p}
            </li>
          ))}
        </ul>
      )}

      {missing && (
        <ol className="mt-8 space-y-6">
          <li className="grid grid-cols-[2rem_1fr] gap-3">
            <span className="font-mono text-sm leading-6 text-lime">1</span>
            <div>
              <p className="font-medium">Make a key</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Sign in and create one in the console. Making a key is free.
              </p>
              <a
                href={KEYS_URL}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-lime px-4 py-2 text-sm font-medium text-ink transition-transform duration-200 ease-out-soft active:scale-[0.98]"
              >
                Open the console
                <ArrowSquareOut size={16} weight="light" aria-hidden />
              </a>
            </div>
          </li>
          <li className="grid grid-cols-[2rem_1fr] gap-3">
            <span className="font-mono text-sm leading-6 text-lime">2</span>
            <div>
              <p className="font-medium">Put it in .env.local</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                In the project folder, next to package.json. On Vercel, add it under Settings, Environment Variables
                instead.
              </p>
              <pre className="mt-3 overflow-x-auto rounded-lg border border-line bg-page px-4 py-3 font-mono text-sm text-lime-soft">
                DECISIONNODE_API_KEY=your-api-key
              </pre>
            </div>
          </li>
          <li className="grid grid-cols-[2rem_1fr] gap-3">
            <span className="font-mono text-sm leading-6 text-lime">3</span>
            <div>
              <p className="font-medium">Restart the app</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Stop <code className="font-mono text-text">pnpm dev</code> and start it again, or redeploy on Vercel, then
                reload this page.
              </p>
            </div>
          </li>
        </ol>
      )}
    </section>
  );
}
