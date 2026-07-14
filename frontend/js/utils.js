

function syncTableWidth(tableEl, numVars, fixedWidth, varWidth) {
  if (!tableEl) return;
  tableEl.style.width = '100%';
  tableEl.style.minWidth = (fixedWidth + numVars * varWidth) + 'px';
}

function isDarkMode() {
  return true;
}

const STEP_DESC_MAP = {
  'Problem is infeasible': 'step.problem.infeasible',
  'Problem is unbounded': 'step.problem.unbounded',
  'Solver did not solve the problem': 'step.solver.not_solved',
  'Solver encountered a numerical issue': 'step.solver.numerical_issue',
  'LP relaxation is unbounded': 'step.lp.relaxation.unbounded',
  'Primal problem is infeasible': 'step.primal.infeasible',
  'Primal problem is unbounded': 'step.primal.unbounded',
  'Row reduction: subtract the smallest value in each row from every cell in that row': 'step.row.reduction',
  'Column reduction: subtract the smallest value in each column from every cell in that column': 'step.col.reduction',
  'Optimality Check': 'step.optimality.check',
  'Problem is not optimal, cannot perform sensitivity analysis': 'step.sensitivity.not_optimal',
  'Computed shadow prices for constraints': 'step.sensitivity.shadow_prices',
  'Computed reduced costs for variables': 'step.sensitivity.reduced_costs',
  'Estimated RHS ranges': 'step.sensitivity.rhs_ranges',
  'Estimated objective coefficient ranges': 'step.sensitivity.obj_ranges',
};

function translateStepDescription(desc) {
  if (!desc) return desc;
  const key = STEP_DESC_MAP[desc];
  return key ? __t(key, desc) : desc;
}

function formatNumber(n, decimals) {
  if (n === undefined || n === null || isNaN(n)) return '-';
  const num = Number(n);
  if (decimals !== undefined) return num.toFixed(decimals).replace(/\.0+$/, '');
  if (Number.isInteger(num)) return String(num);
  return num.toFixed(2).replace(/\.?0+$/, '');
}

function toSubscriptDigits(value) {
  const subscripts = {
    '0': '₀',
    '1': '₁',
    '2': '₂',
    '3': '₃',
    '4': '₄',
    '5': '₅',
    '6': '₆',
    '7': '₇',
    '8': '₈',
    '9': '₉',
  };
  return String(value).replace(/[0-9]/g, digit => subscripts[digit] || digit);
}

function formatVariableName(name) {
  return String(name || '').replace(/\b([a-z])(\d+)\b/g, (_match, prefix, digits) => `${prefix}${toSubscriptDigits(digits)}`);
}

function formatMathText(value) {
  return formatVariableName(value);
}

function formatLinearExpressionText(coefficients, variableNames) {
  const parts = (coefficients || []).map((coeff, idx) => {
    const num = Number(coeff);
    if (!Number.isFinite(num) || Math.abs(num) < 1e-9) return null;
    const name = (variableNames && variableNames[idx]) || `x${idx + 1}`;
    const magnitude = Math.abs(num);
    const term = `${magnitude === 1 ? '' : formatNumber(magnitude)}${formatVariableName(name)}`;
    return { sign: num < 0 ? '-' : '+', term };
  }).filter(Boolean);

  return parts.map((part, idx) => {
    if (idx === 0) return (part.sign === '-' ? '-' : '') + part.term;
    return ` ${part.sign} ${part.term}`;
  }).join('') || '0';
}

function remapStepVarNames(text, varNames) {
  if (!varNames || !varNames.length) return text;
  return text.replace(/\bx(\d+)\b/g, (match, digits) => {
    const idx = parseInt(digits, 10) - 1;
    return (idx >= 0 && idx < varNames.length) ? varNames[idx] : match;
  });
}

function formatConstraintEquation(row, variableNames) {
  const rhs = row && row.rhs !== undefined && row.rhs !== '' ? formatNumber(Number(row.rhs)) : '0';
  return `${formatLinearExpressionText(row ? row.cells : [], variableNames)} ${(row && row.sign) || '<='} ${rhs}`;
}

function formatObjectiveEquation(direction, coefficients, variableNames, objectiveName = 'Z') {
  const label = direction === 'min' ? __t('minimize') : __t('maximize');
  return `${label} ${formatVariableName(objectiveName)} = ${formatLinearExpressionText(coefficients, variableNames)}`;
}

function renderTable(headers, rows, title) {
  let html = '';
  if (title) html += `<h4 class="font-semibold text-sm mb-2 text-slate-800 dark:text-slate-100">${escHtml(title)}</h4>`;
  html += '<div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700"><table class="min-w-full text-xs border-collapse bg-white dark:bg-slate-900">';
  html += '<thead><tr class="bg-slate-100 dark:bg-slate-800">';
  headers.forEach(h => { html += `<th class="border border-slate-300 dark:border-slate-600 px-2 py-1 text-left font-semibold text-slate-700 dark:text-slate-200">${escHtml(formatMathText(h))}</th>`; });
  html += '</tr></thead><tbody>';
  rows.forEach((row, i) => {
    html += `<tr class="${i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-900/70'}">`;
    row.forEach(cell => { html += `<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 text-slate-700 dark:text-slate-300">${escHtml(formatMathText(cell))}</td>`; });
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

function _isEpsilon(v) {
  return v > 0 && v < 1e-4;
}

function _fmtEpsilon(v) {
  return _isEpsilon(v) ? 'ε' : formatNumber(v, 2);
}

function renderMatrix(matrix, highlight, epsilonSet) {
  if (!matrix || !matrix.length) return '<p class="text-xs text-slate-500 dark:text-slate-400">'+__t('no.data')+'</p>';
  let html = '<div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700"><table class="min-w-full text-xs border-collapse bg-white dark:bg-slate-900">';
  for (let i = 0; i < matrix.length; i++) {
    html += '<tr>';
    for (let j = 0; j < matrix[i].length; j++) {
      const val = matrix[i][j];
      const isEps = epsilonSet && epsilonSet.has(i + ',' + j);
      const isHL = highlight && highlight[i] === j;
      const cls = isHL
        ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-950 dark:text-emerald-100 font-bold ring-1 ring-emerald-300 dark:ring-emerald-700'
        : (i % 2 === 0 ? 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300' : 'bg-slate-50 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300');
      const display = isEps ? 'ε' : _fmtEpsilon(val);
      html += `<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 ${cls}">${display}</td>`;
    }
    html += '</tr>';
  }
  html += '</table></div>';
  return html;
}

function renderMatrixWithCover(matrix, coveredRows, coveredCols) {
  if (!matrix || !matrix.length) return '<p class="text-xs text-slate-500 dark:text-slate-400">'+__t('no.data')+'</p>';
  const rows = new Set(coveredRows || []);
  const cols = new Set(coveredCols || []);
  let html = '<div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700"><table class="min-w-full text-xs border-collapse bg-white dark:bg-slate-900">';
  for (let i = 0; i < matrix.length; i++) {
    html += '<tr>';
    for (let j = 0; j < matrix[i].length; j++) {
      const val = matrix[i][j];
      const rowCovered = rows.has(i);
      const colCovered = cols.has(j);
      let cls = 'border border-slate-300 dark:border-slate-700 px-2 py-1';
      if (rowCovered && colCovered) {
        cls += ' bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 ring-1 ring-amber-300 dark:ring-amber-700';
      } else if (rowCovered) {
        cls += ' bg-sky-100 dark:bg-sky-950/50 text-sky-800 dark:text-sky-200';
      } else if (colCovered) {
        cls += ' bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-200';
      } else {
        cls += i % 2 === 0 ? ' bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300' : ' bg-slate-50 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300';
      }
      html += `<td class="${cls}">${formatNumber(val, 2)}</td>`;
    }
    html += '</tr>';
  }
  html += '</table></div>';

  const legendHtml = '<div class="flex flex-wrap gap-3 mt-2 text-xs text-slate-600 dark:text-slate-400">'
    + '<span class="inline-flex items-center gap-1"><span class="inline-block w-3 h-3 rounded bg-sky-100 dark:bg-sky-950/50 border border-sky-300 dark:border-sky-700"></span> '+__t('matrix.covered.row')+'</span>'
    + '<span class="inline-flex items-center gap-1"><span class="inline-block w-3 h-3 rounded bg-purple-100 dark:bg-purple-950/50 border border-purple-300 dark:border-purple-700"></span> '+__t('matrix.covered.column')+'</span>'
    + '<span class="inline-flex items-center gap-1"><span class="inline-block w-3 h-3 rounded bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700"></span> '+__t('matrix.intersection')+'</span>'
    + '</div>';

  return html + legendHtml;
}

function renderMatrixWithCosts(costs, allocation, sourceNames, destNames) {
  if (!costs || !costs.length || !allocation || !allocation.length) return '<p class="text-xs text-slate-500 dark:text-slate-400">'+__t('no.data')+'</p>';
  const rows = costs.length;
  const cols = costs[0] ? costs[0].length : 0;
  let html = '<div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700"><table class="min-w-full text-xs border-collapse bg-white dark:bg-slate-900">';
  html += '<thead><tr><th class="border border-slate-300 dark:border-slate-600 px-2 py-1 bg-slate-100 dark:bg-slate-800"></th>';
  for (let j = 0; j < cols; j++) {
    const name = (destNames && j < destNames.length) ? destNames[j] : `D${j + 1}`;
    html += `<th class="border border-slate-300 dark:border-slate-600 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold">${escHtml(name)}</th>`;
  }
  html += '</tr></thead><tbody>';
  for (let i = 0; i < rows; i++) {
    html += '<tr>';
    const sName = (sourceNames && i < sourceNames.length) ? sourceNames[i] : `S${i + 1}`;
    html += `<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200">${escHtml(sName)}</td>`;
    for (let j = 0; j < cols; j++) {
      const cost = costs[i] !== undefined && costs[i][j] !== undefined ? costs[i][j] : '';
      const alloc = allocation[i] !== undefined && allocation[i][j] !== undefined ? allocation[i][j] : 0;
      html += '<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 text-center">';
      html += `<div class="text-slate-500 dark:text-slate-400">${escHtml(String(cost))}</div>`;
      if (alloc > 0) {
        html += `<div class="font-bold text-indigo-600 dark:text-indigo-400">${escHtml(String(alloc))}</div>`;
      } else {
        html += '<div class="text-slate-300 dark:text-slate-600">—</div>';
      }
      html += '</td>';
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
}

function renderSteps(steps, varNames) {
  if (!steps || steps.length === 0) return '<p class="text-slate-500 dark:text-slate-400 text-sm">'+__t('no.steps')+'</p>';
  let html = '<div class="space-y-2">';
  steps.forEach((step, idx) => {
    const isOptCheck = step.data && step.data._step_type === 'optimality_check';
    const translatedDesc = translateStepDescription(remapStepVarNames(step.description || '', varNames));
    const stepLabel = isOptCheck ? escHtml(formatMathText(translatedDesc)) : `${__t('step')} ${idx + 1}: ${escHtml(formatMathText(translatedDesc))}`;
    html += `<details open class="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
      <summary class="w-full text-left px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-between text-sm font-medium text-slate-800 dark:text-slate-100 transition cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span>${stepLabel}</span>
        <svg class="w-4 h-4 transition-transform text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
      </summary>
      <div class="p-4 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-300">`;
    html += renderStepData(step.data, varNames);
    html += `</div></details>`;
  });
  html += '</div>';
  return html;
}

function renderOperation(text) {
  return `<div class="border-l-4 border-indigo-400 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 pl-3 py-2 text-xs text-indigo-800 dark:text-indigo-200 rounded-r-md">${escHtml(text)}</div>`;
}

function renderStepType_max_to_min(data) {
  let h = '<div class="space-y-3">';
  h += '<table class="text-xs"><tbody>';
  h += `<tr><td class="pr-4 font-medium text-slate-700 dark:text-slate-300">${__t('optimization')}</td><td class="text-slate-600 dark:text-slate-400">${escHtml(data.optimization || 'max')}</td></tr>`;
  if (data.dimensions) {
    h += `<tr><td class="pr-4 font-medium text-slate-700 dark:text-slate-300">${__t('workers')}</td><td class="text-slate-600 dark:text-slate-400">${escHtml(String(data.dimensions.workers))}</td></tr>`;
    h += `<tr><td class="pr-4 font-medium text-slate-700 dark:text-slate-300">${__t('tasks')}</td><td class="text-slate-600 dark:text-slate-400">${escHtml(String(data.dimensions.tasks))}</td></tr>`;
  }
  h += '</tbody></table>';
  h += `<p class="text-xs font-medium text-slate-700 dark:text-slate-300">${__t('method')} ${escHtml(data.conversion_method || '')}</p>`;
  h += '<div><span class="font-semibold text-sm text-slate-700 dark:text-slate-200">' + __t('original.profit.matrix') + '</span>' + renderMatrix(data.original_matrix) + '</div>';
  h += '<div><span class="font-semibold text-sm text-slate-700 dark:text-slate-200">' + __t('converted.matrix.minimization') + '</span>' + renderMatrix(data.converted_matrix) + '</div>';
  h += '</div>';
  return h;
}

function renderStepType_problem_statement(data) {
  let h = '<div class="space-y-2">';
  h += '<table class="text-xs"><tbody>';
  h += `<tr><td class="pr-4 font-medium text-slate-700 dark:text-slate-300">${__t('optimization')}</td><td class="text-slate-600 dark:text-slate-400">${escHtml(data.optimization || 'min')}</td></tr>`;
  if (data.dimensions) {
    h += `<tr><td class="pr-4 font-medium text-slate-700 dark:text-slate-300">${__t('workers')}</td><td class="text-slate-600 dark:text-slate-400">${escHtml(String(data.dimensions.workers))}</td></tr>`;
    h += `<tr><td class="pr-4 font-medium text-slate-700 dark:text-slate-300">${__t('tasks')}</td><td class="text-slate-600 dark:text-slate-400">${escHtml(String(data.dimensions.tasks))}</td></tr>`;
  }
  h += '</tbody></table>';
  h += '<div><span class="font-semibold text-sm text-slate-700 dark:text-slate-200">' + __t('cost.matrix.label') + '</span>' + renderMatrix(data.original_matrix) + '</div>';
  h += '</div>';
  return h;
}

function renderStepType_row_reduction(data) {
  let h = '<div class="space-y-3">';
  h += renderOperation(data.operation || __t('row.reduction.operation'));
  if (data.row_minima) {
    const rows = data.row_minima.map((v, i) => [__t('row') + ' ' + (i + 1), formatNumber(v, 2)]);
    h += renderTable([__t('row'), __t('min.value')], rows, __t('row.minima'));
  }
  h += '<div><span class="font-semibold text-sm text-slate-700 dark:text-slate-200">' + __t('before.row.reduction') + '</span>' + renderMatrix(data.matrix_before) + '</div>';
  h += '<div><span class="font-semibold text-sm text-slate-700 dark:text-slate-200">' + __t('after.row.reduction') + '</span>' + renderMatrix(data.matrix_after) + '</div>';
  h += '</div>';
  return h;
}

function renderStepType_col_reduction(data) {
  let h = '<div class="space-y-3">';
  h += renderOperation(data.operation || __t('col.reduction.operation'));
  if (data.column_minima) {
    const rows = data.column_minima.map((v, j) => [__t('column') + ' ' + (j + 1), formatNumber(v, 2)]);
    h += renderTable([__t('column'), __t('min.value')], rows, __t('column.minima'));
  }
  h += '<div><span class="font-semibold text-sm text-slate-700 dark:text-slate-200">' + __t('before.col.reduction') + '</span>' + renderMatrix(data.matrix_before) + '</div>';
  h += '<div><span class="font-semibold text-sm text-slate-700 dark:text-slate-200">' + __t('after.col.reduction') + '</span>' + renderMatrix(data.matrix_after) + '</div>';
  h += '</div>';
  return h;
}

function renderStepType_line_drawing(data) {
  let h = '<div class="space-y-3">';
  h += `<p class="text-xs text-slate-600 dark:text-slate-400">${__t('lines.used')} <span class="font-bold text-slate-800 dark:text-slate-200">${escHtml(String(data.lines_count))}</span>`;
  if (data.covered_rows && data.covered_rows.length) {
    h += ` ${__t('covered.rows')} <span class="font-mono">${data.covered_rows.map(r => `R${r + 1}`).join(', ')}</span>`;
  } else {
    h += ' ' + __t('no.rows.covered');
  }
  if (data.covered_cols && data.covered_cols.length) {
    h += ` ${__t('covered.columns')} <span class="font-mono">${data.covered_cols.map(c => `C${c + 1}`).join(', ')}</span>`;
  } else {
    h += ' ' + __t('no.columns.covered');
  }
  h += '</p>';

  h += '<div><span class="font-semibold text-sm text-slate-700 dark:text-slate-200">' + __t('matrix.with.lines') + '</span>'
    + renderMatrixWithCover(data.matrix_before, data.covered_rows, data.covered_cols)
    + '</div>';

  if (data.is_optimal) {
    h += `<div class="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-3 py-2 rounded text-xs font-medium">${escHtml(data.operation || __t('optimal.assignment.found'))}</div>`;
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

function _buildEpsilonSet(matrix) {
  const s = new Set();
  if (!matrix) return s;
  for (let i = 0; i < matrix.length; i++)
    for (let j = 0; j < (matrix[i] || []).length; j++)
      if (_isEpsilon(matrix[i][j])) s.add(i + ',' + j);
  return s;
}

function renderStepType_modi_iteration(data) {
  const costs = data.costs || [];
  const allocBefore = data.allocation_before || [];
  const u = data.u_values || [];
  const v = data.v_values || [];
  const supply = data.supply || [];
  const demand = data.demand || [];
  const rows = u.length;
  const cols = v.length;

  const srcLabels = u.map((_, i) => `S${i + 1}`);
  const dstLabels = v.map((_, j) => `D${j + 1}`);

  let h = '<div class="space-y-3">';

  const epsBefore = _buildEpsilonSet(allocBefore);
  const loop = data.loop_path || [];

  function _occupied(i, j) {
    return (allocBefore[i] && allocBefore[i][j] > 0) || epsBefore.has(i + ',' + j);
  }

  function _renderTableau(title, note, showOccupied, valueMatrix, highlight) {
    const vals = valueMatrix || costs;
    let html = `<div><span class="font-semibold text-sm text-slate-700 dark:text-slate-200">${escHtml(title)}</span>`;
    if (note) html += `<div class="text-xs text-slate-500 dark:text-slate-400 mb-1">${note}</div>`;
    html += '<div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700"><table class="min-w-full text-xs border-collapse bg-white dark:bg-slate-900">';
    html += '<thead><tr><th class="border border-slate-300 dark:border-slate-600 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-center"></th>';
    for (let j = 0; j < cols; j++) {
      html += `<th class="border border-slate-300 dark:border-slate-600 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-center">${escHtml(dstLabels[j])}</th>`;
    }
    html += '</tr></thead><tbody>';
    for (let i = 0; i < rows; i++) {
      html += '<tr>';
      const uVal = u[i] !== undefined ? u[i] : 0;
      html += `<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 text-center font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">${formatNumber(uVal, 2)}</td>`;
      for (let j = 0; j < cols; j++) {
        const val = vals[i] !== undefined && vals[i][j] !== undefined ? vals[i][j] : '';
        const isOcc = _occupied(i, j);
        const show = showOccupied === true ? isOcc : (showOccupied === false ? !isOcc : true);
        const isHL = highlight && highlight[i] === j;
        let cls = show
          ? (isHL
              ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-100 font-bold ring-1 ring-rose-300 dark:ring-rose-700'
              : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-800 dark:text-zinc-100')
          : '';
        html += `<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 text-center ${cls}">`;
        if (show) {
          html += `<div class="font-semibold">${escHtml(String(val))}</div>`;
          if (showOccupied === false) {
            const uvVal = (u[i] !== undefined ? u[i] : 0) + (v[j] !== undefined ? v[j] : 0);
            html += `<div class="text-xs text-slate-400 dark:text-slate-500">${formatNumber(uvVal, 2)}</div>`;
          }
        }
        html += '</td>';
      }
      html += '</tr>';
    }
    html += '<tr>';
    html += '<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">uᵢ/vⱼ</td>';
    for (let j = 0; j < cols; j++) {
      const vVal = v[j] !== undefined ? v[j] : 0;
      html += `<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 text-center font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">${formatNumber(vVal, 2)}</td>`;
    }
    html += '</tr>';
    html += '</tbody></table></div></div>';
    return html;
  }

  // ---- Total cost ----
  const costTerms = [];
  let totalCost = 0;
  for (let i = 0; i < costs.length; i++) {
    for (let j = 0; j < (costs[i] || []).length; j++) {
      const a = allocBefore[i] !== undefined && allocBefore[i][j] !== undefined ? allocBefore[i][j] : 0;
      if (a > 0) {
        costTerms.push(`${costs[i][j]}(${a})`);
        totalCost += costs[i][j] * a;
      }
    }
  }
  h += '<div class="text-xs"><span class="font-semibold text-slate-700 dark:text-slate-200">' + __t('total.cost') + '</span> ';
  h += `<span class="font-mono text-slate-600 dark:text-slate-400">${costTerms.join(' + ')}</span>`;
  h += ` <span class="font-bold text-indigo-600 dark:text-indigo-400">= ${formatNumber(totalCost, 2)}</span></div>`;

  h += _renderTableau(__t('current.tableau'), __t('tableau.occupied.note'), true);
  h += _renderTableau(__t('unoccupied.cells'), __t('tableau.unoccupied.note'), false);

  // ---- Opportunity costs ----
  const opp = data.opportunity_costs || [];
  const entering = data.entering_cell;
  const enteringSet = entering ? {[entering[0]]: entering[1]} : {};

  h += _renderTableau(__t('opportunity.costs'), __t('opportunity.note'), null, opp, enteringSet);

  // ---- Optimal or iterate ----
  if (data.is_optimal) {
    h += '<div class="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-3 py-2 rounded text-xs font-medium">' + __t('optimal.reached') + '</div>';
  } else if (entering) {
    const [ei, ej] = entering;
    const minD = data.entering_opportunity_cost;
    h += '<div class="space-y-2 text-xs">';
    h += `<p class="text-slate-700 dark:text-slate-300">${__t('most.negative')} <span class="font-bold text-rose-600 dark:text-rose-400">d(${srcLabels[ei]}, ${dstLabels[ej]}) = ${formatNumber(minD, 2)}</span> ${__t('enters.basis')}</p>`;

    // ---- Loop with +/- ----
    if (loop.length >= 4) {
      h += '<div><span class="font-semibold text-sm text-slate-700 dark:text-slate-200">' + __t('loop.title') + '</span>';
      h += '<div class="text-xs text-slate-500 dark:text-slate-400 mb-1">' + __t('loop.alternating') + '</div>';
      h += '<div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700"><table class="min-w-full text-xs border-collapse bg-white dark:bg-slate-900">';
      h += '<thead><tr><th class="border border-slate-300 dark:border-slate-600 px-2 py-1 bg-slate-100 dark:bg-slate-800"></th>';
      for (let j = 0; j < cols; j++) {
        h += `<th class="border border-slate-300 dark:border-slate-600 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-center">${escHtml(dstLabels[j])}</th>`;
      }
      h += '</tr></thead><tbody>';
      for (let i = 0; i < rows; i++) {
        h += '<tr>';
        h += `<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 font-semibold bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200">${escHtml(srcLabels[i])}</td>`;
        for (let j = 0; j < cols; j++) {
          const alloc = allocBefore[i] !== undefined && allocBefore[i][j] !== undefined ? allocBefore[i][j] : 0;
          const isEps = epsBefore.has(i + ',' + j);
          const loopIdx = loop.findIndex(p => p[0] === i && p[1] === j);
          const inLoop = loopIdx >= 0;
          let sign = '';
          let signCls = '';
          if (inLoop) {
            sign = loopIdx % 2 === 0 ? '+' : '\u2212';
            signCls = loopIdx % 2 === 0
              ? 'bg-emerald-100 dark:bg-emerald-950/70 ring-1 ring-emerald-300 dark:ring-emerald-700'
              : 'bg-rose-100 dark:bg-rose-950/70 ring-1 ring-rose-300 dark:ring-rose-700';
          }

          h += `<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 text-center ${signCls}">`;
          if (isEps) {
            h += '<div class="font-bold text-amber-500 dark:text-amber-400">\u03b5</div>';
          } else if (alloc > 0) {
            h += `<div class="font-bold text-indigo-600 dark:text-indigo-400">${escHtml(String(alloc))}</div>`;
          } else {
            h += '<div class="text-slate-300 dark:text-slate-600">\u2014</div>';
          }
          if (inLoop) {
            h += `<div class="text-xs font-bold ${loopIdx % 2 === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">${sign}</div>`;
          }
          h += '</td>';
        }
        // skip supply/penalty cols in loop table
        h += '</tr>';
      }
      h += '</table></div></div>';

      // Theta
      if (data.theta !== null && data.theta !== undefined) {
        const theta = data.theta;
        // Find which cells are (-) in the loop (odd indices)
        const minusCells = [];
        for (let k = 1; k < loop.length - 1; k += 2) {
          minusCells.push(`(${loop[k][0]},${loop[k][1]})`);
        }
        const minusStr = minusCells.join(', ');
        h += `<p class="text-xs text-slate-700 dark:text-slate-300">${__t('theta.formula')}{${escHtml(minusStr)}} = <span class="font-bold text-indigo-600 dark:text-indigo-400">${formatNumber(theta, 2)}</span></p>`;
      }
    } else if (loop.length > 0) {
      h += `<p class="text-xs text-slate-500 dark:text-slate-400">${__t('loop.too.short')}</p>`;
    }

    // ---- Updated allocation ----
    if (data.allocation_after) {
      const epsAfter = _buildEpsilonSet(data.allocation_after);
      h += '<div><span class="font-semibold text-sm text-slate-700 dark:text-slate-200">' + __t('updated.allocation') + '</span>';
      h += '<div class="text-xs text-slate-500 dark:text-slate-400 mb-1">' + __t('allocation.plusminus') + '</div>';
      h += renderMatrix(data.allocation_after, null, epsAfter) + '</div>';
    }
    h += '</div>';
  }

  h += '</div>';
  return h;
}

function renderMatrixWithHighlight(matrix, highlight) {
  if (!matrix || !matrix.length) return '<p class="text-xs text-slate-500 dark:text-slate-400">'+__t('no.data')+'</p>';
  let html = '<div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700"><table class="min-w-full text-xs border-collapse bg-white dark:bg-slate-900">';
  for (let i = 0; i < matrix.length; i++) {
    html += '<tr>';
    for (let j = 0; j < matrix[i].length; j++) {
      const val = matrix[i][j];
      const isHL = highlight && highlight[i] === j;
      const cls = isHL
        ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-100 font-bold ring-1 ring-rose-300 dark:ring-rose-700'
        : (i % 2 === 0 ? 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300' : 'bg-slate-50 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300');
      html += `<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 ${cls}">${formatNumber(val, 2)}</td>`;
    }
    html += '</tr>';
  }
  html += '</table></div>';
  return html;
}

function renderStepType_result(data) {
  let h = '<div class="space-y-3">';
  if (data.matrix) {
    const highlight = {};
    if (data.assignment) {
      data.assignment.forEach((col, row) => { if (col >= 0) highlight[row] = col; });
    }
    h += '<div><span class="font-semibold text-sm text-slate-700 dark:text-slate-200">' + __t('final.reduced.matrix') + '</span>'
      + renderMatrix(data.matrix, highlight)
      + '</div>';
  }
  if (data.assignment) {
    const rows = data.assignment.map((a, i) => [__t('task') + ' ' + (i + 1), a >= 0 ? __t('worker.label') + ' ' + (a + 1) : __t('unassigned')]);
    h += renderTable([__t('task'), __t('assigned.to')], rows, __t('assignments'));
  }
  if (data.assignment_pairs && data.assignment_pairs.length) {
    const rows = data.assignment_pairs.map(p => [escHtml(p[0] || ''), escHtml(p[1] || '')]);
    h += renderTable([__t('worker.label'), __t('task')], rows, __t('assignment.pairs'));
  }
  if (data.total !== undefined) {
    const label = data.optimization === 'max' ? __t('total.profit') : __t('total.cost');
    h += `<p class="text-sm font-bold text-indigo-600 dark:text-indigo-400">${escHtml(label)}: ${formatNumber(data.total, 2)}</p>`;
  }
  h += '</div>';
  return h;
}

function renderStepType_vogel_iteration(data) {
  const costs = data.costs || [];
  const alloc = data.allocation || [];
  const supply = data.supply_remaining || [];
  const demand = data.demand_remaining || [];
  const rowPen = data.row_penalties || [];
  const colPen = data.col_penalties || [];
  const selRow = data.row;
  const selCol = data.col;
  if (!costs.length || !costs[0]) return '<p class="text-xs text-slate-500 dark:text-slate-400">'+__t('no.data')+'</p>';

  const rows = costs.length;
  const cols = costs[0].length;
  const srcLabels = costs.map((_, i) => `S${i + 1}`);
  const dstLabels = costs[0].map((_, j) => `D${j + 1}`);

  let h = '<div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700"><table class="min-w-full text-xs border-collapse bg-white dark:bg-slate-900">';
  h += '<thead><tr>';
  h += '<th class="border border-slate-300 dark:border-slate-600 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold"></th>';
  dstLabels.forEach(d => { h += `<th class="border border-slate-300 dark:border-slate-600 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold">${escHtml(d)}</th>`; });
  h += '<th class="border border-slate-300 dark:border-slate-600 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold">' + __t('supply') + '</th>';
  h += '<th class="border border-slate-300 dark:border-slate-600 px-2 py-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 font-semibold">' + __t('penalty') + '</th>';
  h += '</tr></thead><tbody>';

  for (let i = 0; i < rows; i++) {
    h += '<tr>';
    h += `<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 font-semibold bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200">${escHtml(srcLabels[i])}</td>`;
    for (let j = 0; j < cols; j++) {
      const isSel = (i === selRow && j === selCol);
      const costVal = costs[i] !== undefined && costs[i][j] !== undefined ? costs[i][j] : '';
      const allocVal = alloc[i] !== undefined && alloc[i][j] !== undefined ? alloc[i][j] : 0;
      const isEps = _isEpsilon(allocVal);
      const cellCls = isSel
        ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-100 ring-1 ring-emerald-300 dark:ring-emerald-700'
        : (i % 2 === 0 ? 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300' : 'bg-slate-50 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300');
      h += `<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 text-center ${cellCls}">`;
      h += `<div class="${isSel ? 'text-emerald-700 dark:text-emerald-200' : 'text-slate-500 dark:text-slate-400'}">${escHtml(String(costVal))}</div>`;
      if (isEps) {
        h += '<div class="font-bold text-amber-500 dark:text-amber-400">ε</div>';
      } else if (allocVal > 0) {
        h += `<div class="font-bold text-indigo-600 dark:text-indigo-400">${escHtml(String(allocVal))}</div>`;
      } else {
        h += '<div class="text-slate-300 dark:text-slate-600">—</div>';
      }
      h += '</td>';
    }
    h += `<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 text-center font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200">${supply[i] !== undefined ? supply[i] : ''}</td>`;
    const rp = rowPen[i];
    h += `<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 text-center font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">${rp !== undefined && rp >= 0 ? rp : '—'}</td>`;
    h += '</tr>';
  }

  h += '<tr>';
  h += '<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">' + __t('demand') + '</td>';
  for (let j = 0; j < cols; j++) {
    h += `<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 text-center font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200">${demand[j] !== undefined ? demand[j] : ''}</td>`;
  }
  h += '<td class="border border-slate-300 dark:border-slate-700 px-2 bg-slate-100 dark:bg-slate-800"></td>';
  h += '<td class="border border-slate-300 dark:border-slate-700 px-2 bg-slate-100 dark:bg-slate-800"></td>';
  h += '</tr>';

  h += '<tr>';
  h += '<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">' + __t('penalty') + '</td>';
  for (let j = 0; j < cols; j++) {
    const cp = colPen[j];
    h += `<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 text-center font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">${cp !== undefined && cp >= 0 ? cp : '—'}</td>`;
  }
  h += '<td class="border border-slate-300 dark:border-slate-700 px-2 bg-slate-100 dark:bg-slate-800"></td>';
  h += '<td class="border border-slate-300 dark:border-slate-700 px-2 bg-slate-100 dark:bg-slate-800"></td>';
  h += '</tr>';

  h += '</tbody></table></div>';
  return h;
}
function renderStepType_nwcorner_iteration(data) {
  const costs = data.costs || [];
  const alloc = data.allocation || [];
  const supply = data.supply_remaining || [];
  const demand = data.demand_remaining || [];
  const selRow = data.row;
  const selCol = data.col;
  if (!costs.length || !costs[0]) return '<p class="text-xs text-slate-500 dark:text-slate-400">'+__t('no.data')+'</p>';

  const rows = costs.length;
  const cols = costs[0].length;
  const srcLabels = costs.map((_, i) => `S${i + 1}`);
  const dstLabels = costs[0].map((_, j) => `D${j + 1}`);

  let h = '<div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700"><table class="min-w-full text-xs border-collapse bg-white dark:bg-slate-900">';
  h += '<thead><tr>';
  h += '<th class="border border-slate-300 dark:border-slate-600 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold"></th>';
  dstLabels.forEach(d => { h += `<th class="border border-slate-300 dark:border-slate-600 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold">${escHtml(d)}</th>`; });
  h += '<th class="border border-slate-300 dark:border-slate-600 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold">' + __t('supply') + '</th>';
  h += '</tr></thead><tbody>';

  for (let i = 0; i < rows; i++) {
    h += '<tr>';
    h += `<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 font-semibold bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200">${escHtml(srcLabels[i])}</td>`;
    for (let j = 0; j < cols; j++) {
      const isSel = (i === selRow && j === selCol);
      const costVal = costs[i] !== undefined && costs[i][j] !== undefined ? costs[i][j] : '';
      const allocVal = alloc[i] !== undefined && alloc[i][j] !== undefined ? alloc[i][j] : 0;
      const isEps = _isEpsilon(allocVal);
      const cellCls = isSel
        ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-100 ring-1 ring-emerald-300 dark:ring-emerald-700'
        : (i % 2 === 0 ? 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300' : 'bg-slate-50 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300');
      h += `<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 text-center ${cellCls}">`;
      h += `<div class="${isSel ? 'text-emerald-700 dark:text-emerald-200' : 'text-slate-500 dark:text-slate-400'}">${escHtml(String(costVal))}</div>`;
      if (isEps) {
        h += '<div class="font-bold text-amber-500 dark:text-amber-400">ε</div>';
      } else if (allocVal > 0) {
        h += `<div class="font-bold text-indigo-600 dark:text-indigo-400">${escHtml(String(allocVal))}</div>`;
      } else {
        h += '<div class="text-slate-300 dark:text-slate-600">—</div>';
      }
      h += '</td>';
    }
    h += `<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 text-center font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200">${supply[i] !== undefined ? supply[i] : ''}</td>`;
    h += '</tr>';
  }

  h += '<tr>';
  h += '<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">' + __t('demand') + '</td>';
  for (let j = 0; j < cols; j++) {
    h += `<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 text-center font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200">${demand[j] !== undefined ? demand[j] : ''}</td>`;
  }
  h += '<td class="border border-slate-300 dark:border-slate-700 px-2 bg-slate-100 dark:bg-slate-800"></td>';
  h += '</tr>';

  h += '</tbody></table></div>';
  return h;
}

function renderStepType_nwcorner_initial(data) {
  const costs = data.costs || [];
  const alloc = data.allocation || [];
  if (!costs.length || !costs[0]) return '<p class="text-xs text-slate-500 dark:text-slate-400">'+__t('no.data')+'</p>';

  const rows = alloc.length;
  const cols = alloc[0] ? alloc[0].length : 0;

  let h = '<div class="space-y-3">';

  let costTerms = [];
  for (let i = 0; i < alloc.length; i++) {
    for (let j = 0; j < (alloc[i] || []).length; j++) {
      if (alloc[i][j] > 0) {
        costTerms.push(`${costs[i][j]}(${alloc[i][j]})`);
      }
    }
  }
  h += '<div class="text-xs">';
  h += `<span class="font-semibold text-slate-700 dark:text-slate-200">${__t('total.cost')}</span> `;
  h += `<span class="font-mono text-slate-600 dark:text-slate-400">${costTerms.join(' + ')}</span>`;
  h += ` <span class="font-bold text-indigo-600 dark:text-indigo-400">= ${formatNumber(data.total_cost, 2)}</span>`;
  h += '</div>';

  h += '<div><span class="font-semibold text-sm text-slate-700 dark:text-slate-200">' + __t('initial.allocation') + '</span>';
  h += '<div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700"><table class="min-w-full text-xs border-collapse bg-white dark:bg-slate-900">';
  h += '<thead><tr><th class="border border-slate-300 dark:border-slate-600 px-2 py-1 bg-slate-100 dark:bg-slate-800"></th>';
  for (let j = 0; j < cols; j++) {
    h += `<th class="border border-slate-300 dark:border-slate-600 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold">D${j + 1}</th>`;
  }
  h += '</tr></thead><tbody>';
  for (let i = 0; i < rows; i++) {
    h += '<tr>';
    h += `<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200">S${i + 1}</td>`;
    for (let j = 0; j < cols; j++) {
      const cost = costs[i] !== undefined && costs[i][j] !== undefined ? costs[i][j] : '';
      const allocVal = alloc[i] !== undefined && alloc[i][j] !== undefined ? alloc[i][j] : 0;
      h += '<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 text-center">';
      h += `<div class="text-slate-500 dark:text-slate-400">${escHtml(String(cost))}</div>`;
      if (allocVal > 0) {
        h += `<div class="font-bold text-indigo-600 dark:text-indigo-400">${escHtml(String(allocVal))}</div>`;
      } else {
        h += '<div class="text-slate-300 dark:text-slate-600">—</div>';
      }
      h += '</td>';
    }
    h += '</tr>';
  }
  h += '</tbody></table></div></div>';
  h += '</div>';
  return h;
}

function renderStepType_vogel_initial(data) {
  const costs = data.costs || [];
  const alloc = data.allocation || [];
  if (!costs.length || !costs[0]) return '<p class="text-xs text-slate-500 dark:text-slate-400">'+__t('no.data')+'</p>';
  const epsSet = new Set();
  for (let i = 0; i < alloc.length; i++)
    for (let j = 0; j < (alloc[i] || []).length; j++)
      if (_isEpsilon(alloc[i][j])) epsSet.add(i + ',' + j);

  const rows = alloc.length;
  const cols = alloc[0] ? alloc[0].length : 0;

  let h = '<div class="space-y-3">';
  const occupied = data.occupied;
  const needed = data.needed;

  let costTerms = [];
  for (let i = 0; i < alloc.length; i++) {
    for (let j = 0; j < (alloc[i] || []).length; j++) {
      if (alloc[i][j] > 0) {
        costTerms.push(`${costs[i][j]}(${alloc[i][j]})`);
      }
    }
  }
  h += '<div class="text-xs">';
  h += `<span class="font-semibold text-slate-700 dark:text-slate-200">${__t('total.cost')}</span> `;
  h += `<span class="font-mono text-slate-600 dark:text-slate-400">${costTerms.join(' + ')}</span>`;
  h += ` <span class="font-bold text-indigo-600 dark:text-indigo-400">= ${formatNumber(data.total_cost, 2)}</span>`;
  h += '<br><span class="font-semibold text-slate-700 dark:text-slate-200">' + __t('degeneracy.check') + '</span>';
  h += '<br><span class="font-mono text-slate-600 dark:text-slate-400 ml-4">m + n − 1 = ' + costs.length + ' + ' + costs[0].length + ' − 1 = ' + needed + '</span>';
  h += '<br><span class="font-mono text-slate-600 dark:text-slate-400 ml-4">' + __t('occupied.cells') + occupied + '</span>';
  h += '<br><span class="ml-4 font-semibold ' + (occupied < needed ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400') + '">' + occupied + ' = ' + needed + ' (' + (occupied < needed ? __t('degenerate') : __t('non.degenerate')) + ')</span>';
  h += '</div>';

  h += '<div><span class="font-semibold text-sm text-slate-700 dark:text-slate-200">' + __t('initial.allocation') + '</span>';
  h += '<div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700"><table class="min-w-full text-xs border-collapse bg-white dark:bg-slate-900">';
  h += '<thead><tr><th class="border border-slate-300 dark:border-slate-600 px-2 py-1 bg-slate-100 dark:bg-slate-800"></th>';
  for (let j = 0; j < cols; j++) {
    h += `<th class="border border-slate-300 dark:border-slate-600 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold">D${j + 1}</th>`;
  }
  h += '</tr></thead><tbody>';
  for (let i = 0; i < rows; i++) {
    h += '<tr>';
    h += `<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200">S${i + 1}</td>`;
    for (let j = 0; j < cols; j++) {
      const cost = costs[i] !== undefined && costs[i][j] !== undefined ? costs[i][j] : '';
      const allocVal = alloc[i] !== undefined && alloc[i][j] !== undefined ? alloc[i][j] : 0;
      const isEps = epsSet.has(i + ',' + j);
      h += '<td class="border border-slate-300 dark:border-slate-700 px-2 py-1 text-center">';
      h += `<div class="text-slate-500 dark:text-slate-400">${escHtml(String(cost))}</div>`;
      if (isEps) {
        h += '<div class="font-bold text-amber-500 dark:text-amber-400">ε</div>';
      } else if (allocVal > 0) {
        h += `<div class="font-bold text-indigo-600 dark:text-indigo-400">${escHtml(String(allocVal))}</div>`;
      } else {
        h += '<div class="text-slate-300 dark:text-slate-600">—</div>';
      }
      h += '</td>';
    }
    h += '</tr>';
  }
  h += '</tbody></table></div></div>';
  h += '</div>';
  return h;
}

function renderStepType_degeneracy_fix(data) {
  const alloc = data.allocation || [];
  if (!alloc.length) return '<p class="text-xs text-slate-500 dark:text-slate-400">'+__t('no.data')+'</p>';
  const cells = data.epsilon_cells || [];
  const epsSet = new Set(cells.map(c => c[0] + ',' + c[1]));
  return '<div class="space-y-2 text-xs">'
    + '<p class="text-slate-700 dark:text-slate-300">' + __t('degeneracy.explanation') + '</p>'
    + '<p class="text-slate-700 dark:text-slate-300">' + __t('degeneracy.epsilons') + ' <span class="font-mono font-semibold">' + cells.map(c => `(${c[0]}, ${c[1]})`).join(', ') + '</span></p>'
    + '<div><span class="font-semibold text-sm text-slate-700 dark:text-slate-200">' + __t('allocation.with.epsilon') + '</span>' + renderMatrix(alloc, null, epsSet) + '</div>'
    + '</div>';
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

function renderStepData(data, varNames) {
  if (!data || Object.keys(data).length === 0) return '<p class="text-slate-400 dark:text-slate-500">'+__t('no.additional.data')+'</p>';

  const remap = s => remapStepVarNames(String(s || ''), varNames);

  if (data._step_type) {
    switch (data._step_type) {
      case 'max_to_min': return renderStepType_max_to_min(data);
      case 'problem_statement': return renderStepType_problem_statement(data);
      case 'row_reduction': return renderStepType_row_reduction(data);
      case 'col_reduction': return renderStepType_col_reduction(data);
      case 'line_drawing': return renderStepType_line_drawing(data);
      case 'result': return renderStepType_result(data);
      case 'modi_iteration': return renderStepType_modi_iteration(data);
      case 'vogel_iteration': return renderStepType_vogel_iteration(data);
      case 'vogel_initial': return renderStepType_vogel_initial(data);
      case 'nwcorner_initial': return renderStepType_nwcorner_initial(data);
      case 'nwcorner_iteration': return renderStepType_nwcorner_iteration(data);
      case 'degeneracy_fix': return renderStepType_degeneracy_fix(data);
      case 'simplex_tableau': return renderStepType_simplex_tableau(data, varNames);
      case 'optimality_check': return renderStepType_optimality_check(data, varNames);
    }
  }

  let html = '<div class="space-y-2">';
  for (const [key, val] of Object.entries(data)) {
    if (key === '_step_type') continue;
    const label = `<span class="font-semibold text-slate-700 dark:text-slate-200">${escHtml(key)}:</span>`;
    if (Array.isArray(val) && val.length > 0 && Array.isArray(val[0])) {
      html += `<div>${label}`;
      html += renderMatrix(val);
      html += '</div>';
    } else if (key === 'variables' || key === 'dual_variables') {
      const rows = Object.entries(val).map(([k, v]) => [formatVariableName(remap(k)), formatNumber(v, 4)]);
      html += renderTable([__t('variable'), __t('value')], rows, key);
    } else if (key === 'row_penalties' || key === 'col_penalties' || key === 'supply_remaining' || key === 'demand_remaining') {
      html += `<div>${label} <span class="text-slate-600 dark:text-slate-300">${escHtml(JSON.stringify(val))}</span></div>`;
    } else if (key === 'allocation' && Array.isArray(val) && Array.isArray(val[0])) {
      html += '<div><span class="font-semibold text-slate-700 dark:text-slate-200">' + __t('allocation.matrix') + '</span>';
      html += renderMatrix(val);
      html += '</div>';
    } else if (key === 'shadow_prices' || key === 'reduced_costs') {
      const rows = val.map(v => {
        if (v.variable) return [formatVariableName(remap(v.variable)), formatNumber(v.value, 4)];
        if (v.name) return [formatVariableName(remap(v.name)), formatNumber(v.value, 4)];
        return [JSON.stringify(v), ''];
      });
      html += renderTable([__t('item'), __t('value')], rows, key);
    } else if (key === 'assignment' && Array.isArray(val)) {
      const rows = val.map((a, i) => [__t('task') + ' ' + (i + 1), a >= 0 ? __t('worker.label') + ' ' + (a + 1) : __t('unassigned')]);
      html += renderTable([__t('task'), __t('assigned.to')], rows, __t('assignments'));
    } else if (typeof val === 'object' && val !== null) {
      html += `<div>${label}<pre class="mt-1 overflow-x-auto rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2 text-slate-600 dark:text-slate-300">${escHtml(JSON.stringify(val, null, 2))}</pre></div>`;
    } else {
      html += `<div>${label} <span class="text-slate-600 dark:text-slate-300">${escHtml(formatMathText(val))}</span></div>`;
    }
  }
  html += '</div>';
  return html;
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function showAlert(container, message, type) {
  const styles = {
    error: 'bg-red-50 border-red-300 text-red-800 dark:bg-red-950/50 dark:border-red-800 dark:text-red-200',
    success: 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-200',
    warning: 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-200',
    info: 'bg-cyan-50 border-cyan-300 text-cyan-800 dark:bg-cyan-950/50 dark:border-cyan-800 dark:text-cyan-200',
  };
  const cls = styles[type] || styles.info;
  container.innerHTML = `<div class="border ${cls} px-4 py-3 rounded-lg relative text-sm" role="alert">${escHtml(message)}</div>`;
}

function getChartTheme() {
  const dark = isDarkMode();
  return dark ? {
    text: '#e2e8f0',
    muted: '#94a3b8',
    grid: 'rgba(100, 116, 139, 0.35)',
    border: '#475569',
    tooltipBg: '#0f172a',
    tooltipBorder: '#334155',
  } : {
    text: '#334155',
    muted: '#64748b',
    grid: 'rgba(148, 163, 184, 0.35)',
    border: '#cbd5e1',
    tooltipBg: '#ffffff',
    tooltipBorder: '#cbd5e1',
  };
}

function getChartPalette() {
  return isDarkMode()
    ? ['#5eead4', '#fbbf24', '#a78bfa', '#22d3ee', '#f472b6', '#bef264']
    : ['#0f766e', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];
}

function mergeChartOptions(base, overrides) {
  const result = { ...base };
  for (const [key, value] of Object.entries(overrides || {})) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = mergeChartOptions(result[key] || {}, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function getChartOptions(overrides = {}) {
  const theme = getChartTheme();
  const base = {
    responsive: true,
    plugins: {
      legend: { labels: { color: theme.text, font: { size: 11 } } },
      tooltip: {
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        borderWidth: 1,
        titleColor: theme.text,
        bodyColor: theme.text,
      },
    },
    scales: {
      x: {
        grid: { color: theme.grid },
        ticks: { color: theme.muted },
        title: { color: theme.text },
      },
      y: {
        grid: { color: theme.grid },
        ticks: { color: theme.muted },
        title: { color: theme.text },
      },
    },
  };
  return mergeChartOptions(base, overrides);
}

function renderSolverStatusBlock(status, result) {
  const msgs = {
    infeasible: { label: __t('status.infeasible'), cause: __t('status.infeasible.cause'), check: __t('status.infeasible.check') },
    unbounded: { label: __t('status.unbounded'), cause: __t('status.unbounded.cause'), check: __t('status.unbounded.check') },
    not_solved: { label: __t('status.not_solved'), cause: __t('status.not_solved.cause'), check: __t('status.not_solved.check') },
    undefined: { label: __t('status.undefined'), cause: __t('status.undefined.cause'), check: __t('status.undefined.check') },
    numerical_issue: { label: __t('status.numerical_issue'), cause: __t('status.numerical_issue.cause'), check: __t('status.numerical_issue.check') },
    node_limit: { label: __t('status.node_limit'), cause: __t('status.node_limit.cause'), check: __t('status.node_limit.check') },
    no_integer_feasible: { label: __t('status.no_integer_feasible'), cause: __t('status.no_integer_feasible.cause'), check: __t('status.no_integer_feasible.check') },
  };
  const msg = msgs[status] || { label: escHtml(status) || __t('status.unknown'), cause: __t('status.unknown.cause'), check: __t('status.unknown.check') };
  return '<div class="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 rounded-lg px-4 py-3 text-sm space-y-1">'
    + '<p class="font-semibold text-amber-800 dark:text-amber-200">' + escHtml(msg.label) + '</p>'
    + '<p class="text-amber-700 dark:text-amber-300">' + escHtml(msg.cause) + '</p>'
    + '<p class="text-amber-600 dark:text-amber-400 text-xs">' + escHtml(msg.check) + '</p>'
    + '</div>';
}

function getPlotlyTheme() {
  return isDarkMode() ? {
    edge: '#64748b',
    nodeLine: '#cbd5e1',
    text: '#f8fafc',
    mutedText: '#cbd5e1',
    labelBg: 'rgba(15, 23, 42, 0.85)',
    paperBg: 'rgba(15, 23, 42, 0)',
    plotBg: 'rgba(15, 23, 42, 0)',
  } : {
    edge: '#94a3b8',
    nodeLine: '#334155',
    text: '#1e293b',
    mutedText: '#64748b',
    labelBg: 'rgba(255, 255, 255, 0.85)',
    paperBg: 'rgba(255, 255, 255, 0)',
    plotBg: 'rgba(255, 255, 255, 0)',
  };
}
