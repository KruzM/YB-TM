# app/import_accounts.py
from __future__ import annotations

import argparse
import re
from typing import Optional

import pandas as pd

from .database import SessionLocal
from . import models


def _read_csv(path: str) -> pd.DataFrame:
    try:
        return pd.read_csv(path, header=1)
    except Exception:
        return pd.read_csv(path, header=0)


def _norm(s: Optional[str]) -> str:
    return (str(s).strip() if s is not None and str(s) != "nan" else "").strip()


def _guess_type(name: str) -> Optional[str]:
    n = name.lower()
    if "checking" in n:
        return "checking"
    if "savings" in n:
        return "savings"
    if "credit" in n or " cc" in n or "card" in n or "amex" in n or "visa" in n:
        return "credit_card"
    if "loan" in n:
        return "loan"
    return None


def _last4(name: str) -> Optional[str]:
    m = re.findall(r"(\d{4})", name)
    return m[-1] if m else None


def _find_client(db, label: str) -> Optional[models.Client]:
    label = _norm(label)
    if not label:
        return None
    exact = db.query(models.Client).filter(models.Client.legal_name == label).first()
    if exact:
        return exact
    exact2 = db.query(models.Client).filter(models.Client.dba_name == label).first()
    if exact2:
        return exact2
    # fallback: partial match
    like = db.query(models.Client).filter(models.Client.legal_name.ilike(f"%{label}%")).first()
    return like


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv_path", help="Path to 'YB Database - Accounts.csv' export")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    df = _read_csv(args.csv_path).fillna("")
    db = SessionLocal()
    created = 0
    skipped = 0

    try:
        for _, row in df.iterrows():
            client_label = _norm(row.get("Client", ""))
            acct_name = _norm(row.get("Account", ""))
            if not client_label or not acct_name:
                continue

            client = _find_client(db, client_label)
            if not client:
                skipped += 1
                continue

            existing = (
                db.query(models.Account)
                .filter(models.Account.client_id == client.id, models.Account.name == acct_name)
                .first()
            )
            if existing:
                continue

            account = models.Account(
                client_id=client.id,
                name=acct_name,
                type=_guess_type(acct_name),
                last4=_last4(acct_name),
                is_active=True,
            )
            db.add(account)
            created += 1

        if args.dry_run:
            db.rollback()
            print(f"[import_accounts] DRY RUN: would create={created} skipped_clients={skipped}")
        else:
            db.commit()
            print(f"[import_accounts] created={created} skipped_clients={skipped}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
