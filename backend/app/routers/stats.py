from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..models import ScanLog, Student
from ..schemas import DayCount, ScanOut, ScanPage, StatsOut
from ..security import current_admin

router = APIRouter(prefix="/api", tags=["dashboard"], dependencies=[Depends(current_admin)])


def _scan_out(s: ScanLog) -> ScanOut:
    return ScanOut(
        id=s.id,
        student_id=s.student_id,
        roll_no=s.roll_no,
        student_name=s.student.name if s.student else None,
        result=s.result,
        reason=s.reason,
        created_at=s.created_at,
    )


@router.get("/stats", response_model=StatsOut)
def stats(db: Session = Depends(get_db), days: int = Query(14, ge=7, le=90)) -> StatsOut:
    today = date.today()
    count = lambda stmt: db.scalar(stmt) or 0  # noqa: E731

    total = count(select(func.count(Student.id)))
    revoked = count(select(func.count(Student.id)).where(Student.status == "revoked"))
    expired = count(select(func.count(Student.id)).where(Student.status == "active", Student.valid_until < today))

    start_today = datetime.combine(today, time.min, tzinfo=timezone.utc)
    since = start_today - timedelta(days=days - 1)
    by_result = dict(db.execute(select(ScanLog.result, func.count()).group_by(ScanLog.result)).all())
    by_dept = dict(
        db.execute(select(Student.department, func.count()).group_by(Student.department).order_by(func.count().desc())).all()
    )

    buckets = {(since + timedelta(days=i)).date().isoformat(): [0, 0] for i in range(days)}
    for created, result in db.execute(select(ScanLog.created_at, ScanLog.result).where(ScanLog.created_at >= since)):
        key = created.date().isoformat()
        if key in buckets:
            buckets[key][0 if result == "valid" else 1] += 1

    recent = db.scalars(
        select(ScanLog).options(joinedload(ScanLog.student)).order_by(ScanLog.created_at.desc()).limit(8)
    ).all()

    scans_total = sum(by_result.values())
    return StatsOut(
        students_total=total,
        students_active=total - revoked - expired,
        students_revoked=revoked,
        students_expired=expired,
        scans_total=scans_total,
        scans_today=count(select(func.count(ScanLog.id)).where(ScanLog.created_at >= start_today)),
        scans_invalid=scans_total - by_result.get("valid", 0),
        by_department=by_dept,
        by_result=by_result,
        daily=[DayCount(day=d, valid=v, invalid=i) for d, (v, i) in buckets.items()],
        recent=[_scan_out(s) for s in recent],
    )


@router.get("/scans", response_model=ScanPage)
def scans(
    db: Session = Depends(get_db),
    result: str = "",
    student_id: str = "",
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> ScanPage:
    stmt = select(ScanLog)
    if result == "invalid":
        stmt = stmt.where(ScanLog.result != "valid")
    elif result:
        stmt = stmt.where(ScanLog.result == result)
    if student_id:
        stmt = stmt.where(ScanLog.student_id == student_id)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(
        stmt.options(joinedload(ScanLog.student)).order_by(ScanLog.created_at.desc()).limit(limit).offset(offset)
    ).all()
    return ScanPage(items=[_scan_out(s) for s in rows], total=total)
