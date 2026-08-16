/**
 * Shared inputs for the long-form figures.
 *
 * `charts.mjs` draws from verified protocol constants rather than typed-in numbers, so a
 * figure cannot print a split or a duration that disagrees with the Solidity. This module
 * is the single re-export point for those, keeping the chart file free of deep relative
 * paths into the typeset whitepaper's source tree.
 */

export { contractConstants, status } from '../whitepaper/src/protocol-facts.mjs';
export { palette, brand } from '../whitepaper/src/theme.mjs';
