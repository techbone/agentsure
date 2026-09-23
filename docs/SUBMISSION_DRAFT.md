# AgentSure — Arc Microgrant submission draft

This is copy for the application, not a claim that the form has been submitted. Check any character
limits in the live form before pasting. Do not describe V1 as insurance, a funded protection pool,
or a shipped MCP integration.

## Project name

AgentSure

## Short description

AgentSure gives supported USDC positions opened by Circle Agent Wallets a predefined onchain exit
trigger. A wallet opens a bounded position on Arc; a separate guardian monitors finalized state
and submits the exit when the trigger is met. The remaining USDC returns directly to the wallet. V1 is
automated exit, not insurance.

## What we built and why Arc

AgentSure combines a source-verified ProtectionManager, a capped demo ERC-4626 vault, a hosted
guardian, and a public web console. The console validates a policy against finalized Arc state and
prepares exact calls for a Circle Agent Wallet without receiving its signing credentials. The
manager records the exit condition and immutable beneficiary; the guardian can submit an exit but
cannot redirect proceeds. Arc provides USDC-denominated execution and finalized onchain state for
the policy, monitoring, and settlement trail.

On Arc mainnet, a Circle Agent Wallet opened a 1 USDC demo position with a 3% exit trigger. An
explicit, controlled 3.25% demo loss reduced redeemable value to 0.9675 USDC. The guardian
submitted the exit, and 0.9675 USDC returned to the same Agent Wallet. Each transition has a
public transaction proof.

The mainnet vault has a 1 USDC system-wide cap and a disclosed owner-only loss-simulation
function. The protection fee is protocol revenue, not claim capital. V1 does not reimburse losses,
guarantee an exit price, or protect arbitrary positions outside its approved vault.

## Links

- Product: https://agentsure-web-indol.vercel.app/
- Public repository: https://github.com/techbone/agentsure
- Builder profile: https://github.com/techbone
- Hosted guardian readiness: https://agentsure-production.up.railway.app/readyz
- ProtectionManager: https://explorer.arc.io/address/0xa70344cEeA5598B836B148B0d83b19eE988b4599
- Policy opened: https://explorer.arc.io/tx/0xd1a0b62dab37e34d86bfd93e3426617f8aa29c056d1b12035b0f4e3bbd1e9776
- Controlled demo loss: https://explorer.arc.io/tx/0xc58bb67d60845036c2a7a73ae21ef84c04b85476ec392b2a43084e5b91b55602
- Protection executed: https://explorer.arc.io/tx/0x616adc37976d5ba7fe113e90163f4b739455e42ba03603b96da351683750a886

## Accuracy boundary

The Circle Agent Wallet executed the demonstrated mainnet policy through an authenticated CLI
session. The hosted guardian is now running and indexing Arc mainnet; the demonstrated protection
exit happened before it was moved to Railway. The web console prepares wallet calls but does not
sign or submit them. MCP integration, third-party protocol adapters, funded claims, and an audited
production release are future work, not shipped V1 features.
