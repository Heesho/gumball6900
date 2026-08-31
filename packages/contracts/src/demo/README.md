# Robinhood Mainnet Demo contracts

These contracts support a valueless **Robinhood Mainnet Demo**. They are compiled from the shared Solidity source tree,
but they are not part of the continuing GumBall6900 core and must never appear in a production release manifest.

- `DemoUSDG` supplies the exact six-decimal genesis seed before launch. Its fixed self-faucet remains unavailable until
  its authority-bound launcher completes and records a deployed Pair.
- `DemoFaucetToken` supplies visibly mock/no-value 18-decimal Strategy payment assets through a fixed self-faucet.
- `DemoOwner` precommits one through four deployments of that exact compiled runtime, then permissionlessly accepts both
  ownership handoffs and creates their Strategies in one atomic transaction. It exposes no post-setup administration.

The token supplies are intentionally manipulable and have no promised value. Users still spend real ETH for every
Robinhood mainnet transaction. A different asset set or contract revision is a fresh demo generation with a new
deployment record and retained indexing endpoint.

No contract here deploys, broadcasts, verifies, publishes, or authorizes a demo by itself.
