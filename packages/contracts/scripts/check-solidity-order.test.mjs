import assert from 'node:assert/strict';
import test from 'node:test';

import { findDeclarationOrderViolations } from './check-solidity-order.mjs';

test('accepts the project phases and groups external with public and internal with private', () => {
  const source = `
    pragma solidity 0.8.26;
    contract Ordered {
      struct Item { uint256 value; }
      uint256 constant LIMIT = 1;
      uint256 immutable configured;
      uint256 stored;
      event Changed();
      error Invalid();
      modifier guarded() { _; }
      constructor() { configured = 1; }
      function externalWrite() external {}
      function publicWrite() public {}
      function externalRead() external view returns (uint256) { return stored; }
      function publicRead() public pure returns (uint256) { return LIMIT; }
      function internalWrite() internal {}
      function privateWrite() private {}
      function internalRead() internal view returns (uint256) { return stored; }
      function privateRead() private pure returns (uint256) { return LIMIT; }
    }
  `;

  assert.deepEqual(findDeclarationOrderViolations(source), []);
});

test('rejects a declaration from an earlier phase after a later phase', () => {
  const source = `
    pragma solidity 0.8.26;
    contract Misordered {
      event Changed();
      uint256 stored;
    }
  `;

  assert.deepEqual(findDeclarationOrderViolations(source), [
    {
      contract: 'Misordered',
      file: '<source>',
      line: 5,
      phase: 'immutables/state',
      precedingLine: 4,
      precedingPhase: 'events',
    },
  ]);
});

test('separates state-changing functions from view and pure functions in each visibility group', () => {
  const source = `
    pragma solidity 0.8.26;
    contract MisorderedFunctions {
      function externalRead() external view {}
      function publicWrite() public {}
      function privateRead() private pure {}
      function internalWrite() internal {}
    }
  `;

  assert.deepEqual(
    findDeclarationOrderViolations(source).map(({ line, phase, precedingPhase }) => ({
      line,
      phase,
      precedingPhase,
    })),
    [
      {
        line: 5,
        phase: 'external/public state-changing functions',
        precedingPhase: 'external/public view or pure functions',
      },
      {
        line: 7,
        phase: 'internal/private state-changing functions',
        precedingPhase: 'internal/private view or pure functions',
      },
    ],
  );
});
