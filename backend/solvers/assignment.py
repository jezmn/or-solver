def _display_num(x):
    num = float(x)
    if num == int(num):
        return str(int(num))
    if isinstance(x, float):
        return f"{x:.2f}".rstrip("0").rstrip(".")
    return str(x)


def _pad_matrix(cost_matrix):
    n = len(cost_matrix)
    m = len(cost_matrix[0])
    if n == m:
        return [row[:] for row in cost_matrix], n, m
    size = max(n, m)
    padded = [[0] * size for _ in range(size)]
    for i in range(n):
        for j in range(m):
            padded[i][j] = cost_matrix[i][j]
    return padded, n, m


def _max_matching_on_zeros(matrix):
    n = len(matrix)
    match_col = [-1] * n

    def bpm(u, seen):
        for v in range(n):
            if matrix[u][v] == 0 and not seen[v]:
                seen[v] = True
                if match_col[v] == -1 or bpm(match_col[v], seen):
                    match_col[v] = u
                    return True
        return False

    for u in range(n):
        seen = [False] * n
        bpm(u, seen)

    return match_col


def _find_assignment_in_zeros(matrix):
    n = len(matrix)
    match_col = _max_matching_on_zeros(matrix)
    assignment = [-1] * n
    for col, row in enumerate(match_col):
        if row != -1:
            assignment[row] = col
    return assignment


def _min_line_cover(matrix):
    n = len(matrix)
    match_col = _max_matching_on_zeros(matrix)

    match_row = [-1] * n
    for col, row in enumerate(match_col):
        if row != -1:
            match_row[row] = col

    marked_row = [False] * n
    marked_col = [False] * n

    def dfs(row):
        marked_row[row] = True
        for col in range(n):
            if matrix[row][col] == 0 and not marked_col[col] and match_row[row] != col:
                marked_col[col] = True
                if match_col[col] != -1:
                    dfs(match_col[col])

    for row in range(n):
        if match_row[row] == -1:
            dfs(row)

    covered_rows = [i for i in range(n) if not marked_row[i]]
    covered_cols = [j for j in range(n) if marked_col[j]]
    lines_count = len(covered_rows) + len(covered_cols)

    return covered_rows, covered_cols, lines_count


def _generate_steps(original, working, n_orig, m_orig, is_max):
    steps = []
    size = len(working)
    m = [row[:] for row in working]
    display_matrix_original = [row[:n_orig] for row in [r[:m_orig] for r in original]]

    if is_max:
        max_val = max(max(row) for row in original)
        converted = [[max_val - val for val in row] for row in original]
        padded_converted, _, _ = _pad_matrix(converted)
        steps.append(
            {
                "description": f"Converting maximization to minimization: subtract each profit from max value ({_display_num(max_val)})",
                "data": {
                    "_step_type": "max_to_min",
                    "original_matrix": [row[:] for row in display_matrix_original],
                    "max_value": max_val,
                    "optimization": "max",
                    "dimensions": {"workers": n_orig, "tasks": m_orig},
                    "conversion_method": f"new_value = {_display_num(max_val)} - original_value",
                    "converted_matrix": [row[:] for row in padded_converted],
                },
            }
        )
    else:
        steps.append(
            {
                "description": f"Problem: {n_orig} workers × {m_orig} tasks (minimize cost)",
                "data": {
                    "_step_type": "problem_statement",
                    "original_matrix": [row[:] for row in display_matrix_original],
                    "optimization": "min",
                    "dimensions": {"workers": n_orig, "tasks": m_orig},
                },
            }
        )

    matrix_before_row = [row[:] for row in m]
    row_minima = [min(row) for row in matrix_before_row]
    for i in range(size):
        rm = row_minima[i]
        if rm > 0:
            for j in range(size):
                m[i][j] -= rm
    steps.append(
        {
            "description": "Row reduction: subtract the smallest value in each row from every cell in that row",
            "data": {
                "_step_type": "row_reduction",
                "operation": "For each row, find the minimum value in that row, then subtract it from every cell in the row.",
                "row_minima": row_minima,
                "matrix_before": matrix_before_row,
                "matrix_after": [row[:] for row in m],
            },
        }
    )

    matrix_before_col = [row[:] for row in m]
    col_minima = [min(m[i][j] for i in range(size)) for j in range(size)]
    for j in range(size):
        cm = col_minima[j]
        if cm > 0:
            for i in range(size):
                m[i][j] -= cm
    steps.append(
        {
            "description": "Column reduction: subtract the smallest value in each column from every cell in that column",
            "data": {
                "_step_type": "col_reduction",
                "operation": "For each column, find the minimum value in that column, then subtract it from every cell in the column.",
                "column_minima": col_minima,
                "matrix_before": matrix_before_col,
                "matrix_after": [row[:] for row in m],
            },
        }
    )

    iteration = 0
    max_iterations = size * size * 10
    while True:
        iteration += 1
        if iteration > max_iterations:
            raise RuntimeError(
                f"Hungarian algorithm did not converge after {max_iterations} iterations. "
                "The cost matrix may be degenerate or numerically unstable."
            )
        matrix_before_iter = [row[:] for row in m]
        covered_rows, covered_cols, lines_count = _min_line_cover(m)

        if lines_count == size:
            steps.append(
                {
                    "description": f"Iteration {iteration}: cover zeros — optimal! ({lines_count} lines = matrix size {size})",
                    "data": {
                        "_step_type": "line_drawing",
                        "iteration": iteration,
                        "matrix_before": matrix_before_iter,
                        "covered_rows": covered_rows,
                        "covered_cols": covered_cols,
                        "lines_count": lines_count,
                        "is_optimal": True,
                        "operation": f"Number of lines ({lines_count}) equals matrix size ({size}). Zero covering is optimal — the algorithm can now find the best assignment.",
                    },
                }
            )
            break

        min_uncovered = float("inf")
        for i in range(size):
            if i in covered_rows:
                continue
            for j in range(size):
                if j not in covered_cols:
                    val = m[i][j]
                    if val < min_uncovered:
                        min_uncovered = val

        for i in range(size):
            for j in range(size):
                if i not in covered_rows and j not in covered_cols:
                    m[i][j] -= min_uncovered
                elif i in covered_rows and j in covered_cols:
                    m[i][j] += min_uncovered

        steps.append(
            {
                "description": f"Iteration {iteration}: adjust matrix (minimum uncovered value = {_display_num(min_uncovered)})",
                "data": {
                    "_step_type": "line_drawing",
                    "iteration": iteration,
                    "matrix_before": matrix_before_iter,
                    "covered_rows": covered_rows,
                    "covered_cols": covered_cols,
                    "lines_count": lines_count,
                    "is_optimal": False,
                    "min_uncovered": min_uncovered,
                    "operation": f"Minimum uncovered value is {_display_num(min_uncovered)}. Subtract it from all uncovered cells, add it to cells at the intersection of covered rows and covered columns.",
                    "matrix_after_intersection_adjustment": [row[:] for row in m],
                },
            }
        )

    zero_assignment = _find_assignment_in_zeros(m)

    filtered_assignment = []
    for i in range(n_orig):
        col = zero_assignment[i] if i < len(zero_assignment) else -1
        if col < m_orig:
            filtered_assignment.append(col)
        else:
            filtered_assignment.append(-1)

    total = sum(
        original[i][filtered_assignment[i]]
        for i in range(n_orig)
        if filtered_assignment[i] >= 0
    )

    value_label = "Total Profit" if is_max else "Total Cost"
    new_matrix = [row[:] for row in m]
    steps.append(
        {
            "description": f"{value_label}: {_display_num(total)}",
            "data": {
                "_step_type": "result",
                "matrix": new_matrix,
                "assignment": filtered_assignment,
                "total": total,
                "assignment_pairs": [
                    (f"W{i + 1}", f"T{filtered_assignment[i] + 1}")
                    for i in range(n_orig)
                    if filtered_assignment[i] >= 0
                ],
                "optimization": "max" if is_max else "min",
            },
        }
    )

    return steps, filtered_assignment, total


def solve_assignment(cost_matrix, optimization="min"):
    n_orig = len(cost_matrix)
    m_orig = len(cost_matrix[0])

    is_max = optimization == "max"

    if is_max:
        max_val = max(max(row) for row in cost_matrix)
        working_matrix = [[max_val - val for val in row] for row in cost_matrix]
    else:
        working_matrix = cost_matrix

    matrix, _, _ = _pad_matrix(working_matrix)

    steps, filtered_assignment, total = _generate_steps(
        cost_matrix, matrix, n_orig, m_orig, is_max
    )

    display_matrix = [row[:m_orig] for row in cost_matrix]

    return {
        "status": "optimal",
        "solution": {
            "assignment": filtered_assignment,
            "total_cost": total,
            "optimization": optimization,
        },
        "steps": steps,
        "graph": {
            "type": "heatmap",
            "data": {"assignment": filtered_assignment, "matrix": display_matrix},
        },
    }
