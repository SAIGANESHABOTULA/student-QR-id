import csv
import io
from datetime import date

import qrcode
from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from pydantic import ValidationError
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import ScanLog, Student
from ..schemas import CredentialOut, ImportResult, RevokeIn, StudentCreate, StudentOut, StudentPage, StudentUpdate
from ..security import current_admin
from ..services import default_valid_until, issue_credential, process_photo
from ..signing import get_signer

router = APIRouter(prefix="/api/students", tags=["students"], dependencies=[Depends(current_admin)])

CSV_FIELDS = ["roll_no", "name", "department", "program", "year", "email", "blood_group", "valid_until"]
MAX_PHOTO_BYTES = 8 * 1024 * 1024


def _get(db: Session, student_id: str) -> Student:
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(404, "Student not found")
    return student


def _out(db: Session, students: list[Student]) -> list[StudentOut]:
    ids = [s.id for s in students]
    agg: dict[str, tuple] = {}
    if ids:
        rows = db.execute(
            select(ScanLog.student_id, func.count(), func.max(ScanLog.created_at))
            .where(ScanLog.student_id.in_(ids))
            .group_by(ScanLog.student_id)
        ).all()
        agg = {sid: (n, last) for sid, n, last in rows}
    out = []
    for s in students:
        n, last = agg.get(s.id, (0, None))
        out.append(StudentOut.model_validate(s).model_copy(update={"scan_count": n, "last_scanned_at": last}))
    return out


def _ensure_unique_roll(db: Session, roll_no: str, exclude_id: str | None = None) -> None:
    q = select(Student.id).where(Student.roll_no == roll_no)
    if exclude_id:
        q = q.where(Student.id != exclude_id)
    if db.scalar(q):
        raise HTTPException(409, f"Roll number {roll_no} already exists")


@router.get("", response_model=StudentPage)
def list_students(
    db: Session = Depends(get_db),
    q: str = "",
    department: str = "",
    status: str = Query("", pattern="^(|active|revoked|expired)$"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> StudentPage:
    stmt = select(Student)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Student.name.ilike(like), Student.roll_no.ilike(like), Student.email.ilike(like)))
    if department:
        stmt = stmt.where(Student.department == department)
    if status == "expired":
        stmt = stmt.where(Student.status == "active", Student.valid_until < date.today())
    elif status == "active":
        stmt = stmt.where(Student.status == "active", Student.valid_until >= date.today())
    elif status:
        stmt = stmt.where(Student.status == status)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(Student.created_at.desc(), Student.roll_no).limit(limit).offset(offset)).all()
    return StudentPage(items=_out(db, list(rows)), total=total)


@router.get("/departments", response_model=list[str])
def departments(db: Session = Depends(get_db)) -> list[str]:
    return list(db.scalars(select(Student.department).distinct().order_by(Student.department)).all())


@router.post("", response_model=StudentOut, status_code=201)
def create_student(body: StudentCreate, db: Session = Depends(get_db)) -> StudentOut:
    _ensure_unique_roll(db, body.roll_no)
    data = body.model_dump()
    data["valid_until"] = data["valid_until"] or default_valid_until()
    student = Student(**data)
    db.add(student)
    db.commit()
    return _out(db, [student])[0]


@router.get("/export.csv")
def export_csv(db: Session = Depends(get_db)) -> Response:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([*CSV_FIELDS, "status"])
    for s in db.scalars(select(Student).order_by(Student.roll_no)):
        writer.writerow([s.roll_no, s.name, s.department, s.program, s.year, s.email or "", s.blood_group or "",
                         s.valid_until.isoformat(), s.status])
    return Response(buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="students.csv"'})


@router.post("/import", response_model=ImportResult)
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db)) -> ImportResult:
    text = (await file.read()).decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames or not {"roll_no", "name", "department"} <= {f.strip() for f in reader.fieldnames}:
        raise HTTPException(400, "CSV must have at least roll_no, name and department columns")
    created = updated = 0
    errors: list[str] = []
    for line, row in enumerate(reader, start=2):
        clean = {k.strip(): (v or "").strip() for k, v in row.items() if k and k.strip() in CSV_FIELDS}
        clean = {k: v for k, v in clean.items() if v != ""}
        try:
            data = StudentCreate(**clean)
        except ValidationError as exc:
            first = exc.errors()[0]
            errors.append(f"Line {line}: {'.'.join(map(str, first['loc']))} - {first['msg']}")
            continue
        existing = db.scalar(select(Student).where(Student.roll_no == data.roll_no))
        values = data.model_dump(exclude_unset=True)
        if existing:
            for k, v in values.items():
                setattr(existing, k, v)
            updated += 1
        else:
            values.setdefault("valid_until", None)
            values["valid_until"] = values["valid_until"] or default_valid_until()
            db.add(Student(**values))
            created += 1
    db.commit()
    return ImportResult(created=created, updated=updated, errors=errors[:50])


@router.get("/{student_id}", response_model=StudentOut)
def get_student(student_id: str, db: Session = Depends(get_db)) -> StudentOut:
    return _out(db, [_get(db, student_id)])[0]


@router.patch("/{student_id}", response_model=StudentOut)
def update_student(student_id: str, body: StudentUpdate, db: Session = Depends(get_db)) -> StudentOut:
    student = _get(db, student_id)
    changes = body.model_dump(exclude_unset=True)
    if changes.get("roll_no"):
        _ensure_unique_roll(db, changes["roll_no"], exclude_id=student.id)
    if "valid_until" in changes and changes["valid_until"] is None:
        changes.pop("valid_until")
    for k, v in changes.items():
        setattr(student, k, v)
    db.commit()
    return _out(db, [student])[0]


@router.delete("/{student_id}", status_code=204)
def delete_student(student_id: str, db: Session = Depends(get_db)) -> Response:
    db.delete(_get(db, student_id))
    db.commit()
    return Response(status_code=204)


@router.post("/{student_id}/photo", response_model=StudentOut)
async def upload_photo(student_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)) -> StudentOut:
    student = _get(db, student_id)
    raw = await file.read(MAX_PHOTO_BYTES + 1)
    if len(raw) > MAX_PHOTO_BYTES:
        raise HTTPException(413, "Photo must be under 8 MB")
    try:
        student.photo = process_photo(raw)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    student.photo_mime = "image/jpeg"
    student.photo_version += 1
    db.commit()
    return _out(db, [student])[0]


@router.post("/{student_id}/revoke", response_model=StudentOut)
def revoke(student_id: str, body: RevokeIn, db: Session = Depends(get_db)) -> StudentOut:
    student = _get(db, student_id)
    student.status, student.revoked_reason = "revoked", body.reason
    db.commit()
    return _out(db, [student])[0]


@router.post("/{student_id}/reinstate", response_model=StudentOut)
def reinstate(student_id: str, db: Session = Depends(get_db)) -> StudentOut:
    student = _get(db, student_id)
    student.status, student.revoked_reason = "active", None
    db.commit()
    return _out(db, [student])[0]


@router.post("/{student_id}/reissue", response_model=StudentOut)
def reissue(student_id: str, db: Session = Depends(get_db)) -> StudentOut:
    """Issue a new card version; every previously printed QR stops verifying."""
    student = _get(db, student_id)
    student.card_version += 1
    db.commit()
    return _out(db, [student])[0]


@router.get("/{student_id}/credential", response_model=CredentialOut)
def credential(student_id: str, db: Session = Depends(get_db)) -> CredentialOut:
    student = _get(db, student_id)
    return CredentialOut(token=issue_credential(student), kid=get_signer().kid, card_version=student.card_version)


@router.get("/{student_id}/qr.png")
def credential_qr(student_id: str, db: Session = Depends(get_db)) -> Response:
    img = qrcode.make(issue_credential(_get(db, student_id)), error_correction=qrcode.constants.ERROR_CORRECT_M,
                      box_size=8, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(buf.getvalue(), media_type="image/png")
