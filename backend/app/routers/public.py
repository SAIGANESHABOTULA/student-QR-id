"""Unauthenticated endpoints used by the verifier app."""
import time
from collections import defaultdict, deque
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import Student
from ..schemas import PublicKeyOut, RevocationsOut, VerifyIn, VerifyOut
from ..services import demo_credentials, verify_token
from ..signing import b64u_encode, get_signer

router = APIRouter(prefix="/api", tags=["public"])

_WINDOW, _LIMIT = 60.0, 60
_hits: dict[str, deque[float]] = defaultdict(deque)


def _rate_limit(request: Request) -> None:
    ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
        request.client.host if request.client else "?"
    )
    now = time.monotonic()
    q = _hits[ip]
    while q and now - q[0] > _WINDOW:
        q.popleft()
    if len(q) >= _LIMIT:
        raise HTTPException(429, "Too many verification requests. Slow down.")
    q.append(now)


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "time": datetime.now(timezone.utc).isoformat()}


@router.get("/public-key", response_model=PublicKeyOut)
def public_key(response: Response) -> PublicKeyOut:
    signer = get_signer()
    response.headers["Cache-Control"] = "public, max-age=3600"
    return PublicKeyOut(kid=signer.kid, public_key=b64u_encode(signer.public_raw), institution=get_settings().institution_name)


@router.get("/revocations", response_model=RevocationsOut)
def revocations(db: Session = Depends(get_db)) -> RevocationsOut:
    revoked = db.scalars(select(Student.id).where(Student.status == "revoked")).all()
    versions = db.execute(select(Student.id, Student.card_version).where(Student.card_version > 1)).all()
    return RevocationsOut(
        kid=get_signer().kid,
        revoked=list(revoked),
        card_versions={sid: cv for sid, cv in versions},
        generated_at=datetime.now(timezone.utc),
    )


@router.post("/verify", response_model=VerifyOut, dependencies=[Depends(_rate_limit)])
def verify(body: VerifyIn, request: Request, db: Session = Depends(get_db)) -> VerifyOut:
    return verify_token(db, body.token, request.headers.get("user-agent"))


@router.get("/demo-credentials")
def demo(db: Session = Depends(get_db)) -> list[dict]:
    if not get_settings().seed_demo:
        return []
    return demo_credentials(db)


@router.get("/students/{student_id}/photo")
def student_photo(student_id: str, db: Session = Depends(get_db)) -> Response:
    student = db.get(Student, student_id)
    if student is None or not student.photo:
        raise HTTPException(404, "No photo")
    return Response(
        content=student.photo,
        media_type=student.photo_mime or "image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )
