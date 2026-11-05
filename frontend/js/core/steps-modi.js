// MODI step renderer (segmented from utils.js)

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
