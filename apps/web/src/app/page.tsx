import proof from "../../../../docs/evidence/arc-mainnet-lifecycle.json";
import { ArrowDown, ArrowUpRight, CircleDot, Radio, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { PolicyBuilder } from "@/components/policy-builder";
import { PolicyMonitor } from "@/components/policy-monitor";
import { ProofTimeline } from "@/components/proof-timeline";
import { compactAddress } from "@/lib/display";

export default function HomePage() {
  return (
    <div className="overflow-x-hidden bg-ink text-paper">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-paper/10 bg-ink/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <BrandMark />
          <div className="flex items-center gap-5">
            <span className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-paper/50 sm:flex">
              <span className="size-1.5 rounded-full bg-lime shadow-[0_0_10px_#c8ff3d]" /> Arc
              mainnet
            </span>
            <a
              className="border border-paper/25 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] hover:border-lime hover:text-lime"
              href="#console"
            >
              Open console
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative min-h-[950px] border-b border-paper/10 pt-16">
          <div className="dot-grid absolute inset-0 opacity-45" />
          <div className="absolute inset-y-0 left-[64%] hidden w-px bg-paper/10 lg:block" />
          <div className="relative mx-auto grid min-h-[884px] max-w-[1600px] px-5 sm:px-8 lg:grid-cols-[1.8fr_1fr] lg:px-12">
            <div className="flex flex-col justify-between py-14 sm:py-20 lg:border-r lg:border-paper/10 lg:pr-12">
              <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.24em] text-paper/45">
                <Radio className="size-3.5 text-lime" aria-hidden="true" /> Autonomous risk
                infrastructure
              </div>

              <div className="py-24 lg:py-12">
                <h1 className="max-w-[1050px] font-display text-[clamp(4.6rem,10.8vw,11.5rem)] font-medium leading-[0.76] tracking-[-0.095em]">
                  MONEY.
                  <br />
                  WITH A
                  <br />
                  <span className="text-lime">LIMIT.</span>
                </h1>
                <div className="mt-16 grid gap-8 border-t border-paper/15 pt-6 md:grid-cols-[1fr_1.1fr]">
                  <p className="font-mono text-[10px] uppercase leading-5 tracking-[0.18em] text-paper/40">
                    AgentSure / Arc
                    <br />
                    Protocol build 0.5
                  </p>
                  <p className="max-w-lg text-base leading-7 text-paper/[0.68] sm:text-lg">
                    Autonomous agents can move money. AgentSure monitors supported positions against
                    a predefined exit trigger and acts when it is met.
                  </p>
                </div>
              </div>

              <a
                className="magnetic-action flex w-fit items-center gap-14 bg-lime px-5 py-4 text-xs font-bold uppercase tracking-[0.16em] text-ink"
                href="#console"
              >
                Configure protection <ArrowDown className="size-4" aria-hidden="true" />
              </a>
            </div>

            <div className="relative hidden min-h-full flex-col justify-between py-20 pl-10 lg:flex">
              <div className="ml-auto w-[85%] border border-paper/15 bg-ink/70 p-5 backdrop-blur-sm">
                <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.18em] text-paper/40">
                  <span>Finalized signal</span>
                  <span className="text-lime">Verified</span>
                </div>
                <div className="mt-24">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-paper/35">Rule</p>
                  <p className="mt-2 font-display text-5xl tracking-[-0.07em]">−3.00%</p>
                </div>
                <div className="mt-8 h-px bg-paper/10">
                  <div className="h-px w-[72%] bg-lime" />
                </div>
                <div className="mt-4 flex justify-between font-mono text-[9px] text-paper/35">
                  <span>1.0000</span>
                  <span>TRIGGER 0.9700</span>
                </div>
              </div>

              <div className="self-end pr-[15%] text-right">
                <p className="font-display text-7xl leading-none tracking-[-0.08em] text-paper/12">
                  01
                </p>
                <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.2em] text-paper/35">
                  Proven lifecycle
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-paper/10">
          <div className="mx-auto grid max-w-[1600px] grid-cols-2 lg:grid-cols-4">
            {[
              ["01", "Executed policy"],
              ["0.9675", "USDC returned"],
              ["< 1s", "Deterministic finality"],
              ["00", "User keys held"],
            ].map(([value, label], index) => (
              <div
                className={`min-h-40 border-paper/10 p-5 sm:p-7 ${index % 2 === 0 ? "border-r" : ""} ${
                  index > 1 ? "border-t lg:border-t-0" : ""
                } ${index !== 3 ? "lg:border-r" : ""}`}
                key={label}
              >
                <p className="font-display text-4xl tracking-[-0.065em] sm:text-5xl">{value}</p>
                <p className="mt-8 text-[10px] uppercase tracking-[0.18em] text-paper/40">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section
          className="mx-auto max-w-[1600px] px-5 py-28 sm:px-8 sm:py-40 lg:px-12"
          id="console"
        >
          <div className="mb-16 grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-lime">
              01 / Protection console
            </p>
            <h2 className="font-display text-[clamp(3.2rem,7vw,7.4rem)] leading-[0.86] tracking-[-0.08em]">
              Set the rule.
              <br />
              Watch the chain.
            </h2>
          </div>

          <ol className="mb-5 grid border border-paper/15 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["01", "Define boundary", "Principal, downside, window"],
              ["02", "MPC confirms", "Two bounded wallet calls"],
              ["03", "Guardian watches", "Finalized Arc state only"],
              ["04", "USDC returns", "Direct to beneficiary"],
            ].map(([number, title, detail], index) => (
              <li
                className={`min-h-36 p-5 ${index < 3 ? "xl:border-r xl:border-paper/15" : ""} ${
                  index % 2 === 0 ? "sm:border-r sm:border-paper/15" : ""
                } ${index > 1 ? "border-t border-paper/15 xl:border-t-0" : ""}`}
                key={number}
              >
                <span className="font-mono text-[9px] text-lime">{number}</span>
                <p className="mt-7 text-xs font-semibold uppercase tracking-[0.12em]">{title}</p>
                <p className="mt-2 text-[11px] leading-5 text-paper/40">{detail}</p>
              </li>
            ))}
          </ol>

          <div className="grid gap-5 xl:grid-cols-[1.16fr_0.84fr]">
            <PolicyBuilder
              beneficiary={proof.participants.circleAgentWallet}
              vault={proof.contracts.demoRiskVault}
            />
            <PolicyMonitor />
          </div>
        </section>

        <section className="border-y border-paper/10 bg-ink-soft">
          <div className="mx-auto max-w-[1600px] px-5 py-28 sm:px-8 sm:py-40 lg:px-12">
            <div className="grid gap-16 lg:grid-cols-[0.65fr_1.35fr]">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-lime">
                  02 / Verifiable trail
                </p>
                <h2 className="mt-8 font-display text-5xl leading-[0.92] tracking-[-0.07em] sm:text-7xl">
                  One rule.
                  <br />
                  Four proofs.
                </h2>
                <p className="mt-8 max-w-sm text-sm leading-6 text-paper/[0.48]">
                  Every material transition is public. The interface explains the state; Arc remains
                  the authority.
                </p>
              </div>
              <ProofTimeline />
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-[1600px] px-5 py-32 sm:px-8 sm:py-52 lg:px-12">
          <div className="hairline-grid absolute inset-x-0 top-0 h-full opacity-40" />
          <div className="relative grid gap-14 lg:grid-cols-[1.35fr_0.65fr]">
            <h2 className="max-w-5xl font-display text-[clamp(3.7rem,8.5vw,9rem)] leading-[0.82] tracking-[-0.09em]">
              NOT INSURANCE.
              <br />
              <span className="text-paper/20">AUTOMATIC EXIT.</span>
            </h2>
            <div className="flex flex-col justify-end">
              <ShieldCheck className="size-10 text-lime" strokeWidth={1.25} aria-hidden="true" />
              <p className="mt-8 text-base leading-7 text-paper/60">
                V1 monitors objective onchain value and exits a position when its configured
                boundary is crossed. It does not replace lost value, promise execution price, or
                hold user keys.
              </p>
              <dl className="mt-10 divide-y divide-paper/10 border-y border-paper/10 text-xs">
                <div className="flex justify-between py-4">
                  <dt className="text-paper/40">Agent Wallet</dt>
                  <dd className="font-mono">
                    {compactAddress(proof.participants.circleAgentWallet)}
                  </dd>
                </div>
                <div className="flex justify-between py-4">
                  <dt className="text-paper/40">Guardian</dt>
                  <dd className="font-mono">{compactAddress(proof.participants.guardian)}</dd>
                </div>
                <div className="flex justify-between py-4">
                  <dt className="text-paper/40">Settlement</dt>
                  <dd className="font-mono text-lime">Direct to beneficiary</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-paper/10 px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1504px] flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <BrandMark />
          <div className="flex flex-wrap items-center gap-6 font-mono text-[9px] uppercase tracking-[0.16em] text-paper/35">
            <span>Built on Arc</span>
            <span>USDC native</span>
            <a
              className="flex items-center gap-1 hover:text-lime"
              href={`https://explorer.arc.io/address/${proof.contracts.protectionManager}`}
              rel="noreferrer"
              target="_blank"
            >
              View contract <ArrowUpRight className="size-3" aria-hidden="true" />
            </a>
            <span className="flex items-center gap-1.5 text-lime">
              <CircleDot className="size-3" aria-hidden="true" /> Mainnet live
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
