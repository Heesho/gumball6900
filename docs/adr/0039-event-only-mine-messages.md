# ADR 0039: Event-only Mine messages

- Status: accepted for development; not approved for deployment or user funds
- Date: 2026-08-21

## Context

A Mine handoff already records its payer, beneficiary, slot, epoch, price, next auction price, and assigned emission
rate in `Mined`. A short payer-supplied message makes the handoff socially expressive. Keeping the latest message in a
Solidity storage slot would add a persistent write and a state-reading surface even though historical event logs are
the useful record.

Solidity strings are arbitrary byte sequences at runtime. A character limit would therefore be ambiguous and costly
to validate onchain, especially for multibyte Unicode text.

## Decision

`Mine.mine` takes `string calldata message` as its final argument. It allows an empty message and reverts with
`MessageTooLong(bytes(message).length)` when the value exceeds the hard-coded `MAX_MESSAGE_BYTES = 280` limit.

The unindexed message is appended to `Mined`. Mine never writes it to contract storage. `Mined.payer` remains the
authoring caller and may differ from `Mined.miner`, the beneficiary receiving the slot. The subgraph may project the
latest emitted message for discovery, but that offchain projection is not protocol state.

## Consequences

- The limit is 280 raw bytes, not 280 Unicode characters. Ordinary ASCII text uses one byte per character, while many
  accented characters and emoji use multiple UTF-8 bytes.
- Solidity does not validate UTF-8. Applications must byte-check user input, treat emitted messages as untrusted, and
  escape content before displaying it.
- Messages remain available from chain logs without a per-handoff Solidity storage write. Other contracts cannot read
  a message back from Mine.
- The `mine` function selector and `Mined` event signature change. SDK calldata, generated ABIs, subgraph handlers, and
  downstream integrations must use the new signatures.
- The message increases calldata and log gas in proportion to its encoded size. No protocol economics, slot state,
  payment allocation, mining rate, or authority changes.
- This development decision does not authorize deployment or use with user funds.
