# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from . import (
    routes_auth,
    routes_tasks,
    routes_clients,
    routes_users,
    routes_accounts,
    routes_documents,
    routes_recurring,   
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Yecny Bookkeeping OS API")

origins = [
    "http://10.0.0.237:5173",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Key lines: these create /api/auth/... and /api/tasks/...
app.include_router(routes_auth.router, prefix="/api")
app.include_router(routes_tasks.router, prefix="/api")
app.include_router(routes_clients.router, prefix="/api")
app.include_router(routes_users.router, prefix="/api")
app.include_router(routes_accounts.router, prefix="/api")
app.include_router(routes_documents.router, prefix="/api")
app.include_router(routes_recurring.router, prefix="/api") 

@app.get("/api/health")
async def health():
    return {"status": "ok"}
