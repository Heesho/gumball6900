"""Independent reference calculations for committed Mine scenarios."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

WAD = 10**18


def mul_div(a: int, b: int, denominator: int) -> int:
    return a * b // denominator


def mining_price(initial: int, elapsed: int) -> int:
    return 0 if elapsed >= 3_600 else initial - mul_div(initial, elapsed, 3_600)


def mining_rate(total_mined: int, initial: int, halving: int, tail: int) -> int:
    halvings = 0
    threshold = halving
    while total_mined >= threshold:
        halvings += 1
        shifted = initial >> halvings
        if shifted <= tail:
            return tail
        threshold += halving >> halvings
    return max(initial >> halvings, tail)


def auction_price(initial: int, elapsed: int, duration: int) -> int:
    return 0 if elapsed >= duration else initial - mul_div(initial, elapsed, duration)


def compute(scenarios: dict[str, Any]) -> dict[str, Any]:
    mining_quotes = []
    for case in scenarios["miningCases"]:
        payment = int(case["payment"])
        previous = mul_div(payment, 8_000, 10_000) if case["hasPreviousMiner"] else 0
        seconds = int(case["accrualSeconds"])
        emissions = [int(rate) * seconds for rate in case["slotUps"]]
        next_global = mining_rate(
            int(case["totalMined"]),
            int(case["initialUps"]),
            int(case["halvingAmount"]),
            int(case["tailUps"]),
        )
        mining_quotes.append(
            {
                "id": case["id"],
                "price": str(mining_price(int(case["initialPrice"]), int(case["elapsedSeconds"]))),
                "previousMinerAmount": str(previous),
                "resonanceAmount": str(payment - previous),
                "slotEmissions": [str(value) for value in emissions],
                "totalEmission": str(sum(emissions)),
                "nextGlobalUps": str(next_global),
                "nextSlotUps": str(next_global // int(case["capacity"])),
            }
        )

    auction_quotes = []
    for case in scenarios["auctionCases"]:
        payment = auction_price(int(case["initPrice"]), int(case["elapsedSeconds"]), int(case["epochPeriod"]))
        next_price = max(mul_div(payment, int(case["priceMultiplier"]), WAD), int(case["minInitPrice"]))
        auction_quotes.append(
            {
                "id": case["id"],
                "paymentAmount": str(payment),
                "nextInitPrice": str(next_price),
                "fundAmount": case["actualTargetReceived"],
            }
        )

    reward_quotes = []
    for case in scenarios["rewardCases"]:
        reward = int(case["rewardAmount"])
        weight = int(case["totalActiveWeight"])
        precision = int(case["precision"])
        increment = mul_div(reward, precision, weight)
        indexed = mul_div(increment, weight, precision)
        earned = int(case["userAccrued"]) + mul_div(
            int(case["userActiveWeight"]), increment - int(case["userRewardPerWeightPaid"]), precision
        )
        reward_quotes.append(
            {
                "id": case["id"],
                "rewardPerWeightIncrement": str(increment),
                "indexedReward": str(indexed),
                "residue": str(reward - indexed),
                "userEarned": str(earned),
            }
        )

    redemption_quotes = []
    for case in scenarios["redemptionCases"]:
        shares = int(case["shares"])
        supply = int(case["supplyBefore"])
        redemption_quotes.append(
            {
                "id": case["id"],
                "percentageWad": str(mul_div(shares, WAD, supply)),
                "outputs": [
                    {"asset": asset["asset"], "amount": str(mul_div(int(asset["balance"]), shares, supply))}
                    for asset in case["assets"]
                ],
            }
        )

    supply_quotes = []
    for case in scenarios["supplyCases"]:
        supply = int(case["lifetimeMinted"]) - int(case["lifetimeBurned"])
        change = int(case["gbxMined"]) - int(case["gbxBurned"])
        supply_quotes.append(
            {
                "id": case["id"],
                "currentSupply": str(supply),
                "netSupplyChange": str(change),
                "projectedSupply": str(supply + change),
            }
        )

    return {
        "schemaVersion": scenarios["schemaVersion"],
        "usdGDecimals": scenarios["usdGDecimals"],
        "targetDecimals": scenarios["targetDecimals"],
        "infiniteSupply": True,
        "genesisLiquidityAllocation": str(20_000_000 * WAD),
        "miningQuotes": mining_quotes,
        "auctionQuotes": auction_quotes,
        "rewardQuotes": reward_quotes,
        "redemptionQuotes": redemption_quotes,
        "supplyQuotes": supply_quotes,
    }


if __name__ == "__main__":
    path = Path(sys.argv[1])
    print(json.dumps(compute(json.loads(path.read_text())), indent=2))
