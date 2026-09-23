import proof from "../../../../docs/evidence/arc-mainnet-lifecycle.json";
import { ArrowUpRight, Check } from "lucide-react";
import { explorerTransactionUrl } from "@/lib/display";

const STEPS = [
  { key: "approval", index: "01", title: "Wallet authorized", detail: "Exact 1.01 USDC allowance" },
  { key: "policyOpened", index: "02", title: "Rule committed", detail: "1 USDC · 3% · 24 hours" },
  {
    key: "controlledLoss",
    index: "03",
    title: "Demo trigger crossed",
    detail: "Controlled loss reduced value to 0.9675 USDC",
  },
  {
    key: "protectionExecuted",
    index: "04",
    title: "Position exited",
    detail: "0.9675 USDC returned",
  },
] as const;

export function ProofTimeline() {
  return (
    <ol className="border-t border-paper/15">
      {STEPS.map((step, position) => {
        const transaction = proof.transactions[step.key];
        return (
          <li
            className={`group grid gap-6 border-b border-paper/15 py-8 transition-colors hover:bg-paper/[0.025] sm:grid-cols-[80px_1fr_auto] sm:items-center ${
              position % 2 === 1 ? "sm:pl-[9%]" : ""
            }`}
            key={step.key}
          >
            <span className="font-mono text-xs text-lime">/{step.index}</span>
            <div>
              <div className="flex items-center gap-3">
                <span className="grid size-5 place-items-center bg-lime text-ink">
                  <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                </span>
                <h3 className="font-display text-2xl tracking-[-0.045em]">{step.title}</h3>
              </div>
              <p className="mt-2 pl-8 text-sm text-paper/45">{step.detail}</p>
            </div>
            <a
              className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-paper/45 hover:text-lime"
              href={explorerTransactionUrl(transaction.hash)}
              rel="noreferrer"
              target="_blank"
            >
              Block {Number(transaction.blockNumber).toLocaleString()}
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </a>
          </li>
        );
      })}
    </ol>
  );
}
