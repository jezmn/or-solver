import pulp
import numpy as np


def _fmt_num(x):
    num = float(x)
    if num == int(num):
        return str(int(num))
    return f"{num:.2f}"


def solve_dual(objective, constraints, signs, rhs, optimization):
    primal_dir = pulp.LpMaximize if optimization == "max" else pulp.LpMinimize
    prob = pulp.LpProblem("Primal", primal_dir)
    n = len(objective)
    m = len(constraints)
    x = [pulp.LpVariable(f"x{i + 1}", lowBound=0) for i in range(n)]

    prob += pulp.lpSum(objective[i] * x[i] for i in range(n))
    for i, row in enumerate(constraints):
        lhs = pulp.lpSum(row[j] * x[j] for j in range(n))
        if signs[i] == "<=":
            prob += lhs <= rhs[i]
        elif signs[i] == ">=":
            prob += lhs >= rhs[i]
        else:
            prob += lhs == rhs[i]

    status = prob.solve(pulp.PULP_CBC_CMD(msg=False))

    if status == pulp.LpStatusInfeasible:
        return {
            "status": "infeasible",
            "steps": [{"description": "Primal problem is infeasible", "data": {}}],
            "graph": {"type": "chart", "data": {}},
        }

    if status == pulp.LpStatusUnbounded:
        return {
            "status": "unbounded",
            "steps": [{"description": "Primal problem is unbounded", "data": {}}],
            "graph": {"type": "chart", "data": {}},
        }

    primal_val = pulp.value(prob.objective)
    var_values = {f"x{i + 1}": pulp.value(x[i]) for i in range(n)}

    steps = [
        {
            "description": f"Primal problem formulated with {n} variables and {m} constraints ({optimization}imize)",
            "data": {
                "objective": objective,
                "constraints": constraints,
                "signs": signs,
                "rhs": rhs,
                "direction": optimization,
            },
        }
    ]

    dual_dir = "min" if optimization == "max" else "max"
    dual_rows = []
    for j in range(n):
        row = [constraints[i][j] for i in range(m)]
        dual_rows.append(row)
    dual_sign = ">=" if optimization == "max" else "<="

    dual_obj_details = [{"dual_var": f"y{i + 1}", "coeff": rhs[i]} for i in range(m)]
    dual_constr_details = []
    for j in range(n):
        dual_constr_details.append(
            {
                "variables": [f"y{i + 1}" for i in range(m)],
                "coefficients": dual_rows[j],
                "sign": dual_sign,
                "rhs": objective[j],
            }
        )

    steps.append(
        {
            "description": f"Dual problem constructed: {m} dual variables, {n} dual constraints, direction={dual_dir}",
            "data": {
                "dual_objective": dual_obj_details,
                "dual_constraints": dual_constr_details,
                "dual_direction": dual_dir,
                "mapping": "Each primal constraint → dual variable, each primal variable → dual constraint",
            },
        }
    )

    dual_prob = pulp.LpProblem(
        "Dual", pulp.LpMinimize if optimization == "max" else pulp.LpMaximize
    )
    y = [pulp.LpVariable(f"y{i + 1}", lowBound=0) for i in range(m)]

    dual_obj = [rhs[i] for i in range(m)]
    dual_prob += pulp.lpSum(dual_obj[i] * y[i] for i in range(m))
    for j in range(n):
        dual_row = [constraints[i][j] for i in range(m)]
        if optimization == "max":
            dual_prob += (
                pulp.lpSum(dual_row[i] * y[i] for i in range(m)) >= objective[j]
            )
        else:
            dual_prob += (
                pulp.lpSum(dual_row[i] * y[i] for i in range(m)) <= objective[j]
            )

    dual_prob.solve(pulp.PULP_CBC_CMD(msg=False))
    dual_vars = {f"y{i + 1}": pulp.value(y[i]) for i in range(m)}
    dual_val = (
        pulp.value(dual_prob.objective) if dual_prob.objective is not None else None
    )

    steps.append(
        {
            "description": f"Dual solved: optimal value = {_fmt_num(dual_val)}"
            if dual_val is not None
            else "Dual solved: optimal value = N/A",
            "data": {
                "dual_variables": dual_vars,
                "dual_optimal_value": dual_val,
                "primal_optimal_value": primal_val,
                "duality_gap": abs(primal_val - (dual_val or 0))
                if dual_val is not None
                else None,
            },
        }
    )

    graph = {"type": "chart", "data": {}}
    if n <= 2:
        xs = np.linspace(0, 1000, 200)
        boundary_lines = []
        for i, row in enumerate(constraints):
            if abs(row[1]) > 1e-9:
                ys = (rhs[i] - row[0] * xs) / row[1]
            else:
                ys = np.full_like(xs, rhs[i] / row[0] if row[0] != 0 else 0)
            boundary_lines.append(
                {"x": xs.tolist(), "y": ys.tolist(), "label": f"C{i + 1}"}
            )
        graph = {
            "type": "chart",
            "data": {"boundary_lines": boundary_lines, "solution_point": var_values},
        }

    return {
        "status": "optimal",
        "solution": {
            "variables": var_values,
            "optimal_value": primal_val,
            "primal_optimal_value": primal_val,
            "dual_variables": dual_vars,
            "dual_optimal_value": dual_val,
        },
        "steps": steps,
        "graph": graph,
    }
