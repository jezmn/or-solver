// page controller (segmented from the inline script in frontend/transportation.html)

            function transportPage() {
                return {
                    method: "vogel",
                    optimization: "min",
                    numRows: 3,
                    numCols: 3,
                    supply: ["", "", ""],
                    demand: ["", "", ""],
                    costs: [
                        ["", "", ""],
                        ["", "", ""],
                        ["", "", ""],
                    ],
                    sourceNames: ["Source 1", "Source 2", "Source 3"],
                    destNames: [
                        "Destination 1",
                        "Destination 2",
                        "Destination 3",
                    ],
                    loading: false,
                    result: null,
                    error: "",

                    getProblemInput() {
                        return getTransportationProblemInput(this);
                    },

                    exportProblem() {
                        this.error = "";
                        try {
                            downloadProblemJson(
                                this.method,
                                this.getProblemInput(),
                            );
                        } catch (e) {
                            this.error = e.message || "Export failed.";
                        }
                    },

                    onInputChange() {
                        this.result = null;
                        this.error = "";
                    },

                    async importProblem(event) {
                        this.error = "";
                        try {
                            const input = await importProblemFromFile(
                                event,
                                null,
                                validateTransportationProblemInput,
                            );
                            if (!input) return;
                            applyTransportationProblemInput(this, input);
                            if (
                                !Array.isArray(this.destNames) ||
                                this.destNames.length !== this.numCols
                            ) {
                                this.destNames = Array.from(
                                    { length: this.numCols },
                                    (_, j) => "Destination " + (j + 1),
                                );
                            }
                            if (
                                !Array.isArray(this.sourceNames) ||
                                this.sourceNames.length !== this.numRows
                            ) {
                                this.sourceNames = Array.from(
                                    { length: this.numRows },
                                    (_, i) => "Source " + (i + 1),
                                );
                            }
                            this.result = null;
                            this.$nextTick(() =>
                                syncTableWidth(
                                    this.$refs.inputTable,
                                    this.numCols,
                                    420,
                                    100,
                                ),
                            );
                        } catch (e) {
                            this.error = e.message || "Import failed.";
                        }
                    },

                    addRow() {
                        this.supply.push("");
                        this.costs.push(Array(this.numCols).fill(""));
                        this.sourceNames.push("Source " + (this.numRows + 1));
                        this.numRows = this.supply.length;
                    },
                    removeRow() {
                        if (this.numRows > 1) {
                            this.supply.pop();
                            this.costs.pop();
                            this.sourceNames.pop();
                            this.numRows = this.supply.length;
                        }
                    },
                    addCol() {
                        this.demand.push("");
                        for (const row of this.costs) row.push("");
                        this.destNames.push(
                            "Destination " + (this.numCols + 1),
                        );
                        this.numCols = this.demand.length;
                        this.$nextTick(() =>
                            syncTableWidth(
                                this.$refs.inputTable,
                                this.numCols,
                                420,
                                100,
                            ),
                        );
                    },
                    removeCol() {
                        if (this.numCols > 1) {
                            this.demand.pop();
                            for (const row of this.costs) row.pop();
                            this.destNames.pop();
                            this.numCols = this.demand.length;
                            this.$nextTick(() =>
                                syncTableWidth(
                                    this.$refs.inputTable,
                                    this.numCols,
                                    420,
                                    100,
                                ),
                            );
                        }
                    },

                    async solve() {
                        this.error = "";
                        this.result = null;

                        const supply = this.supply.map(Number);
                        const demand = this.demand.map(Number);
                        if (supply.some(isNaN) || demand.some(isNaN)) {
                            this.error = "Supply and demand must be numeric.";
                            return;
                        }

                        const costRows = this.costs.map((r) => r.map(Number));
                        for (const row of costRows) {
                            if (row.some(isNaN)) {
                                this.error =
                                    "Cost matrix values must be numeric.";
                                return;
                            }
                        }

                        const input = {
                            supply,
                            demand,
                            costs: costRows,
                            optimization: this.optimization,
                        };
                        const cacheKey = getCacheKey(this.method, input);
                        const cached = getFromCache(cacheKey);
                        if (cached) {
                            this.result = cached.result;
                            return;
                        }

                        this.loading = true;
                        try {
                            const data = await solve(this.method, input);
                            this.result = data;
                            setCache(cacheKey, data);
                        } catch (e) {
                            this.error = e.message || "API error";
                        } finally {
                            this.loading = false;
                        }
                    },

                    clearTable() {
                        this.error = "";
                        this.result = null;

                        const t = createTransportTableState(
                            this.numRows,
                            this.numCols,
                        );
                        this.supply = t.supply;
                        this.demand = t.demand;
                        this.costs = t.costs;
                        this.sourceNames = t.supply.map(
                            (_, i) => "Source " + (i + 1),
                        );
                        this.destNames = t.demand.map(
                            (_, j) => "Destination " + (j + 1),
                        );
                        this.numRows = this.supply.length;
                        this.numCols = this.demand.length;
                        this.$nextTick(() =>
                            syncTableWidth(
                                this.$refs.inputTable,
                                this.numCols,
                                420,
                                100,
                            ),
                        );
                    },

                    init() {
                        const t = createTransportTableState(3, 3);
                        this.supply = t.supply;
                        this.demand = t.demand;
                        this.costs = t.costs;
                        this.sourceNames = ["Source 1", "Source 2", "Source 3"];
                        this.destNames = [
                            "Destination 1",
                            "Destination 2",
                            "Destination 3",
                        ];
                        this.numRows = this.supply.length;
                        this.numCols = this.demand.length;
                        this.$nextTick(() =>
                            syncTableWidth(
                                this.$refs.inputTable,
                                this.numCols,
                                420,
                                100,
                            ),
                        );
                    },
                };
            }
