import pulp


def solve_sensitivity(objective, constraints, signs, rhs, optimization):
    prob = pulp.LpProblem(
        "Sensitivity", pulp.LpMaximize if optimization == "max" else pulp.LpMinimize
    )
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

    prob.solve(pulp.PULP_CBC_CMD(msg=False))

    if pulp.LpStatus[prob.status] != "Optimal":
        return {
            "status": "non-optimal",
            "steps": [
                {
                    "description": "Problem is not optimal, cannot perform sensitivity analysis",
                    "data": {},
                }
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

    EPSILON = 0.01

    # Shadow prices (dual values) from constraints
    shadow_prices = []
    for i, (name, constraint) in enumerate(prob.constraints.items()):
        shadow_prices.append(
            {
                "constraint": i,
                "name": f"C{i + 1}",
                "value": constraint.pi if constraint.pi is not None else 0,
            }
        )

    # Reduced costs from variables
    reduced_costs = []
    for i, var in enumerate(prob.variables()):
        reduced_costs.append(
            {"variable": var.name, "value": var.dj if var.dj is not None else 0}
        )

    # Estimate RHS ranges by perturbing
    rhs_lower = []
    rhs_upper = []
    for i in range(m):
        for direction, label in [(1, "increase"), (-1, "decrease")]:
            test_rhs = list(rhs)
            test_rhs[i] += direction * EPSILON
            test_prob = pulp.LpProblem(
                "Test", pulp.LpMaximize if optimization == "max" else pulp.LpMinimize
            )
            test_x = [pulp.LpVariable(f"x{i + 1}", lowBound=0) for i in range(n)]
            test_prob += pulp.lpSum(objective[j] * test_x[j] for j in range(n))
            for k, row in enumerate(constraints):
                lhs = pulp.lpSum(row[j] * test_x[j] for j in range(n))
                if signs[k] == "<=":
                    test_prob += lhs <= test_rhs[k]
                elif signs[k] == ">=":
                    test_prob += lhs >= test_rhs[k]
                else:
                    test_prob += lhs == test_rhs[k]
            test_prob.solve(pulp.PULP_CBC_CMD(msg=False))
            if pulp.LpStatus[test_prob.status] != "Optimal":
                if direction > 0:
                    rhs_upper.append(
                        {"constraint": i, "bound": "upper", "value": rhs[i]}
                    )
                else:
                    rhs_lower.append(
                        {"constraint": i, "bound": "lower", "value": rhs[i]}
                    )
            else:
                if direction > 0:
                    rhs_upper.append(
                        {"constraint": i, "bound": "upper", "value": rhs[i] + EPSILON}
                    )
                else:
                    rhs_lower.append(
                        {"constraint": i, "bound": "lower", "value": rhs[i] - EPSILON}
                    )

    obj_lower = []
    obj_upper = []
    for j in range(n):
        for direction, label in [(1, "increase"), (-1, "decrease")]:
            test_obj = list(objective)
            test_obj[j] += direction * EPSILON
            test_prob = pulp.LpProblem(
                "Test", pulp.LpMaximize if optimization == "max" else pulp.LpMinimize
            )
            test_x = [pulp.LpVariable(f"x{i + 1}", lowBound=0) for i in range(n)]
            test_prob += pulp.lpSum(test_obj[k] * test_x[k] for k in range(n))
            for k, row in enumerate(constraints):
                lhs = pulp.lpSum(row[k2] * test_x[k2] for k2 in range(n))
                if signs[k] == "<=":
                    test_prob += lhs <= rhs[k]
                elif signs[k] == ">=":
                    test_prob += lhs >= rhs[k]
                else:
                    test_prob += lhs == rhs[k]
            test_prob.solve(pulp.PULP_CBC_CMD(msg=False))
            if pulp.LpStatus[test_prob.status] == "Optimal":
                if direction > 0:
                    obj_upper.append({"variable": j, "value": objective[j] + EPSILON})
                else:
                    obj_lower.append({"variable": j, "value": objective[j] - EPSILON})
            else:
                if direction > 0:
                    obj_upper.append({"variable": j, "value": objective[j]})
                else:
                    obj_lower.append({"variable": j, "value": objective[j]})

    estimated_ranges = {
        "epsilon": EPSILON,
        "caveat": f"Estimated by ±{EPSILON} perturbation. Actual theoretical ranges may differ.",
        "rhs": {"lower": rhs_lower, "upper": rhs_upper},
        "objective": {"lower": obj_lower, "upper": obj_upper},
    }

    steps = [
        {
            "description": "Computed shadow prices for constraints",
            "data": {"shadow_prices": shadow_prices},
        },
        {
            "description": "Computed reduced costs for variables",
            "data": {"reduced_costs": reduced_costs},
        },
        {
            "description": "Estimated RHS ranges",
            "data": {"rhs_lower": rhs_lower, "rhs_upper": rhs_upper},
        },
        {
            "description": "Estimated objective coefficient ranges",
            "data": {"obj_lower": obj_lower, "obj_upper": obj_upper},
        },
    ]

    return {
        "status": "optimal",
        "solution": {
            "variables": var_values,
            "optimal_value": optimal_value,
            "slacks": slacks,
            "shadow_prices": shadow_prices,
            "reduced_costs": reduced_costs,
            "estimated_ranges": estimated_ranges,
        },
        "steps": steps,
        "graph": {
            "type": "chart",
            "data": {"shadow_prices": shadow_prices, "reduced_costs": reduced_costs},
        },
    }
