// vogel/nw-corner step renderers (segmented from utils.js)

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
