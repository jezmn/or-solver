import copy


def _fmt_num(x):
    num = float(x)
    if num == int(num):
        return str(int(num))
    return f"{num:.2f}"


def _solve_uv(allocation, costs, m, n):
    u = [None] * m
    v = [None] * n
    u[0] = 0
    occupied = [(i, j) for i in range(m) for j in range(n) if allocation[i][j] > 0]
    changed = True
    while changed:
        changed = False
        for i, j in occupied:
            if u[i] is not None and v[j] is None:
                v[j] = costs[i][j] - u[i]
                changed = True
            elif v[j] is not None and u[i] is None:
                u[i] = costs[i][j] - v[j]
                changed = True
    for i in range(m):
        if u[i] is None:
            u[i] = 0
    for j in range(n):
        if v[j] is None:
            v[j] = 0
    return u, v


def _opportunity_costs(costs, u, v, m, n):
    d = [[0.0] * n for _ in range(m)]
    for i in range(m):
        for j in range(n):
            d[i][j] = costs[i][j] - u[i] - v[j]
    return d


def _find_entering(d, allocation, m, n):
    min_val = float("inf")
    min_pos = None
    for i in range(m):
        for j in range(n):
            if allocation[i][j] == 0 and d[i][j] < min_val - 1e-10:
                min_val = d[i][j]
                min_pos = (i, j)
    return min_pos, min_val


def _find_loop(allocation, enter_i, enter_j, m, n):
    row_cells = {i: set() for i in range(m)}
    col_cells = {j: set() for j in range(n)}
    for i in range(m):
        for j in range(n):
            if allocation[i][j] > 0:
                row_cells[i].add(j)
                col_cells[j].add(i)
    row_cells[enter_i].add(enter_j)
    col_cells[enter_j].add(enter_i)
    path = [(enter_i, enter_j)]
    visited = set()

    def dfs(horizontal):
        curr_i, curr_j = path[-1]
        if len(path) > 2:
            if not horizontal and curr_j == enter_j and curr_i != enter_i:
                if enter_i in col_cells[enter_j]:
                    path.append((enter_i, enter_j))
                    return True
        if horizontal:
            for j in sorted(row_cells[curr_i]):
                if j == curr_j:
                    continue
                nxt = (curr_i, j)
                if nxt in visited:
                    continue
                path.append(nxt)
                visited.add(nxt)
                if dfs(False):
                    return True
                visited.discard(nxt)
                path.pop()
        else:
            for i in sorted(col_cells[curr_j]):
                if i == curr_i:
                    continue
                nxt = (i, curr_j)
                if nxt in visited:
                    continue
                path.append(nxt)
                visited.add(nxt)
                if dfs(True):
                    return True
                visited.discard(nxt)
                path.pop()
        return False

    dfs(True)
    return path


def _reallocate(allocation, loop, m, n):
    new_alloc = [row[:] for row in allocation]
    theta = float("inf")
    for k in range(1, len(loop) - 1, 2):
        i, j = loop[k]
        theta = min(theta, allocation[i][j])
    for k in range(len(loop) - 1):
        i, j = loop[k]
        if k % 2 == 0:
            new_alloc[i][j] += theta
        else:
            new_alloc[i][j] -= theta
    return new_alloc, theta


EPSILON = 1e-6


def _make_non_degenerate(allocation, m, n):
    occupied = [(i, j) for i in range(m) for j in range(n) if allocation[i][j] > 0]
    needed = m + n - 1 - len(occupied)
    if needed <= 0:
        return [row[:] for row in allocation], []
    parent = list(range(m + n))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(x, y):
        rx, ry = find(x), find(y)
        if rx != ry:
            parent[rx] = ry

    for i, j in occupied:
        union(i, m + j)

    new_alloc = [row[:] for row in allocation]
    epsilon_cells = []
    added = 0
    for i in range(m):
        for j in range(n):
            if new_alloc[i][j] == 0 and find(i) != find(m + j):
                new_alloc[i][j] = EPSILON
                epsilon_cells.append((i, j))
                union(i, m + j)
                added += 1
                if added >= needed:
                    return new_alloc, epsilon_cells
    return new_alloc, epsilon_cells


def _count_occupied(allocation, m, n):
    return sum(1 for i in range(m) for j in range(n) if allocation[i][j] > 0)


def solve_modi(allocation, costs, supply, demand, prior_steps):
    m = len(supply)
    n = len(demand)
    alloc, epsilon_cells = _make_non_degenerate(allocation, m, n)
    steps = list(prior_steps)

    if epsilon_cells:
        eps_desc = ", ".join(f"({i},{j})" for i, j in epsilon_cells)
        steps.append(
            {
                "description": f"Solution is degenerate — adding ε at cells: {eps_desc}",
                "data": {
                    "_step_type": "degeneracy_fix",
                    "epsilon_cells": epsilon_cells,
                    "allocation": [row[:] for row in alloc],
                },
            }
        )

    iteration = 0
    max_iterations = 100

    while iteration < max_iterations:
        u, v = _solve_uv(alloc, costs, m, n)
        d = _opportunity_costs(costs, u, v, m, n)

        non_degenerate = _count_occupied(alloc, m, n) >= m + n - 1

        entering, min_d = _find_entering(d, alloc, m, n)

        is_optimal = entering is None or min_d >= -1e-10

        def _make_step(desc, **overrides):
            data = {
                "_step_type": "modi_iteration",
                "iteration": iteration + 1,
                "u_values": u,
                "v_values": v,
                "opportunity_costs": [row[:] for row in d],
                "allocation_before": [row[:] for row in alloc],
                "is_optimal": is_optimal,
                "entering_cell": list(entering) if entering else None,
                "entering_opportunity_cost": min_d if not is_optimal else None,
                "loop_path": None,
                "theta": None,
                "allocation_after": None,
                "costs": [row[:] for row in costs],
                "supply": list(supply),
                "demand": list(demand),
            }
            data.update(overrides)
            return {"description": desc, "data": data}

        if is_optimal or not non_degenerate:
            desc = (
                f"MODI iteration {iteration + 1}: Optimal. All opportunity costs >= 0."
                if is_optimal
                else f"MODI iteration {iteration + 1}: Degenerate — stopping."
            )
            steps.append(_make_step(desc, allocation_after=[row[:] for row in alloc]))
            break

        ei, ej = entering
        loop = _find_loop(alloc, ei, ej, m, n)

        if len(loop) < 4:
            steps.append(
                _make_step(
                    f"MODI iteration {iteration + 1}: Cannot form loop — treating as optimal.",
                    allocation_after=[row[:] for row in alloc],
                    is_optimal=True,
                    entering_cell=None,
                    entering_opportunity_cost=None,
                )
            )
            break

        new_alloc, theta = _reallocate(alloc, loop, m, n)

        steps.append(
            _make_step(
                f"MODI iteration {iteration + 1}: Enter (row {ei}, col {ej}) "
                f"d={_fmt_num(min_d)}  theta={_fmt_num(theta)}",
                loop_path=loop,
                theta=theta,
                allocation_after=[row[:] for row in new_alloc],
            )
        )
        alloc = new_alloc
        iteration += 1

    for i in range(m):
        for j in range(n):
            if 0 < alloc[i][j] < 1e-4:
                alloc[i][j] = 0.0
            elif abs(alloc[i][j] - round(alloc[i][j])) < 1e-6:
                alloc[i][j] = round(alloc[i][j])

    total_cost = sum(alloc[i][j] * costs[i][j] for i in range(m) for j in range(n))

    return {
        "status": "optimal",
        "solution": {
            "allocation": alloc,
            "total_cost": total_cost,
        },
        "steps": steps,
    }
