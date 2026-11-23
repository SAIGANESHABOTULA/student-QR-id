import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, deferred, mapped_column, relationship

from .db import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return uuid.uuid4().hex


class Admin(Base):
    __tablename__ = "admins"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), default="Administrator")
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Student(Base):
    __tablename__ = "students"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    roll_no: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    department: Mapped[str] = mapped_column(String(120))
    program: Mapped[str] = mapped_column(String(60), default="M.Tech")
    year: Mapped[int] = mapped_column(default=1)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    blood_group: Mapped[str | None] = mapped_column(String(5), nullable=True)
    valid_until: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(16), default="active")  # active | revoked
    revoked_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Bumped on "reissue card": QR codes carrying an older version are rejected.
    card_version: Mapped[int] = mapped_column(default=1)
    photo: Mapped[bytes | None] = deferred(mapped_column(LargeBinary, nullable=True))
    photo_mime: Mapped[str | None] = mapped_column(String(40), nullable=True)
    photo_version: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    scans: Mapped[list["ScanLog"]] = relationship(back_populates="student", passive_deletes=True)

    @property
    def has_photo(self) -> bool:
        return self.photo_version > 0


class ScanLog(Base):
    __tablename__ = "scan_logs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    student_id: Mapped[str | None] = mapped_column(
        String(32), ForeignKey("students.id", ondelete="SET NULL"), nullable=True, index=True
    )
    roll_no: Mapped[str | None] = mapped_column(String(40), nullable=True)
    # valid | revoked | expired | tampered | malformed | unknown
    result: Mapped[str] = mapped_column(String(20), index=True)
    reason: Mapped[str] = mapped_column(String(255), default="")
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)

    student: Mapped[Student | None] = relationship(back_populates="scans")
