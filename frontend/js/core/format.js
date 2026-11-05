// formatting helpers (segmented from utils.js)

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
  if (typeof varNames === 'object' && !Array.isArray(varNames)) return text;
  return text.replace(/\bx(\d+)\b/g, (match, digits) => {
    const idx = parseInt(digits, 10) - 1;
    return (idx >= 0 && idx < varNames.length) ? varNames[idx] : match;
  });
}

function getAssignmentLabel(varNames, index, isRow) {
  if (!varNames || typeof varNames !== 'object' || Array.isArray(varNames)) return null;
  const names = isRow ? varNames.rowNames : varNames.colNames;
  if (names && index >= 0 && index < names.length) return names[index];
  return null;
}

function formatConstraintEquation(row, variableNames) {
  const rhs = row && row.rhs !== undefined && row.rhs !== '' ? formatNumber(Number(row.rhs)) : '0';
  return `${formatLinearExpressionText(row ? row.cells : [], variableNames)} ${(row && row.sign) || '<='} ${rhs}`;
}

function formatObjectiveEquation(direction, coefficients, variableNames, objectiveName = 'Z') {
  const label = direction === 'min' ? __t('minimize') : __t('maximize');
  return `${label} ${formatVariableName(objectiveName)} = ${formatLinearExpressionText(coefficients, variableNames)}`;
}
