#!/usr/bin/env python3
"""Export OpenAPI schema to JSON for static docs.

Usage:
  python -m scripts.export_openapi --out ../../docs/api-schema.json
"""
from __future__ import annotations
import argparse, json, sys, os

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='../../docs/api-schema.json')
    args = ap.parse_args()
    try:
        from app.main import app  # type: ignore
    except Exception as e:  # pragma: no cover
        print(f"Failed to import FastAPI app: {e}", file=sys.stderr)
        sys.exit(1)
    schema = app.openapi()
    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    # Cast path to str explicitly for stricter type checkers
    path_str: str = str(out_path)
    with open(path_str, 'w') as f:  # type: ignore[arg-type]
        json.dump(schema, f, indent=2, sort_keys=True)
    print(f"Wrote OpenAPI schema to {out_path}")

if __name__ == '__main__':
    main()
