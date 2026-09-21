"use client";

import { RotateCcw } from "lucide-react";
import { useEffect } from "react";

export default function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("AgentSure web surface failed", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-end bg-ink p-6 text-paper sm:p-12">
      <div className="max-w-3xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-lime">
          Interface degraded / onchain state unaffected
        </p>
        <h1 className="mt-8 font-display text-6xl leading-[0.87] tracking-[-0.08em] sm:text-8xl">
          The surface failed.
          <br />
          The contract did not.
        </h1>
        <button
          className="mt-10 flex items-center gap-3 border border-paper/30 px-5 py-4 text-xs font-bold uppercase tracking-[0.14em] hover:border-lime hover:text-lime"
          onClick={reset}
          type="button"
        >
          <RotateCcw className="size-4" aria-hidden="true" /> Retry interface
        </button>
      </div>
    </main>
  );
}
