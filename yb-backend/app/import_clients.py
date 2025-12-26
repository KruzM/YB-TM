# app/import_clients.py
from __future__ import annotations

import argparse
from typing import Optional

import pandas as pd

from .database import SessionLocal
from . import models


def _read_csv(path: str) -> pd.DataFrame:
    # Your exports have an extra first row of numbers; header=1 handles that.
    try:
        return pd.read_csv(path, header=1)
    except Exception:
        return pd.read_csv(path, header=0)


def _norm(s: Optional[str]) -> str:
    return (str(s).strip() if s is not None and str(s) != "nan" else "").strip()


def _find_user_id(db, value: str) -> Optional[int]:
    v = _norm(value)
    if not v:
        return None

    if "@" in v:
        u = db.query(models.User).filter(models.User.email.ilike(v)).first()
        return u.id if u else None

    u = db.query(models.User).filter(models.User.name.ilike(v)).first()
    return u.id if u else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv_path", help="Path to 'YB Database - Clients.csv' export")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--created-by-email", default=None, help="Optional: who to attribute notes to")
    args = ap.parse_args()

    df = _read_csv(args.csv_path).fillna("")

    db = SessionLocal()
    created = 0
    updated = 0
    notes = 0

    created_by_id = _find_user_id(db, args.created_by_email) if args.created_by_email else None

    try:
        for _, row in df.iterrows():
            client_label = _norm(row.get("Client", ""))
            legal_name = _norm(row.get("Legal Name", "")) or client_label
            if not legal_name:
                continue

            existing = db.query(models.Client).filter(models.Client.legal_name == legal_name).first()
            tier = _norm(row.get("Tier", "")) or None
            billing_freq = _norm(row.get("Billing Frequency", "")) or None

            payload = {
                "legal_name": legal_name,
                "dba_name": client_label if client_label and client_label != legal_name else None,
                "tier": tier,
                "billing_frequency": billing_freq,
                "bookkeeping_frequency": billing_freq,
                "primary_contact": _norm(row.get("Primary Contact", "")) or None,
                "email": _norm(row.get("Primary Email", "")) or None,
                "phone": _norm(row.get("Primary Phone", "")) or None,
                "cpa": _norm(row.get("CPA", "")) or None,
                "manager_id": _find_user_id(db, row.get("Manager", "")),
            }

            if existing:
                for k, v in payload.items():
                    setattr(existing, k, v)
                updated += 1
                client = existing
            else:
                client = models.Client(**payload)
                db.add(client)
                db.flush()
                created += 1

            # Optional: capture extra operational info into a client note
            extra_fields = {
                "Bank Feeds": _norm(row.get("Bank Feeds", "")),
                "Payroll": _norm(row.get("Payroll", "")),
                "Locations": _norm(row.get("Locations", "")),
                "Prepare 1099s": _norm(row.get("Prepare 1099s", "")),
                "Drive Link": _norm(row.get("Drive Link", "")),
                "EIN": _norm(row.get("EIN", "")),
            }
            extra_fields = {k: v for k, v in extra_fields.items() if v}

            if extra_fields:
                body = "Imported client details:\n" + "\n".join([f"- {k}: {v}" for k, v in extra_fields.items()])
                db.add(models.ClientNote(client_id=client.id, created_by_id=created_by_id, body=body, pinned=False))
                notes += 1

        if args.dry_run:
            db.rollback()
            print(f"[import_clients] DRY RUN: would create={created} update={updated} notes={notes}")
        else:
            db.commit()
            print(f"[import_clients] created={created} updated={updated} notes={notes}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
