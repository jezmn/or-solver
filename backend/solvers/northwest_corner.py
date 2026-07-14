from backend.solvers.modi import solve_modi


def _fmt_num(x):
    num = float(x)
    if num == int(num):
        return str(int(num))
    return f"{num:.2f}"


def _balance(supply, demand, costs):
    total_supply = sum(supply)
    total_demand = sum(demand)
    if total_supply == total_demand:
        return (
            list(supply),
            list(demand),
            [row[:] for row in costs],
            len(supply),
            len(demand),
        )

    new_costs = [row[:] for row in costs]
    if total_supply < total_demand:
        supply = list(supply) + [total_demand - total_supply]
        new_costs.append([0] * len(demand))
    else:
        demand = list(demand) + [total_supply - total_demand]
        for row in new_costs:
            row.append(0)

    return supply, demand, new_costs, len(supply), len(demand)


def solve_northwest_corner(supply, demand, costs, optimization="min"):
    orig_costs = [row[:] for row in costs]
    is_max = optimization == "max"

    if is_max:
        max_val = max(max(row) for row in costs)
        costs = [[max_val - val for val in row] for row in costs]

    supply, demand, costs, orig_n, orig_m = _balance(supply, demand, costs)
    n = len(supply)
    m = len(demand)
    allocation = [[0] * m for _ in range(n)]
    steps = []
    supply_left = list(supply)
    demand_left = list(demand)

    i, j = 0, 0
    iteration = 0
    while i < n and j < m:
        if supply_left[i] == 0:
            i += 1
            continue
        if demand_left[j] == 0:
            j += 1
            continue

        alloc = min(supply_left[i], demand_left[j])
        allocation[i][j] = alloc
        supply_left[i] -= alloc
        demand_left[j] -= alloc

        steps.append(
            {
                "description": f"Iteration {iteration + 1}: Allocated {_fmt_num(alloc)} at ({i}, {j}) cost={_fmt_num(costs[i][j])}",
                "data": {
                    "_step_type": "nwcorner_iteration",
                    "row": i,
                    "col": j,
                    "amount": alloc,
                    "cost": costs[i][j],
                    "supply_remaining": list(supply_left),
                    "demand_remaining": list(demand_left),
                    "allocation": [row[:] for row in allocation],
                    "costs": [row[:] for row in costs],
                },
            }
        )
        iteration += 1

        if supply_left[i] == 0:
            i += 1
        elif demand_left[j] == 0:
            j += 1

    total_cost = sum(allocation[i][j] * costs[i][j] for i in range(n) for j in range(m))

    occupied = sum(1 for i in range(n) for j in range(m) if allocation[i][j] > 0)
    needed = n + m - 1
    steps.append(
        {
            "description": f"Initial solution: total cost = {_fmt_num(total_cost)}, occupied cells = {occupied}/{needed} ({'non-degenerate' if occupied >= needed else 'degenerate'})",
            "data": {
                "_step_type": "nwcorner_initial",
                "costs": [row[:] for row in costs],
                "allocation": [row[:] for row in allocation],
                "total_cost": total_cost,
                "occupied": occupied,
                "needed": needed,
                "supply": list(supply),
                "demand": list(demand),
            },
        }
    )

    modi_result = solve_modi(allocation, costs, supply, demand, steps)
    opt_alloc = modi_result["solution"]["allocation"]
    all_steps = modi_result["steps"]

    opt_cost = sum(
        opt_alloc[i][j] * orig_costs[i][j] for i in range(orig_n) for j in range(orig_m)
    )

    filtered_allocation = [
        [opt_alloc[i][j] for j in range(orig_m)] for i in range(orig_n)
    ]
    return {
        "status": "optimal",
        "message": "Optimal solution found via MODI test.",
        "solution": {
            "allocation": filtered_allocation,
            "total_cost": opt_cost,
            "optimization": optimization,
            "costs": [row[:] for row in orig_costs],
        },
        "steps": all_steps,
    }
