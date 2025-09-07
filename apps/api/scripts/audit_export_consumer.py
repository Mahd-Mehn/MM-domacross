#!/usr/bin/env python3
"""Audit Export Streaming Consumer Example.

Usage:
  python scripts/audit_export_consumer.py --base https://8000-01k4gmg9q2k5psffk18y0q47h1.cloudspaces.litng.ai --token <JWT> [--after 100] [--verify]

Features:
  * Resumes from --after cursor (exclusive)
  * Streams JSONL from /settlement/audit-export/stream
  * Optional integrity_ok assertion
"""
import argparse, sys, json, time, os
import requests

def consume(base: str, token: str, after: int | None, verify_integrity: bool):
    session = requests.Session()
    params = {}
    if after is not None:
        params['after_id'] = after
    if verify_integrity:
        params['verify_integrity'] = 'true'
    url = base.rstrip('/') + '/api/v1/settlement/audit-export/stream'
    headers = { 'Authorization': f'Bearer {token}' }
    with session.get(url, params=params, headers=headers, stream=True, timeout=60) as r:
        r.raise_for_status()
        last_id = after
        line_count = 0
        for line in r.iter_lines(decode_unicode=True):
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                print('!! decode error line:', line, file=sys.stderr)
                continue
            last_id = obj['id']
            line_count += 1
            if verify_integrity and obj.get('integrity_ok') is False:
                print('Integrity MISMATCH at id', obj['id'], file=sys.stderr)
                break
            # Minimal output (id + type)
            print(f"{obj['id']} {obj['event_type']} {obj['created_at']}")
        return last_id, line_count


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default='https://8000-01k4gmg9q2k5psffk18y0q47h1.cloudspaces.litng.ai')
    ap.add_argument('--token', required=True)
    ap.add_argument('--after', type=int, default=None)
    ap.add_argument('--verify', action='store_true')
    args = ap.parse_args()
    last, count = consume(args.base, args.token, args.after, args.verify)
    print(f"\nCompleted batch: {count} lines (last_id={last})")

if __name__ == '__main__':
    main()
