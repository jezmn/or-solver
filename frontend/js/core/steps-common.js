// step-render infrastructure shared by all solvers (segmented from utils.js)

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
  'For each row, find the minimum value in that row, then subtract it from every cell in the row.': 'step.assignment.row.operation',
  'For each column, find the minimum value in that column, then subtract it from every cell in the column.': 'step.assignment.col.operation',
  'Root node: LP relaxation is already integer feasible': 'step.ip.root.integer_feasible',
  'No integer feasible solution found — all branches explored': 'step.ip.no_integer_feasible',
};

const STEP_DESC_PATTERNS = [
  { regex: /^Converting maximization to minimization: subtract each profit from max value \((.+)\)$/, key: 'step.assignment.max.to.min' },
  { regex: /^Problem: (\d+) workers? × (\d+) tasks? \(minimize cost\)$/, key: 'step.assignment.problem.min' },
  { regex: /^Iteration (\d+): cover zeros — optimal! \((\d+) lines = matrix size (\d+)\)$/, key: 'step.assignment.iteration.optimal' },
  { regex: /^Iteration (\d+): adjust matrix \(minimum uncovered value = (.+)\)$/, key: 'step.assignment.iteration.adjust' },
  { regex: /^Total Cost: (.+)$/, key: 'step.assignment.total.cost' },
  { regex: /^Total Profit: (.+)$/, key: 'step.assignment.total.profit' },
  { regex: /^Number of lines \((\d+)\) equals matrix size \((\d+)\)\. Zero covering is optimal — the algorithm can now find the best assignment\.$/, key: 'step.assignment.lines.optimal' },
  { regex: /^Minimum uncovered value is (.+)\. Subtract it from all uncovered cells, add it to cells at the intersection of covered rows and covered columns\.$/, key: 'step.assignment.min.uncovered' },
  { regex: /^Problem: (\d+) variables, (\d+) constraints, (\d+) integer vars$/, key: 'step.ip.problem' },
  { regex: /^Root node: branch on x(\d+)$/, key: 'step.ip.root.branch' },
  { regex: /^(.+): infeasible relaxation$/, key: 'step.ip.infeasible_relaxation' },
  { regex: /^(.+): pruned by bound$/, key: 'step.ip.pruned_bound' },
  { regex: /^(.+): integer feasible$/, key: 'step.ip.integer_feasible' },
  { regex: /^(.+): branch on x(\d+)$/, key: 'step.ip.node.branch' },
  { regex: /^Branch & Bound complete — optimal integer solution Z=(.+)$/, key: 'step.ip.bb_complete' },
  { regex: /^Node limit \((\d+)\) reached — not proven optimal/, key: 'step.ip.node_limit' },
];

function translateStepDescription(desc) {
  if (!desc) return desc;
  const key = STEP_DESC_MAP[desc];
  if (key) return __t(key, desc);
  for (const pat of STEP_DESC_PATTERNS) {
    const m = desc.match(pat.regex);
    if (m) {
      let result = __t(pat.key, desc);
      for (let i = 0; i < m.length; i++) {
        result = result.replace(`{${i}}`, m[i]);
      }
      return result;
    }
  }
  return desc;
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
  const translated = translateStepDescription(text);
  return `<div class="border-l-4 border-indigo-400 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 pl-3 py-2 text-xs text-indigo-800 dark:text-indigo-200 rounded-r-md">${escHtml(translated)}</div>`;
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


function renderStepType_result(data, varNames) {
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
    const rows = data.assignment.map((a, i) => {
      const rowLabel = getAssignmentLabel(varNames, i, true) || (__t('task') + ' ' + (i + 1));
      const colLabel = a >= 0 ? (getAssignmentLabel(varNames, a, false) || (__t('worker.label') + ' ' + (a + 1))) : __t('unassigned');
      return [rowLabel, colLabel];
    });
    h += renderTable([__t('task'), __t('assigned.to')], rows, __t('assignments'));
  }
  h += '</div>';
  return h;
}


function renderStepData(data, varNames) {
  if (!data || Object.keys(data).length === 0) return '<p class="text-slate-400 dark:text-slate-500">'+__t('no.additional.data')+'</p>';

  const remap = s => remapStepVarNames(String(s || ''), varNames);

  if (data._step_type) {
    switch (data._step_type) {
      case 'max_to_min': return renderStepType_max_to_min(data, varNames);
      case 'problem_statement': return renderStepType_problem_statement(data);
      case 'row_reduction': return renderStepType_row_reduction(data, varNames);
      case 'col_reduction': return renderStepType_col_reduction(data, varNames);
      case 'line_drawing': return renderStepType_line_drawing(data, varNames);
      case 'result': return renderStepType_result(data, varNames);
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
  const skipKeys = new Set(['nonachievement', 'lock']);
  for (const [key, val] of Object.entries(data)) {
    if (key === '_step_type' || skipKeys.has(key)) continue;
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
