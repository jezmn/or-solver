// integer programming page: branch-and-bound step rendering (segmented from the inline page script)

const IP_PAGE_STEPS = {
                    renderIntegerSteps(steps) {
                        if (!steps || steps.length === 0)
                            return (
                                '<p class="text-slate-500 dark:text-slate-400 text-sm">' +
                                Alpine.store("i18n").t("no.steps") +
                                "</p>"
                            );

                        const varNames = this.table
                            ? this.table.varNames
                            : null;
                        const remap = (text) =>
                            remapStepVarNames(String(text || ""), varNames);

                        const formatExpr = (coeffs) =>
                            formatLinearExpressionText(coeffs, varNames);

                        const formatValues = (values) =>
                            Object.entries(values || {})
                                .sort(
                                    ([a], [b]) =>
                                        Number(a.slice(1)) - Number(b.slice(1)),
                                )
                                .map(([name, value]) => {
                                    const idx =
                                        parseInt(name.replace("x", ""), 10) - 1;
                                    const displayName =
                                        varNames &&
                                        idx >= 0 &&
                                        idx < varNames.length
                                            ? varNames[idx]
                                            : name;
                                    return `${formatVariableName(displayName)}=${formatNumber(value)}`;
                                })
                                .join(", ");

                        const summaryRow = (label, value) => `
            <div class="grid gap-1 sm:grid-cols-[150px_1fr]">
              <dt class="font-semibold text-slate-700 dark:text-slate-200">${label}</dt>
              <dd class="text-slate-700 dark:text-slate-300">${escHtml(formatMathText(value || "none"))}</dd>
            </div>`;

                        const compactFixedValueCalculations = (lines) => {
                            const cleanLines = (lines || []).filter(
                                (line) => line !== null && line !== undefined,
                            );
                            if (!cleanLines.length) return cleanLines;

                            const firstLine = String(cleanLines[0]);
                            const withMatch = firstLine.match(/^With (.*):$/);
                            if (!withMatch) return cleanLines;

                            const seen = new Set();
                            const fixedParts = withMatch[1]
                                .split(",")
                                .map((part) => part.trim())
                                .filter((part) => {
                                    const name = (part.match(
                                        /^([a-z]\d+)\s*=/,
                                    ) || [])[1];
                                    if (!name || seen.has(name)) return false;
                                    seen.add(name);
                                    return true;
                                });
                            if (!fixedParts.length) return cleanLines;

                            let idx = 1;
                            const spacing = [];
                            while (idx < cleanLines.length) {
                                const line = String(cleanLines[idx]);
                                if (line === "") {
                                    spacing.push(line);
                                    idx += 1;
                                    break;
                                }
                                const assignment = line
                                    .trim()
                                    .match(
                                        /^([a-z]\d+)\s*=\s*-?\d+(?:\.\d+)?$/,
                                    );
                                if (!assignment || !seen.has(assignment[1]))
                                    break;
                                idx += 1;
                            }

                            return [
                                `With ${fixedParts.join(", ")}:`,
                                ...spacing,
                                ...cleanLines.slice(idx),
                            ];
                        };

                        const calculationDetails = (lines, extraHtml = "") => {
                            const cleanLines =
                                compactFixedValueCalculations(lines);
                            if (!cleanLines.length && !extraHtml) return "";
                            const lineHtml = cleanLines
                                .map((line) =>
                                    line === ""
                                        ? '<div class="h-2"></div>'
                                        : `<div>${escHtml(formatMathText(line))}</div>`,
                                )
                                .join("");
                            return `
              <details class="mt-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40">
                <summary class="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200">${Alpine.store("i18n").t("show.calculations")}</summary>
                <div class="px-3 pb-3 pt-1 text-xs text-slate-700 dark:text-slate-300 space-y-2">
                  ${lineHtml ? `<div class="font-mono leading-5">${lineHtml}</div>` : ""}
                  ${extraHtml}
                </div>
              </details>`;
                        };

                        const renderNodeStep = (step, idx) => {
                            const data = step.data || {};
                            let branchHtml = "";
                            if (
                                data.inherited_constraints &&
                                data.inherited_constraints.length
                            ) {
                                branchHtml += summaryRow(
                                    Alpine.store("i18n").t(
                                        "ip.inherited_constraints",
                                    ),
                                    data.inherited_constraints
                                        .map(remap)
                                        .join(", "),
                                );
                            }
                            if (data.new_constraint) {
                                branchHtml += summaryRow(
                                    Alpine.store("i18n").t("ip.new_constraint"),
                                    remap(data.new_constraint),
                                );
                            }

                            let calcExtra = "";
                            if (
                                data.redundancy_notes &&
                                data.redundancy_notes.length
                            ) {
                                calcExtra += `<div class="text-xs text-zinc-500 dark:text-zinc-400">${escHtml(data.redundancy_notes.map(remap).join("; "))}</div>`;
                            }

                            if (
                                data.simplified_constraints &&
                                data.simplified_constraints.length
                            ) {
                                branchHtml += summaryRow(
                                    Alpine.store("i18n").t(
                                        "ip.simplified_constraints",
                                    ),
                                    data.simplified_constraints
                                        .map(remap)
                                        .join(", "),
                                );
                            }

                            const lpResult =
                                data.lp_status && data.lp_status !== "Optimal"
                                    ? data.lp_status
                                    : `${formatValues(data.variables)}, Z=${formatNumber(data.value)}`;
                            const translatedDesc = remap(
                                translateStepDescription(
                                    remapStepVarNames(
                                        step.description || "",
                                        varNames,
                                    ),
                                ),
                            );
                            return `
              <div class="border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 p-4 text-sm">
                <div class="flex items-start justify-between gap-3 mb-3">
                  <h3 class="font-semibold text-slate-900 dark:text-slate-50">${escHtml(translatedDesc || remap(data.node_name || `${Alpine.store("i18n").t("step")} ${idx + 1}`))}</h3>
                  <span class="text-xs text-slate-500 dark:text-slate-400">${Alpine.store("i18n").t("step")} ${idx + 1}</span>
                </div>
                <dl class="space-y-2">
                  ${branchHtml}
                  ${summaryRow(Alpine.store("i18n").t("ip.lp_relaxation_result"), lpResult)}
                  ${summaryRow(Alpine.store("i18n").t("ip.integer_check"), data.integer_check || "checked")}
                  ${summaryRow(Alpine.store("i18n").t("ip.decision"), remap(data.decision || step.description || Alpine.store("i18n").t("ip.step_completed")))}
                </dl>
                ${calculationDetails(data.calculations, calcExtra)}
              </div>`;
                        };

                        const renderGeneralStep = (step, idx) => {
                            const i18n = Alpine.store("i18n");
                            const data = step.data || {};
                            let lines = [];
                            let extraHtml = "";
                            if (data.objective && data.constraints) {
                                const var0 =
                                    varNames && varNames[0]
                                        ? formatVariableName(varNames[0])
                                        : "x₁";
                                const var1 =
                                    varNames && varNames[1]
                                        ? formatVariableName(varNames[1])
                                        : "x₂";
                                const intText = (data.integer_variables || [])
                                    .length
                                    ? data.integer_variables
                                          .map((v) => {
                                              const vidx =
                                                  parseInt(
                                                      String(v).replace(
                                                          "x",
                                                          "",
                                                      ),
                                                      10,
                                                  ) - 1;
                                              return formatVariableName(
                                                  varNames &&
                                                      vidx >= 0 &&
                                                      vidx < varNames.length
                                                      ? varNames[vidx]
                                                      : v,
                                              );
                                          })
                                          .join(", ")
                                    : "none";
                                const optLabel =
                                    this.optimization === "max"
                                        ? i18n.t("maximize")
                                        : i18n.t("minimize");
                                lines = [
                                    remap(
                                        i18n
                                            .t("ip.objective")
                                            .replace(
                                                "{0}",
                                                formatExpr(data.objective),
                                            )
                                            .replace("{1}", optLabel),
                                    ),
                                    remap(
                                        i18n
                                            .t("ip.lp_relaxation")
                                            .replace("{0}", intText),
                                    ),
                                    i18n
                                        .t("ip.graph_setup")
                                        .replace("{0}", var0)
                                        .replace("{1}", var1),
                                ];
                                if (data.intercepts && data.intercepts.length) {
                                    extraHtml = renderTable(
                                        [
                                            "Constraint",
                                            "Equation",
                                            `${var1} = 0`,
                                            `${var0} = 0`,
                                        ],
                                        data.intercepts,
                                        "Graph intercepts",
                                    );
                                }
                            } else if (
                                data.variables &&
                                data.optimal_value !== undefined
                            ) {
                                lines = [
                                    remap(
                                        i18n
                                            .t("ip.final_integer_solution")
                                            .replace(
                                                "{0}",
                                                formatValues(data.variables),
                                            )
                                            .replace(
                                                "{1}",
                                                formatNumber(
                                                    data.optimal_value,
                                                ),
                                            ),
                                    ),
                                ];
                            } else if (data.nodes_explored !== undefined) {
                                lines = [
                                    i18n
                                        .t("ip.nodes_explored")
                                        .replace(
                                            "{0}",
                                            String(data.nodes_explored),
                                        ),
                                ];
                            } else {
                                lines = [
                                    remap(
                                        translateStepDescription(
                                            step.description,
                                        ) || i18n.t("ip.step_completed"),
                                    ),
                                ];
                            }

                            const translatedDesc = remap(
                                translateStepDescription(
                                    remapStepVarNames(
                                        step.description || "",
                                        varNames,
                                    ),
                                ),
                            );
                            return `
              <div class="border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 p-4 text-sm">
                <div class="flex items-start justify-between gap-3 mb-2">
                  <h3 class="font-semibold text-slate-900 dark:text-slate-50">${i18n.t("step")} ${idx + 1}</h3>
                  <span class="text-xs text-slate-500 dark:text-slate-400">${escHtml(formatMathText(translatedDesc || step.description || ""))}</span>
                </div>
                <ul class="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-300">
                  ${lines.map((line) => `<li>${escHtml(formatMathText(line))}</li>`).join("")}
                </ul>
                ${extraHtml ? calculationDetails([], extraHtml) : ""}
              </div>`;
                        };

                        return `<div class="space-y-3">${steps.map((step, idx) => (step.data && step.data.node_name ? renderNodeStep(step, idx) : renderGeneralStep(step, idx))).join("")}</div>`;
                    },
};
