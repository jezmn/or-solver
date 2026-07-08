from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from backend.models import (
    SimplexInput,
    DualInput,
    TransportInput,
    AssignmentInput,
    IntegerProgrammingInput,
    GoalProgrammingInput,
    SensitivityInput,
)
from backend.solvers.simplex import solve_simplex
from backend.solvers.dual import solve_dual
from backend.solvers.vogel import solve_vogel
from backend.solvers.northwest_corner import solve_northwest_corner
from backend.solvers.assignment import solve_assignment
from backend.solvers.integer_programming import solve_integer_programming
from backend.solvers.goal_programming import solve_goal_programming
from backend.solvers.sensitivity import solve_sensitivity

app = FastAPI(title="Operations Research API", version="1.0.0")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
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


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)


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
    result = solve_northwest_corner(data.supply, data.demand, data.costs)
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
        raise HTTPException(status_code=404, detail="Not found")
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
