// LP/simplex/goal step renderers (segmented from utils.js)

function renderStepType_row_reduction(data, varNames) {
  let h = '<div class="space-y-3">';
  h += renderOperation(data.operation || __t('row.reduction.operation'));
  if (data.row_minima) {
    const rows = data.row_minima.map((v, i) => {
      const label = getAssignmentLabel(varNames, i, true) || (__t('row') + ' ' + (i + 1));
      return [label, formatNumber(v, 2)];
    });
    h += renderTable([__t('row'), __t('min.value')], rows, __t('row.minima'));
  }
  h += '<div><span class="font-semibold text-sm text-slate-700 dark:text-slate-200">' + __t('before.row.reduction') + '</span>' + renderMatrix(data.matrix_before) + '</div>';
  h += '<div><span class="font-semibold text-sm text-slate-700 dark:text-slate-200">' + __t('after.row.reduction') + '</span>' + renderMatrix(data.matrix_after) + '</div>';
  h += '</div>';
  return h;
}

function renderStepType_col_reduction(data, varNames) {
  let h = '<div class="space-y-3">';
  h += renderOperation(data.operation || __t('col.reduction.operation'));
  if (data.column_minima) {
    const rows = data.column_minima.map((v, j) => {
      const label = getAssignmentLabel(varNames, j, false) || (__t('column') + ' ' + (j + 1));
      return [label, formatNumber(v, 2)];
    });
    h += renderTable([__t('column'), __t('min.value')], rows, __t('column.minima'));
  }
  h += '<div><span class="font-semibold text-sm text-slate-700 dark:text-slate-200">' + __t('before.col.reduction') + '</span>' + renderMatrix(data.matrix_before) + '</div>';
  h += '<div><span class="font-semibold text-sm text-slate-700 dark:text-slate-200">' + __t('after.col.reduction') + '</span>' + renderMatrix(data.matrix_after) + '</div>';
  h += '</div>';
  return h;
}

function renderStepType_line_drawing(data, varNames) {
  let h = '<div class="space-y-3">';
  h += `<p class="text-xs text-slate-600 dark:text-slate-400">${__t('lines.used')} <span class="font-bold text-slate-800 dark:text-slate-200">${escHtml(String(data.lines_count))}</span>`;
  if (data.covered_rows && data.covered_rows.length) {
    const rowLabels = data.covered_rows.map(r => {
      const label = getAssignmentLabel(varNames, r, true);
      return label ? `<span class="font-mono">${escHtml(label)}</span>` : `<span class="font-mono">R${r + 1}</span>`;
    });
    h += ` ${__t('covered.rows')} ${rowLabels.join(', ')}`;
  } else {
    h += ' ' + __t('no.rows.covered');
  }
  if (data.covered_cols && data.covered_cols.length) {
    const colLabels = data.covered_cols.map(c => {
      const label = getAssignmentLabel(varNames, c, false);
      return label ? `<span class="font-mono">${escHtml(label)}</span>` : `<span class="font-mono">C${c + 1}</span>`;
    });
    h += ` ${__t('covered.columns')} ${colLabels.join(', ')}`;
  } else {
    h += ' ' + __t('no.columns.covered');
  }
  h += '</p>';

  h += '<div><span class="font-semibold text-sm text-slate-700 dark:text-slate-200">' + __t('matrix.with.lines') + '</span>'
    + renderMatrixWithCover(data.matrix_before, data.covered_rows, data.covered_cols)
    + '</div>';

  if (data.is_optimal) {
    h += `<div class="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-3 py-2 rounded text-xs font-medium">${escHtml(translateStepDescription(data.operation) || __t('optimal.assignment.found'))}</div>`;
  } else {
    h += renderOperation(data.operation || '');
    if (data.min_uncovered !== undefined) {
      h += `<p class="text-xs font-medium text-slate-700 dark:text-slate-300">${__t('min.uncovered.value')} <span class="font-bold text-rose-600 dark:text-rose-400">${formatNumber(data.min_uncovered, 2)}</span></p>`;
    }
    if (data.matrix_after_intersection_adjustment) {
      h += '<div><span class="font-semibold text-sm text-slate-700 dark:text-slate-200">' + __t('after.intersection.adjustment') + '</span>'
        + renderMatrix(data.matrix_after_intersection_adjustment)
        + '</div>';
    }
  }
  h += '</div>';
  return h;
}


function renderStepType_simplex_tableau(data, varNames) {
  let h = '<div class="space-y-3">';
  const remap = s => remapStepVarNames(String(s || ''), varNames);

  const numVars = data.num_vars || 0;
  const numSlacks = data.num_slacks || 0;
  const totalVars = numVars + numSlacks;

  let headers = [__t('basis', 'Basis')];
  for (let j = 0; j < numVars; j++) {
    const name = (varNames && j < varNames.length) ? varNames[j] : `x${j + 1}`;
    headers.push(formatVariableName(name));
  }
  for (let j = 0; j < numSlacks; j++) {
    headers.push(`s<sub>${j + 1}</sub>`);
  }
  headers.push(__t('rhs'));

  const pivotRow = data.pivot_row;
  const pivotCol = data.pivot_col;
  const tableau = data.tableau || [];
  const rhs = data.rhs || [];
  const basis = data.basis || [];
  const numRows = tableau.length;

  h += '<div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">';
  h += '<table class="min-w-full text-xs border-collapse bg-white dark:bg-slate-900">';
  h += '<thead><tr class="bg-slate-100 dark:bg-slate-800">';
  headers.forEach(hdr => {
    h += `<th class="border border-slate-300 dark:border-slate-600 px-2 py-1 text-center font-semibold text-slate-700 dark:text-slate-200">${hdr}</th>`;
  });
  h += '</tr></thead><tbody>';

  for (let i = 0; i < numRows; i++) {
    const isObjRow = i === 0;
    let cls = isObjRow
      ? 'bg-indigo-50 dark:bg-indigo-950/40 font-semibold'
      : (i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-900/70');

    h += '<tr>';
    h += `<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 text-center font-mono ${cls}">${isObjRow ? __t('objective.row') : escHtml(formatMathText(remap(basis[i - 1] || '')))}</td>`;

    for (let j = 0; j < totalVars; j++) {
      const val = tableau[i] != null ? tableau[i][j] : 0;
      const isPivot = i === pivotRow && j === pivotCol;
      const cellCls = isPivot
        ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-950 dark:text-emerald-100 font-bold ring-1 ring-emerald-300 dark:ring-emerald-700'
        : cls;
      h += `<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 text-right font-mono ${cellCls}">${formatNumber(val, 2)}</td>`;
    }

    const rhsVal = rhs[i] != null ? rhs[i] : 0;
    h += `<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 text-right font-mono ${cls}">${formatNumber(rhsVal, 2)}</td>`;
    h += '</tr>';
  }

  h += '</tbody></table></div>';

  if (data.pivot_col_var) {
    h += '<div class="border-l-2 border-emerald-400 dark:border-emerald-600 pl-3 space-y-1">';
    h += `<p class="text-xs text-slate-700 dark:text-slate-200"><span class="font-semibold">${__t('pivot.column')}</span> <span class="font-mono text-emerald-700 dark:text-emerald-300">${escHtml(formatMathText(remap(data.pivot_col_var)))}</span></p>`;
    if (data.pivot_col_reason) {
      h += `<p class="text-xs text-slate-600 dark:text-slate-400"><span class="font-semibold">${__t('reason')}</span> ${escHtml(remap(data.pivot_col_reason))}</p>`;
    }
    h += `<p class="text-xs text-slate-600 dark:text-slate-400"><span class="font-semibold">${__t('entering.variable')}</span> <span class="font-mono text-emerald-600 dark:text-emerald-400">${escHtml(formatMathText(remap(data.entering || data.pivot_col_var)))}</span></p>`;
    h += '</div>';
  }

  if (data.ratio_tests && data.ratio_tests.length) {
    h += '<div class="border-l-2 border-amber-400 dark:border-amber-600 pl-3 space-y-1">';
    h += '<p class="text-xs font-semibold text-slate-700 dark:text-slate-200">' + __t('ratio.test') + '</p>';
    for (const rt of data.ratio_tests) {
      const label = escHtml(formatMathText(remap(rt.label)));
      if (rt.skipped) {
        h += `<p class="text-xs text-slate-500 dark:text-slate-500"><span class="font-mono">${label}</span>: ${__t('ignored')} (${escHtml(remap(rt.reason))})</p>`;
      } else {
        h += `<p class="text-xs text-slate-600 dark:text-slate-400"><span class="font-mono">${label}</span>: ${formatNumber(rt.rhs, 2)} / ${formatNumber(rt.pivot_col_val, 2)} = <span class="font-medium text-slate-800 dark:text-slate-200">${formatNumber(rt.ratio, 4)}</span></p>`;
      }
    }
    h += '</div>';
  }

  if (data.pivot_row_label) {
    h += '<div class="border-l-2 border-emerald-400 dark:border-emerald-600 pl-3 space-y-1">';
    h += `<p class="text-xs text-slate-700 dark:text-slate-200"><span class="font-semibold">${__t('pivot.row')}</span> <span class="font-mono text-emerald-700 dark:text-emerald-300">${escHtml(formatMathText(remap(data.pivot_row_label)))}</span></p>`;
    if (data.pivot_row_reason) {
      h += `<p class="text-xs text-slate-600 dark:text-slate-400"><span class="font-semibold">${__t('reason')}</span> ${escHtml(remap(data.pivot_row_reason))}</p>`;
    }
    h += `<p class="text-xs text-slate-600 dark:text-slate-400"><span class="font-semibold">${__t('leaving.variable')}</span> <span class="font-mono text-rose-600 dark:text-rose-400">${escHtml(formatMathText(remap(data.leaving || '')))}</span></p>`;
    h += '</div>';
  }

  if (data.pivot_val !== undefined) {
    h += `<p class="text-xs text-slate-600 dark:text-slate-400"><span class="font-semibold">${__t('pivot.element')}</span> <span class="font-mono font-semibold">${formatNumber(data.pivot_val, 4)}</span></p>`;
  }

  if (data.objective_value !== undefined) {
    h += `<p class="text-xs text-slate-600 dark:text-slate-400"><span class="font-semibold">${__t('objective.value')}</span> <span class="font-mono font-semibold">${formatNumber(data.objective_value, 4)}</span></p>`;
  }

  h += '</div>';
  return h;
}

function renderStepType_optimality_check(data, varNames) {
  let h = '<div class="space-y-3">';
  const remap = s => remapStepVarNames(String(s || ''), varNames);

  const numVars = data.num_vars || 0;

  if (data.explanation) {
    h += `<p class="text-xs text-emerald-700 dark:text-emerald-300 font-medium">${escHtml(remap(data.explanation))}</p>`;
  }

  if (data.z_row && data.z_row.length) {
    const zHeaders = [];
    for (let j = 0; j < numVars; j++) {
      const name = (varNames && j < varNames.length) ? varNames[j] : `x${j + 1}`;
      zHeaders.push(formatVariableName(name));
    }
    for (let j = numVars; j < data.z_row.length; j++) {
      zHeaders.push(`s${j - numVars + 1}`);
    }
    const zRows = [data.z_row.map((val) => formatNumber(val, 2))];
    h += renderTable(zHeaders, zRows, __t('objective.row') + ' Row');
  }

  if (data.basis_values && data.basis_values.length) {
    const basisRows = data.basis_values.map((row) => [formatMathText(remap(row.name)), formatNumber(row.value, 2)]);
    h += renderTable([__t('variable'), __t('value')], basisRows, __t('basis', 'Basis') + ' ' + __t('variable') + 's');
  }

  if (data.variables) {
    const variableRows = Object.entries(data.variables).map(([name, val]) => [formatVariableName(remap(name)), formatNumber(val, 2)]);
    h += renderTable([__t('variable'), __t('value')], variableRows, __t('decision.variables'));
  }

  if (data.constraint_analysis && data.constraint_analysis.length) {
    const slackRows = data.constraint_analysis.map((row) => [remap(row.constraint), formatNumber(row.slack, 2)]);
    h += renderTable([__t('constraint'), __t('slack')], slackRows, __t('slack') + ' ' + __t('value') + 's');
  }

  if (data.optimal_value !== undefined) {
    h += `<p class="text-xs text-slate-600 dark:text-slate-400"><span class="font-semibold">${__t('objective.row')} =</span> <span class="font-mono font-bold text-indigo-600 dark:text-indigo-400">${formatNumber(data.optimal_value, 2)}</span></p>`;
  }

  h += '</div>';
  return h;
}
