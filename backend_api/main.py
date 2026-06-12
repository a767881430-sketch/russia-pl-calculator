from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api_auth import router as auth_router
from .api_projects import router as projects_router
from .api_public import router as public_router
from .auth import ensure_default_admin
from .config import settings
from .database import Base, SessionLocal, engine


settings.ensure_production_safe()

app = FastAPI(title="XingHaKu Russia P&L Calculator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        ensure_default_admin(db)
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"ok": True}


app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(public_router)
