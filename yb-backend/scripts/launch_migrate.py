import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[2] / "yb_app.db"

def column_exists(cur, table, col):
    cur.execute(f"PRAGMA table_info({table})")
    return any(r[1] == col for r in cur.fetchall())

def table_exists(cur, table):
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
    return cur.fetchone() is not None

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # ---- clients.ein ----
    if not column_exists(cur, "clients", "ein"):
        cur.execute("ALTER TABLE clients ADD COLUMN ein TEXT")
        print(" Added clients.ein")

    # ---- client_intake.ein ----
    if not column_exists(cur, "client_intake", "ein"):
        cur.execute("ALTER TABLE client_intake ADD COLUMN ein TEXT")
        print(" Added client_intake.ein")

    # ---- client_intake.custom_recurring_rules ----
    if not column_exists(cur, "client_intake", "custom_recurring_rules"):
        cur.execute("ALTER TABLE client_intake ADD COLUMN custom_recurring_rules TEXT")
        print(" Added client_intake.custom_recurring_rules")

    # ---- recurring_template_tasks table ----
    if not table_exists(cur, "recurring_template_tasks"):
        cur.execute("""
        CREATE TABLE recurring_template_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            schedule_type TEXT NOT NULL DEFAULT 'client_frequency',
            day_of_month INTEGER,
            weekday INTEGER,
            week_of_month INTEGER,
            initial_delay_days INTEGER NOT NULL DEFAULT 21,
            default_assigned_role TEXT,
            default_status TEXT DEFAULT 'open',
            order_index INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT 1
        )
        """)
        print(" Created recurring_template_tasks table")

    conn.commit()
    conn.close()
    print(" Migration complete:", DB_PATH)
if __name__ == "__main__":
    main()