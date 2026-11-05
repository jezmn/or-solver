// matrix + table renderers (segmented from utils.js)

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
