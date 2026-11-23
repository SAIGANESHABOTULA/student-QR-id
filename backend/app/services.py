"""Business logic shared by the routers."""
import io
from datetime import date, timedelta

from PIL import Image, ImageOps
from sqlalchemy.orm import Session

from .config import get_settings
from .models import ScanLog, Student
from .schemas import VerifiedStudent, VerifyOut
from .signing import TokenError, get_signer

MESSAGES = {
    "valid": "Authentic ID card. Signature verified and student is in good standing.",
    "revoked": "This ID card has been revoked by the institution.",
    "superseded": "This is an old card. A newer card has been issued to this student.",
    "expired": "This ID card has expired.",
    "tampered": "Signature check failed. The QR code was forged or altered.",
    "malformed": "This QR code is not a SecureID credential.",
    "unknown": "Signature is genuine but the student record no longer exists.",
}


def default_valid_until() -> date:
    return date.today() + timedelta(days=get_settings().default_validity_days)


def issue_credential(student: Student) -> str:
    claims = {
        "sid": student.id,
        "roll": student.roll_no,
        "name": student.name,
        "dept": student.department,
        "prog": student.program,
        "yr": student.year,
        "exp": student.valid_until.isoformat(),
        "cv": student.card_version,
    }
    return get_signer().sign(claims)


def _verified(student: Student) -> VerifiedStudent:
    return VerifiedStudent(
        id=student.id,
        roll_no=student.roll_no,
        name=student.name,
        department=student.department,
        program=student.program,
        year=student.year,
        blood_group=student.blood_group,
        valid_until=student.valid_until.isoformat(),
        has_photo=student.has_photo,
        photo_version=student.photo_version,
    )


def verify_token(db: Session, token: str, user_agent: str | None = None) -> VerifyOut:
    institution = get_settings().institution_name
    student: Student | None = None
    claims: dict = {}
    try:
        claims = get_signer().verify(token)
        student = db.get(Student, claims.get("sid"))
        if student is None:
            result = "unknown"
        elif student.status == "revoked":
            result = "revoked"
        elif int(claims.get("cv", 1)) < student.card_version:
            result = "superseded"
        elif date.fromisoformat(str(claims.get("exp"))) < date.today() or student.valid_until < date.today():
            result = "expired"
        else:
            result = "valid"
    except TokenError as exc:
        result = exc.kind
    except (TypeError, ValueError):
        result = "malformed"

    reason = MESSAGES[result]
    if result == "revoked" and student is not None and student.revoked_reason:
        reason = f"{reason} Reason: {student.revoked_reason}"

    db.add(
        ScanLog(
            student_id=student.id if student else None,
            roll_no=(student.roll_no if student else claims.get("roll")),
            result=result,
            reason=reason[:255],
            user_agent=(user_agent or "")[:255] or None,
        )
    )
    db.commit()

    # Never echo student details for forged / unparsable codes.
    show_student = student is not None and result not in ("tampered", "malformed")
    return VerifyOut(
        result=result,
        valid=result == "valid",
        message=reason,
        student=_verified(student) if show_student else None,
        issued_at=claims.get("iat") if show_student else None,
        institution=institution,
    )


def process_photo(raw: bytes) -> bytes:
    """Normalise an uploaded photo to a 3:4 JPEG passport crop (~20-40 KB)."""
    try:
        img = Image.open(io.BytesIO(raw))
        img = ImageOps.exif_transpose(img).convert("RGB")
    except Exception as exc:  # noqa: BLE001
        raise ValueError("Unsupported image file") from exc
    img = ImageOps.fit(img, (360, 480), method=Image.Resampling.LANCZOS, centering=(0.5, 0.4))
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=85, optimize=True)
    return out.getvalue()


def demo_credentials(db) -> list[dict]:
    """Ready-made sample QR payloads so visitors can try the verifier without a printed card."""
    from sqlalchemy import select

    from .signing import b64u_decode, b64u_encode

    today = date.today()
    pick = lambda *conds: db.scalar(select(Student).where(*conds).order_by(Student.roll_no).limit(1))  # noqa: E731
    out: list[dict] = []
    valid = pick(Student.status == "active", Student.valid_until >= today, Student.card_version == 1)
    if valid:
        token = issue_credential(valid)
        out.append({"kind": "valid", "label": "Genuine card", "token": token})
        prefix, payload, sig = token.split(".")
        forged = b64u_decode(payload).replace(f'"yr":{valid.year}'.encode(), b'"yr":4')
        forged = forged.replace(valid.name.encode(), b"Impostor " + valid.name.split()[-1].encode())
        out.append({"kind": "tampered", "label": "Forged / edited card", "token": f"{prefix}.{b64u_encode(forged)}.{sig}"})
    if revoked := pick(Student.status == "revoked"):
        out.append({"kind": "revoked", "label": "Revoked (reported lost)", "token": issue_credential(revoked)})
    if expired := pick(Student.status == "active", Student.valid_until < today):
        out.append({"kind": "expired", "label": "Expired card", "token": issue_credential(expired)})
    if reissued := pick(Student.status == "active", Student.card_version > 1, Student.valid_until >= today):
        current = reissued.card_version
        reissued.card_version = 1  # sign the *old* version, without persisting the change
        token = issue_credential(reissued)
        reissued.card_version = current
        db.expunge(reissued)
        out.append({"kind": "superseded", "label": "Old card after reissue", "token": token})
    return out
