"use client";

import { calculateTriggerAssets, formatUsdc, parseUsdc } from "@agentsure/domain/money";
import { policyIntentSchema } from "@agentsure/domain/policy";
import { ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { displayDuration } from "@/lib/display";

const PROTECTION_FEE = 10_000n;

type Draft = {
  amountUsdc: string;
  durationSeconds: number;
  maxLossBps: number;
};

const DEFAULT_DRAFT: Draft = {
  amountUsdc: "1",
  durationSeconds: 86_400,
  maxLossBps: 300,
};

export function PolicyBuilder({ beneficiary, vault }: { beneficiary: string; vault: string }) {
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [confirmedDraft, setConfirmedDraft] = useState(DEFAULT_DRAFT);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => {
    try {
      const principal = parseUsdc(confirmedDraft.amountUsdc);
      return {
        principal,
        trigger: calculateTriggerAssets(principal, confirmedDraft.maxLossBps),
        authorization: principal + PROTECTION_FEE,
      };
    } catch {
      return null;
    }
  }, [confirmedDraft]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = policyIntentSchema.safeParse({
      ...draft,
      beneficiary,
      vault,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Review the protection terms.");
      return;
    }
    if (parseUsdc(parsed.data.amountUsdc) > 2_000_000n) {
      setError("Position size exceeds the deployed 2 USDC testnet cap.");
      return;
    }
    setError(null);
    setConfirmedDraft(draft);
  }

  return (
    <section className="border border-line bg-paper text-ink" aria-labelledby="builder-title">
      <div className="flex items-center justify-between border-b border-ink/15 px-5 py-4 sm:px-7">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink/55">
            Intent compiler / 01
          </p>
          <h2 id="builder-title" className="mt-1 font-display text-xl font-semibold tracking-tight">
            Define the boundary
          </h2>
        </div>
        <ShieldCheck className="size-6" strokeWidth={1.5} aria-hidden="true" />
      </div>

      <form onSubmit={submit} className="grid gap-0 lg:grid-cols-[1fr_0.9fr]">
        <div className="space-y-8 p-5 sm:p-7 lg:border-r lg:border-ink/15">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em]">
              Position size
            </span>
            <span className="flex items-baseline border-b border-ink/30 pb-3 focus-within:border-ink">
              <input
                aria-label="Position size in USDC"
                className="min-w-0 flex-1 bg-transparent font-display text-5xl font-medium tracking-[-0.07em] outline-none sm:text-6xl"
                inputMode="decimal"
                max="2"
                min="0.000001"
                name="amount"
                onChange={(event) => setDraft({ ...draft, amountUsdc: event.target.value })}
                step="0.000001"
                value={draft.amountUsdc}
              />
              <span className="text-xs font-bold tracking-[0.16em]">USDC</span>
            </span>
            <span className="mt-2 block text-[11px] text-ink/55">Testnet cap: 2 USDC</span>
          </label>

          <div className="grid grid-cols-2 gap-5">
            <label>
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em]">
                Max downside
              </span>
              <span className="flex border-b border-ink/30 pb-2 focus-within:border-ink">
                <input
                  aria-label="Maximum downside percentage"
                  className="min-w-0 flex-1 bg-transparent font-display text-2xl outline-none"
                  max="50"
                  min="1"
                  onChange={(event) =>
                    setDraft({ ...draft, maxLossBps: Number(event.target.value) * 100 })
                  }
                  step="1"
                  type="number"
                  value={draft.maxLossBps / 100}
                />
                <span className="self-center text-sm">%</span>
              </span>
            </label>

            <label>
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em]">
                Window
              </span>
              <select
                aria-label="Protection window"
                className="w-full border-b border-ink/30 bg-transparent pb-2 font-display text-2xl outline-none focus:border-ink"
                onChange={(event) =>
                  setDraft({ ...draft, durationSeconds: Number(event.target.value) })
                }
                value={draft.durationSeconds}
              >
                <option value={3_600}>1 hour</option>
                <option value={86_400}>24 hours</option>
                <option value={604_800}>7 days</option>
              </select>
            </label>
          </div>

          {error ? (
            <p className="border-l-2 border-ink bg-ink/5 px-3 py-2 text-xs" role="alert">
              {error}
            </p>
          ) : null}

          <button
            className="magnetic-action flex w-full items-center justify-between bg-ink px-5 py-4 text-left text-paper hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            type="submit"
          >
            <span className="text-sm font-bold uppercase tracking-[0.14em]">Review protection</span>
            <ArrowUpRight className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex min-h-[430px] flex-col justify-between bg-[#e7e5db] p-5 sm:p-7">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/55">
              Compiled intent
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em]">
              <Check className="size-3.5" aria-hidden="true" /> Valid bounds
            </span>
          </div>

          {preview ? (
            <div aria-live="polite">
              <p className="max-w-xs font-display text-3xl leading-[1.05] tracking-[-0.055em]">
                Exit at or below{" "}
                <span className="underline decoration-2 underline-offset-4">
                  {formatUsdc(preview.trigger)} USDC
                </span>
                .
              </p>
              <dl className="mt-9 divide-y divide-ink/15 border-y border-ink/15 text-xs">
                <div className="flex justify-between py-3">
                  <dt className="text-ink/55">Principal</dt>
                  <dd className="font-mono">{formatUsdc(preview.principal)} USDC</dd>
                </div>
                <div className="flex justify-between py-3">
                  <dt className="text-ink/55">Protection rule</dt>
                  <dd className="font-mono">−{confirmedDraft.maxLossBps / 100}%</dd>
                </div>
                <div className="flex justify-between py-3">
                  <dt className="text-ink/55">Duration</dt>
                  <dd className="font-mono">{displayDuration(confirmedDraft.durationSeconds)}</dd>
                </div>
                <div className="flex justify-between py-3">
                  <dt className="text-ink/55">AgentSure fee</dt>
                  <dd className="font-mono">0.01 USDC</dd>
                </div>
                <div className="flex justify-between py-3 font-semibold">
                  <dt>Exact authorization</dt>
                  <dd className="font-mono">{formatUsdc(preview.authorization)} USDC</dd>
                </div>
              </dl>
            </div>
          ) : null}

          <p className="text-[11px] leading-relaxed text-ink/55">
            Preview only. The wallet must approve and confirm the exact onchain terms. AgentSure
            exits remaining value; it does not reimburse losses.
          </p>
        </div>
      </form>
    </section>
  );
}
