import json
from pathlib import Path

from python.reference_model import compute


def test_reference_cases_capture_miner_rate_protection() -> None:
    scenarios = json.loads((Path(__file__).parents[2] / "scenarios" / "reference-cases.json").read_text())
    results = compute(scenarios)
    assert results["infiniteSupply"] is True
    assert results["miningQuotes"][0]["previousMinerAmount"] == "800000"
    assert results["miningQuotes"][1]["price"] == "0"
    assert results["miningQuotes"][1]["nextGlobalUps"] == "50000000000000000000"
