# Vercel Web Deployment

AgentSure's reviewer-facing Next.js application is deployed separately from the guardian. Vercel
serves only the public product surface and read-only Arc API routes; it must never receive a wallet
private key, keystore password, Circle credential, mnemonic, or guardian signing secret.

## Project settings

Import `techbone/agentsure` from GitHub with these settings:

- Project name: `agentsure`
- Framework preset: Next.js
- Root directory: `apps/web`
- Include source files outside the root directory: enabled
- Install command: Vercel default (`npm install`)
- Build command: Vercel default (`npm run build`)
- Output directory: Next.js default (`.next`)
- Node.js: `22.x`
- Production branch: `main`

Source-file access outside `apps/web` is required because the application imports the shared npm
workspace packages, mainnet deployment manifest, and canonical lifecycle evidence.

## Environment

Add this non-secret variable to Production and Preview:

```text
ARC_MAINNET_RPC_URL=https://rpc.mainnet.arc.io
```

No other environment variable is required for the V1 web deployment. Any later managed RPC URL
must remain server-only and must not use a `NEXT_PUBLIC_` prefix.

Environment changes affect only new deployments. Redeploy after adding or changing a value.

## Acceptance checks

After the production deployment succeeds, replace `<deployment-url>` and verify:

```bash
curl --fail --silent --show-error https://<deployment-url>/
curl --fail --silent --show-error https://<deployment-url>/api/policies/1
```

The policy response must report:

- network `Arc`;
- manager `0xa70344cEeA5598B836B148B0d83b19eE988b4599`;
- policy status `Executed`;
- owner and beneficiary `0x6b9B032be42343944bd383Cc3f0a3e4C6120106f`;
- assets returned `967500` micro-USDC.

Finally, prepare a policy handoff in the browser and confirm that it produces bounded calldata
without asking the browser for a private key or submitting a transaction.

## Deployment behavior

Git integration deploys `main` to Production and non-production branches to Preview. Vercel can
skip unaffected monorepo projects by following the npm workspace dependency graph.

Official references:

- [Vercel monorepos](https://vercel.com/docs/monorepos)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
