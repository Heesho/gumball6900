import json
from pathlib import Path

from python.reference_model import classify_payment, compute


def test_reference_cases_capture_miner_rate_protection() -> None:
    scenarios = json.loads((Path(__file__).parents[2] / "scenarios" / "reference-cases.json").read_text())
    results = compute(scenarios)
    assert results["infiniteSupply"] is True
    assert results["miningQuotes"][0]["previousMinerAmount"] == "800000"
    assert results["miningQuotes"][1]["price"] == "0"
    assert results["miningQuotes"][1]["nextGlobalUps"] == "50000000000000000000"
    auction = results["auctionQuotes"][0]
    assert auction["fundAmount"] == auction["partitionFundAmount"] == "37800000000000000000"
    assert auction["bribeAmount"] == auction["partitionBribeAmount"] == "4200000000000000000"


def test_one_raw_unit_payments_eventually_fund_the_bribe() -> None:
    fund = bribe = remainder = 0
    for _ in range(10_000):
        next_fund, next_bribe, remainder = classify_payment(1, remainder)
        fund += next_fund
        bribe += next_bribe
    assert (fund, bribe, remainder) == (9_000, 1_000, 0)
