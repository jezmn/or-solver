import os

# lift the per-IP rate limit while tests hammer the API
os.environ["RATE_LIMIT_MAX"] = "1000000"

import pytest
from fastapi.testclient import TestClient

from backend.main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def simple_lp():
    # max x1 + 2*x2, s.t. x1 + x2 <= 4, x1 <= 3
    return {
        "objective": [1, 2],
        "constraints": [[1, 1], [1, 0]],
        "signs": ["<=", "<="],
        "rhs": [4, 3],
        "optimization": "max",
    }


BALANCED_TRANSPORT = {
    "supply": [20, 30, 25],
    "demand": [10, 25, 20, 20],
    "costs": [[8, 6, 10, 5], [10, 12, 13, 7], [7, 9, 11, 16]],
    "optimization": "min",
}
