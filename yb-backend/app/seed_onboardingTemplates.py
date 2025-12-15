# app/seed_onboardingTemplates.py
from app.database import SessionLocal
from app.models import OnboardingTemplateTask

TEMPLATES = [
    # --- Admin phase ---
    dict(
        name="Create and send engagement letter / estimate",
        description="Draft and send engagement letter / estimate for client approval.",
        phase="Admin - Pre Onboarding",
        default_due_offset_days=0,
        default_assigned_role="admin",
        order_index=10,
        is_active=True,
    ),
    dict(
        name="Create client in QBO (or verify existing)",
        description="Create QBO company (or confirm existing file) and invite Yecny users.",
        phase="Admin - QBO Setup",
        default_due_offset_days=1,
        default_assigned_role="admin",
        order_index=20,
        is_active=True,
    ),
    dict(
        name="Set up recurring invoice / billing",
        description="Configure recurring invoice / billing plan based on agreed scope.",
        phase="Admin - Billing",
        default_due_offset_days=2,
        default_assigned_role="admin",
        order_index=30,
        is_active=True,
    ),

    # --- Manager / bookkeeping setup ---
    dict(
        name="Review intake & define scope",
        description="Manager reviews intake answers and refines service scope / notes.",
        phase="Manager - Review",
        default_due_offset_days=1,
        default_assigned_role="manager",
        order_index=40,
        is_active=True,
    ),
    dict(
        name="Build / review chart of accounts",
        description="Customize chart of accounts in QBO based on client industry and needs.",
        phase="Manager - Accounting Setup",
        default_due_offset_days=3,
        default_assigned_role="manager",
        order_index=50,
        is_active=True,
    ),
    dict(
        name="Set up bank feeds and logins",
        description="Connect bank/credit card feeds or document where statements will be pulled.",
        phase="Manager - Banking",
        default_due_offset_days=3,
        default_assigned_role="manager",
        order_index=60,
        is_active=True,
    ),
    dict(
        name="Catch up historical transactions (if needed)",
        description="Determine catch-up period and plan for historical cleanup work.",
        phase="Manager - Cleanup",
        default_due_offset_days=5,
        default_assigned_role="manager",
        order_index=70,
        is_active=True,
    ),

    # --- Optional: payroll-related (still unconditional for now) ---
    dict(
        name="Review payroll setup / provider",
        description="Confirm payroll provider, access, and responsibilities with client.",
        phase="Manager - Payroll",
        default_due_offset_days=4,
        default_assigned_role="manager",
        order_index=80,
        is_active=True,
    ),
]

def main():
    db = SessionLocal()
    try:
        for t in TEMPLATES:
            existing = (
                db.query(OnboardingTemplateTask)
                .filter(OnboardingTemplateTask.name == t["name"])
                .first()
            )
            if existing:
                # Update existing row
                for field, value in t.items():
                    setattr(existing, field, value)
                print(f"Updated template: {t['name']}")
            else:
                db.add(OnboardingTemplateTask(**t))
                print(f"Inserted template: {t['name']}")

        db.commit()
        print("Done seeding onboarding templates.")
    finally:
        db.close()

if __name__ == "__main__":
    main()
