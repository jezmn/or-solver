// goal programming page: row/col editing + graph rendering (segmented from the inline page script)

const GP_PAGE_VISUALS = {
                    addCol() {
                        for (const row of this.rows) row.cells.push("");
                        this.numCols++;
                        this.varNames.push("x" + this.numCols);
                        this.$nextTick(() =>
                            syncTableWidth(
                                this.$refs.inputTable,
                                this.numCols,
                                540,
                                96,
                            ),
                        );
                    },

                    removeCol() {
                        if (this.numCols > 1) {
                            for (const row of this.rows) row.cells.pop();
                            this.numCols--;
                            this.varNames.pop();
                            this.$nextTick(() =>
                                syncTableWidth(
                                    this.$refs.inputTable,
                                    this.numCols,
                                    540,
                                    96,
                                ),
                            );
                        }
                    },

                    addRow() {
                        this.rows.push({
                            cells: Array(this.numCols).fill(""),
                            wt_plus: "",
                            prty_plus: "",
                            wt_minus: "",
                            prty_minus: "",
                            sign: "=",
                            rhs: "",
                            label: "Goal " + (this.rows.length + 1),
                        });
                    },

                    addConstraint() {
                        this.rows.push({
                            cells: Array(this.numCols).fill(""),
                            wt_plus: "",
                            prty_plus: "",
                            wt_minus: "",
                            prty_minus: "",
                            sign: "=",
                            rhs: "",
                            label: "Constraint " + (this.rows.length + 1),
                        });
                    },

                    removeRow() {
                        if (this.rows.length > 1) this.rows.pop();
                    },


                    renderGraph() {
                        const canvas = document.getElementById("graph-canvas");
                        if (
                            !canvas ||
                            !this.result ||
                            !this.result.graph ||
                            !this.result.graph.data ||
                            !this.result.graph.data.objectives_achieved
                        )
                            return;
                        if (this.chartInstance) this.chartInstance.destroy();
                        const ctx = canvas.getContext("2d");
                        const data = this.result.graph.data.objectives_achieved;
                        const goalLabels = this.rows.map(
                            (r, i) => r.label || `Goal ${i + 1}`,
                        );
                        const doneColor = "#22c55e";
                        const missColor = "#f97316";
                        this.chartInstance = new Chart(ctx, {
                            type: "bar",
                            data: {
                                labels: goalLabels,
                                datasets: [
                                    {
                                        label: Alpine.store("i18n").t(
                                            "chart.target",
                                        ),
                                        data: data.map((d) => d.target),
                                        backgroundColor: isDarkMode()
                                            ? "#64748b"
                                            : "#94a3b8",
                                    },
                                    {
                                        label: Alpine.store("i18n").t(
                                            "chart.achieved",
                                        ),
                                        data: data.map((d) =>
                                            Math.abs(d.deviation) > 0.01
                                                ? null
                                                : d.achieved,
                                        ),
                                        backgroundColor: doneColor,
                                    },
                                    {
                                        label: Alpine.store("i18n").t(
                                            "chart.miss",
                                        ),
                                        data: data.map((d) =>
                                            Math.abs(d.deviation) > 0.01
                                                ? d.achieved
                                                : null,
                                        ),
                                        backgroundColor: missColor,
                                    },
                                ],
                            },
                            options: getChartOptions({
                                plugins: {
                                    legend: { labels: { font: { size: 11 } } },
                                    tooltip: {
                                        callbacks: {
                                            afterBody: function (items) {
                                                const i = items[0].dataIndex;
                                                const d = data[i];
                                                return [
                                                    `d+: ${d.d_plus.toFixed(2)}`,
                                                    `d-: ${d.d_minus.toFixed(2)}`,
                                                    `${Alpine.store("i18n").t("deviation.label")} ${d.deviation.toFixed(2)}`,
                                                ];
                                            },
                                        },
                                    },
                                },
                                scales: {
                                    y: {
                                        beginAtZero: true,
                                        title: {
                                            display: true,
                                            text: Alpine.store("i18n").t(
                                                "chart.value",
                                            ),
                                        },
                                    },
                                },
                            }),
                        });
                    },
};
