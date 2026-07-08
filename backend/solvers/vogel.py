import copy
from backend.solvers.modi import solve_modi


def _balance(supply, demand, costs):
    total_supply = sum(supply)
    total_demand = sum(demand)
    if total_supply == total_demand:
        return list(supply), list(demand), [row[:] for row in costs]

    n = len(supply)
    m = len(demand)
    new_costs = [row[:] for row in costs]

    if total_supply < total_demand:
        supply = list(supply) + [total_demand - total_supply]
        new_costs.append([0] * m)
    else:
        demand = list(demand) + [total_supply - total_demand]
        for row in new_costs:
            row.append(0)

    return supply, demand, new_costs


def _compute_penalties(costs, supply, demand):
    n = len(supply)
    m = len(demand)
    row_penalties = []
    col_penalties = []

    for i in range(n):
        if supply[i] <= 0:
            row_penalties.append(-1)
            continue
        sorted_costs = sorted([costs[i][j] for j in range(m) if demand[j] > 0])
        if len(sorted_costs) >= 2:
            row_penalties.append(sorted_costs[1] - sorted_costs[0])
        elif len(sorted_costs) == 1:
            row_penalties.append(sorted_costs[0])
        else:
            row_penalties.append(-1)

    for j in range(m):
        if demand[j] <= 0:
            col_penalties.append(-1)
            continue
        sorted_costs = sorted([costs[i][j] for i in range(n) if supply[i] > 0])
        if len(sorted_costs) >= 2:
            col_penalties.append(sorted_costs[1] - sorted_costs[0])
        elif len(sorted_costs) == 1:
            col_penalties.append(sorted_costs[0])
        else:
            col_penalties.append(-1)

    return row_penalties, col_penalties


def solve_vogel(supply, demand, costs, optimization="min"):
    orig_costs = [row[:] for row in costs]
    is_max = optimization == "max"

    if is_max:
        max_val = max(max(row) for row in costs)
        costs = [[max_val - val for val in row] for row in costs]

    supply, demand, costs = _balance(supply, demand, costs)
    n = len(supply)
    m = len(demand)
    orig_n = len(supply)
    orig_m = len(demand)
    allocation = [[0] * m for _ in range(n)]
    steps = []

    supply_left = list(supply)
    demand_left = list(demand)

    iteration = 0
    while sum(supply_left) > 0 and sum(demand_left) > 0:
        row_penalties, col_penalties = _compute_penalties(
            costs, supply_left, demand_left
        )

        max_row_pen = max(row_penalties)
        max_col_pen = max(col_penalties)

        if max_row_pen >= max_col_pen:
            row_idx = row_penalties.index(max_row_pen)
            valid_cols = [
                j
                for j in range(m)
                if demand_left[j] > 0 and costs[row_idx][j] is not None
            ]
            if not valid_cols:
                break
            col_idx = min(valid_cols, key=lambda j: costs[row_idx][j])
        else:
            col_idx = col_penalties.index(max_col_pen)
            valid_rows = [
                i
                for i in range(n)
                if supply_left[i] > 0 and costs[i][col_idx] is not None
            ]
            if not valid_rows:
                break
            row_idx = min(valid_rows, key=lambda i: costs[i][col_idx])

        alloc = min(supply_left[row_idx], demand_left[col_idx])
        allocation[row_idx][col_idx] = alloc
        supply_left[row_idx] -= alloc
        demand_left[col_idx] -= alloc

        steps.append(
            {
                "description": f"Iteration {iteration + 1}: Allocated {alloc} at ({row_idx}, {col_idx}) cost={costs[row_idx][col_idx]}",
                "data": {
                    "_step_type": "vogel_iteration",
                    "row": row_idx,
                    "col": col_idx,
                    "amount": alloc,
                    "cost": costs[row_idx][col_idx],
                    "row_penalties": row_penalties,
                    "col_penalties": col_penalties,
                    "supply_remaining": list(supply_left),
                    "demand_remaining": list(demand_left),
                    "allocation": [row[:] for row in allocation],
                    "costs": [row[:] for row in costs],
                },
            }
        )
        iteration += 1

    total_cost = sum(allocation[i][j] * costs[i][j] for i in range(n) for j in range(m))
    occupied = sum(1 for i in range(n) for j in range(m) if allocation[i][j] > 0)
    needed = n + m - 1
    is_degenerate = occupied < needed

    steps.append(
        {
            "description": f"Initial solution: total cost = {total_cost:.2f}, occupied cells = {occupied}/{needed} {'(degenerate)' if is_degenerate else '(non-degenerate)'}",
            "data": {
                "_step_type": "vogel_initial",
                "total_cost": total_cost,
                "occupied": occupied,
                "needed": needed,
                "is_degenerate": is_degenerate,
                "costs": [row[:] for row in costs],
                "allocation": [row[:] for row in allocation],
            },
        }
    )

    modi_result = solve_modi(allocation, costs, supply, demand, steps)
    opt_alloc = modi_result["solution"]["allocation"]
    opt_cost = modi_result["solution"]["total_cost"]
    all_steps = modi_result["steps"]

    filtered_allocation = [
        [opt_alloc[i][j] for j in range(orig_m)] for i in range(orig_n)
    ]
    return {
        "status": "optimal",
        "message": "Optimal solution found via MODI test.",
        "solution": {
            "allocation": filtered_allocation,
            "total_cost": opt_cost,
            "costs": [row[:] for row in orig_costs],
        },
        "steps": all_steps,
    }
