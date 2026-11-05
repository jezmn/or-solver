// dom + ui helpers (segmented from utils.js)

function syncTableWidth(tableEl, numVars, fixedWidth, varWidth) {
  if (!tableEl) return;
  tableEl.style.width = '100%';
  tableEl.style.minWidth = (fixedWidth + numVars * varWidth) + 'px';
}

function isDarkMode() {
  return true;
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
