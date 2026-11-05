// integer programming page: bounding-tree visualization (segmented from the inline page script)

const IP_PAGE_TREE = {
                    renderTree() {
                        const el = document.getElementById("plotly-tree");
                        if (!el) return;
                        el.innerHTML = "";

                        if (
                            !this.result ||
                            !this.result.graph ||
                            !this.result.graph.data
                        )
                            return;
                        const treeData = this.result.graph.data;
                        const nodes = treeData.nodes || [];
                        const edges = treeData.edges || [];
                        const plotlyTheme = getPlotlyTheme();
                        const palette = getChartPalette();

                        if (nodes.length === 0) {
                            el.innerHTML =
                                '<p class="text-sm text-slate-500 dark:text-zinc-400 py-8 text-center">' +
                                Alpine.store("i18n").t("no.nodes") +
                                "</p>";
                            return;
                        }
                        if (typeof Plotly === "undefined") {
                            el.innerHTML =
                                '<p class="text-sm text-slate-500 dark:text-zinc-400 py-8 text-center">' +
                                Alpine.store("i18n").t("no.renderer") +
                                "</p>";
                            return;
                        }

                        const nodeById = new Map(nodes.map((n) => [n.id, n]));
                        const children = {};
                        const parentMap = {};
                        for (const e of edges) {
                            if (!nodeById.has(e.from) || !nodeById.has(e.to))
                                continue;
                            if (!children[e.from]) children[e.from] = [];
                            children[e.from].push(e.to);
                            parentMap[e.to] = e.from;
                        }

                        const root =
                            nodes.find((n) => parentMap[n.id] === undefined) ||
                            nodes[0];
                        const positions = {};
                        const depth = {};
                        const visited = new Set();
                        let nextLeaf = 0;

                        function layoutNode(id, d) {
                            if (visited.has(id)) return positions[id].rawX;
                            visited.add(id);
                            depth[id] = d;
                            const nodeChildren = (children[id] || [])
                                .slice()
                                .sort((a, b) => Number(a) - Number(b));
                            if (nodeChildren.length === 0) {
                                positions[id] = { rawX: nextLeaf, depth: d };
                                nextLeaf += 1;
                                return positions[id].rawX;
                            }
                            const childXs = nodeChildren.map((childId) =>
                                layoutNode(childId, d + 1),
                            );
                            const rawX =
                                (Math.min(...childXs) + Math.max(...childXs)) /
                                2;
                            positions[id] = { rawX, depth: d };
                            return rawX;
                        }

                        layoutNode(root.id, 0);
                        for (const n of nodes) {
                            if (!visited.has(n.id)) layoutNode(n.id, 0);
                        }

                        const leafCount = Math.max(nextLeaf, 1);
                        const maxDepth = Math.max(...Object.values(depth), 0);
                        const xSpacing = 2.6;
                        const ySpacing = 1.55;
                        for (const pos of Object.values(positions)) {
                            pos.x = (pos.rawX - (leafCount - 1) / 2) * xSpacing;
                            pos.y = -pos.depth * ySpacing;
                        }

                        const plotHeight = Math.max(430, (maxDepth + 1) * 130);
                        el.style.height = plotHeight + "px";

                        const edgeTraces = edges
                            .map((e) => {
                                const fromPos = positions[e.from];
                                const toPos = positions[e.to];
                                if (!fromPos || !toPos) return null;
                                return {
                                    type: "scatter",
                                    mode: "lines",
                                    x: [fromPos.x, toPos.x],
                                    y: [fromPos.y, toPos.y],
                                    line: {
                                        color: plotlyTheme.edge,
                                        width: 1.5,
                                    },
                                    hoverinfo: "skip",
                                    showlegend: false,
                                };
                            })
                            .filter(Boolean);

                        const edgeLabels = edges
                            .map((e) => {
                                const fromPos = positions[e.from];
                                const toPos = positions[e.to];
                                if (!fromPos || !toPos || !e.label) return null;
                                return {
                                    x: (fromPos.x + toPos.x) / 2,
                                    y: (fromPos.y + toPos.y) / 2,
                                    xref: "x",
                                    yref: "y",
                                    text: formatMathText(e.label),
                                    showarrow: false,
                                    font: {
                                        size: 9,
                                        color: plotlyTheme.mutedText,
                                    },
                                    bgcolor: plotlyTheme.labelBg,
                                    borderpad: 2,
                                };
                            })
                            .filter(Boolean);

                        const formatNodeLabel = (node) => {
                            const lines = String(node.label || "")
                                .replace("Integer Optimal", "Integer\nOptimal")
                                .split("\n")
                                .filter(Boolean);
                            const title =
                                lines[0] === "X" ? "Infeasible" : lines[0];
                            const zLine = lines.find((line) =>
                                /^Z=/.test(line),
                            );
                            const labelLines = [formatMathText(title)];
                            if (zLine) {
                                labelLines.push(
                                    zLine.replace(
                                        /Z=(-?\d+(?:\.\d+)?)/g,
                                        (_match, value) =>
                                            "Z=" + formatNumber(Number(value)),
                                    ),
                                );
                            } else if (lines[1]) {
                                labelLines.push(formatMathText(lines[1]));
                            }

                            const valueLines = Object.entries(node.values || {})
                                .sort(
                                    ([a], [b]) =>
                                        Number(a.slice(1)) - Number(b.slice(1)),
                                )
                                .slice(0, 2)
                                .map(
                                    ([name, value]) =>
                                        `${formatVariableName(name)}=${formatNumber(value)}`,
                                );
                            return labelLines.concat(valueLines).join("<br>");
                        };

                        const nodeColors = {
                            relaxation: "#0f766e",
                            fractional: "#0f766e",
                            optimal: "#4f46e5",
                            infeasible: "#92400e",
                            unbounded: "#334155",
                        };
                        const nodeTrace = {
                            type: "scatter",
                            mode: "markers+text",
                            x: nodes.map((n) => positions[n.id].x),
                            y: nodes.map((n) => positions[n.id].y),
                            marker: {
                                symbol: "circle",
                                size: 92,
                                color: nodes.map(
                                    (n) => nodeColors[n.type] || "#475569",
                                ),
                                line: { color: plotlyTheme.nodeLine, width: 2 },
                            },
                            text: nodes.map((n) => formatNodeLabel(n)),
                            textposition: "middle center",
                            textfont: { size: 9, color: "#f8fafc" },
                            hoverinfo: "skip",
                            showlegend: false,
                        };

                        const xValues = nodes.map((n) => positions[n.id].x);
                        const minX = Math.min(...xValues);
                        const maxX = Math.max(...xValues);
                        const layout = {
                            xaxis: {
                                visible: false,
                                showgrid: false,
                                zeroline: false,
                                fixedrange: true,
                                range: [minX - 1.4, maxX + 1.4],
                            },
                            yaxis: {
                                visible: false,
                                showgrid: false,
                                zeroline: false,
                                fixedrange: true,
                                range: [-maxDepth * ySpacing - 0.7, 0.7],
                            },
                            plot_bgcolor: plotlyTheme.plotBg,
                            paper_bgcolor: plotlyTheme.paperBg,
                            margin: { l: 20, r: 20, t: 20, b: 20 },
                            hovermode: false,
                            dragmode: false,
                            font: {
                                family: "monospace",
                                color: plotlyTheme.text,
                            },
                            annotations: edgeLabels,
                        };
                        const config = {
                            responsive: true,
                            displayModeBar: false,
                            staticPlot: true,
                        };
                        Plotly.newPlot(
                            el,
                            [...edgeTraces, nodeTrace],
                            layout,
                            config,
                        );
                    },
};
