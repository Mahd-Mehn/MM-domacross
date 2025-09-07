#!/usr/bin/env python3
"""Collect latency metrics for valuation batches.

Usage:
  python scripts/collect_latency.py --iterations 200 --domains A,B,C --ensemble 0
  python scripts/collect_latency.py --iterations 200 --domains A,B,C --ensemble 1

Outputs JSON lines to stdout and a summary table at end. Pipe to file for record:
  python scripts/collect_latency.py ... > perf_run.jsonl
"""
from __future__ import annotations
import argparse, json, statistics, time, os, sys
from decimal import Decimal
import requests

API_URL = os.environ.get("API_URL", "https://8000-01k4gmg9q2k5psffk18y0q47h1.cloudspaces.litng.ai")


def valuation_batch(domains: list[str]):
    payload = {"domains": domains}
    # Endpoint lives under /api/v1
    return requests.post(f"{API_URL}/api/v1/valuation/batch", json=payload, timeout=10)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--iterations", type=int, default=200)
    ap.add_argument("--domains", type=str, default="A,B,C")
    ap.add_argument("--ensemble", type=int, choices=[0,1], default=0)
    args = ap.parse_args()

    domains = [d.strip() for d in args.domains.split(",") if d.strip()]

    # Toggle ensemble via env var (assumes config reads it at startup) – user must restart server accordingly.
    if args.ensemble:
        print("# NOTE: Ensure server started with VALUATION_USE_ENSEMBLE=1", file=sys.stderr)

    latencies = []
    errors = 0
    start_wall = time.time()

    for i in range(1, args.iterations + 1):
        t0 = time.time()
        try:
            resp = valuation_batch(domains)
            dt = (time.time() - t0) * 1000
            if resp.status_code != 200:
                errors += 1
                outcome = {"iter": i, "ms": dt, "status": resp.status_code}
            else:
                outcome = {"iter": i, "ms": dt, "status": 200}
                latencies.append(dt)
        except Exception as e:  # noqa
            dt = (time.time() - t0) * 1000
            errors += 1
            outcome = {"iter": i, "ms": dt, "error": str(e)}
        print(json.dumps(outcome))
    total_wall = (time.time() - start_wall) * 1000

    if latencies:
        p50 = statistics.median(latencies)
        p95 = statistics.quantiles(latencies, n=100)[94]
        avg = sum(latencies) / len(latencies)
    else:
        p50 = p95 = avg = None

    summary = {
        "iterations": args.iterations,
        "domains": domains,
        "ensemble": bool(args.ensemble),
        "success": len(latencies),
        "errors": errors,
        "avg_ms": avg,
        "p50_ms": p50,
        "p95_ms": p95,
        "total_wall_ms": total_wall,
    }
    print(json.dumps({"summary": summary}))

    # Friendly table to stderr
    print("\nSummary:", file=sys.stderr)
    for k, v in summary.items():
        print(f"  {k}: {v}", file=sys.stderr)

if __name__ == "__main__":
    main()
