import pulp


def _fmt_num(x):
    num = float(x)
    if num == int(num):
        return str(int(num))
    return f"{num:.2f}"


def solve_goal_programming(objectives, constraints, signs, rhs):
    objectives = [o if isinstance(o, dict) else o.model_dump() for o in objectives]
    n = len(constraints[0]) if constraints else len(objectives[0]["coefficients"])

    x = [pulp.LpVariable(f"x{i + 1}", lowBound=0) for i in range(n)]

    base_cons = []
    for i, row in enumerate(constraints):
        lhs = pulp.lpSum(row[j] * x[j] for j in range(n))
        if signs[i] == "<=":
            base_cons.append(lhs <= rhs[i])
        elif signs[i] == ">=":
            base_cons.append(lhs >= rhs[i])
        else:
            base_cons.append(lhs == rhs[i])

    deviations = []
    for g_idx, obj in enumerate(objectives):
        wtp = float(obj.get("wt_plus", 0))
        prp = int(obj.get("prty_plus", 0))
        wtm = float(obj.get("wt_minus", 0))
        prm = int(obj.get("prty_minus", 0))
        if wtp != 0 and prp > 0:
            deviations.append((prp, wtp, "plus", g_idx))
        if wtm != 0 and prm > 0:
            deviations.append((prm, wtm, "minus", g_idx))

    if not deviations:
        return {
            "status": "infeasible",
            "steps": [],
            "graph": {"type": "chart", "data": {}},
        }

    priorities = sorted(set(d[0] for d in deviations))
    n_goals = len(objectives)

    dp = {g: pulp.LpVariable(f"dp_{g}", lowBound=0) for g in range(n_goals)}
    dm = {g: pulp.LpVariable(f"dm_{g}", lowBound=0) for g in range(n_goals)}

    goal_cons = []
    for g_idx, obj in enumerate(objectives):
        coeffs = obj["coefficients"]
        target = obj["target"]
        expr = pulp.lpSum(coeffs[j] * x[j] for j in range(n))
        goal_cons.append(expr + dm[g_idx] - dp[g_idx] == target)

    locked = []
    steps = []
    priority_nonachievement = []

    for prio in priorities:
        prob = pulp.LpProblem(f"GP_P{prio}", pulp.LpMinimize)
        for c in base_cons:
            prob += c
        for c in locked:
            prob += c
        for c in goal_cons:
            prob += c

        terms = []
        prt = []
        for d_prio, w, typ, g_idx in deviations:
            if d_prio == prio:
                v = dp[g_idx] if typ == "plus" else dm[g_idx]
                terms.append(w * v)
                prt.append((prio, w, typ, g_idx))

        prob += pulp.lpSum(terms)
        prob.solve(pulp.PULP_CBC_CMD(msg=False))

        if pulp.LpStatus[prob.status] != "Optimal":
            break

        total_dev = sum(
            pulp.value(dp[g_idx] if typ == "plus" else dm[g_idx]) or 0
            for _, _, typ, g_idx in prt
        )

        priority_nonachievement.append(
            {
                "priority": prio,
                "nonachievement": total_dev,
            }
        )

        active_goals = [
            {
                "goal": g_idx,
                "type": typ,
                "weight": w,
                "value": pulp.value(dp[g_idx] if typ == "plus" else dm[g_idx]) or 0,
            }
            for p, w, typ, g_idx in prt
        ]

        dev_terms = []
        for _, w, typ, g_idx in prt:
            sign = "d⁺" if typ == "plus" else "d⁻"
            wt = f"{w}·" if w != 1 else ""
            dev_terms.append(f"{wt}{sign}(Goal {g_idx + 1})")
        minimized_str = " + ".join(dev_terms) if dev_terms else "none"

        lock_desc = (
            f"Total deviation locked to ≤ {_fmt_num(total_dev)} for lower priorities"
            if prio != priorities[-1]
            else "Final priority — no lock needed"
        )

        steps.append(
            {
                "description": f"Priority {prio}: nonachievement = {_fmt_num(total_dev)}",
                "data": {
                    "step": f"Minimizing: {minimized_str}",
                    "nonachievement": total_dev,
                    "lock": lock_desc,
                },
            }
        )

        lock_expr = pulp.lpSum(terms)
        locked.append(lock_expr <= total_dev + 1e-6)

    var_values = {f"x{i + 1}": pulp.value(x[i]) for i in range(n)}

    achieved = []
    for g_idx, obj in enumerate(objectives):
        av = sum(obj["coefficients"][j] * (pulp.value(x[j]) or 0) for j in range(n))
        achieved.append(
            {
                "target": obj["target"],
                "achieved": av,
                "d_plus": pulp.value(dp[g_idx]) or 0,
                "d_minus": pulp.value(dm[g_idx]) or 0,
                "deviation": av - obj["target"],
            }
        )

    if not achieved:
        return {
            "status": "infeasible",
            "steps": [],
            "graph": {"type": "chart", "data": {}},
        }

    return {
        "status": "optimal",
        "solution": {
            "variables": var_values,
            "objectives_achieved": achieved,
            "priority_nonachievement": priority_nonachievement,
        },
        "steps": steps,
        "graph": {"type": "chart", "data": {"objectives_achieved": achieved}},
    }
