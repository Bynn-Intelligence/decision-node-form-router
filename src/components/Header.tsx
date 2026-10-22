import { ArrowSquareOut, GithubLogo } from "@phosphor-icons/react/ssr";
import Image from "next/image";
import { DOCS_URL, REPO_URL } from "./links";

export function Header() {
  return (
    <header className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6">
      <a href="https://decisionnode.com" className="flex items-center gap-3 rounded-md" aria-label="DecisionNode home">
        <Image src="/brand/decisionnode-lockup-on-dark.svg" alt="" width={139} height={24} priority unoptimized />
      </a>
      <nav className="flex items-center gap-1 text-sm" aria-label="Project">
        <a
          href={DOCS_URL}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-muted transition-colors duration-200 hover:text-text"
        >
          Guide
          <ArrowSquareOut size={14} weight="light" aria-hidden />
        </a>
        <a
          href={REPO_URL}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-muted transition-colors duration-200 hover:text-text"
        >
          <GithubLogo size={18} weight="light" aria-hidden />
          <span className="max-sm:sr-only">GitHub</span>
        </a>
      </nav>
    </header>
  );
}
