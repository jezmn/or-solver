# OR Solver

Simple Operations Research solver via web with interactive step-by-step solutions.

## Solver Methods

- **Linear Programming** — Simplex method with graphical feasible region
- **Integer Programming** — Branch and bound with tree visualization
- **Transportation** — Vogel Approximation and Northwest Corner methods
- **Assignment** — Hungarian algorithm with cost matrix visualization
- **Goal Programming** — Multi-objective optimization
- **Sensitivity Analysis** — Dual values and shadow prices

## Stack

- **Backend:** Python / FastAPI
- **Frontend:** Alpine.js, Chart.js, Plotly, Tailwind CSS
- **Solvers:** PuLP (LP/IP), custom algorithms (transportation, assignment, goal)

## Quick Start

```cmd
npm install
npm run css
pip install -r requirements.txt
python -m uvicorn backend.main:app
```

Open `http://localhost:8000` in your browser.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/simplex` | Linear programming (Simplex) |
| POST | `/api/integer-programming` | Integer programming |
| POST | `/api/assignment` | Assignment problem |
| POST | `/api/vogel` | Vogel Approximation |
| POST | `/api/northwest-corner` | Northwest Corner |
| POST | `/api/goal-programming` | Goal programming |
| POST | `/api/sensitivity` | Sensitivity analysis |
| POST | `/api/dual` | Dual formulation |
| GET | `/api/health` | Health check |

