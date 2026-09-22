"use client";

import { calculateTriggerAssets, formatUsdc, parseUsdc } from "@agentsure/domain/money";
import { policyIntentSchema } from "@agentsure/domain/policy";
import type { PolicyExecutionPlan } from "@agentsure/protection/policy-plan";
import {
  ArrowUpRight,
  Check,
  Clipboard,
  DatabaseZap,
  LoaderCircle,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { compactAddress, displayDuration, displayUsdc } from "@/lib/display";

const ESTIMATED_PROTECTION_FEE = 10_000n;

type Draft = {
  amountUsdc: string;
  durationSeconds: number;
  maxLossBps: number;
};

type PreparationState =
  | { kind: "draft" }
  | { kind: "preparing" }
  | { kind: "ready"; plan: PolicyExecutionPlan }
  | { kind: "failed"; message: string };

const DEFAULT_DRAFT: Draft = {
  amountUsdc: "1",
  durationSeconds: 86_400,
  maxLossBps: 300,
};

export function PolicyBuilder({ beneficiary, vault }: { beneficiary: string; vault: string }) {
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [state, setState] = useState<PreparationState>({ kind: "draft" });
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const preview = useMemo(() => {
    try {
      const principal = parseUsdc(draft.amountUsdc);
      return {
        authorization: principal + ESTIMATED_PROTECTION_FEE,
        principal,
        trigger: calculateTriggerAssets(principal, draft.maxLossBps),
      };
    } catch {
      return null;
    }
  }, [draft]);

  function updateDraft(nextDraft: Draft) {
    setDraft(nextDraft);
    setCopied(false);
    setCopyError(null);
    setState({ kind: "draft" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = policyIntentSchema.safeParse({ ...draft, beneficiary, vault });
    if (!parsed.success) {
      setState({
        kind: "failed",
        message: parsed.error.issues[0]?.message ?? "Review the protection terms.",
      });
      return;
    }
    if (parseUsdc(parsed.data.amountUsdc) > 1_000_000n) {
      setState({
        kind: "failed",
        message: "Position size exceeds the deployed 1 USDC mainnet cap.",
      });
      return;
    }

    setCopied(false);
    setCopyError(null);
    setState({ kind: "preparing" });
    try {
      const response = await fetch("/api/intents/prepare", {
        body: JSON.stringify(parsed.data),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as PolicyExecutionPlan | { message?: string };
      if (!response.ok || !("steps" in payload)) {
        throw new Error(
          "message" in payload && payload.message
            ? payload.message
            : "The policy could not be verified against Arc.",
        );
      }
      setState({ kind: "ready", plan: payload });
    } catch (error) {
      setState({
        kind: "failed",
        message:
          error instanceof Error ? error.message : "The policy could not be verified against Arc.",
      });
    }
  }

  async function copyAgentInstruction(plan: PolicyExecutionPlan) {
    try {
      await navigator.clipboard.writeText(plan.agentInstruction);
      setCopied(true);
      setCopyError(null);
    } catch {
      setCopyError(
        "Clipboard access was blocked. Expand Exact calls to copy the commands manually.",
      );
    }
  }

  const error = state.kind === "failed" ? state.message : null;

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

      <form onSubmit={submit} className="grid min-w-0 gap-0 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="min-w-0 space-y-8 p-5 sm:p-7 lg:border-r lg:border-ink/15">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em]">
              Position size
            </span>
            <span className="flex items-baseline border-b border-ink/30 pb-3 focus-within:border-ink">
              <input
                aria-label="Position size in USDC"
                className="min-w-0 flex-1 bg-transparent font-display text-5xl font-medium tracking-[-0.07em] outline-none sm:text-6xl"
                inputMode="decimal"
                max="1"
                min="0.000001"
                name="amount"
                onChange={(event) => updateDraft({ ...draft, amountUsdc: event.target.value })}
                step="0.000001"
                value={draft.amountUsdc}
              />
              <span className="text-xs font-bold tracking-[0.16em]">USDC</span>
            </span>
            <span className="mt-2 block text-[11px] text-ink/55">Mainnet cap: 1 USDC</span>
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
                    updateDraft({ ...draft, maxLossBps: Number(event.target.value) * 100 })
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
                  updateDraft({ ...draft, durationSeconds: Number(event.target.value) })
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
            className="magnetic-action flex w-full items-center justify-between bg-ink px-5 py-4 text-left text-paper hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-wait disabled:opacity-60"
            disabled={state.kind === "preparing"}
            type="submit"
          >
            <span className="text-sm font-bold uppercase tracking-[0.14em]">
              {state.kind === "preparing" ? "Verifying Arc state" : "Prepare agent handoff"}
            </span>
            {state.kind === "preparing" ? (
              <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
            ) : (
              <ArrowUpRight className="size-5" aria-hidden="true" />
            )}
          </button>

          <div className="flex gap-3 border-t border-ink/15 pt-5 text-[11px] leading-5 text-ink/55">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              The browser prepares bounded calls only. Circle keeps custody and the Agent Wallet
              executes through its MPC session.
            </p>
          </div>
        </div>

        <div className="min-h-[560px] min-w-0 overflow-hidden bg-[#e7e5db] p-5 sm:p-7">
          {state.kind === "ready" ? (
            <PreparedPlan
              copied={copied}
              copyError={copyError}
              onCopy={() => void copyAgentInstruction(state.plan)}
              plan={state.plan}
            />
          ) : (
            <DraftPreview draft={draft} preview={preview} preparing={state.kind === "preparing"} />
          )}
        </div>
      </form>
    </section>
  );
}

function DraftPreview({
  draft,
  preview,
  preparing,
}: {
  draft: Draft;
  preview: { authorization: bigint; principal: bigint; trigger: bigint } | null;
  preparing: boolean;
}) {
  return (
    <div className="flex min-h-[504px] flex-col justify-between" aria-live="polite">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/55">
          {preparing ? "Reading finalized Arc state" : "Draft intent"}
        </span>
        {preparing ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em]">
            <DatabaseZap className="size-3.5" aria-hidden="true" /> Not verified
          </span>
        )}
      </div>

      {preview ? (
        <div>
          <p className="max-w-xs font-display text-3xl leading-[1.05] tracking-[-0.055em]">
            Exit at or below{" "}
            <span className="underline decoration-2 underline-offset-4">
              {formatUsdc(preview.trigger)} USDC
            </span>
            .
          </p>
          <dl className="mt-9 divide-y divide-ink/15 border-y border-ink/15 text-xs">
            <PlanRow label="Principal" value={`${formatUsdc(preview.principal)} USDC`} />
            <PlanRow label="Protection rule" value={`−${draft.maxLossBps / 100}%`} />
            <PlanRow label="Duration" value={displayDuration(draft.durationSeconds)} />
            <PlanRow label="Estimated fee" value="0.01 USDC" />
            <PlanRow
              emphasis
              label="Estimated authorization"
              value={`${formatUsdc(preview.authorization)} USDC`}
            />
          </dl>
        </div>
      ) : null}

      <p className="text-[11px] leading-relaxed text-ink/55">
        Nothing has been sent. Preparation verifies the live contract bounds, vault capacity, wallet
        balance, share quote, and exact calldata against finalized Arc state.
      </p>
    </div>
  );
}

function PreparedPlan({
  copied,
  copyError,
  onCopy,
  plan,
}: {
  copied: boolean;
  copyError: string | null;
  onCopy: () => void;
  plan: PolicyExecutionPlan;
}) {
  return (
    <div className="flex min-h-[504px] min-w-0 max-w-full flex-col" aria-live="polite">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/55">
          Finalized block {Number(plan.source.blockNumber).toLocaleString()}
        </span>
        <span className="flex items-center gap-1.5 bg-lime px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em]">
          <Check className="size-3" strokeWidth={3} aria-hidden="true" /> Verified
        </span>
      </div>

      <div className="mt-10">
        <p className="font-display text-3xl leading-none tracking-[-0.065em] sm:text-4xl">
          Ready for
          <br /> Agent Wallet.
        </p>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">
          Intent {plan.intentId.slice(0, 10)}…{plan.intentId.slice(-6)}
        </p>
      </div>

      <ol className="mt-8 min-w-0 border-y border-ink/15">
        {plan.steps.map((step, index) => (
          <li
            className="grid min-w-0 grid-cols-[28px_minmax(0,1fr)] gap-3 border-b border-ink/15 py-3 last:border-0"
            key={step.id}
          >
            <span className="font-mono text-[10px] text-ink/45">0{index + 1}</span>
            <div className="min-w-0">
              <p className="break-words text-xs font-semibold uppercase tracking-[0.1em]">
                {index === 0 ? "Bound authorization" : "Open protection policy"}
              </p>
              <p className="mt-1 break-words text-[11px] leading-5 text-ink/55">
                {step.description}
              </p>
            </div>
          </li>
        ))}
        <li className="grid min-w-0 grid-cols-[28px_minmax(0,1fr)] gap-3 py-3">
          <span className="font-mono text-[10px] text-ink/45">03</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.1em]">Guardian monitors</p>
            <p className="mt-1 text-[11px] leading-5 text-ink/55">
              Finalized Arc value is watched until exit, cancellation, or expiry.
            </p>
          </div>
        </li>
      </ol>

      <dl className="mt-5 grid min-w-0 grid-cols-1 gap-x-5 text-[11px] sm:grid-cols-2">
        <PlanRow label="Wallet balance" value={`${displayUsdc(plan.wallet.balanceAssets)} USDC`} />
        <PlanRow
          label="Exact authorization"
          value={`${displayUsdc(plan.terms.authorizationAssets)} USDC`}
        />
        <PlanRow label="Trigger" value={`${displayUsdc(plan.terms.triggerAssets)} USDC`} />
        <PlanRow label="Policy slot" value={`#${plan.policyNumberAtPreparation}*`} />
      </dl>

      <button
        className="magnetic-action mt-6 flex w-full items-center justify-between bg-ink px-5 py-4 text-left text-paper hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        onClick={onCopy}
        type="button"
      >
        <span className="min-w-0 break-words text-xs font-bold uppercase tracking-[0.14em]">
          {copied ? "Agent instruction copied" : "Copy agent instruction"}
        </span>
        {copied ? (
          <Check className="size-4 text-lime" aria-hidden="true" />
        ) : (
          <Clipboard className="size-4" aria-hidden="true" />
        )}
      </button>

      {copyError ? (
        <p className="mt-2 text-[10px] leading-4 text-ink/65" role="alert">
          {copyError}
        </p>
      ) : null}

      <details className="mt-4 min-w-0 max-w-full overflow-hidden border-t border-ink/15 pt-4">
        <summary className="flex cursor-pointer list-none items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em]">
          Inspect exact calls <TerminalSquare className="size-4" aria-hidden="true" />
        </summary>
        <div className="mt-4 space-y-4">
          {plan.steps.map((step) => (
            <div className="min-w-0 max-w-full overflow-hidden bg-ink/[0.06] p-3" key={step.id}>
              <p className="break-all font-mono text-[10px] font-semibold">
                {step.functionSignature}
              </p>
              <p className="mt-1 font-mono text-[9px] text-ink/50">
                Target {compactAddress(step.target)}
              </p>
              <p className="mt-2 break-all font-mono text-[9px] leading-4 text-ink/45">
                {step.calldata}
              </p>
            </div>
          ))}
        </div>
      </details>

      <p className="mt-5 text-[10px] leading-4 text-ink/50">
        *Policy number is a preparation-time hint. Circle’s MPC wallet still confirms both calls; no
        transaction was sent by this browser.
      </p>
    </div>
  );
}

function PlanRow({
  emphasis = false,
  label,
  value,
}: {
  emphasis?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className={`flex min-w-0 justify-between gap-4 py-3 ${emphasis ? "font-semibold" : ""}`}>
      <dt className={`min-w-0 break-words ${emphasis ? "" : "text-ink/55"}`}>{label}</dt>
      <dd className="shrink-0 text-right font-mono">{value}</dd>
    </div>
  );
}
