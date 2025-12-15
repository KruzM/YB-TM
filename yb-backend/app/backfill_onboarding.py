# app/backfill_onboarding.py
from app.database import SessionLocal
from app.models import Client, Task
from app.onboarding import create_onboarding_tasks_for_client


def main():
    db = SessionLocal()

    clients = db.query(Client).order_by(Client.id).all()
    print(f"Found {len(clients)} clients")

    for client in clients:
        existing = db.query(Task).filter(
            Task.client_id == client.id,
            Task.task_type == "onboarding",
        ).count()

        if existing:
            print(f"Client {client.id} ({client.legal_name}): already has {existing} onboarding tasks, skipping")
            continue

        created = create_onboarding_tasks_for_client(
            db=db,
            client=client,
            created_by_user_id=None,
        )
        print(f"Client {client.id} ({client.legal_name}): created {len(created)} onboarding tasks")

    db.close()


if __name__ == "__main__":
    main()
