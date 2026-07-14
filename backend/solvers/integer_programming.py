import pulp
import math
from copy import deepcopy


def _find_fractional_var(vals, integer_vars):
    best = None
    best_frac = 0
    for i in integer_vars:
        v = vals.get(f"x{i + 1}")
        if v is None:
            continue
        frac = abs(v - round(v))
        if frac > 1e-6 and frac > best_frac:
            best_frac = frac
            best = i
    return best


def _solve_lp(objective, constraints, signs, rhs, optimization, bounds):
    n = len(objective)
    prob = pulp.LpProblem(
        "Node", pulp.LpMaximize if optimization == "max" else pulp.LpMinimize
    )
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
    for var_idx, lb, ub in bounds:
        if lb is not None:
            prob += x[var_idx] >= lb
        if ub is not None:
            prob += x[var_idx] <= ub
    prob.solve(pulp.PULP_CBC_CMD(msg=False))
    status = pulp.LpStatus[prob.status]
    if status == "Optimal":
        vals = {f"x{i + 1}": pulp.value(x[i]) for i in range(n)}
        obj_val = pulp.value(prob.objective)
        if obj_val is None:
            return {"status": "Optimal", "variables": {}, "value": 0.0}
        return {"status": "Optimal", "variables": vals, "value": obj_val}
    elif status == "Infeasible":
        return {"status": "Infeasible", "variables": {}, "value": None}
    elif status == "Unbounded":
        return {"status": "Unbounded", "variables": {}, "value": None}
    else:
        return {"status": status, "variables": {}, "value": None}


def _terminal_tree_graph(label, node_type):
    return {
        "type": "tree",
        "data": {
            "nodes": [
                {
                    "id": 0,
                    "label": label,
                    "values": {},
                    "type": node_type,
                }
            ],
            "edges": [],
        },
    }


def _fmt_num(value, decimals=2):
    if value is None:
        return "N/A"
    num = float(value)
    if abs(num - round(num)) < 1e-8:
        return str(int(round(num)))
    return f"{num:.{decimals}f}".rstrip("0").rstrip(".")


def _format_linear_expr(coeffs):
    parts = []
    for idx, coeff in enumerate(coeffs):
        if abs(coeff) < 1e-9:
            continue
        name = f"x{idx + 1}"
        mag = abs(coeff)
        coeff_text = "" if abs(mag - 1) < 1e-9 else _fmt_num(mag)
        term = f"{coeff_text}{name}"
        if not parts:
            parts.append(term if coeff > 0 else f"-{term}")
        else:
            parts.append((" + " if coeff > 0 else " - ") + term)
    return "".join(parts) or "0"


def _format_values(values):
    if not values:
        return "no feasible values"
    return ", ".join(
        f"{name}={_fmt_num(value)}"
        for name, value in sorted(values.items(), key=lambda item: int(item[0][1:]))
    )


def _format_bounds(bounds):
    merged = {}
    for var_idx, lb, ub in bounds:
        entry = merged.setdefault(var_idx, {"lb": None, "ub": None})
        if lb is not None:
            entry["lb"] = lb if entry["lb"] is None else max(entry["lb"], lb)
        if ub is not None:
            entry["ub"] = ub if entry["ub"] is None else min(entry["ub"], ub)

    formatted = []
    for var_idx in sorted(merged):
        name = f"x{var_idx + 1}"
        lb = merged[var_idx]["lb"]
        ub = merged[var_idx]["ub"]
        if lb is not None and ub is not None and abs(lb - ub) < 1e-9:
            formatted.append(f"{name} = {_fmt_num(lb)}")
            continue
        if lb is not None:
            formatted.append(f"{name} ≥ {_fmt_num(lb)}")
        if ub is not None:
            formatted.append(f"{name} ≤ {_fmt_num(ub)}")
    return formatted


def _format_single_bound(var_idx, direction, bound_val):
    name = f"x{var_idx + 1}"
    return f"{name} {direction} {_fmt_num(bound_val)}"


def _equality_derivations(bounds):
    merged = {}
    for var_idx, lb, ub in bounds:
        entry = merged.setdefault(var_idx, {"lb": None, "ub": None})
        if lb is not None:
            entry["lb"] = lb if entry["lb"] is None else max(entry["lb"], lb)
        if ub is not None:
            entry["ub"] = ub if entry["ub"] is None else min(entry["ub"], ub)
    lines = []
    for var_idx in sorted(merged):
        name = f"x{var_idx + 1}"
        lb = merged[var_idx]["lb"]
        ub = merged[var_idx]["ub"]
        if lb is not None and ub is not None and abs(float(lb) - float(ub)) < 1e-9:
            lines.append(
                f"{name} \u2265 {_fmt_num(lb)} and {name} \u2264 {_fmt_num(ub)} imply {name} = {_fmt_num(lb)}"
            )
    return lines


def _redundancy_notes(parent_bounds, var_idx, new_lb, new_ub):
    notes = []
    name = f"x{var_idx + 1}"
    for p_var_idx, p_lb, p_ub in parent_bounds:
        if p_var_idx != var_idx:
            continue
        if new_lb is not None and p_lb is not None and new_lb > p_lb:
            notes.append(
                f"{name} \u2265 {_fmt_num(new_lb)} makes {name} \u2265 {_fmt_num(p_lb)} redundant"
            )
        if new_ub is not None and p_ub is not None and new_ub < p_ub:
            notes.append(
                f"{name} \u2264 {_fmt_num(new_ub)} makes {name} \u2264 {_fmt_num(p_ub)} redundant"
            )
    return notes


def _format_objective_substitution(objective, variables):
    parts = []
    for idx, coeff in enumerate(objective):
        name = f"x{idx + 1}"
        if name not in variables:
            continue
        term = f"{_fmt_num(abs(coeff))}({_fmt_num(variables[name])})"
        if not parts:
            parts.append(term if coeff >= 0 else f"-{term}")
        else:
            parts.append((" + " if coeff >= 0 else " - ") + term)
    return "".join(parts) or "0"


def _calc_term(coeff, body, omit_one_for_variable=False):
    mag = abs(coeff)
    if abs(mag - 1) < 1e-9:
        if omit_one_for_variable:
            return body
        if body.startswith("(") and body.endswith(")"):
            return body[1:-1]
    return f"{_fmt_num(mag)}{body}"


def _join_signed_terms(terms):
    output = []
    for coeff, body in terms:
        if abs(coeff) < 1e-9:
            continue
        term = _calc_term(coeff, body, body.startswith("x"))
        if not output:
            output.append(term if coeff >= 0 else f"-{term}")
        else:
            output.append((" + " if coeff >= 0 else " - ") + term)
    return "".join(output) or "0"


def _active_constraint_solution_lines(constraints, rhs, variables):
    n_active = sum(1 for _ in _active_constraint_pairs(constraints, rhs, variables))
    if n_active == 0:
        return []

    n_vars = (
        len(variables)
        if all(f"x{i + 1}" in variables for i in range(len(variables)))
        else 0
    )
    if n_vars < 2:
        return []

    active = _collect_active(constraints, rhs, variables, n_vars)
    if len(active) < n_vars:
        return []

    system = active[:n_vars]
    lines = ["Solve active constraints:"]
    for idx, _, _ in system:
        lines.append(
            f"C{idx + 1}: {_format_linear_expr(constraints[idx][:n_vars])} = {_fmt_num(rhs[idx])}"
        )

    remaining = list(system)
    solved = [None] * n_vars
    elimination_steps = []

    step = 1
    while remaining:
        best_dist = float("inf")
        best_eq = None
        best_var = None
        best_coeff = None
        best_row = None

        for eq_idx, row, const in remaining:
            for vi in range(n_vars):
                if solved[vi] is not None:
                    continue
                c = row[vi]
                if abs(c) < 1e-9:
                    continue
                dist = abs(abs(c) - 1)
                if dist < best_dist:
                    best_dist = dist
                    best_eq = eq_idx
                    best_var = vi
                    best_coeff = c
                    best_row = (row, const)

        if best_eq is None:
            break

        row, const = best_row
        var_name = f"x{best_var + 1}"
        remaining_exprs = []
        for vi in range(n_vars):
            if solved[vi] is not None or vi == best_var:
                continue
            c = row[vi]
            if abs(c) < 1e-9:
                continue
            remaining_exprs.append((c, vi))

        if remaining_exprs:
            terms = []
            for c, vi in remaining_exprs:
                if abs(c / best_coeff) > 1e-9:
                    t = _fmt_term_val(c / best_coeff, f"x{vi + 1}")
                    terms.append(t)
            iso_expr = _join_terms(terms, const / best_coeff)
        else:
            iso_expr = _fmt_num(const / best_coeff)

        if abs(best_coeff - 1) < 1e-9:
            if not remaining_exprs:
                display_iso = _fmt_num(const)
            else:
                terms = [_fmt_num(const)]
                for c, vi in remaining_exprs:
                    term_val = -c
                    tv = _fmt_term_val(term_val, f"x{vi + 1}")
                    terms.append(tv)
                display_iso = _fmt_num(const)
                for c, vi in remaining_exprs:
                    tv = _fmt_term_val(-c / best_coeff, f"x{vi + 1}")
                    display_iso += tv
        else:
            display_iso = f"({_fmt_num(const)}"
            for c, vi in remaining_exprs:
                tv = _fmt_term_val(-c, f"x{vi + 1}")
                display_iso += tv
            display_iso += f") / {_fmt_num(best_coeff)}"

        elim_line = f"Step {step}: From C{best_eq + 1}: {var_name} = {display_iso}"
        elimination_steps.append(
            (best_eq, best_var, best_coeff, const, remaining_exprs, elim_line)
        )
        solved[best_var] = (best_eq, best_coeff, const, remaining_exprs)
        remaining = [(eq_idx, r, c) for eq_idx, r, c in remaining if eq_idx != best_eq]
        step += 1

    lines.append(elimination_steps[0][-1])

    for subst_idx in range(len(elimination_steps) - 1):
        prev_var = elimination_steps[subst_idx][1]
        pe, pc, pconst, pexprs = solved[prev_var]
        cur_step = elimination_steps[subst_idx + 1]
        cur_eq, cur_var, cur_coeff, cur_const, cur_exprs, cur_line = cur_step
        cur_name = f"x{cur_var + 1}"
        prev_name = f"x{prev_var + 1}"
        prev_val = variables.get(prev_name)

        lines.append(
            f"Substitute {prev_name} = {_fmt_num(prev_val)} into C{cur_eq + 1}:"
        )
        subst_parts = []
        for vi in range(n_vars):
            c = constraints[cur_eq][vi]
            if abs(c) < 1e-9:
                continue
            vn = f"x{vi + 1}"
            if vi == prev_var:
                subst_parts.append(f"{_fmt_num(c)}({_fmt_num(prev_val)})")
            elif vi == cur_var:
                subst_parts.append(f"{_fmt_num(c)}{vn}")
            elif solved[vi] is not None:
                subst_parts.append(f"{_fmt_num(c)}({_fmt_num(variables.get(vn, 0))})")
        rhs_val = rhs[cur_eq]
        lines.append(" + ".join(subst_parts) + f" = {_fmt_num(rhs_val)}")

        if prev_var is not None:
            prev_coeff = constraints[cur_eq][prev_var]
            remaining_rhs = rhs_val - prev_coeff * prev_val
            for vi in range(n_vars):
                if vi == prev_var or vi == cur_var:
                    continue
                solved_val = variables.get(f"x{vi + 1}")
                if solved_val is not None:
                    remaining_rhs -= constraints[cur_eq][vi] * solved_val
            lines.append(f"{_fmt_num(cur_coeff)}{cur_name} = {_fmt_num(remaining_rhs)}")
            cur_val = variables.get(cur_name)
            lines.append(f"{cur_name} = {_fmt_num(cur_val)}")

    for si in range(len(elimination_steps) - 2, -1, -1):
        vi = elimination_steps[si][1]
        vname = f"x{vi + 1}"
        vval = variables.get(vname)
        lines.append(f"Back-substitute: {vname} = {_fmt_num(vval)}")

    return lines


def _fmt_term_val(coeff, name):
    if abs(coeff) < 1e-9:
        return ""
    if abs(abs(coeff) - 1) < 1e-9:
        return f" - {name}" if coeff < 0 else f" + {name}"
    return (
        f" - {_fmt_num(abs(coeff))}{name}"
        if coeff < 0
        else f" + {_fmt_num(abs(coeff))}{name}"
    )


def _join_terms(terms, const_val=0):
    if not terms:
        return _fmt_num(const_val)
    result = _fmt_num(const_val) if abs(const_val) > 1e-9 else ""
    for t in terms:
        result += t
    return result if result else "0"


def _collect_active(constraints, rhs, variables, n_vars):
    active = []
    for idx, (row, bound) in enumerate(zip(constraints, rhs)):
        lhs = sum(
            row[j] * variables.get(f"x{j + 1}", 0) for j in range(min(n_vars, len(row)))
        )
        if abs(lhs - bound) <= 1e-5:
            active.append((idx, row[:n_vars], bound))
    return active


def _active_constraint_pairs(constraints, rhs, variables):
    for idx, (row, bound) in enumerate(zip(constraints, rhs)):
        lhs = sum(
            row[j] * variables.get(f"x{j + 1}", 0) for j in range(min(2, len(row)))
        )
        if abs(lhs - bound) <= 1e-5:
            yield idx, row, bound


def _display_sign(sign):
    return {"<=": "≤", ">=": "≥"}.get(sign, sign)


def _candidate_relation(sign, coeff):
    if sign == "<=":
        return "≤" if coeff > 0 else "≥"
    if sign == ">=":
        return "≥" if coeff > 0 else "≤"
    return "="


def _branch_bound_candidates(bounds, solve_idx):
    candidates = []
    seen = set()
    for var_idx, lb, ub in bounds:
        if var_idx != solve_idx:
            continue
        if lb is not None:
            key = ("≥", float(lb))
            if key not in seen:
                seen.add(key)
                candidates.append(
                    {
                        "source": "Branch",
                        "relation": "≥",
                        "value": lb,
                        "line": f"Branch bound: x{solve_idx + 1} ≥ {_fmt_num(lb)}",
                    }
                )
        if ub is not None:
            key = ("≤", float(ub))
            if key not in seen:
                seen.add(key)
                candidates.append(
                    {
                        "source": "Branch",
                        "relation": "≤",
                        "value": ub,
                        "line": f"Branch bound: x{solve_idx + 1} ≤ {_fmt_num(ub)}",
                    }
                )
    return candidates


def _active_bounds(bounds, variables):
    fixed = []
    seen = set()
    for var_idx, lb, ub in bounds:
        if var_idx in seen:
            continue
        value = variables.get(f"x{var_idx + 1}")
        if value is None:
            continue
        if lb is not None and abs(value - lb) < 1e-5:
            fixed.append((var_idx, value))
            seen.add(var_idx)
        elif ub is not None and abs(value - ub) < 1e-5:
            fixed.append((var_idx, value))
            seen.add(var_idx)
    return fixed


def _bound_solution_lines(constraints, signs, rhs, variables, fixed_vars, bounds=None):
    fixed_desc = ", ".join(f"x{idx + 1} = {_fmt_num(val)}" for idx, val in fixed_vars)
    lines = [f"With {fixed_desc}:"]
    fixed_set = {idx for idx, _ in fixed_vars}
    n = len(variables)

    free_idxs = [i for i in range(n) if i not in fixed_set]

    if len(free_idxs) == 1:
        solve_idx = free_idxs[0]
        solve_name = f"x{solve_idx + 1}"
        actual = variables.get(solve_name)
        candidates = []

        for idx, (row, sign, bound) in enumerate(zip(constraints, signs, rhs)):
            if abs(row[solve_idx]) < 1e-9:
                continue
            remaining = float(bound)
            line_parts = []
            for vi in range(n):
                coeff = row[vi]
                if abs(coeff) < 1e-9:
                    continue
                if vi in fixed_set:
                    fv = next(v for i, v in fixed_vars if i == vi)
                    remaining -= coeff * fv
                    line_parts.append(f"{_fmt_num(coeff)}({_fmt_num(fv)})")
                elif vi == solve_idx:
                    line_parts.append(f"{_fmt_num(coeff)}{solve_name}")
            lhs_str = " + ".join(line_parts)
            value = remaining / row[solve_idx]
            relation = _candidate_relation(sign, row[solve_idx])
            candidates.append(
                {
                    "source": f"C{idx + 1}",
                    "relation": relation,
                    "value": value,
                    "line": f"C{idx + 1}: {lhs_str} {_display_sign(sign)} {_fmt_num(bound)} -> {solve_name} {relation} {_fmt_num(value)}",
                }
            )

        candidates.extend(_branch_bound_candidates(bounds, solve_idx))
        lines.extend(c["line"] for c in candidates)

        binding = None
        if actual is not None:
            for c in candidates:
                if abs(float(c["value"]) - float(actual)) <= 1e-5:
                    binding = c
                    break

        if binding is not None:
            label = (
                "Binding bound" if binding["source"] == "Branch" else "Most restrictive"
            )
            lines.append(
                f"{label}: {binding['source']} gives {solve_name} {binding['relation']} {_fmt_num(binding['value'])}, so {solve_name} = {_fmt_num(actual)}"
            )
        elif actual is not None:
            lines.append(f"{solve_name} = {_fmt_num(actual)}")
    elif free_idxs:
        for idx, val in fixed_vars:
            lines.append(f"  x{idx + 1} = {_fmt_num(val)}")
        for fi in free_idxs:
            v = variables.get(f"x{fi + 1}")
            if v is not None:
                lines.append(f"  x{fi + 1} = {_fmt_num(v)}")

    return lines


def _node_calculations(objective, constraints, signs, rhs, bounds, result):
    if result["status"] != "Optimal":
        return ["Branch constraints make the LP relaxation infeasible."]

    variables = result.get("variables") or {}
    value = result.get("value")
    n = len(objective)
    lines = []

    if n >= 2 and variables:
        fixed_vars = _active_bounds(bounds, variables)
        if fixed_vars:
            lines.extend(
                _bound_solution_lines(
                    constraints, signs, rhs, variables, fixed_vars, bounds
                )
            )
        elif n <= 6:
            lines.extend(_active_constraint_solution_lines(constraints, rhs, variables))

    if value is not None:
        if lines:
            lines.append("")
        lines.append(f"Z = {_format_objective_substitution(objective, variables)}")
        lines.append(f"Z = {_fmt_num(value)}")
    return lines


def _incumbent_value(value):
    if value is None or math.isinf(value):
        return None
    return value


def _node_step_data(
    node_name,
    bounds,
    result,
    objective,
    constraints,
    signs,
    rhs,
    integer_vars,
    optimization,
    status,
    branch_var=None,
    direction=None,
    bound=None,
    incumbent_before=None,
    incumbent_after=None,
    incumbent_updated=False,
    next_branch_var=None,
    parent_bounds=None,
):
    parent = parent_bounds or []
    data = {
        "node_name": node_name,
        "added_constraints": _format_bounds(bounds),
        "inherited_constraints": _format_bounds(parent),
        "simplified_constraints": _format_bounds(bounds),
        "equality_derivations": [],
        "lp_status": result["status"],
        "status": status,
        "calculations": _node_calculations(
            objective, constraints, signs, rhs, bounds, result
        ),
    }
    if branch_var is not None and direction is not None and bound is not None:
        data["new_constraint"] = _format_single_bound(branch_var, direction, bound)
        new_lb = bound if direction == "\u2265" else None
        new_ub = bound if direction == "\u2264" else None
        data["redundancy_notes"] = _redundancy_notes(parent, branch_var, new_lb, new_ub)
    else:
        data["new_constraint"] = None
        data["redundancy_notes"] = []
    if branch_var is not None:
        data.update({"branch_var": branch_var, "direction": direction, "bound": bound})

    if result["status"] != "Optimal":
        data["prune_reason"] = "infeasible"
        data["integer_check"] = "LP relaxation infeasible"
        data["decision"] = "Prune: infeasible relaxation"
        return data

    variables = result.get("variables") or {}
    value = float(result.get("value") or 0)
    data.update({"variables": variables, "value": value})

    if status == "pruned":
        incumbent = _incumbent_value(incumbent_before)
        cmp = "≤" if optimization == "max" else "≥"
        data["prune_reason"] = "bound"
        data["incumbent_value"] = incumbent
        frac = _find_fractional_var(variables, integer_vars)
        data["integer_check"] = (
            f"x{frac + 1} is fractional"
            if frac is not None
            else "All integer variables are whole"
        )
        if incumbent is None:
            data["decision"] = "Prune by bound"
        else:
            data["decision"] = (
                f"Prune by bound: Z={_fmt_num(value)} {cmp} incumbent Z={_fmt_num(incumbent)}"
            )
        return data

    if status == "integer":
        before = _incumbent_value(incumbent_before)
        after = _incumbent_value(incumbent_after)
        data.update(
            {
                "prune_reason": "integer feasible",
                "integer_check": "All integer variables are whole",
                "incumbent_before": before,
                "incumbent_after": after,
                "incumbent_updated": incumbent_updated,
            }
        )
        if incumbent_updated:
            data["decision"] = (
                f"Integer feasible; incumbent updated to Z={_fmt_num(after)}"
            )
        else:
            data["decision"] = (
                f"Integer feasible; incumbent remains Z={_fmt_num(after)}"
            )
        return data

    frac = next_branch_var
    if frac is None:
        frac = _find_fractional_var(variables, integer_vars)
    if frac is not None:
        name = f"x{frac + 1}"
        frac_value = variables[name]
        low = int(math.floor(frac_value))
        high = int(math.ceil(frac_value))
        data.update(
            {
                "fractional_var": name,
                "fractional_value": frac_value,
                "branch_floor": low,
                "branch_ceil": high,
                "integer_check": f"{name} is fractional",
                "decision": f"Branch on {name} → {name} ≤ {low} and {name} ≥ {high}",
            }
        )
    else:
        data["integer_check"] = "All integer variables are whole"
        data["decision"] = "No branch needed"
    return data


def _step(description, lines=None, table=None):
    step = {"description": description}
    if lines:
        step["lines"] = lines
    if table:
        step["table"] = table
    return step


def _intercept_rows(constraints, signs, rhs):
    rows = []
    for i, row in enumerate(constraints):
        a = row[0] if len(row) > 0 else 0
        b = row[1] if len(row) > 1 else 0
        x_intercept = _fmt_num(rhs[i] / a) if abs(a) > 1e-9 else "N/A"
        y_intercept = _fmt_num(rhs[i] / b) if abs(b) > 1e-9 else "N/A"
        rows.append(
            [
                f"C{i + 1}",
                f"{_format_linear_expr(row[:2])} {signs[i]} {_fmt_num(rhs[i])}",
                f"x1={x_intercept}",
                f"x2={y_intercept}",
            ]
        )
    return rows


def _satisfies(lhs, sign, bound):
    if sign == "<=":
        return lhs <= bound + 1e-8
    if sign == ">=":
        return lhs >= bound - 1e-8
    return abs(lhs - bound) <= 1e-8


def _build_feasible_graph(
    objective, constraints, signs, rhs, lp_vars=None, int_vars=None
):
    graph = {"type": "chart", "data": {}}
    if len(objective) != 2:
        return graph

    x_candidates = [0.0]
    y_candidates = [0.0]
    for row, bound in zip(constraints, rhs):
        a = row[0] if len(row) > 0 else 0
        b = row[1] if len(row) > 1 else 0
        if abs(a) > 1e-9 and bound / a >= 0:
            x_candidates.append(bound / a)
        if abs(b) > 1e-9 and bound / b >= 0:
            y_candidates.append(bound / b)
    for values in (lp_vars, int_vars):
        if values:
            x_candidates.append(float(values.get("x1", 0) or 0))
            y_candidates.append(float(values.get("x2", 0) or 0))

    x_max = max(6.0, max(x_candidates) * 1.2 + 1.0)
    y_max = max(6.0, max(y_candidates) * 1.2 + 1.0)
    samples = 100
    xs = [x_max * i / samples for i in range(samples + 1)]

    boundary_lines = []
    for i, row in enumerate(constraints):
        a = row[0] if len(row) > 0 else 0
        b = row[1] if len(row) > 1 else 0
        if abs(b) > 1e-9:
            ys = [(rhs[i] - a * x) / b for x in xs]
            boundary_lines.append({"x": xs, "y": ys, "label": f"C{i + 1}"})
        elif abs(a) > 1e-9:
            x_value = rhs[i] / a
            boundary_lines.append(
                {"x": [x_value, x_value], "y": [0, y_max], "label": f"C{i + 1}"}
            )

    integer_points = []
    max_grid_x = min(int(math.ceil(x_max)), 80)
    max_grid_y = min(int(math.ceil(y_max)), 80)
    for x in range(max_grid_x + 1):
        for y in range(max_grid_y + 1):
            feasible = True
            for row, sign, bound in zip(constraints, signs, rhs):
                a = row[0] if len(row) > 0 else 0
                b = row[1] if len(row) > 1 else 0
                if not _satisfies(a * x + b * y, sign, bound):
                    feasible = False
                    break
            if feasible:
                integer_points.append(
                    {"x": x, "y": y, "z": objective[0] * x + objective[1] * y}
                )

    graph["data"] = {
        "boundary_lines": boundary_lines,
        "intercepts": _intercept_rows(constraints, signs, rhs),
        "integer_points": integer_points,
    }
    if lp_vars:
        graph["data"]["lp_solution"] = {
            "x1": lp_vars.get("x1", 0),
            "x2": lp_vars.get("x2", 0),
        }
    if int_vars:
        graph["data"]["integer_solution"] = {
            "x1": int_vars.get("x1", 0),
            "x2": int_vars.get("x2", 0),
        }
    return graph


def solve_integer_programming(
    objective, constraints, signs, rhs, integer_vars, optimization, max_nodes=20
):
    n = len(objective)
    steps = []

    steps.append(
        {
            "description": f"Problem: {n} variables, {len(constraints)} constraints, {len(integer_vars)} integer vars",
            "data": {
                "objective": objective,
                "constraints": constraints,
                "signs": signs,
                "rhs": rhs,
                "integer_variables": [f"x{i + 1}" for i in integer_vars],
                "continuous_variables": [
                    f"x{i + 1}" for i in range(n) if i not in integer_vars
                ],
                "intercepts": _intercept_rows(constraints, signs, rhs)
                if n == 2
                else [],
            },
        }
    )

    root = _solve_lp(objective, constraints, signs, rhs, optimization, [])
    if root["status"] == "Infeasible":
        return {
            "status": "infeasible",
            "steps": [{"description": "Problem is infeasible", "data": {}}],
            "graph": _terminal_tree_graph("Root LP\nInfeasible", "infeasible"),
            "feasible_graph": _build_feasible_graph(objective, constraints, signs, rhs),
        }
    if root["status"] == "Unbounded":
        return {
            "status": "unbounded",
            "steps": [{"description": "LP relaxation is unbounded", "data": {}}],
            "graph": _terminal_tree_graph("Root LP\nUnbounded", "unbounded"),
            "feasible_graph": _build_feasible_graph(objective, constraints, signs, rhs),
        }

    tree_nodes = []
    tree_edges = []
    node_counter = 0

    rv = root.get("value")
    tree_nodes.append(
        {
            "id": node_counter,
            "label": f"Root LP\nZ={rv:.4f}" if rv is not None else "Root LP\nZ=N/A",
            "values": root["variables"],
            "type": "relaxation",
        }
    )
    root_id = node_counter
    node_counter += 1

    gap = 1e-4
    best_int_val = -float("inf") if optimization == "max" else float("inf")
    best_int_vars = None

    frac_var = _find_fractional_var(root["variables"], integer_vars)

    if frac_var is None:
        tree_nodes.append(
            {
                "id": node_counter,
                "label": f"Integer Optimal\nZ={rv:.4f}"
                if rv is not None
                else "Integer Optimal\nZ=N/A",
                "values": root["variables"],
                "type": "optimal",
            }
        )
        tree_edges.append({"from": root_id, "to": node_counter, "label": "integer"})
        node_counter += 1

        steps.append(
            {
                "description": "Root node: LP relaxation is already integer feasible",
                "data": _node_step_data(
                    "Root node",
                    [],
                    root,
                    objective,
                    constraints,
                    signs,
                    rhs,
                    integer_vars,
                    optimization,
                    "integer",
                    incumbent_before=None,
                    incumbent_after=root["value"],
                    incumbent_updated=True,
                    parent_bounds=[],
                ),
            }
        )

        return {
            "status": "optimal",
            "solution": {
                "variables": root["variables"],
                "optimal_value": root["value"],
            },
            "steps": steps,
            "graph": {
                "type": "tree",
                "data": {"nodes": tree_nodes, "edges": tree_edges},
            },
            "feasible_graph": _build_feasible_graph(
                objective, constraints, signs, rhs, root["variables"], root["variables"]
            ),
        }

    steps.append(
        {
            "description": f"Root node: branch on x{frac_var + 1}",
            "data": _node_step_data(
                "Root node",
                [],
                root,
                objective,
                constraints,
                signs,
                rhs,
                integer_vars,
                optimization,
                "fractional",
                next_branch_var=frac_var,
                parent_bounds=[],
            ),
        }
    )

    queue = [(root_id, [])]
    explored = 0

    while queue and explored < max_nodes:
        parent_id, parent_bounds = queue.pop(0)
        explored += 1

        parent_node = next(n for n in tree_nodes if n["id"] == parent_id)
        frac = _find_fractional_var(parent_node["values"], integer_vars)
        if frac is None:
            continue

        frac_val = parent_node["values"][f"x{frac + 1}"]

        for direction, bound_val in [
            ("≤", int(math.floor(frac_val))),
            ("≥", int(math.ceil(frac_val))),
        ]:
            new_bounds = list(parent_bounds)
            if direction == "≤":
                new_bounds.append((frac, None, bound_val))
            else:
                new_bounds.append((frac, bound_val, None))

            result = _solve_lp(
                objective, constraints, signs, rhs, optimization, new_bounds
            )

            child_id = node_counter
            node_name = f"Node B{child_id}"
            node_counter += 1

            if result["status"] != "Optimal":
                tree_nodes.append(
                    {
                        "id": child_id,
                        "label": f"X\nx{frac + 1}{direction}{bound_val}",
                        "values": {},
                        "type": "infeasible",
                    }
                )
                tree_edges.append(
                    {
                        "from": parent_id,
                        "to": child_id,
                        "label": f"x{frac + 1}{direction}{bound_val}",
                    }
                )

                steps.append(
                    {
                        "description": f"{node_name}: infeasible relaxation",
                        "data": _node_step_data(
                            node_name,
                            new_bounds,
                            result,
                            objective,
                            constraints,
                            signs,
                            rhs,
                            integer_vars,
                            optimization,
                            "infeasible",
                            branch_var=frac,
                            direction=direction,
                            bound=bound_val,
                            parent_bounds=parent_bounds,
                        ),
                    }
                )
                continue

            next_frac = _find_fractional_var(result["variables"], integer_vars)
            is_frac = next_frac is not None

            rv = float(result["value"] or 0)
            if optimization == "max":
                prune = rv <= best_int_val + gap
            else:
                prune = rv >= best_int_val - gap

            if prune:
                tree_nodes.append(
                    {
                        "id": child_id,
                        "label": f"Pruned\nZ={rv:.4f}",
                        "values": result["variables"],
                        "type": "infeasible",
                    }
                )
                tree_edges.append(
                    {
                        "from": parent_id,
                        "to": child_id,
                        "label": f"x{frac + 1}{direction}{bound_val}",
                    }
                )
                steps.append(
                    {
                        "description": f"{node_name}: pruned by bound",
                        "data": _node_step_data(
                            node_name,
                            new_bounds,
                            result,
                            objective,
                            constraints,
                            signs,
                            rhs,
                            integer_vars,
                            optimization,
                            "pruned",
                            branch_var=frac,
                            direction=direction,
                            bound=bound_val,
                            incumbent_before=best_int_val,
                            parent_bounds=parent_bounds,
                        ),
                    }
                )
                continue

            if not is_frac:
                incumbent_before = best_int_val if best_int_vars is not None else None
                incumbent_updated = False
                if (optimization == "max" and rv > best_int_val + gap) or (
                    optimization != "max" and rv < best_int_val - gap
                ):
                    best_int_val = rv
                    best_int_vars = result["variables"]
                    incumbent_updated = True

                tree_nodes.append(
                    {
                        "id": child_id,
                        "label": f"Integer\nZ={rv:.4f}",
                        "values": result["variables"],
                        "type": "optimal",
                    }
                )
                tree_edges.append(
                    {
                        "from": parent_id,
                        "to": child_id,
                        "label": f"x{frac + 1}{direction}{bound_val}",
                    }
                )
                steps.append(
                    {
                        "description": f"{node_name}: integer feasible",
                        "data": _node_step_data(
                            node_name,
                            new_bounds,
                            result,
                            objective,
                            constraints,
                            signs,
                            rhs,
                            integer_vars,
                            optimization,
                            "integer",
                            branch_var=frac,
                            direction=direction,
                            bound=bound_val,
                            incumbent_before=incumbent_before,
                            incumbent_after=best_int_val,
                            incumbent_updated=incumbent_updated,
                            parent_bounds=parent_bounds,
                        ),
                    }
                )
            else:
                tree_nodes.append(
                    {
                        "id": child_id,
                        "label": f"Relaxation\nZ={rv:.4f}",
                        "values": result["variables"],
                        "type": "fractional",
                    }
                )
                tree_edges.append(
                    {
                        "from": parent_id,
                        "to": child_id,
                        "label": f"x{frac + 1}{direction}{bound_val}",
                    }
                )
                queue.append((child_id, new_bounds))
                steps.append(
                    {
                        "description": f"{node_name}: branch on x{next_frac + 1}",
                        "data": _node_step_data(
                            node_name,
                            new_bounds,
                            result,
                            objective,
                            constraints,
                            signs,
                            rhs,
                            integer_vars,
                            optimization,
                            "fractional",
                            branch_var=frac,
                            direction=direction,
                            bound=bound_val,
                            next_branch_var=next_frac,
                            parent_bounds=parent_bounds,
                        ),
                    }
                )

    node_limit_hit = explored >= max_nodes and len(queue) > 0

    if node_limit_hit:
        best_bound = None
        gap = None
        if best_int_vars is not None and root.get("value") is not None:
            rv = float(root["value"])
            g = abs(rv - best_int_val)
            best_bound = rv if optimization == "max" else best_int_val
            gap = g
        msg = f"Node limit ({max_nodes}) reached — not proven optimal"
        if best_int_vars is not None:
            msg += f", best Z={best_int_val:.4f}"
        if best_bound is not None:
            msg += f", best bound={best_bound:.4f}"
        if gap is not None:
            msg += f", gap={gap:.4f}"
        steps.append({"description": msg, "data": {"nodes_explored": explored}})
        result = {
            "status": "node_limit",
            "steps": steps,
            "graph": {
                "type": "tree",
                "data": {"nodes": tree_nodes, "edges": tree_edges},
            },
            "feasible_graph": _build_feasible_graph(
                objective, constraints, signs, rhs, root["variables"], best_int_vars
            ),
        }
        if best_int_vars is not None:
            result["solution"] = {
                "variables": best_int_vars,
                "optimal_value": best_int_val,
            }
            if best_bound is not None:
                result["solution"]["best_bound"] = best_bound
            if gap is not None:
                result["solution"]["gap"] = gap
        return result

    if best_int_vars is not None:
        steps.append(
            {
                "description": f"Branch & Bound complete — optimal integer solution Z={_fmt_num(best_int_val)}",
                "data": {
                    "variables": best_int_vars,
                    "optimal_value": best_int_val,
                    "nodes_explored": explored,
                },
            }
        )
        return {
            "status": "optimal",
            "solution": {"variables": best_int_vars, "optimal_value": best_int_val},
            "steps": steps,
            "graph": {
                "type": "tree",
                "data": {"nodes": tree_nodes, "edges": tree_edges},
            },
            "feasible_graph": _build_feasible_graph(
                objective, constraints, signs, rhs, root["variables"], best_int_vars
            ),
        }
    else:
        steps.append(
            {
                "description": "No integer feasible solution found — all branches explored",
                "data": {},
            }
        )
        return {
            "status": "no_integer_feasible",
            "steps": steps,
            "graph": {
                "type": "tree",
                "data": {"nodes": tree_nodes, "edges": tree_edges},
            },
            "feasible_graph": _build_feasible_graph(
                objective, constraints, signs, rhs, root["variables"], None
            ),
        }
