import json
from pathlib import Path

from python.reference_model import classify_payment, compute


def test_reference_cases_capture_miner_rate_protection() -> None:
    scenarios = json.loads((Path(__file__).parents[2] / "scenarios" / "reference-cases.json").read_text())
    results = compute(scenarios)
    assert results["infiniteSupply"] is True
    assert results["miningQuotes"][0]["previousMinerAmount"] == "800000"
    assert results["miningQuotes"][1]["price"] == "0"
    assert results["miningQuotes"][1]["nextGlobalTps"] == "32000000000000000000"
    auction = results["auctionQuotes"][0]
    assert auction["fundAmount"] == "37800000000000000000"
    assert auction["bribeAmount"] == "4200000000000000000"
    assert auction["partitionFundAmount"] == "37800000000000000002"
    assert auction["partitionBribeAmount"] == "4199999999999999998"
    changed = results["auctionQuotes"][1]
    assert changed["partitionBribeBasisPoints"] == ["1000", "0", "500", "2000"]
    assert changed["partitionFundAmount"] == "58"
    assert changed["partitionBribeAmount"] == "4"


def test_reference_cases_pin_exact_time_boundaries_and_tail() -> None:
    scenarios = json.loads((Path(__file__).parents[2] / "scenarios" / "reference-cases.json").read_text())
    rates = {quote["id"]: quote["nextGlobalTps"] for quote in compute(scenarios)["miningQuotes"]}
    assert rates == {
        "incumbent-before-halving": "64000000000000000000",
        "protected-staggered-halving": "32000000000000000000",
        "just-before-first-time-boundary": "64000000000000000000",
        "just-before-second-time-boundary": "32000000000000000000",
        "at-second-time-boundary": "16000000000000000000",
        "just-before-tail-time-boundary": "2000000000000000000",
        "at-tail-time-boundary": "1000000000000000000",
        "far-after-tail": "1000000000000000000",
        "ten-years-synchronized-supply": "1000000000000000000",
    }


def test_reference_cases_pin_synchronized_supply_at_tail_and_year_ten() -> None:
    scenarios = json.loads((Path(__file__).parents[2] / "scenarios" / "reference-cases.json").read_text())
    quotes = {quote["id"]: quote for quote in compute(scenarios)["miningQuotes"]}
    at_tail = quotes["at-tail-time-boundary"]
    assert at_tail["synchronizedMiningEmission"] == "751161600000000000000000000"
    assert at_tail["synchronizedGrossSupply"] == "771161600000000000000000000"
    at_year_ten = quotes["ten-years-synchronized-supply"]
    assert at_year_ten["synchronizedMiningEmission"] == "1030752000000000000000000000"
    assert at_year_ten["synchronizedGrossSupply"] == "1050752000000000000000000000"


def test_one_raw_unit_payments_are_independently_floored() -> None:
    fund = bribe = 0
    for _ in range(10_000):
        next_fund, next_bribe = classify_payment(1)
        fund += next_fund
        bribe += next_bribe
    assert (fund, bribe) == (10_000, 0)


def test_payment_classification_accepts_zero_and_twenty_percent_bounds() -> None:
    assert classify_payment(10, 0) == (10, 0)
    assert classify_payment(10, 2_000) == (8, 2)
