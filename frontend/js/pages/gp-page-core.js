// goal programming page: state, input, import/export, solve lifecycle (segmented from the inline page script)

const GP_PAGE_CORE = {
                    rows: [],
                    numCols: 2,
                    varNames: ["x1", "x2"],
                    loading: false,
                    result: null,
                    error: "",
                    chartInstance: null,

                    getProblemInput() {
                        const objectives = [];
                        const constraints = [];
                        const signs = [];
                        const rhs = [];
                        const labels = [];

                        for (const row of this.rows) {
                            const coeffs = row.cells.map(Number);
                            const hasRhs = row.rhs !== "";
                            const wtp =
                                row.wt_plus !== "" ? Number(row.wt_plus) : 0;
                            const prp =
                                row.prty_plus !== ""
                                    ? Number(row.prty_plus)
                                    : 0;
                            const wtm =
                                row.wt_minus !== "" ? Number(row.wt_minus) : 0;
                            const prm =
                                row.prty_minus !== ""
                                    ? Number(row.prty_minus)
                                    : 0;

                            const isGoal =
                                hasRhs &&
                                (wtp !== 0 ||
                                    prp !== 0 ||
                                    wtm !== 0 ||
                                    prm !== 0);
                            const isConstraint = hasRhs && !isGoal;

                            if (isConstraint) {
                                constraints.push(coeffs);
                                signs.push(row.sign);
                                rhs.push(Number(row.rhs));
                                labels.push(row.label || "");
                            }
                            if (isGoal) {
                                objectives.push({
                                    coefficients: coeffs,
                                    target: Number(row.rhs),
                                    wt_plus: wtp,
                                    prty_plus: prp,
                                    wt_minus: wtm,
                                    prty_minus: prm,
                                });
                            }
                        }

                        const input = {
                            objectives,
                            constraints,
                            signs,
                            rhs,
                            labels,
                            varNames: this.varNames,
                        };
                        validateGoalProblemInput(input);
                        return input;
                    },

                    exportProblem() {
                        this.error = "";
                        try {
                            downloadProblemJson(
                                "goal-programming",
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


                    async solve() {
                        this.error = "";
                        this.result = null;

                        if (this.chartInstance) {
                            this.chartInstance.destroy();
                            this.chartInstance = null;
                        }

                        let input;
                        try {
                            input = this.getProblemInput();
                        } catch (e) {
                            this.error = e.message;
                            return;
                        }

                        if (input.objectives.length === 0) {
                            this.error = "Add at least one goal.";
                            return;
                        }

                        const cacheKey = getCacheKey("goal-programming", input);
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
                            const data = await solve("goal-programming", input);
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


                    clearTable() {
                        this.error = "";
                        this.result = null;

                        if (this.chartInstance) {
                            this.chartInstance.destroy();
                            this.chartInstance = null;
                        }
                        this.numCols = 3;
                        this.rows = [];
                        this.addRow();
                        this.addRow();
                        this.addRow();
                        this.$nextTick(() =>
                            syncTableWidth(
                                this.$refs.inputTable,
                                this.numCols,
                                540,
                                96,
                            ),
                        );
                    },

                    init() {
                        this.addRow();
                        this.addRow();
                        this.addRow();
                        this.$nextTick(() =>
                            syncTableWidth(
                                this.$refs.inputTable,
                                this.numCols,
                                540,
                                96,
                            ),
                        );
                    },
};
