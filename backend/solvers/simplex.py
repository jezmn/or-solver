import logging
import pulp
import math
import numpy as np


def _fmt(v, decimals=2):
    if v is None:
        return "N/A"
    if abs(v - round(v)) < 1e-10:
        return str(int(round(v)))
    return f"{v:.{decimals}f}".rstrip("0").rstrip(".")


logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)


def _dual_variable_sign(primal_sign, optimization):
    if primal_sign == "=":
        return "unrestricted"
    if optimization == "max":
        return ">= 0" if primal_sign == "<=" else "<= 0"
    return ">= 0" if primal_sign == ">=" else "<= 0"


def _build_dual_formulation(objective, constraints, signs, rhs, optimization):
    m = len(constraints)
    n = len(objective)
    dual_direction = "min" if optimization == "max" else "max"
    dual_constraint_sign = ">=" if optimization == "max" else "<="
    variables = [
        {
            "name": f"y{i + 1}",
            "objective_coefficient": rhs[i],
            "sign": _dual_variable_sign(signs[i], optimization),
            "source_constraint": f"C{i + 1}",
        }
        for i in range(m)
    ]
    dual_constraints = []
    for j in range(n):
        dual_constraints.append(
            {
                "name": f"D{j + 1}",
                "variables": [f"y{i + 1}" for i in range(m)],
                "coefficients": [constraints[i][j] for i in range(m)],
                "sign": dual_constraint_sign,
                "rhs": objective[j],
                "source_variable": f"x{j + 1}",
            }
        )
    return {
        "direction": dual_direction,
        "variables": variables,
        "constraints": dual_constraints,
        "mapping": "Each primal constraint becomes a dual variable; each primal variable becomes a dual constraint.",
    }


def solve_simplex(objective, constraints, signs, rhs, optimization):
    n = len(objective)
    m = len(constraints)

    prob = pulp.LpProblem(
        "Simplex", pulp.LpMaximize if optimization == "max" else pulp.LpMinimize
    )
    x = [pulp.LpVariable(f"x{i + 1}", lowBound=0) for i in range(n)]

    prob += pulp.lpSum(objective[i] * x[i] for i in range(n))

    for i, row in enumerate(constraints):
        lhs = pulp.lpSum(row[j] * x[j] for j in range(n))
        if signs[i] == "<=":
            prob += lhs <= rhs[i], f"C{i + 1}"
        elif signs[i] == ">=":
            prob += lhs >= rhs[i], f"C{i + 1}"
        else:
            prob += lhs == rhs[i], f"C{i + 1}"

    status = prob.solve(pulp.PULP_CBC_CMD(msg=False))

    if status == pulp.LpStatusInfeasible:
        return {
            "status": "infeasible",
            "steps": [{"description": "Problem is infeasible", "data": {}}],
            "graph": {"type": "chart", "data": {}},
        }

    if status == pulp.LpStatusUnbounded:
        return {
            "status": "unbounded",
            "steps": [{"description": "Problem is unbounded", "data": {}}],
            "graph": {"type": "chart", "data": {}},
        }

    if status == pulp.LpStatusNotSolved:
        return {
            "status": "not_solved",
            "steps": [{"description": "Solver did not solve the problem", "data": {}}],
            "graph": {"type": "chart", "data": {}},
        }

    if status == pulp.LpStatusUndefined:
        return {
            "status": "numerical_issue",
            "steps": [
                {"description": "Solver encountered a numerical issue", "data": {}}
            ],
            "graph": {"type": "chart", "data": {}},
        }

    var_values = {f"x{i + 1}": pulp.value(x[i]) for i in range(n)}
    optimal_value = pulp.value(prob.objective)

    slacks = []
    for i in range(m):
        lhs_value = sum(constraints[i][j] * var_values[f"x{j + 1}"] for j in range(n))
        if signs[i] == "<=":
            slacks.append(round(rhs[i] - lhs_value, 10))
        elif signs[i] == ">=":
            slacks.append(round(lhs_value - rhs[i], 10))
        else:
            slacks.append(0.0)

    shadow_prices = []
    for i, constraint in enumerate(prob.constraints.values()):
        shadow_prices.append(
            {
                "constraint": i,
                "name": f"C{i + 1}",
                "value": constraint.pi if constraint.pi is not None else 0,
            }
        )

    reduced_costs = []
    for i, var in enumerate(x):
        reduced_costs.append(
            {"variable": f"x{i + 1}", "value": var.dj if var.dj is not None else 0}
        )

    constraint_analysis = []
    for i, slack in enumerate(slacks):
        dual_value = shadow_prices[i]["value"] if i < len(shadow_prices) else 0
        constraint_analysis.append(
            {
                "constraint": f"C{i + 1}",
                "slack": slack,
                "dual_value": dual_value,
            }
        )

    dual_formulation = _build_dual_formulation(
        objective, constraints, signs, rhs, optimization
    )

    steps = []
    slack_count = sum(1 for s in signs if s in ("<=", ">="))

    try:
        simplex_dir = 1 if optimization == "max" else -1
        obj_row = [-simplex_dir * c for c in objective] + [0] * slack_count + [0]
        tableau = []
        slack_idx = 0
        basis = []
        for i in range(m):
            row = list(constraints[i])
            row += [0] * slack_count
            slack_col = n + slack_idx
            if signs[i] == "<=":
                row[slack_col] = 1
                basis.append(slack_col)
                slack_idx += 1
            elif signs[i] == ">=":
                row[slack_col] = -1
                basis.append(slack_col)
                slack_idx += 1
            else:
                basis.append(-1)
            row.append(rhs[i])
            tableau.append(row)

        tableau.insert(0, obj_row)

        def _label(b):
            if b < n:
                return f"x{b + 1}"
            elif b >= n:
                return f"s{b - n + 1}"
            return "art"

        row_labels = [_label(b) for b in basis]

        max_iter = 50
        for iteration in range(max_iter):
            z_row = tableau[0]

            opt_dir = "most negative" if optimization == "max" else "most positive"
            threshold = -1e-12 if optimization == "max" else 1e-12
            better = (
                (lambda v, best: v < best)
                if optimization == "max"
                else (lambda v, best: v > best)
            )

            pivot_col = None
            best_val = threshold
            for j in range(n + slack_count):
                if better(z_row[j], best_val):
                    best_val = z_row[j]
                    pivot_col = j
            if pivot_col is None:
                break

            entering = _label(pivot_col)
            pivot_col_reason = f"{_fmt(best_val)} is the {opt_dir} value in the Z row"

            pivot_row = None
            min_ratio = float("inf")
            ratio_tests = []
            for i in range(1, m + 1):
                label = row_labels[i - 1]
                col_val = tableau[i][pivot_col]
                rhs_val = tableau[i][-1]
                if col_val > 1e-12:
                    ratio = rhs_val / col_val
                    ratio_tests.append(
                        {
                            "label": label,
                            "rhs": rhs_val,
                            "pivot_col_val": col_val,
                            "ratio": ratio,
                        }
                    )
                    if ratio < min_ratio:
                        min_ratio = ratio
                        pivot_row = i
                else:
                    reason = (
                        "0" if abs(col_val) < 1e-12 else f"{_fmt(col_val)} (negative)"
                    )
                    ratio_tests.append(
                        {
                            "label": label,
                            "rhs": rhs_val,
                            "pivot_col_val": col_val,
                            "ratio": None,
                            "skipped": True,
                            "reason": reason,
                        }
                    )

            if pivot_row is None:
                break

            pivot_val = tableau[pivot_row][pivot_col]
            leaving_idx = basis[pivot_row - 1]
            leaving = _label(leaving_idx)
            pivot_row_label = row_labels[pivot_row - 1]
            pivot_row_reason = f"{_fmt(min_ratio)} is the smallest valid ratio"

            basis[pivot_row - 1] = pivot_col
            row_labels[pivot_row - 1] = entering

            for j in range(n + slack_count + 1):
                tableau[pivot_row][j] /= pivot_val

            for i in range(m + 1):
                if i != pivot_row:
                    factor = tableau[i][pivot_col]

                    for j in range(n + slack_count + 1):
                        tableau[i][j] -= factor * tableau[pivot_row][j]

            tdisplay = [tableau[0][:-1]] + [row[:-1] for row in tableau[1:]]
            rhs_display = [tableau[0][-1]] + [row[-1] for row in tableau[1:]]
            current_vars = {}
            for i in range(1, m + 1):
                if basis[i - 1] < n:
                    current_vars[f"x{basis[i - 1] + 1}"] = tableau[i][-1]

            steps.append(
                {
                    "description": f"Iteration {iteration + 1}: {entering} enters, {leaving} leaves",
                    "data": {
                        "_step_type": "simplex_tableau",
                        "entering": entering,
                        "leaving": leaving,
                        "pivot_row": pivot_row,
                        "pivot_col": pivot_col,
                        "pivot_col_var": entering,
                        "pivot_col_value": best_val,
                        "pivot_col_reason": pivot_col_reason,
                        "pivot_val": pivot_val,
                        "pivot_row_label": pivot_row_label,
                        "pivot_row_reason": pivot_row_reason,
                        "ratio_tests": ratio_tests,
                        "tableau": tdisplay,
                        "rhs": rhs_display,
                        "basis": [_label(b) for b in basis],
                        "objective_value": tableau[0][-1],
                        "current_vars": current_vars,
                        "num_vars": n,
                        "num_slacks": slack_count,
                    },
                }
            )
    except Exception:
        logger.warning("Tableau iteration computation failed", exc_info=True)

    final_z_values = [round(tableau[0][j], 10) for j in range(n + slack_count)]
    final_basis_labels = [_label(b) for b in basis]
    basis_values = []
    for i, label in enumerate(final_basis_labels, start=1):
        basis_values.append({"name": label, "value": round(tableau[i][-1], 10)})
    if optimization == "max":
        opt_reason = "There are no negative values left in the Z row, so the current tableau is optimal."
    else:
        opt_reason = "There are no positive values left in the Z row, so the current tableau is optimal."

    steps.append(
        {
            "description": "Optimality Check",
            "data": {
                "_step_type": "optimality_check",
                "z_row": final_z_values,
                "basis_values": basis_values,
                "variables": var_values,
                "constraint_analysis": constraint_analysis,
                "optimal_value": optimal_value,
                "explanation": opt_reason,
                "num_vars": n,
                "num_slacks": slack_count,
            },
        }
    )

    graph = {"type": "chart", "data": {}}
    if n <= 2:
        eps = 1e-9

        def _feasible_pt(x1, x2):
            if x1 < -eps or x2 < -eps:
                return False
            for r, row in enumerate(constraints):
                val = row[0] * x1 + row[1] * x2
                if signs[r] == "<=" and val > rhs[r] + eps:
                    return False
                if signs[r] == ">=" and val < rhs[r] - eps:
                    return False
                if signs[r] == "=" and abs(val - rhs[r]) > eps:
                    return False
            return True

        lines = []
        for r, row in enumerate(constraints):
            lines.append((row[0], row[1], rhs[r], signs[r]))
        lines.append((1.0, 0.0, 0.0, ">="))
        lines.append((0.0, 1.0, 0.0, ">="))

        vertices = []
        n_lines = len(lines)
        for i in range(n_lines):
            a1, b1, c1, _ = lines[i]
            for j in range(i + 1, n_lines):
                a2, b2, c2, _ = lines[j]
                det = a1 * b2 - a2 * b1
                if abs(det) < eps:
                    continue
                x1 = (c1 * b2 - c2 * b1) / det
                x2 = (a1 * c2 - a2 * c1) / det
                if _feasible_pt(x1, x2):
                    vertices.append((x1, x2))

        if vertices:
            deduped = {}
            for x1, x2 in vertices:
                deduped[(round(x1, 8), round(x2, 8))] = (x1, x2)
            vertices = list(deduped.values())
            cx = sum(v[0] for v in vertices) / len(vertices)
            cy = sum(v[1] for v in vertices) / len(vertices)
            vertices.sort(key=lambda v: math.atan2(v[1] - cy, v[0] - cx))
            poly_x = [v[0] for v in vertices] + [vertices[0][0]]
            poly_y = [v[1] for v in vertices] + [vertices[0][1]]

            all_x = [v[0] for v in vertices] + [0]
            all_y = [v[1] for v in vertices] + [0]
            x_min, x_max = 0, max(all_x) * 1.15
            y_min, y_max = 0, max(all_y) * 1.15
            if x_max < eps:
                x_max = 1
            if y_max < eps:
                y_max = 1
        else:
            poly_x, poly_y = [], []
            x_min, x_max = 0, max(max(rhs), 1.0) * 1.5
            y_min, y_max = 0, max(max(rhs), 1.0) * 1.5

        xs = np.linspace(x_min, x_max, 200)
        boundary_lines = []
        for i, row in enumerate(constraints):
            if abs(row[1]) > eps:
                ys = (rhs[i] - row[0] * xs) / row[1]
                clipped_x = []
                clipped_y = []
                for k in range(len(xs)):
                    if ys[k] >= y_min - eps and ys[k] <= y_max + eps:
                        clipped_x.append(xs[k])
                        clipped_y.append(ys[k])
                if clipped_x:
                    boundary_lines.append(
                        {"x": clipped_x, "y": clipped_y, "label": f"C{i + 1}"}
                    )
            elif abs(row[0]) > eps:
                x_val = rhs[i] / row[0]
                if x_val >= x_min - eps and x_val <= x_max + eps:
                    ys = np.linspace(y_min, y_max, 200)
                    xs_vert = np.full_like(ys, x_val)
                    boundary_lines.append(
                        {"x": xs_vert.tolist(), "y": ys.tolist(), "label": f"C{i + 1}"}
                    )

        isoprofit_line = None
        if (
            optimal_value is not None
            and abs(objective[0]) > eps
            or abs(objective[1]) > eps
        ):
            c1, c2 = objective[0], objective[1]
            if abs(c2) > eps:
                y_at_xmin = c2 and (optimal_value - c1 * x_min) / c2 or 0
                y_at_xmax = c2 and (optimal_value - c1 * x_max) / c2 or 0
            else:
                y_at_xmin = y_at_xmax = None
            if abs(c1) > eps:
                x_at_ymin = (optimal_value - c2 * y_min) / c1
                x_at_ymax = (optimal_value - c2 * y_max) / c1
            else:
                x_at_ymin = x_at_ymax = None

            iso_pts = []
            if (
                y_at_xmin is not None
                and y_at_xmin >= y_min - eps
                and y_at_xmin <= y_max + eps
            ):
                iso_pts.append((x_min, y_at_xmin))
            if (
                y_at_xmax is not None
                and y_at_xmax >= y_min - eps
                and y_at_xmax <= y_max + eps
            ):
                iso_pts.append((x_max, y_at_xmax))
            if (
                x_at_ymin is not None
                and x_at_ymin >= x_min - eps
                and x_at_ymin <= x_max + eps
            ):
                iso_pts.append((x_at_ymin, y_min))
            if (
                x_at_ymax is not None
                and x_at_ymax >= x_min - eps
                and x_at_ymax <= x_max + eps
            ):
                iso_pts.append((x_at_ymax, y_max))

            if len(iso_pts) >= 2:
                iso_pts = iso_pts[:2]
                isoprofit_line = {
                    "x": [iso_pts[0][0], iso_pts[1][0]],
                    "y": [iso_pts[0][1], iso_pts[1][1]],
                }

        graph = {
            "type": "chart",
            "data": {
                "boundary_lines": boundary_lines,
                "solution_point": var_values,
                "feasible_region": {"x": poly_x, "y": poly_y} if poly_x else None,
                "isoprofit_line": isoprofit_line,
                "x_bounds": [x_min, x_max],
                "y_bounds": [y_min, y_max],
            },
        }

    return {
        "status": "optimal",
        "solution": {
            "variables": var_values,
            "optimal_value": optimal_value,
            "slacks": slacks,
            "shadow_prices": shadow_prices,
            "reduced_costs": reduced_costs,
            "constraint_analysis": constraint_analysis,
            "dual_formulation": dual_formulation,
        },
        "steps": steps,
        "graph": graph,
    }
