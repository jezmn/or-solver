import math

import pytest
from conftest import BALANCED_TRANSPORT
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.models import IntegerProgrammingInput, SimplexInput, TransportInput
from backend.solvers.vogel import solve_vogel


# --- the regression that hung forever: exhausted row + negative costs ---
def test_vogel_zero_supply_row_does_not_hang():
    r = solve_vogel(supply=[0.0, 1.0], demand=[1.0], costs=[[-100.0], [-100.0]])
    assert r["status"] == "optimal"
    assert r["solution"]["allocation"] == [[0.0], [1]]


def test_vogel_balanced_allocates_everything():
    r = solve_vogel(**BALANCED_TRANSPORT)
    assert r["status"] == "optimal"
    alloc = r["solution"]["allocation"]
    supply = BALANCED_TRANSPORT["supply"]
    demand = BALANCED_TRANSPORT["demand"]
    assert all(abs(sum(row) - s) < 1e-9 for row, s in zip(alloc, supply, strict=True))
    assert all(
        abs(sum(alloc[i][j] for i in range(len(supply))) - d) < 1e-9
        for j, d in enumerate(demand)
    )
    assert r["solution"]["total_cost"] == sum(
        alloc[i][j] * c
        for i, row in enumerate(BALANCED_TRANSPORT["costs"])
        for j, c in enumerate(row)
    )


# --- model validation (the security boundary) ---
def test_model_rejects_oversize_objective():
    with pytest.raises(ValidationError):
        SimplexInput(
            objective=[1.0] * 101,
            constraints=[[1.0]],
            signs=["<="],
            rhs=[1.0],
        )


def test_model_rejects_non_finite():
    with pytest.raises(ValidationError):
        SimplexInput(
            objective=[1.0, math.inf],
            constraints=[[1.0, 1.0]],
            signs=["<="],
            rhs=[1.0],
        )


def test_model_rejects_huge_finite_values():
    with pytest.raises(ValidationError):
        SimplexInput(
            objective=[1e308, 1.0],
            constraints=[[1.0, 1.0]],
            signs=["<="],
            rhs=[1.0],
        )


def test_body_size_limit(client):
    r = client.post(
        "/api/simplex", json={"objective": [1.0] * 1_000_000}
    )
    assert r.status_code == 413


def test_model_rejects_dimension_mismatch():
    with pytest.raises(ValidationError):
        SimplexInput(
            objective=[1.0, 2.0],
            constraints=[[1.0, 1.0]],
            signs=["<=", "<="],  # 2 signs, 1 constraint
            rhs=[4.0],
        )


def test_model_rejects_negative_supply():
    with pytest.raises(ValidationError):
        TransportInput(supply=[-1.0], demand=[1.0], costs=[[5.0]], optimization="min")


def test_model_rejects_integer_var_out_of_range():
    with pytest.raises(ValidationError):
        IntegerProgrammingInput(
            objective=[1.0, 2.0],
            constraints=[[1.0, 1.0]],
            signs=["<="],
            rhs=[4.0],
            integer_vars=[5],
        )


# --- API smoke: every endpoint answers on a known-good problem ---
def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200


def test_security_headers(client):
    r = client.get("/api/health")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert "content-security-policy" in r.headers
    assert "strict-transport-security" in r.headers


def test_static_served(client):
    r = client.get("/")
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]


def test_api_simplex(client, simple_lp):
    r = client.post("/api/simplex", json=simple_lp)
    assert r.status_code == 200
    assert r.json()["status"] == "optimal"


def test_api_dual(client, simple_lp):
    r = client.post("/api/dual", json=simple_lp)
    assert r.status_code == 200


def test_api_sensitivity(client, simple_lp):
    r = client.post("/api/sensitivity", json=simple_lp)
    assert r.status_code == 200


def test_api_vogel_and_northwest(client):
    for path in ("/api/vogel", "/api/northwest-corner"):
        r = client.post(path, json=BALANCED_TRANSPORT)
        assert r.status_code == 200, path
        assert r.json()["status"] == "optimal", path


def test_api_assignment(client):
    r = client.post(
        "/api/assignment",
        json={"cost_matrix": [[4, 1, 3], [2, 0, 5], [3, 2, 2]], "optimization": "min"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "optimal"


def test_api_integer_programming(client):
    r = client.post(
        "/api/integer-programming",
        json={
            "objective": [1, 1],
            "constraints": [[1, 1]],
            "signs": ["<="],
            "rhs": [4],
            "integer_vars": [0, 1],
            "optimization": "max",
        },
    )
    assert r.status_code == 200


def test_api_goal_programming(client):
    r = client.post(
        "/api/goal-programming",
        json={
            "objectives": [
                {
                    "coefficients": [1],
                    "target": 3,
                    "wt_plus": 1,
                    "prty_plus": 1,
                    "wt_minus": 1,
                    "prty_minus": 1,
                }
            ],
            "constraints": [[2]],
            "signs": ["<="],
            "rhs": [5],
        },
    )
    assert r.status_code == 200
    assert r.json()["status"] == "optimal"


def test_api_rejects_invalid_payload(client):
    r = client.post(
        "/api/simplex",
        json={"objective": "not a list", "constraints": [], "signs": [], "rhs": []},
    )
    assert r.status_code == 422


def test_rate_limiter_blocks_after_limit(monkeypatch):
    from fastapi import FastAPI

    from backend import main as main_mod

    monkeypatch.setattr(main_mod, "RATE_LIMIT_MAX", 3)

    limiter_app = FastAPI()
    limiter_app.add_middleware(main_mod.SolverRateLimitMiddleware)

    @limiter_app.post("/api/x")
    def x(data: dict):
        return {"ok": True}

    with TestClient(limiter_app) as c:
        for _ in range(3):
            assert c.post("/api/x", json={}).status_code == 200
        assert c.post("/api/x", json={}).status_code == 429
        # other methods and paths are never limited
        assert c.get("/api/x").status_code == 405
        assert c.post("/health", json={}).status_code == 404


def test_secret_paths_not_leaked(client):
    r = client.get("/api/nope")
    assert r.status_code == 404


def test_solve_queue_timeout(monkeypatch):
    import asyncio

    import httpx
    from fastapi import FastAPI

    from backend import main as main_mod

    monkeypatch.setattr(main_mod, "MAX_CONCURRENT_SOLVES", 1)
    monkeypatch.setattr(main_mod, "SOLVE_QUEUE_TIMEOUT", 0.01)

    app = FastAPI()
    app.add_middleware(main_mod.SolverRateLimitMiddleware)

    @app.post("/api/slow")
    async def slow():
        await asyncio.sleep(0.1)
        return {"ok": True}

    async def run():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
            return await asyncio.gather(c.post("/api/slow"), c.post("/api/slow"))

    codes = sorted(r.status_code for r in asyncio.run(run()))
    assert codes == [200, 429]
