// integer programming page: state, input, import/export, solve lifecycle (segmented from the inline page script)

const IP_PAGE_CORE = {
                    optimization: "max",
                    table: null,
                    loading: false,
                    result: null,
                    error: "",
                    intVars: [],
                    chartInstance: null,


                    hasFeasibleGraph() {
                        const graph = this.getFeasibleGraphData();
                        return !!(
                            graph &&
                            graph.boundary_lines &&
                            graph.boundary_lines.length
                        );
                    },

                    renderResultVisuals() {
                        this.$nextTick(() => {
                            setTimeout(() => {
                                this.renderFeasibleRegion();
                                this.renderTree();
                            }, 0);
                        });
                    },
                    formatEquation(row) {
                        return formatConstraintEquation(
                            row,
                            this.table.varNames,
                        );
                    },

                    syncIntVars() {
                        while (this.intVars.length < this.table.cols)
                            this.intVars.push(true);
                        while (this.intVars.length > this.table.cols)
                            this.intVars.pop();
                    },

                    getProblemInput() {
                        const input = getLpProblemInput(
                            this.table,
                            this.optimization,
                        );
                        input.integer_vars = this.intVars
                            .map((v, j) => (v ? j : -1))
                            .filter((j) => j >= 0);
                        validateIntegerProblemInput(input);
                        return input;
                    },

                    exportProblem() {
                        this.error = "";
                        try {
                            downloadProblemJson(
                                "integer-programming",
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
                                "integer-programming",
                                validateIntegerProblemInput,
                            );
                            if (!input) return;
                            applyLpProblemInput(this.table, input);
                            this.optimization = input.optimization;
                            this.result = null;
                            const tree = document.getElementById("plotly-tree");
                            if (tree) tree.innerHTML = "";
                            if (this.chartInstance) {
                                this.chartInstance.destroy();
                                this.chartInstance = null;
                            }
                            this.$nextTick(() =>
                                syncTableWidth(
                                    this.$refs.inputTable,
                                    this.table.cols,
                                    350,
                                    112,
                                ),
                            );
                        } catch (e) {
                            this.error = e.message || "Import failed.";
                        }
                    },

                    async solve() {
                        this.error = "";
                        this.result = null;
                        const el = document.getElementById("plotly-tree");
                        if (el) el.innerHTML = "";
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

                        const intIndices = this.intVars
                            .map((v, j) => (v ? j : -1))
                            .filter((j) => j >= 0);

                        const input = {
                            objective,
                            constraints,
                            signs,
                            rhs,
                            integer_vars: intIndices,
                            optimization: this.optimization,
                        };
                        const cacheKey = getCacheKey(
                            "integer-programming",
                            input,
                        );
                        const cached = getFromCache(cacheKey);
                        if (
                            cached &&
                            cached.result &&
                            cached.result.feasible_graph
                        ) {
                            this.result = cached.result;
                            this.$nextTick(() => {
                                this.renderFeasibleRegion();
                                this.renderTree();
                            });
                            return;
                        }
                        this.loading = true;
                        try {
                            const data = await solve(
                                "integer-programming",
                                input,
                            );
                            this.result = data;
                            setCache(cacheKey, data);
                            this.$nextTick(() => {
                                this.renderFeasibleRegion();
                                this.renderTree();
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
                        this.table = createTableState(3, 2, { labels: true });
                        this.intVars = [true, true];
                        for (let i = 1; i < this.table.rows.length; i++)
                            this.table.rows[i].label = "Constraint " + i;
                        this._wrapAddRow();
                        this._wrapColMethods();
                        this.$nextTick(() =>
                            syncTableWidth(
                                this.$refs.inputTable,
                                this.table.cols,
                                350,
                                112,
                            ),
                        );
                    },

                    init() {
                        this.table = createTableState(3, 2, { labels: true });
                        this.intVars = [true, true];
                        for (let i = 1; i < this.table.rows.length; i++)
                            this.table.rows[i].label = "Constraint " + i;
                        this._wrapAddRow();
                        this._wrapColMethods();
                        this.$nextTick(() =>
                            syncTableWidth(
                                this.$refs.inputTable,
                                this.table.cols,
                                350,
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
                            self.syncIntVars();
                            syncTableWidth(
                                self.$refs.inputTable,
                                self.table.cols,
                                350,
                                112,
                            );
                        };
                        this.table.removeCol = function () {
                            origRemove();
                            self.syncIntVars();
                            syncTableWidth(
                                self.$refs.inputTable,
                                self.table.cols,
                                350,
                                112,
                            );
                        };
                    },
};
