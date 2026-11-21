import asyncio
import os
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from backend.models import (
    AssignmentInput,
    DualInput,
    GoalProgrammingInput,
    IntegerProgrammingInput,
    SensitivityInput,
    SimplexInput,
    TransportInput,
)
from backend.solvers.assignment import solve_assignment
from backend.solvers.dual import solve_dual
from backend.solvers.goal_programming import solve_goal_programming
from backend.solvers.integer_programming import solve_integer_programming
from backend.solvers.northwest_corner import solve_northwest_corner
from backend.solvers.sensitivity import solve_sensitivity
from backend.solvers.simplex import solve_simplex
from backend.solvers.vogel import solve_vogel

app = FastAPI(title="Operations Research API", version="1.0.0")

RATE_LIMIT_MAX = int(os.environ.get("RATE_LIMIT_MAX", "30"))
RATE_WINDOW = 60  # seconds
MAX_BODY_BYTES = int(os.environ.get("MAX_BODY_BYTES", "1000000"))
MAX_CONCURRENT_SOLVES = int(os.environ.get("MAX_CONCURRENT_SOLVES", "4"))
SOLVE_QUEUE_TIMEOUT = float(os.environ.get("SOLVE_QUEUE_TIMEOUT", "10"))


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject oversized request bodies before FastAPI parses them.

    shortcut: content-length only; chunked bodies bypass it, but the public
    entrypoint is behind Cloudflare which caps body size. Revisit if the origin
    is ever exposed directly.
    """

    async def dispatch(self, request: Request, call_next):
        length = request.headers.get("content-length")
        if length and length.isdigit() and int(length) > MAX_BODY_BYTES:
            return Response("Payload too large", status_code=413)
        return await call_next(request)


class SolverRateLimitMiddleware(BaseHTTPMiddleware):
    """Fixed-window per-IP limits on POST /api/* (the CPU-heavy solver calls).

    shortcut: in-memory and trusts cf-connecting-ip / x-forwarded-for, so a
    restart resets counters and a direct caller could spoof its IP. Enough while
    traffic goes through the Cloudflare tunnel with a single worker; move to
    Cloudflare rate-limiting rules if the app scales past that.
    """

    def __init__(self, app):
        super().__init__(app)
        self._hits: dict[str, list[float]] = {}
        self._slots = asyncio.Semaphore(MAX_CONCURRENT_SOLVES)

    async def dispatch(self, request: Request, call_next):
        if request.method == "POST" and request.url.path.startswith("/api/"):
            forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
            ip = (
                request.headers.get("cf-connecting-ip")
                or forwarded
                or (request.client.host if request.client else "?")
            )
            now = time.monotonic()
            window = [t for t in self._hits.setdefault(ip, []) if now - t < RATE_WINDOW]
            if len(window) >= RATE_LIMIT_MAX:
                return Response("Too many requests", status_code=429)
            window.append(now)
            self._hits[ip] = window
            if len(self._hits) > 10_000:
                # clearing bounds memory when spoofed IPs keep every entry fresh
                self._hits = {}
            # cap simultaneous CBC processes: the per-IP limit is spoofable,
            # so this is the bound that actually protects the server. A request
            # that waits too long is dropped instead of queued forever.
            try:
                await asyncio.wait_for(
                    self._slots.acquire(), timeout=SOLVE_QUEUE_TIMEOUT
                )
            except TimeoutError:
                return Response("Solver busy", status_code=429)
            try:
                return await call_next(request)
            finally:
                self._slots.release()
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            # shortcut: 'unsafe-eval' is required by the stock Alpine CDN build,
            # review only if the frontend moves to Alpine's CSP build or drops it
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdn.plot.ly; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data:; "
            "connect-src 'self' https://cdn.jsdelivr.net https://cdn.plot.ly"
        )
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
        return response


IS_PROD = os.environ.get("ENVIRONMENT", "development") == "production"

# no cookies or sessions exist, so credentials (and their preflight constraints)
# are never needed; drop localhost origins when actually deployed
if IS_PROD:
    ALLOWED_ORIGINS = ["https://or-solver.arnebin.dev"]
else:
    ALLOWED_ORIGINS = [
        "https://or-solver.arnebin.dev",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SolverRateLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(BodySizeLimitMiddleware)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/assignment")
def assignment_endpoint(data: AssignmentInput):
    result = solve_assignment(data.cost_matrix, data.optimization)
    if result["status"] == "infeasible":
        raise HTTPException(status_code=400, detail="Problem is infeasible")
    return result


@app.post("/api/northwest-corner")
def northwest_corner_endpoint(data: TransportInput):
    result = solve_northwest_corner(
        data.supply, data.demand, data.costs, data.optimization
    )
    if result["status"] == "infeasible":
        raise HTTPException(status_code=400, detail="Problem is infeasible")
    return result


@app.post("/api/vogel")
def vogel_endpoint(data: TransportInput):
    result = solve_vogel(data.supply, data.demand, data.costs, data.optimization)
    if result["status"] == "infeasible":
        raise HTTPException(status_code=400, detail="Problem is infeasible")
    return result


@app.post("/api/integer-programming")
def integer_programming_endpoint(data: IntegerProgrammingInput):
    result = solve_integer_programming(
        data.objective,
        data.constraints,
        data.signs,
        data.rhs,
        data.integer_vars,
        data.optimization,
    )
    return result


@app.post("/api/goal-programming")
def goal_programming_endpoint(data: GoalProgrammingInput):
    result = solve_goal_programming(
        data.objectives,
        data.constraints,
        data.signs,
        data.rhs,
    )
    if result["status"] == "infeasible":
        raise HTTPException(status_code=400, detail="Problem is infeasible")
    return result


@app.post("/api/sensitivity")
def sensitivity_endpoint(data: SensitivityInput):
    result = solve_sensitivity(
        data.objective,
        data.constraints,
        data.signs,
        data.rhs,
        data.optimization,
    )
    if result["status"] == "non-optimal":
        raise HTTPException(status_code=400, detail="Problem is not optimal")
    return result


@app.post("/api/dual")
def dual_endpoint(data: DualInput):
    result = solve_dual(
        data.objective,
        data.constraints,
        data.signs,
        data.rhs,
        data.optimization,
    )
    if result["status"] == "infeasible":
        raise HTTPException(status_code=400, detail="Problem is infeasible")
    if result["status"] == "unbounded":
        raise HTTPException(status_code=400, detail="Problem is unbounded")
    return result


FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


@app.get("/{path:path}")
def serve_frontend(path: str):
    if path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")
    if not path:
        path = "index.html"
    elif not path.endswith(".html") and "." not in path:
        path = path + ".html"
    file_path = (FRONTEND_DIR / path).resolve()
    try:
        file_path.relative_to(FRONTEND_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=404, detail="Not found") from None
    if file_path.is_file():
        return FileResponse(file_path)
    index = FRONTEND_DIR / "index.html"
    if index.is_file():
        return FileResponse(index)
    raise HTTPException(status_code=404, detail="Not found")


@app.post("/api/simplex")
def simplex_endpoint(data: SimplexInput):
    result = solve_simplex(
        data.objective,
        data.constraints,
        data.signs,
        data.rhs,
        data.optimization,
    )
    if result["status"] == "infeasible":
        raise HTTPException(status_code=400, detail="Problem is infeasible")
    if result["status"] == "unbounded":
        raise HTTPException(status_code=400, detail="Problem is unbounded")
    return result
