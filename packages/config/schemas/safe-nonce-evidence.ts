/**
 * Backward-compatible import surface for downstream tooling. The evidence formerly captured only
 * a Safe nonce; it is now the complete Safe control-plane observation.
 */
export {
  parseSafeControlPlaneEvidence as parseSafeNonceEvidence,
  safeControlPlaneEvidenceSchema as safeNonceEvidenceSchema,
} from './safe-control-plane.js';
export type { SafeControlPlaneEvidence as SafeNonceEvidence } from './safe-control-plane.js';
