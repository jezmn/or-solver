// page controller (segmented from the inline script in frontend/assignment.html)

            function assignmentPage() {
                return {
                    numRows: 3,
                    numCols: 3,
                    matrix: [
                        ["", "", ""],
                        ["", "", ""],
                        ["", "", ""],
                    ],
                    rowNames: ["Job 1", "Job 2", "Job 3"],
                    colNames: ["Machine 1", "Machine 2", "Machine 3"],
                    optimization: "min",
                    loading: false,
                    result: null,
                    error: "",
                    graphHtml: "",

                    getProblemInput() {
                        return getAssignmentProblemInput(this);
                    },

                    exportProblem() {
                        this.error = "";
                        try {
                            downloadProblemJson(
                                "assignment",
                                this.getProblemInput(),
                            );
                        } catch (e) {
                            this.error = e.message || "Export failed.";
                        }
                    },

                    onInputChange() {
                        this.result = null;
                        this.error = "";
                        this.graphHtml = "";
                    },

                    async importProblem(event) {
                        this.error = "";
                        try {
                            const input = await importProblemFromFile(
                                event,
                                "assignment",
                                validateAssignmentProblemInput,
                            );
                            if (!input) return;
                            applyAssignmentProblemInput(this, input);
                            this.result = null;

                            this.graphHtml = "";
                            this.$nextTick(() =>
                                syncTableWidth(
                                    this.$refs.inputTable,
                                    this.numCols,
                                    220,
                                    100,
                                ),
                            );
                        } catch (e) {
                            this.error = e.message || "Import failed.";
                        }
                    },
                    addRow() {
                        this.matrix.push(Array(this.numCols || 1).fill(""));
                        this.rowNames.push("Job " + (this.numRows + 1));
                        this.numRows = this.matrix.length;
                    },
                    removeRow() {
                        if (this.numRows > 1) {
                            this.matrix.pop();
                            this.rowNames.pop();
                            this.numRows = this.matrix.length;
                        }
                    },
                    addCol() {
                        for (const row of this.matrix) row.push("");
                        this.colNames.push("Machine " + (this.numCols + 1));
                        this.numCols =
                            this.matrix.length > 0 ? this.matrix[0].length : 0;
                        this.$nextTick(() =>
                            syncTableWidth(
                                this.$refs.inputTable,
                                this.numCols,
                                220,
                                100,
                            ),
                        );
                    },
                    removeCol() {
                        if (this.numCols > 1) {
                            for (const row of this.matrix) row.pop();
                            this.colNames.pop();
                            this.numCols =
                                this.matrix.length > 0
                                    ? this.matrix[0].length
                                    : 0;
                            this.$nextTick(() =>
                                syncTableWidth(
                                    this.$refs.inputTable,
                                    this.numCols,
                                    220,
                                    100,
                                ),
                            );
                        }
                    },

                    async solve() {
                        this.error = "";
                        this.result = null;
                        this.graphHtml = "";

                        const costMatrix = this.matrix.map((r) =>
                            r.map(Number),
                        );
                        if (
                            costMatrix.length === 0 ||
                            costMatrix[0].length === 0
                        ) {
                            this.error = "Matrix cannot be empty.";
                            return;
                        }
                        for (const row of costMatrix) {
                            if (row.some(isNaN)) {
                                this.error =
                                    "All matrix values must be numeric.";
                                return;
                            }
                        }

                        const input = {
                            cost_matrix: costMatrix,
                            optimization: this.optimization,
                        };
                        const cacheKey = getCacheKey("assignment", input);
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
                            const data = await solve("assignment", input);
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
                        if (
                            !this.result ||
                            !this.result.graph ||
                            !this.result.graph.data
                        ) {
                            this.graphHtml = "";
                            return;
                        }
                        const matrix = this.result.graph.data.matrix || [];
                        const assignment =
                            this.result.graph.data.assignment || [];
                        const nRows = matrix.length;
                        const nCols = matrix[0] ? matrix[0].length : 0;
                        if (nRows === 0 || nCols === 0) {
                            this.graphHtml = "";
                            return;
                        }

                        const flat = matrix.flat();
                        const minVal = Math.min(...flat);
                        const maxVal = Math.max(...flat);
                        const range = maxVal - minVal || 1;
                        const dark = isDarkMode();

                        let html =
                            '<div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700"><table class="min-w-full text-xs border-collapse bg-white dark:bg-slate-900">';

                        html +=
                            '<thead><tr class="bg-slate-100 dark:bg-slate-800">';
                        html +=
                            '<th class="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-center font-semibold text-slate-700 dark:text-slate-200"></th>';
                        for (let j = 0; j < nCols; j++) {
                            html += `<th class="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-center font-semibold text-slate-700 dark:text-slate-200">${escHtml(this.colNames[j] || "T" + (j + 1))}</th>`;
                        }
                        html += "</tr></thead><tbody>";

                        for (let i = 0; i < nRows; i++) {
                            html += "<tr>";
                            html += `<td class="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/70">${escHtml(this.rowNames[i] || "W" + (i + 1))}</td>`;
                            for (let j = 0; j < nCols; j++) {
                                const val = matrix[i][j];
                                const intensity = (val - minVal) / range;
                                const isAssigned = assignment[i] === j;
                                const r = Math.round(220 - intensity * 180);
                                const g = Math.round(220 - intensity * 180);
                                const b = Math.round(255);
                                const bgCss = dark
                                    ? `rgb(${Math.round(r * 0.15)}, ${Math.round(g * 0.15)}, ${Math.round(b * 0.2)})`
                                    : `rgb(${r}, ${g}, ${b})`;
                                let cellCls =
                                    "border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center font-mono";
                                if (isAssigned) {
                                    cellCls +=
                                        " font-bold ring-2 ring-green-500 dark:ring-green-400 rounded";
                                }
                                html += `<td class="${cellCls}" style="background-color: ${bgCss}">${formatNumber(val, 2)}</td>`;
                            }
                            html += "</tr>";
                        }
                        html += "</tbody></table></div>";

                        html +=
                            '<div class="flex flex-wrap gap-4 mt-3 justify-center text-xs text-slate-600 dark:text-slate-400">';
                        html +=
                            '<span class="inline-flex items-center gap-1.5"><span class="inline-block w-4 h-3 rounded" style="background: rgb(220, 220, 255)"></span> ' +
                            this.$store.i18n.t("low.cost") +
                            "</span>";
                        html +=
                            '<span class="inline-flex items-center gap-1.5"><span class="inline-block w-4 h-3 rounded" style="background: rgb(40, 40, 70)"></span> ' +
                            this.$store.i18n.t("high.cost") +
                            "</span>";
                        html +=
                            '<span class="inline-flex items-center gap-1.5"><span class="inline-block w-3 h-3 rounded-full ring-2 ring-green-500 dark:ring-green-400 bg-green-100 dark:bg-green-900"></span> ' +
                            this.$store.i18n.t("assigned.cell") +
                            "</span>";
                        html += "</div>";

                        this.graphHtml = html;
                    },

                    clearTable() {
                        this.error = "";
                        this.result = null;
                        this.graphHtml = "";
                        const t = createAssignmentTableState(
                            this.numRows,
                            this.numCols,
                        );
                        this.matrix = t.matrix;
                        this.rowNames = this.matrix.map(
                            (_, i) => "Job " + (i + 1),
                        );
                        this.colNames = (this.matrix[0] || []).map(
                            (_, j) => "Machine " + (j + 1),
                        );
                        this.numRows = this.matrix.length;
                        this.numCols = this.matrix[0].length;
                        this.$nextTick(() =>
                            syncTableWidth(
                                this.$refs.inputTable,
                                this.numCols,
                                220,
                                100,
                            ),
                        );
                    },

                    init() {
                        const t = createAssignmentTableState(3, 3);
                        this.matrix = t.matrix;
                        this.rowNames = ["Job 1", "Job 2", "Job 3"];
                        this.colNames = ["Machine 1", "Machine 2", "Machine 3"];
                        this.numRows = this.matrix.length;
                        this.numCols = this.matrix[0].length;
                        this.$nextTick(() =>
                            syncTableWidth(
                                this.$refs.inputTable,
                                this.numCols,
                                220,
                                100,
                            ),
                        );
                    },
                };
            }
