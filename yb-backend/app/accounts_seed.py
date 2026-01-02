# app/accounts_seed.py
from sqlalchemy.orm import Session
from . import models

# type, default name, default is_active
DEFAULT_ACCOUNT_SHELLS = [
    # Assets
    ("investment", "Investment Accounts", False),
    ("loan_to_others", "Loans to Others", False),
    ("loan_to_shareholders", "Loans to Shareholders", False),
    ("vehicle", "Vehicles", False),
    ("equipment", "Equipment", False),
    ("other_asset", "Other Assets", False),

    # Liabilities
    ("line_of_credit", "Lines of Credit (LOC)", False),
    ("payroll_liability", "Payroll Liabilities", False),
    ("vehicle_loan", "Vehicle Loans", False),
    ("loan_from_shareholders", "Loans from Shareholders", False),
    ("loan_from_others", "Loans from Others", False),
    ("mortgage", "Mortgages", False),

    # Equity
    ("owner_contributions", "Owner Contributions", False),
    ("owner_distributions", "Owner Distributions", False),
]

def seed_default_accounts_for_client(db: Session, client_id: int) -> int:
    """
    Create missing default 'shell' accounts for onboarding.
    Does NOT create checking/savings/credit_card shells if those already exist.
    Returns number created.
    """
    existing_types = {
        (a.type or "").strip()
        for a in db.query(models.Account).filter(models.Account.client_id == client_id).all()
    }

    created = 0
    for acct_type, name, is_active in DEFAULT_ACCOUNT_SHELLS:
        if acct_type in existing_types:
            continue

        db.add(models.Account(
            client_id=client_id,
            name=name,
            type=acct_type,
            last4=None,
            is_active=is_active,
        ))
        created += 1

    return created
