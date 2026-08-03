# Trust Assumptions

## Trust-minimized properties

The reviewed core bytecode, if deployed with the verified constructor graph, enforces supply accounting, pre-burn
pro-rata redemption, target-before-USDG acquisition ordering, bounded signals, real burns, and purpose-limited
privilege without an external NAV oracle. These properties do not depend on a token vote or offchain indexer.

## Trusted deployment facts

Before production, users must trust independently reproduced evidence that:

- source, compiler settings, CREATE2 salts, constructors, and deployed runtime bytecode match;
- the signed manifest resolves the correct Robinhood chain, USDG, WETH, wrapped BTC, stock tokens, Permit2, and
  Uniswap v4 contracts;
- stock-token address, UID, decimals, multiplier interface, registry status, proxy/admin behavior, and transfer
  semantics were checked at the release block;
- every set-once initializer closed on the intended peer and no deployer authority remains economically relevant;
- LiquidityManager owns the canonical position NFTs and genesis received the required sponsor backing.

The repository deliberately refuses to turn provisional configuration into a release-approved manifest.

## Operational trust

- The proposer multisig secures the bounded ProtocolTimelock authority and publicly reviews queued calldata.
- The guardian Safe secures break-glass keys and uses them only to stop new exposure. Its typed, block-pinned Safe
  identity evidence must be reviewed alongside the separate protocol-admin Safe; contract code presence by itself is
  not proof of Safe identity or policy.
- The production eligibility registry, its owner/signers, update delay, fail behavior, and recovery process are
  disclosed and approved by counsel and issuers.
- RPC, indexing, monitoring, status communications, and manifest hosting are available enough for users to inspect
  state and submit transactions, while direct contract state remains authoritative.
- Independent security and economic reviewers are competent, independent, and review the final commit—not an older
  snapshot.

## External asset and chain trust

USDG can depeg, freeze, upgrade, or stop transferring. Stock tokens depend on their issuer, legal rights, market
hours, eligibility, corporate-action mechanism, and registry. Wrapped BTC depends on its bridge/custodian. Robinhood
Chain can halt, reorganize, censor, or change operational behavior. Uniswap v4 and its routers can fail or be
incompatible with the pinned integration.

The protocol cannot repair those failures through an admin sweep or asset substitution. Guardian disable prevents
new acquisition but leaves existing exposure in the basket. A registered token that reverts on transfer can block
the deliberately atomic all-asset redemption until the external issuer restores liveness.

## Market trust and oracleless limitations

No contract promises fair market execution. Mining's reference is historical and endogenous. Auction references are
deployment inputs or bounded timelocked resets. Takers may not fill, Uniswap positions may be one-sided or thin, GBX
may trade above or below any display estimate, and a buyback may not be accretive. Display APIs can be wrong without
changing contract accounting.

## Legal and user-level trust

Legal rights represented by Robinhood Stock Tokens, GBX distribution restrictions, staking/reward treatment,
jurisdiction rules, tax consequences, sanctions/privacy controls, and eligible alternate-receiver policies require
qualified advice. Code cannot confer rights that the underlying issuer or law does not recognize.

Users must review the exact basket, raw redemption outputs, external-token liveness warning, transaction simulation,
and approval targets. They retain wallet/key risk and transaction-ordering/MEV risk.
