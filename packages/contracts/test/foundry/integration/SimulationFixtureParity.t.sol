// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { Test } from "forge-std/Test.sol";

import { EmissionMath } from "../../../src/libraries/EmissionMath.sol";
import { RateMath } from "../../../src/libraries/RateMath.sol";

/// @notice Consumes the committed cross-language simulation fixtures as contract-math parity vectors.
contract SimulationFixtureParityTest is Test {
    uint256 private constant _INITIAL_DAILY_EMISSION = 427_181_096_645_855_643_000_000;
    uint256 private constant _MINT_CAP = 1_000_000_000 ether;

    function test_ReferenceFixtureMatchesEmissionAuctionAndRedemptionMath() external view {
        string memory fixture = _readFixture("reference-results.json");

        uint256 daysElapsed = _fixtureUint(fixture, ".emissionHorizons[0].days");
        uint256 recurringMinted;
        uint256 scheduled = _INITIAL_DAILY_EMISSION;
        for (uint256 day; day < daysElapsed; ++day) {
            recurringMinted += scheduled;
            scheduled = EmissionMath.decayOneEpoch(scheduled);
        }
        assertEq(recurringMinted, _fixtureUint(fixture, ".emissionHorizons[0].recurringMinted"));
        assertEq(scheduled, _fixtureUint(fixture, ".emissionHorizons[0].nextScheduledEmission"));

        uint256 rate = _fixtureUint(fixture, ".auctionQuotes[0].rate");
        uint256 requiredTarget = RateMath.quoteAssetAmount(10_000e6, rate, 6, 18);
        assertEq(requiredTarget, _fixtureUint(fixture, ".auctionQuotes[0].requiredTargetAmount"));
        uint256 actualReceipt = 42 ether;
        uint256 managerAmount = Math.mulDiv(actualReceipt, 200, 10_000);
        assertEq(managerAmount, _fixtureUint(fixture, ".auctionQuotes[0].managerAmount"));
        assertEq(actualReceipt - managerAmount, _fixtureUint(fixture, ".auctionQuotes[0].vaultAmount"));

        uint256 shares = 100 ether;
        uint256 supplyBefore = 1_000 ether;
        assertEq(Math.mulDiv(shares, 1e18, supplyBefore), _fixtureUint(fixture, ".redemptionQuotes[0].percentageWad"));
        assertEq(
            Math.mulDiv(5_000e6, shares, supplyBefore), _fixtureUint(fixture, ".redemptionQuotes[0].assets[0].amount")
        );
        assertEq(
            Math.mulDiv(42 ether, shares, supplyBefore), _fixtureUint(fixture, ".redemptionQuotes[0].assets[1].amount")
        );
        assertEq(Math.mulDiv(7, shares, supplyBefore), _fixtureUint(fixture, ".redemptionQuotes[0].assets[2].amount"));
    }

    function test_EconomicFixturePinsNonOracleSupplyAssumptions() external view {
        string memory fixture = _readFixture("economic-scenarios.json");
        assertEq(_fixtureUint(fixture, ".assumptions.cumulativeMintCap"), _MINT_CAP);
        assertTrue(vm.parseJsonBool(fixture, ".assumptions.noOnchainNavOracle"));
        assertEq(
            keccak256(bytes(vm.parseJsonString(fixture, ".purpose"))),
            keccak256(
                "Deterministic protocol-mechanics scenarios; not forecasts, valuations, or investment projections."
            )
        );
    }

    function _readFixture(string memory name) private view returns (string memory) {
        return vm.readFile(string.concat(vm.projectRoot(), "/../simulations/fixtures/", name));
    }

    function _fixtureUint(string memory fixture, string memory key) private pure returns (uint256) {
        return vm.parseUint(vm.parseJsonString(fixture, key));
    }
}
