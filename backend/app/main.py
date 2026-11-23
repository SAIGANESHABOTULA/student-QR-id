import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from .config import get_settings
from .db import Base, SessionLocal, engine
from .routers import auth, public, stats, students
from .seed import ensure_admin, seed_demo
from .signing import get_signer

logging.basicConfig(level=logging.INFO)
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    get_signer()  # fail fast on a bad SIGNING_KEY
    with SessionLocal() as db:
        ensure_admin(db)
        if settings.seed_demo:
            seed_demo(db)
    yield


app = FastAPI(
    title="SecureID API",
    description="Issue and verify tamper-proof, digitally signed student ID cards.",
    version="2.0.0",
    lifespan=lifespan,
)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(public.router)
app.include_router(auth.router)
app.include_router(students.router)
app.include_router(stats.router)


@app.get("/", include_in_schema=False)
def root() -> dict:
    return {"name": "SecureID API", "docs": "/docs", "health": "/api/health"}
