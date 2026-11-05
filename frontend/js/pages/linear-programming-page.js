// page controller (segmented from the inline script in frontend/linear-programming.html)

            function lpPage() {
                return {
                    optimization: "max",
                    table: null,
                    loading: false,
                    result: null,
                    error: "",
                    chartInstance: null,

                    formatLinearExpression(variables, coefficients) {
                        return formatLinearExpressionText(
                            coefficients,
                            variables,
                        );
                    },

                    renderDualFormulation(formulation) {
                        if (!formulation) return "";
                        const vars = formulation.variables || [];
                        const objective = this.formatLinearExpression(
                            vars.map((v) => v.name),
                            vars.map((v) => v.objective_coefficient),
                        );
                        let html = `<p class="font-semibold mb-2">${formulation.direction === "min" ? "Minimize" : "Maximize"} W = ${escHtml(objective)}</p>`;
                        html += '<div class="space-y-1">';
                        (formulation.constraints || []).forEach((row) => {
                            const expr = this.formatLinearExpression(
                                row.variables,
                                row.coefficients,
                            );
                            html += `<div><span class="font-mono">${escHtml(formatMathText(row.name))}:</span> ${escHtml(expr)} ${escHtml(row.sign)} ${escHtml(formatNumber(row.rhs))}</div>`;
                        });
                        html += "</div>";
                        if (vars.length) {
                            html +=
                                '<div class="mt-2 text-slate-500 dark:text-zinc-400">' +
                                vars
                                    .map(
                                        (v) =>
                                            `${escHtml(formatVariableName(v.name))} ${escHtml(v.sign)}`,
                                    )
                                    .join(", ") +
                                "</div>";
                        }
                        return html;
                    },
                    formatEquation(row) {
                        return formatConstraintEquation(
                            row,
                            this.table.varNames,
                        );
                    },

                    getProblemInput() {
                        return getLpProblemInput(this.table, this.optimization);
                    },

                    exportProblem() {
                        this.error = "";
                        try {
                            downloadProblemJson(
                                "simplex",
                                this.getProblemInput(),
                            );
                        } catch (e) {
                            this.error = e.message || "Export failed.";
                        }
                    },

                    onInputChange() {
                        this.result = null;

                        this.error = "";
                        if (this.chartInstance) {
                            this.chartInstance.destroy();
                            this.chartInstance = null;
                        }
                    },

                    async importProblem(event) {
                        this.error = "";
                        try {
                            const input = await importProblemFromFile(
                                event,
                                "simplex",
                                validateLpProblemInput,
                            );
                            if (!input) return;
                            applyLpProblemInput(this.table, input);
                            this.optimization = input.optimization;
                            this.result = null;
                            this.$nextTick(() =>
                                syncTableWidth(
                                    this.$refs.inputTable,
                                    this.table.cols,
                                    250,
                                    112,
                                ),
                            );

                            if (this.chartInstance) {
                                this.chartInstance.destroy();
                                this.chartInstance = null;
                            }
                        } catch (e) {
                            this.error = e.message || "Import failed.";
                        }
                    },

                    async solve() {
                        this.error = "";
                        this.result = null;

                        if (this.chartInstance) {
                            this.chartInstance.destroy();
                            this.chartInstance = null;
                        }

                        const vals = this.table.getAllValues();
                        const objective = vals[0].cells;
                        if (objective.some(isNaN)) {
                            this.error =
                                "Objective coefficients must be numeric.";
                            return;
                        }

                        const constraints = [];
                        const signs = [];
                        const rhs = [];
                        for (let i = 1; i < vals.length; i++) {
                            const r = vals[i];
                            const coeffs = r.cells;
                            if (coeffs.some(isNaN) || isNaN(r.rhs)) {
                                this.error =
                                    "All constraint values must be numeric.";
                                return;
                            }
                            constraints.push(coeffs);
                            signs.push(r.sign);
                            rhs.push(r.rhs);
                        }
                        if (constraints.length === 0) {
                            this.error = "Add at least one constraint.";
                            return;
                        }

                        const input = {
                            objective,
                            constraints,
                            signs,
                            rhs,
                            optimization: this.optimization,
                        };

                        const cacheKey = getCacheKey("simplex", input);
                        const cached = getFromCache(cacheKey);
                        if (cached) {
                            this.result = cached.result;

                            this.$nextTick(() => {
                                this.renderGraph();
                            });
                            return;
                        }

                        this.loading = true;
                        try {
                            const data = await solve("simplex", input);
                            this.result = data;
                            setCache(cacheKey, data);
                            this.$nextTick(() => {
                                this.renderGraph();
                            });
                        } catch (e) {
                            this.error = e.message || "API error";
                        } finally {
                            this.loading = false;
                        }
                    },

                    renderGraph() {
                        this.renderFeasibleRegion();
                    },

                    renderFeasibleRegion() {
                        const canvas = document.getElementById("graph-canvas");
                        if (
                            !canvas ||
                            !this.result ||
                            !this.result.graph ||
                            !this.result.graph.data ||
                            !this.result.graph.data.boundary_lines
                        )
                            return;
                        if (this.chartInstance) this.chartInstance.destroy();
                        const ctx = canvas.getContext("2d");
                        const gData = this.result.graph.data;
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
                            gData.feasible_region &&
                            gData.feasible_region.x &&
                            gData.feasible_region.x.length
                        ) {
                            datasets.push({
                                label: "Feasible Area",
                                data: gData.feasible_region.x.map((_, idx) => ({
                                    x: gData.feasible_region.x[idx],
                                    y: gData.feasible_region.y[idx],
                                })),
                                backgroundColor: "rgba(99, 102, 241, 0.12)",
                                borderColor: "rgba(99, 102, 241, 0.4)",
                                borderWidth: 0.5,
                                pointRadius: 0,
                                fill: "shape",
                                showLine: true,
                                order: 0,
                            });
                        }
                        if (gData.isoprofit_line) {
                            datasets.push({
                                label: "Isoprofit Line",
                                data: gData.isoprofit_line.x.map((_, idx) => ({
                                    x: gData.isoprofit_line.x[idx],
                                    y: gData.isoprofit_line.y[idx],
                                })),
                                borderColor: "rgba(239, 68, 68, 0.5)",
                                borderWidth: 1,
                                borderDash: [5, 5],
                                pointRadius: 0,
                                showLine: true,
                                order: 0,
                            });
                        }
                        if (gData.solution_point) {
                            datasets.push({
                                label: "Optimal Feasible Point",
                                data: [
                                    {
                                        x: gData.solution_point.x1 ?? 0,
                                        y: gData.solution_point.x2 ?? 0,
                                    },
                                ],
                                borderColor: palette[1],
                                backgroundColor: palette[1],
                                pointRadius: 6,
                                pointStyle: "rectRot",
                                showLine: false,
                            });
                        }
                        const chartOpts = getChartOptions({
                            plugins: {
                                legend: { labels: { font: { size: 11 } } },
                            },
                            scales: {
                                x: {
                                    type: "linear",
                                    position: "bottom",
                                    title: { display: true, text: "x\u2081" },
                                },
                                y: {
                                    title: { display: true, text: "x\u2082" },
                                },
                            },
                        });
                        if (gData.x_bounds) {
                            chartOpts.scales.x.min = gData.x_bounds[0];
                            chartOpts.scales.x.max = gData.x_bounds[1];
                        }
                        if (gData.y_bounds) {
                            chartOpts.scales.y.min = gData.y_bounds[0];
                            chartOpts.scales.y.max = gData.y_bounds[1];
                        }
                        this.chartInstance = new Chart(ctx, {
                            type: "scatter",
                            data: { datasets },
                            options: chartOpts,
                        });
                    },

                    clearTable() {
                        this.error = "";
                        this.result = null;

                        if (this.chartInstance) {
                            this.chartInstance.destroy();
                            this.chartInstance = null;
                        }
                        this.table = createTableState(3, 2, { labels: true });
                        for (let i = 1; i < this.table.rows.length; i++)
                            this.table.rows[i].label = "Constraint " + i;
                        this._wrapAddRow();
                    },

                    init() {
                        this.table = createTableState(3, 2, { labels: true });
                        for (let i = 1; i < this.table.rows.length; i++)
                            this.table.rows[i].label = "Constraint " + i;
                        this._wrapAddRow();
                        this._wrapColMethods();
                        this.$nextTick(() =>
                            syncTableWidth(
                                this.$refs.inputTable,
                                this.table.cols,
                                250,
                                112,
                            ),
                        );
                    },

                    _wrapAddRow() {
                        const orig = this.table.addRow.bind(this.table);
                        const self = this;
                        this.table.addRow = function () {
                            orig();
                            self.table.rows[self.table.rows.length - 1].label =
                                "Constraint " + (self.table.rows.length - 1);
                        };
                    },

                    _wrapColMethods() {
                        const origAdd = this.table.addCol.bind(this.table);
                        const origRemove = this.table.removeCol.bind(
                            this.table,
                        );
                        const self = this;
                        this.table.addCol = function () {
                            origAdd();
                            syncTableWidth(
                                self.$refs.inputTable,
                                self.table.cols,
                                250,
                                112,
                            );
                        };
                        this.table.removeCol = function () {
                            origRemove();
                            syncTableWidth(
                                self.$refs.inputTable,
                                self.table.cols,
                                250,
                                112,
                            );
                        };
                    },
                };
            }
