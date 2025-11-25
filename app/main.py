from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session

from app import models
from app.database import engine
from app.routers import accounts, auth, clients, contacts, documents, recurring_tasks, tasks, users

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Yecny Bookkeeping Platform")

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(clients.router)
app.include_router(contacts.router)
app.include_router(accounts.router)
app.include_router(tasks.router)
app.include_router(recurring_tasks.router)
app.include_router(documents.router)


@app.get("/health")
def healthcheck():
    return {"status": "ok"}
