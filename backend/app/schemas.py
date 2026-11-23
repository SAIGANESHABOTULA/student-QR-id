from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class AdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    name: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin: AdminOut


def _blank_to_none(v):
    return None if isinstance(v, str) and not v.strip() else v


class StudentCreate(BaseModel):
    roll_no: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=120)
    department: str = Field(min_length=1, max_length=120)
    program: str = Field(default="M.Tech", max_length=60)
    year: int = Field(default=1, ge=1, le=6)
    email: EmailStr | None = None
    blood_group: str | None = Field(default=None, max_length=5)
    valid_until: date | None = None

    _blank = field_validator("email", "blood_group", "valid_until", mode="before")(_blank_to_none)

    @field_validator("roll_no")
    @classmethod
    def _roll(cls, v: str) -> str:
        return v.strip().upper()


class StudentUpdate(BaseModel):
    roll_no: str | None = Field(default=None, min_length=1, max_length=40)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    department: str | None = Field(default=None, min_length=1, max_length=120)
    program: str | None = Field(default=None, max_length=60)
    year: int | None = Field(default=None, ge=1, le=6)
    email: EmailStr | None = None
    blood_group: str | None = Field(default=None, max_length=5)
    valid_until: date | None = None

    _blank = field_validator("email", "blood_group", "valid_until", mode="before")(_blank_to_none)

    @field_validator("roll_no")
    @classmethod
    def _roll(cls, v: str | None) -> str | None:
        return v.strip().upper() if v else v


class StudentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    roll_no: str
    name: str
    department: str
    program: str
    year: int
    email: str | None
    blood_group: str | None
    valid_until: date
    status: str
    revoked_reason: str | None
    card_version: int
    has_photo: bool
    photo_version: int
    created_at: datetime
    last_scanned_at: datetime | None = None
    scan_count: int = 0


class StudentPage(BaseModel):
    items: list[StudentOut]
    total: int


class RevokeIn(BaseModel):
    reason: str = Field(default="Revoked by administrator", max_length=255)


class CredentialOut(BaseModel):
    token: str
    kid: str
    card_version: int


VerifyResult = Literal["valid", "revoked", "superseded", "expired", "tampered", "malformed", "unknown"]


class VerifyIn(BaseModel):
    token: str = Field(max_length=4096)


class VerifiedStudent(BaseModel):
    id: str
    roll_no: str
    name: str
    department: str
    program: str
    year: int
    blood_group: str | None = None
    valid_until: str
    has_photo: bool
    photo_version: int


class VerifyOut(BaseModel):
    result: VerifyResult
    valid: bool
    message: str
    student: VerifiedStudent | None = None
    issued_at: int | None = None
    institution: str


class PublicKeyOut(BaseModel):
    alg: str = "Ed25519"
    kid: str
    public_key: str  # base64url raw 32 bytes
    institution: str


class RevocationsOut(BaseModel):
    kid: str
    revoked: list[str]
    card_versions: dict[str, int]  # student id -> current card version (only when > 1)
    generated_at: datetime


class ScanOut(BaseModel):
    id: str
    student_id: str | None
    roll_no: str | None
    student_name: str | None
    result: str
    reason: str
    created_at: datetime


class ScanPage(BaseModel):
    items: list[ScanOut]
    total: int


class ImportResult(BaseModel):
    created: int
    updated: int
    errors: list[str]


class DayCount(BaseModel):
    day: str
    valid: int
    invalid: int


class StatsOut(BaseModel):
    students_total: int
    students_active: int
    students_revoked: int
    students_expired: int
    scans_total: int
    scans_today: int
    scans_invalid: int
    by_department: dict[str, int]
    by_result: dict[str, int]
    daily: list[DayCount]
    recent: list[ScanOut]
