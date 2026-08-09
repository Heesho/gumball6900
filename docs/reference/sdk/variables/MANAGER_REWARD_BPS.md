[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / MANAGER_REWARD_BPS

# Variable: MANAGER_REWARD_BPS

> `const` **MANAGER_REWARD_BPS**: `1000n` = `1_000n`

The signal-reward share of a completed normal acquisition.

This is the launch value, not a fixed constant: the share is settable through timelocked
governance and may never exceed `MAX_MANAGER_REWARD_BPS`. Callers that model a changed
share should pass it explicitly rather than relying on this default.
