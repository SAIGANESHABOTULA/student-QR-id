import os
import tempfile
from datetime import date, timedelta

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["SEED_DEMO"] = "false"
os.environ["JWT_SECRET"] = "test-secret-that-is-long-enough-for-hs256"
os.environ["ADMIN_EMAIL"] = "admin@test.dev"
os.environ["ADMIN_PASSWORD"] = "secret-pass"
os.environ["SIGNING_KEY"] = "nWGxne_9WmC6hEr0kuwsxERJxWl7MZkZ3DzgUGFUxBY"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.signing import b64u_decode, b64u_encode  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        token = c.post("/api/auth/login", json={"email": "admin@test.dev", "password": "secret-pass"}).json()
        c.headers["Authorization"] = f"Bearer {token['access_token']}"
        yield c


def _student(client, roll="P24CS001", **extra):
    body = {"roll_no": roll, "name": "Test Student", "department": "Computer Science & Engineering", **extra}
    r = client.post("/api/students", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def _token(client, sid):
    return client.get(f"/api/students/{sid}/credential").json()["token"]


def _verify(client, token):
    return client.post("/api/verify", json={"token": token}).json()


def test_login_rejects_bad_password():
    with TestClient(app) as c:
        assert c.post("/api/auth/login", json={"email": "admin@test.dev", "password": "nope"}).status_code == 401


def test_admin_routes_require_auth():
    with TestClient(app) as c:
        assert c.get("/api/students").status_code == 401


def test_valid_credential(client):
    s = _student(client)
    res = _verify(client, _token(client, s["id"]))
    assert res["result"] == "valid" and res["valid"] is True
    assert res["student"]["roll_no"] == "P24CS001"


def test_tampered_credential(client):
    s = _student(client, roll="P24CS002")
    prefix, payload, sig = _token(client, s["id"]).split(".")
    forged = b64u_decode(payload).replace(b"Test Student", b"Evil Student")
    res = _verify(client, f"{prefix}.{b64u_encode(forged)}.{sig}")
    assert res["result"] == "tampered" and res["student"] is None


def test_malformed(client):
    assert _verify(client, "hello world")["result"] == "malformed"
    # The original project's JSON format must not be accepted.
    assert _verify(client, '{"data":{"name":"x"},"signature":"abc"}')["result"] == "malformed"


def test_revoke_and_reinstate(client):
    s = _student(client, roll="P24CS003")
    token = _token(client, s["id"])
    client.post(f"/api/students/{s['id']}/revoke", json={"reason": "Lost"})
    res = _verify(client, token)
    assert res["result"] == "revoked" and "Lost" in res["message"]
    assert s["id"] in client.get("/api/revocations").json()["revoked"]
    client.post(f"/api/students/{s['id']}/reinstate")
    assert _verify(client, token)["result"] == "valid"


def test_reissue_supersedes_old_card(client):
    s = _student(client, roll="P24CS004")
    old = _token(client, s["id"])
    client.post(f"/api/students/{s['id']}/reissue")
    assert _verify(client, old)["result"] == "superseded"
    assert _verify(client, _token(client, s["id"]))["result"] == "valid"


def test_expired(client):
    s = _student(client, roll="P24CS005", valid_until=(date.today() - timedelta(days=1)).isoformat())
    assert _verify(client, _token(client, s["id"]))["result"] == "expired"


def test_duplicate_roll_rejected(client):
    _student(client, roll="P24CS006")
    r = client.post("/api/students", json={"roll_no": "p24cs006", "name": "X", "department": "Y"})
    assert r.status_code == 409


def test_csv_import(client):
    csv_text = "roll_no,name,department,year\nP24EE100,Csv One,Electrical Engineering,1\nP24EE101,Csv Two,,2\n"
    r = client.post("/api/students/import", files={"file": ("s.csv", csv_text, "text/csv")})
    body = r.json()
    assert body["created"] == 1 and len(body["errors"]) == 1


def test_photo_upload(client):
    import io

    from PIL import Image

    s = _student(client, roll="P24CS007")
    buf = io.BytesIO()
    Image.new("RGB", (800, 600), "red").save(buf, format="PNG")
    r = client.post(f"/api/students/{s['id']}/photo", files={"file": ("p.png", buf.getvalue(), "image/png")})
    assert r.json()["has_photo"] is True
    photo = client.get(f"/api/students/{s['id']}/photo")
    assert photo.headers["content-type"] == "image/jpeg"
    assert Image.open(io.BytesIO(photo.content)).size == (360, 480)


def test_stats_and_scans(client):
    stats = client.get("/api/stats").json()
    assert stats["scans_total"] > 0 and len(stats["daily"]) == 14
    assert client.get("/api/scans?result=invalid").json()["total"] > 0


def test_demo_credentials_disabled_by_default(client):
    assert client.get("/api/demo-credentials").json() == []


def test_demo_credentials_results(client, monkeypatch):
    from app.config import get_settings
    from app.db import SessionLocal
    from app.seed import seed_demo
    from app.services import demo_credentials

    with SessionLocal() as db:
        from app.models import Student
        db.query(Student).delete()
        db.commit()
        seed_demo(db)
        creds = demo_credentials(db)
    kinds = {c["kind"]: c["token"] for c in creds}
    assert set(kinds) == {"valid", "tampered", "revoked", "expired", "superseded"}
    for kind, token in kinds.items():
        assert _verify(client, token)["result"] == kind, kind
    monkeypatch.setattr(get_settings(), "seed_demo", True)
    assert len(client.get("/api/demo-credentials").json()) == 5


def test_admin_password_follows_env(client, monkeypatch):
    from app.config import get_settings
    from app.db import SessionLocal
    from app.seed import ensure_admin

    monkeypatch.setattr(get_settings(), "admin_password", "rotated-pass-123")
    with SessionLocal() as db:
        ensure_admin(db)
    with TestClient(app) as c:
        assert c.post("/api/auth/login", json={"email": "admin@test.dev", "password": "secret-pass"}).status_code == 401
        assert c.post("/api/auth/login", json={"email": "admin@test.dev", "password": "rotated-pass-123"}).status_code == 200
