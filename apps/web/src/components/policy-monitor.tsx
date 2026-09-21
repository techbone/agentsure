"use client";

import { ExternalLink, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { compactAddress, displayUsdc } from "@/lib/display";
import type { PolicyView } from "@/lib/policy-read-model";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; policy: PolicyView }
  | { kind: "empty" }
  | { kind: "degraded"; message: string };

export function PolicyMonitor({ policyId = "1" }: { policyId?: string }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setState({ kind: "loading" });
      setRefreshing(quiet);
      try {
        const response = await fetch(`/api/policies/${policyId}`, { cache: "no-store" });
        if (response.status === 404) {
          setState({ kind: "empty" });
          return;
        }
        const payload = (await response.json()) as PolicyView | { message?: string };
        if (!response.ok) {
          setState({
            kind: "degraded",
            message:
              "message" in payload && payload.message
                ? payload.message
                : "Arc data is temporarily unavailable.",
          });
          return;
        }
        setState({ kind: "ready", policy: payload as PolicyView });
      } catch {
        setState({
          kind: "degraded",
          message: "The Arc read endpoint could not be reached. No offchain fallback is displayed.",
        });
      } finally {
        setRefreshing(false);
      }
    },
    [policyId],
  );

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(true), 15_000);
    return () => window.clearInterval(interval);
  }, [load]);

  if (state.kind === "loading") return <PolicyMonitorSkeleton />;

  if (state.kind === "empty") {
    return (
      <section className="flex min-h-[520px] flex-col justify-between border border-line bg-ink-soft p-6 sm:p-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper/45">
          Arc read model / empty
        </p>
        <div>
          <p className="font-display text-4xl tracking-[-0.06em]">No policy #{policyId}</p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-paper/55">
            No matching onchain policy was found. The interface will never manufacture a local one.
          </p>
        </div>
      </section>
    );
  }

  if (state.kind === "degraded") {
    return (
      <section className="flex min-h-[520px] flex-col justify-between border border-line bg-ink-soft p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper/45">
            Arc read model / degraded
          </p>
          <TriangleAlert className="size-5 text-lime" aria-hidden="true" />
        </div>
        <div>
          <p className="font-display text-4xl tracking-[-0.06em]">We refuse to guess.</p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-paper/55">{state.message}</p>
          <button
            className="mt-6 border border-paper/30 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] hover:border-lime hover:text-lime"
            onClick={() => void load()}
            type="button"
          >
            Retry Arc read
          </button>
        </div>
      </section>
    );
  }

  const { policy } = state;
  const statusTone =
    policy.status === "Executed" ? "bg-lime text-ink" : "border border-lime text-lime";

  return (
    <section
      className="relative min-h-[520px] overflow-hidden border border-line bg-ink-soft"
      aria-labelledby="monitor-title"
    >
      <div className="dot-grid absolute inset-0 opacity-35" />
      <div className="scan-line absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-transparent via-lime/5 to-transparent" />
      <div className="relative flex min-h-[520px] flex-col p-6 sm:p-8">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper/45">
              Finalized Arc state / policy {policy.policyId.padStart(4, "0")}
            </p>
            <h2 id="monitor-title" className="mt-2 font-display text-2xl tracking-[-0.04em]">
              Protected position
            </h2>
          </div>
          <span
            className={`px-3 py-2 font-mono text-[10px] font-bold tracking-[0.16em] ${statusTone}`}
          >
            {policy.status.toUpperCase()}
          </span>
        </div>

        <div className="my-auto py-14">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-paper/45">
            Value returned
          </p>
          <p className="mt-2 font-display text-[clamp(3.8rem,8vw,7.5rem)] leading-[0.83] tracking-[-0.085em]">
            {displayUsdc(policy.assetsReturned, 4)}
          </p>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-lime">USDC</p>
        </div>

        <dl className="grid grid-cols-2 border-y border-paper/10 text-xs">
          <div className="border-r border-paper/10 py-4 pr-4">
            <dt className="text-paper/40">Trigger</dt>
            <dd className="mt-1 font-mono">{displayUsdc(policy.triggerAssets)} USDC</dd>
          </div>
          <div className="py-4 pl-4">
            <dt className="text-paper/40">Loss bound</dt>
            <dd className="mt-1 font-mono">{policy.lossLimitBps / 100}%</dd>
          </div>
          <div className="border-r border-t border-paper/10 py-4 pr-4">
            <dt className="text-paper/40">Beneficiary</dt>
            <dd className="mt-1 font-mono">{compactAddress(policy.beneficiary)}</dd>
          </div>
          <div className="border-t border-paper/10 py-4 pl-4">
            <dt className="text-paper/40">Observed block</dt>
            <dd className="mt-1 font-mono">{Number(policy.observedBlock).toLocaleString()}</dd>
          </div>
        </dl>

        <div className="mt-5 flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.14em] text-paper/45">
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-lime" aria-hidden="true" /> Onchain source
          </span>
          <span className="flex items-center gap-3">
            <button
              aria-label="Refresh policy from Arc"
              className="hover:text-lime disabled:opacity-40"
              disabled={refreshing}
              onClick={() => void load(true)}
              type="button"
            >
              <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <a
              className="flex items-center gap-1 hover:text-lime"
              href={`https://explorer.testnet.arc.io/address/${policy.managerAddress}`}
              rel="noreferrer"
              target="_blank"
            >
              Contract <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </span>
        </div>
      </div>
    </section>
  );
}

function PolicyMonitorSkeleton() {
  return (
    <section
      aria-label="Loading policy from Arc"
      className="min-h-[520px] animate-pulse border border-line bg-ink-soft p-6 sm:p-8"
    >
      <div className="h-3 w-44 bg-paper/10" />
      <div className="mt-36 h-24 w-3/4 bg-paper/10" />
      <div className="mt-24 grid grid-cols-2 gap-px bg-paper/10">
        <div className="h-20 bg-ink-soft" />
        <div className="h-20 bg-ink-soft" />
      </div>
    </section>
  );
}
