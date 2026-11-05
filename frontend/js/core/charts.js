// chart theme + option builders (segmented from utils.js)

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
