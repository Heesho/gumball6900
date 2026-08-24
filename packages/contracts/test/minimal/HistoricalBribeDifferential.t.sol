// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ProtocolFixture } from "./utils/ProtocolFixture.sol";

/// @title HistoricalBribeReference
/// @notice Test-only reference for the historical Synthetix/Liquid-Signal Bribe accounting shape.
/// @dev This deliberately retains the historical `1e18` index and quotient-only reward rate. It is independent of
///      Resonance and exists only to make intended similarities and divergences executable review evidence.
contract HistoricalBribeReference {
    uint256 internal constant DURATION = 7 days;
    uint256 internal constant PRECISION = 1e18;

    uint256 public totalSupply;
    uint256 public periodFinish;
    uint256 public rewardRate;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address account => uint256 balance) public balanceOf;
    mapping(address account => uint256 paid) public userRewardPerTokenPaid;
    mapping(address account => uint256 accrued) public rewards;

    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalSupply == 0) return rewardPerTokenStored;
        return
            rewardPerTokenStored + ((lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * PRECISION)
                / totalSupply;
    }

    function earned(address account) public view returns (uint256) {
        return
            (balanceOf[account] * (rewardPerToken() - userRewardPerTokenPaid[account])) / PRECISION + rewards[account];
    }

    function setBalance(address account, uint256 amount) external {
        _checkpoint(account);
        totalSupply = totalSupply - balanceOf[account] + amount;
        balanceOf[account] = amount;
    }

    function notifyRewardAmount(uint256 amount) external {
        _checkpoint(address(0));
        if (block.timestamp >= periodFinish) {
            rewardRate = amount / DURATION;
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            rewardRate = (amount + remaining * rewardRate) / DURATION;
        }
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + DURATION;
    }

    function claim(address account) external returns (uint256 reward) {
        _checkpoint(account);
        reward = rewards[account];
        rewards[account] = 0;
    }

    function _checkpoint(address account) private {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
    }
}

/// @title HistoricalBribeDifferentialTest
/// @notice Executable comparison of Resonance with the historical Bribe mechanics it intentionally adapts.
contract HistoricalBribeDifferentialTest is ProtocolFixture {
    HistoricalBribeReference internal historical;

    function setUp() external {
        _deployProtocol();
        historical = new HistoricalBribeReference();
    }

    function test_DivisibleStreamsMatchHistoricalRateIndexEarnedRestartAndClaimAccounting() external {
        uint256 weight = 100 ether;
        uint256 firstReward = 604_800e6;
        uint256 startedAt = block.timestamp;

        _signalDefault(ALICE, weight);
        historical.setBalance(address(targetStrategy), weight);
        _routeRevenue(firstReward);
        historical.notifyRewardAmount(firstReward);

        (uint256 finish, uint256 rate,,) = _revenueData();
        assertEq(_strategySignalWeight(address(targetStrategy)), historical.balanceOf(address(targetStrategy)));
        assertEq(resonance.totalSignalWeight(), historical.totalSupply());
        assertEq(rate, historical.rewardRate());
        assertEq(finish, historical.periodFinish());

        vm.warp(startedAt + 2 days);
        _assertEquivalentIndexAndEarned();

        uint256 amountLeft = resonance.remainingRevenue();
        assertEq(amountLeft, (historical.periodFinish() - block.timestamp) * historical.rewardRate());
        uint256 topUp = amountLeft;
        _notifyAsRouter(topUp);
        historical.notifyRewardAmount(topUp);

        (finish, rate,,) = _revenueData();
        assertEq(rate, historical.rewardRate());
        assertEq(finish, historical.periodFinish());

        vm.warp(block.timestamp + 7 days);
        _assertEquivalentIndexAndEarned();

        uint256 expectedClaim = historical.claim(address(targetStrategy));
        uint256 actualClaim = resonance.distributeRevenue(address(targetStrategy));
        assertEq(actualClaim, expectedClaim);
        assertEq(usdg.balanceOf(address(targetStrategy)), expectedClaim);
        assertEq(resonance.earnedRevenue(address(targetStrategy)), 0);
        assertEq(historical.earned(address(targetStrategy)), 0);
    }

    function test_VirtualBalanceChangesMatchHistoricalCheckpointOrdering() external {
        _signalDefault(ALICE, 100 ether);
        vm.prank(ALICE);
        signalGBX.moveSignal(address(targetStrategy), address(gbxStrategy), 40 ether);

        historical.setBalance(address(targetStrategy), 60 ether);
        historical.setBalance(address(gbxStrategy), 40 ether);
        _routeRevenue(604_800e6);
        historical.notifyRewardAmount(604_800e6);

        vm.warp(block.timestamp + 1 days);
        vm.prank(ALICE);
        signalGBX.moveSignal(address(targetStrategy), address(gbxStrategy), 10 ether);
        historical.setBalance(address(targetStrategy), 50 ether);
        historical.setBalance(address(gbxStrategy), 50 ether);

        assertEq(_strategySignalWeight(address(targetStrategy)), historical.balanceOf(address(targetStrategy)));
        assertEq(_strategySignalWeight(address(gbxStrategy)), historical.balanceOf(address(gbxStrategy)));
        assertEq(resonance.totalSignalWeight(), historical.totalSupply());
        assertEq(resonance.earnedRevenue(address(targetStrategy)), historical.earned(address(targetStrategy)));
        assertEq(resonance.earnedRevenue(address(gbxStrategy)), historical.earned(address(gbxStrategy)));

        vm.warp(block.timestamp + 6 days);
        assertEq(resonance.distributeRevenue(address(targetStrategy)), historical.claim(address(targetStrategy)));
        assertEq(resonance.distributeRevenue(address(gbxStrategy)), historical.claim(address(gbxStrategy)));
    }

    function test_OrdinaryRateFloorMatchesHistoricalAndLeavesSurplus() external {
        uint256 startedAt = block.timestamp;
        _signalDefault(ALICE, 1 ether);
        historical.setBalance(address(targetStrategy), 1 ether);

        _routeRevenue(604_801);
        historical.notifyRewardAmount(604_801);

        assertEq(historical.rewardRate(), 1, "historical quotient-only scheduling strands one raw unit");
        (, uint256 rate,,) = _revenueData();
        assertEq(rate, 1);

        vm.warp(startedAt + 1);
        assertEq(resonance.earnedRevenue(address(targetStrategy)), 1);
        assertEq(historical.earned(address(targetStrategy)), 1);
        _assertEquivalentIndexAndEarned();

        vm.warp(startedAt + 7 days);
        assertEq(resonance.distributeRevenue(address(targetStrategy)), 604_800);
        assertEq(historical.claim(address(targetStrategy)), 604_800);
        assertEq(usdg.balanceOf(address(resonance)), 1);
    }

    function _assertEquivalentIndexAndEarned() private view {
        assertEq(
            resonance.revenuePerSignal() / 1e18,
            historical.rewardPerToken(),
            "the 1e36 Resonance index must normalize to the historical 1e18 index"
        );
        assertEq(resonance.earnedRevenue(address(targetStrategy)), historical.earned(address(targetStrategy)));
    }

    function _revenueData()
        private
        view
        returns (uint256 periodFinish, uint256 revenueRate, uint256 lastUpdateTime, uint256 revenuePerSignalStored)
    {
        return resonance.revenueData();
    }

    function _notifyAsRouter(uint256 amount) private {
        usdg.mint(address(resonanceRouter), amount);
        vm.prank(KEEPER);
        resonanceRouter.route();
    }
}
