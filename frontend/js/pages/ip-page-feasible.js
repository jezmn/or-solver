// integer programming page: feasible-region graph (segmented from the inline page script)

const IP_PAGE_FEASIBLE = {
                    getFeasibleGraphData() {
                        if (
                            this.result &&
                            this.result.feasible_graph &&
                            this.result.feasible_graph.data
                        ) {
                            return this.result.feasible_graph.data;
                        }
                        return this.buildFeasibleGraphFromInput();
                    },

                    buildFeasibleGraphFromInput() {
                        if (
                            !this.result ||
                            !this.table ||
                            this.table.cols !== 2
                        )
                            return null;
                        const vals = this.table.getAllValues();
                        const objective = vals[0]?.cells || [];
                        const constraints = [];
                        const signs = [];
                        const rhs = [];
                        for (let i = 1; i < vals.length; i++) {
                            const row = vals[i];
                            if (
                                !row ||
                                row.cells.some(Number.isNaN) ||
                                Number.isNaN(row.rhs)
                            )
                                return null;
                            constraints.push(row.cells);
                            signs.push(row.sign || "<=");
                            rhs.push(row.rhs);
                        }
                        if (
                            constraints.length === 0 ||
                            objective.length !== 2 ||
                            objective.some(Number.isNaN)
                        )
                            return null;

                        const lpStep = (this.result.steps || []).find(
                            (step) =>
                                step.data &&
                                step.data.variables &&
                                step.data.value !== undefined &&
                                step.data.direction === undefined,
                        );
                        const lpVars =
                            lpStep && lpStep.data
                                ? lpStep.data.variables
                                : null;
                        const intVars =
                            this.result.solution &&
                            this.result.solution.variables
                                ? this.result.solution.variables
                                : null;
                        const xSeeds = [0];
                        const ySeeds = [0];
                        constraints.forEach((row, idx) => {
                            const a = row[0] || 0;
                            const b = row[1] || 0;
                            if (Math.abs(a) > 1e-9 && rhs[idx] / a >= 0)
                                xSeeds.push(rhs[idx] / a);
                            if (Math.abs(b) > 1e-9 && rhs[idx] / b >= 0)
                                ySeeds.push(rhs[idx] / b);
                        });
                        [lpVars, intVars].forEach((vars) => {
                            if (vars) {
                                xSeeds.push(Number(vars.x1 || 0));
                                ySeeds.push(Number(vars.x2 || 0));
                            }
                        });
                        const xMax = Math.max(6, Math.max(...xSeeds) * 1.2 + 1);
                        const yMax = Math.max(6, Math.max(...ySeeds) * 1.2 + 1);
                        const samples = 100;
                        const xs = Array.from(
                            { length: samples + 1 },
                            (_, i) => (xMax * i) / samples,
                        );
                        const boundary_lines = constraints
                            .map((row, idx) => {
                                const a = row[0] || 0;
                                const b = row[1] || 0;
                                if (Math.abs(b) > 1e-9) {
                                    return {
                                        label: `C${idx + 1}`,
                                        x: xs,
                                        y: xs.map(
                                            (x) => (rhs[idx] - a * x) / b,
                                        ),
                                    };
                                }
                                if (Math.abs(a) > 1e-9) {
                                    const x = rhs[idx] / a;
                                    return {
                                        label: `C${idx + 1}`,
                                        x: [x, x],
                                        y: [0, yMax],
                                    };
                                }
                                return null;
                            })
                            .filter(Boolean);
                        const satisfies = (lhs, sign, bound) =>
                            sign === "<="
                                ? lhs <= bound + 1e-8
                                : sign === ">="
                                  ? lhs >= bound - 1e-8
                                  : Math.abs(lhs - bound) <= 1e-8;
                        const integer_points = [];
                        for (
                            let x = 0;
                            x <= Math.min(Math.ceil(xMax), 80);
                            x++
                        ) {
                            for (
                                let y = 0;
                                y <= Math.min(Math.ceil(yMax), 80);
                                y++
                            ) {
                                if (
                                    constraints.every((row, idx) =>
                                        satisfies(
                                            (row[0] || 0) * x +
                                                (row[1] || 0) * y,
                                            signs[idx],
                                            rhs[idx],
                                        ),
                                    )
                                ) {
                                    integer_points.push({
                                        x,
                                        y,
                                        z: objective[0] * x + objective[1] * y,
                                    });
                                }
                            }
                        }
                        const graph = { boundary_lines, integer_points };
                        if (lpVars)
                            graph.lp_solution = {
                                x1: lpVars.x1 || 0,
                                x2: lpVars.x2 || 0,
                            };
                        if (intVars)
                            graph.integer_solution = {
                                x1: intVars.x1 || 0,
                                x2: intVars.x2 || 0,
                            };
                        return graph;
                    },


                    renderFeasibleRegion() {
                        const canvas = document.getElementById("graph-canvas");
                        const gData = this.getFeasibleGraphData();
                        if (
                            !canvas ||
                            !gData ||
                            !gData.boundary_lines ||
                            !gData.boundary_lines.length
                        )
                            return;
                        if (this.chartInstance) this.chartInstance.destroy();
                        const ctx = canvas.getContext("2d");
                        const palette = getChartPalette();
                        const datasets = gData.boundary_lines.map(
                            (line, i) => ({
                                label: line.label,
                                data: line.x.map((_, idx) => ({
                                    x: line.x[idx],
                                    y: line.y[idx],
                                })),
                                borderColor: palette[i % palette.length],
                                borderWidth: 1.5,
                                pointRadius: 0,
                                showLine: true,
                            }),
                        );
                        if (
                            gData.integer_points &&
                            gData.integer_points.length
                        ) {
                            datasets.push({
                                label: Alpine.store("i18n").t(
                                    "integer.feasible.points",
                                ),
                                data: gData.integer_points.map((p) => ({
                                    x: p.x,
                                    y: p.y,
                                })),
                                backgroundColor: isDarkMode()
                                    ? "#94a3b8"
                                    : "#475569",
                                borderColor: isDarkMode()
                                    ? "#94a3b8"
                                    : "#475569",
                                pointRadius: 3,
                                showLine: false,
                            });
                        }
                        if (gData.lp_solution) {
                            datasets.push({
                                label: Alpine.store("i18n").t("lp.relaxation"),
                                data: [
                                    {
                                        x: gData.lp_solution.x1 ?? 0,
                                        y: gData.lp_solution.x2 ?? 0,
                                    },
                                ],
                                backgroundColor: "#d97706",
                                borderColor: "#d97706",
                                pointRadius: 6,
                                pointStyle: "rectRot",
                                showLine: false,
                            });
                        }
                        if (gData.integer_solution) {
                            datasets.push({
                                label: Alpine.store("i18n").t(
                                    "integer.optimum",
                                ),
                                data: [
                                    {
                                        x: gData.integer_solution.x1 ?? 0,
                                        y: gData.integer_solution.x2 ?? 0,
                                    },
                                ],
                                backgroundColor: "#4f46e5",
                                borderColor: "#4f46e5",
                                pointRadius: 7,
                                showLine: false,
                            });
                        }
                        this.chartInstance = new Chart(ctx, {
                            type: "scatter",
                            data: { datasets },
                            options: getChartOptions({
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: { labels: { font: { size: 11 } } },
                                },
                                scales: {
                                    x: {
                                        type: "linear",
                                        position: "bottom",
                                        min: 0,
                                        title: {
                                            display: true,
                                            text: formatVariableName("x1"),
                                        },
                                    },
                                    y: {
                                        min: 0,
                                        title: {
                                            display: true,
                                            text: formatVariableName("x2"),
                                        },
                                    },
                                },
                            }),
                        });
                    },
};
