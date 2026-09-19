# Contributing

AgentSure is being delivered in explicit milestones. Changes should be narrow, tested, and traceable to the current milestone.

## Local checks

```sh
npm install
npm run check
```

Never commit `.env` files, private keys, wallet sessions, API keys, or production addresses that have not been intentionally published in a deployment manifest.

Contract changes require tests for state transitions, authorization boundaries, rounding behavior, and failure paths. No mainnet deployment may increase value caps without an explicit security review.
