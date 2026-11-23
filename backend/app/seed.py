"""Bootstrap the admin account and (optionally) realistic demo data."""
import random
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import get_settings
from .models import Admin, ScanLog, Student
from .security import hash_password
from .services import MESSAGES

DEPARTMENTS = {
    "Computer Science & Engineering": "CS",
    "Electronics Engineering": "EC",
    "Electrical Engineering": "EE",
    "Mechanical Engineering": "ME",
    "Civil Engineering": "CE",
    "Chemical Engineering": "CH",
}
FIRST = ["Aarav", "Diya", "Rohan", "Ananya", "Karthik", "Meera", "Vikram", "Sneha", "Arjun", "Priya", "Rahul",
         "Kavya", "Nikhil", "Ishita", "Siddharth", "Pooja", "Aditya", "Neha", "Harsha", "Lakshmi", "Varun",
         "Divya", "Manish", "Riya"]
LAST = ["Sharma", "Patel", "Reddy", "Iyer", "Nair", "Gupta", "Desai", "Rao", "Mehta", "Kulkarni", "Joshi",
        "Verma", "Shah", "Pillai", "Naidu", "Bhatt"]
BLOOD = ["A+", "B+", "O+", "AB+", "A-", "O-", "B-"]


def ensure_admin(db: Session) -> None:
    s = get_settings()
    email = s.admin_email.lower()
    if db.scalar(select(Admin).where(Admin.email == email)) is None:
        db.add(Admin(email=email, name="Administrator", password_hash=hash_password(s.admin_password)))
        db.commit()


def seed_demo(db: Session) -> None:
    if (db.scalar(select(func.count(Student.id))) or 0) > 0:
        return
    rng = random.Random(42)
    today = date.today()
    students: list[Student] = []
    for i in range(24):
        dept = rng.choices(list(DEPARTMENTS), weights=[8, 5, 4, 3, 2, 2])[0]
        code = DEPARTMENTS[dept]
        first, last = FIRST[i], rng.choice(LAST)
        year = rng.choice([1, 2])
        roll = f"P{24 - year + 1:02d}{code}{i + 1:03d}"
        students.append(
            Student(
                roll_no=roll,
                name=f"{first} {last}",
                department=dept,
                program="M.Tech",
                year=year,
                email=f"{first.lower()}.{last.lower()}@example.edu",
                blood_group=rng.choice(BLOOD),
                valid_until=today + timedelta(days=rng.randint(120, 600)),
            )
        )
    students[5].status, students[5].revoked_reason = "revoked", "Card reported lost"
    students[11].valid_until = today - timedelta(days=12)
    students[17].card_version = 2
    db.add_all(students)
    db.flush()

    now = datetime.now(timezone.utc)
    weights = {"valid": 80, "tampered": 7, "expired": 5, "revoked": 4, "malformed": 4}
    for _ in range(160):
        when = now - timedelta(days=rng.randint(0, 13), hours=rng.randint(0, 10), minutes=rng.randint(0, 59))
        result = rng.choices(list(weights), weights=list(weights.values()))[0]
        st = None
        if result == "revoked":
            st = students[5]
        elif result == "expired":
            st = students[11]
        elif result in ("valid",):
            st = rng.choice([s for j, s in enumerate(students) if j not in (5, 11)])
        db.add(ScanLog(student_id=st.id if st else None, roll_no=st.roll_no if st else None,
                       result=result, reason=MESSAGES[result], created_at=when))
    db.commit()
