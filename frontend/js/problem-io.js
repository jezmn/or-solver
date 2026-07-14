const PROBLEM_IO_VERSION = 1;

function buildProblemDocument(method, input) {
  return {
    version: PROBLEM_IO_VERSION,
    method,
    createdAt: new Date().toISOString(),
    input: cloneJsonValue(input),
  };
}

function downloadResultJson(method, input, status, result) {
  const document = {
    version: PROBLEM_IO_VERSION,
    method,
    createdAt: new Date().toISOString(),
    input: cloneJsonValue(input),
    status,
    result: cloneJsonValue(result),
  };
  const blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  const stamp = document.createdAt.replace(/[:.]/g, '-');
  link.href = url;
  link.download = `${method}-result-${stamp}.json`;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadProblemJson(method, input) {
  const document = buildProblemDocument(method, input);
  const blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  const stamp = document.createdAt.replace(/[:.]/g, '-');
  link.href = url;
  link.download = `${method}-problem-${stamp}.json`;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function importProblemFromFile(event, expectedMethod, validateInput) {
  const inputEl = event && event.target ? event.target : null;
  const file = inputEl && inputEl.files ? inputEl.files[0] : null;
  if (!file) return null;

  try {
    const text = await readProblemFile(file);
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error('Import file must be valid JSON.');
    }
    return validateProblemDocument(parsed, expectedMethod, validateInput);
  } finally {
    if (inputEl) inputEl.value = '';
  }
}

function readProblemFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read import file.'));
    reader.readAsText(file);
  });
}

function validateProblemDocument(documentData, expectedMethod, validateInput) {
  if (!isPlainObject(documentData)) throw new Error('Problem file must be a JSON object.');
  if (documentData.version !== PROBLEM_IO_VERSION) throw new Error('Unsupported problem file version.');
  if (expectedMethod && documentData.method !== expectedMethod) {
    const found = documentData.method || 'another method';
    throw new Error(`This file is for ${found}, not ${expectedMethod}.`);
  }
  if (!isPlainObject(documentData.input)) throw new Error('Problem input is incomplete.');
  validateInput(documentData.input);
  return documentData.input;
}

function getLpProblemInput(table, optimization) {
  const vals = table.getAllValues();
  const objective = vals[0].cells;
  const constraints = [];
  const signs = [];
  const rhs = [];
  const labels = [];
  for (let i = 1; i < vals.length; i++) {
    const row = vals[i];
    const origRow = table.rows[i];
    constraints.push(row.cells);
    signs.push(row.sign);
    rhs.push(row.rhs);
    labels.push(origRow && origRow.label ? String(origRow.label) : '');
  }
  const input = { objective, constraints, signs, rhs, optimization, varNames: [...table.varNames], labels };
  validateLpProblemInput(input);
  return input;
}

function validateLpProblemInput(input) {
  if (!isPlainObject(input)) throw new Error('Problem input is incomplete.');
  if (!Array.isArray(input.objective) || !Array.isArray(input.constraints) || !Array.isArray(input.signs) || !Array.isArray(input.rhs)) {
    throw new Error('Problem input is incomplete.');
  }
  const varCount = validateNumericArray('Objective', input.objective);
  if (input.constraints.length === 0) throw new Error('Add at least one constraint.');
  if (input.signs.length !== input.constraints.length || input.rhs.length !== input.constraints.length) {
    throw new Error('Problem input is incomplete.');
  }
  input.constraints.forEach((row) => {
    validateNumericArray('Constraint', row);
    if (row.length !== varCount) throw new Error('Constraint dimensions do not match the objective.');
  });
  input.signs.forEach(validateSign);
  validateNumericArray('RHS', input.rhs, input.constraints.length);
  validateOptimization(input.optimization);
}

function applyLpProblemInput(table, input) {
  validateLpProblemInput(input);
  table.cols = input.objective.length;
  table.numVars = table.cols;
  table.varNames = Array.isArray(input.varNames) && input.varNames.length >= table.numVars
    ? input.varNames.map(String)
    : Array.from({ length: table.numVars }, (_, i) => (input.varNames && input.varNames[i]) ? String(input.varNames[i]) : 'x' + (i + 1));
  table.rows = [
    { cells: input.objective.map(inputValue), label: '' },
    ...input.constraints.map((row, idx) => ({
      cells: row.map(inputValue),
      sign: input.signs[idx],
      rhs: inputValue(input.rhs[idx]),
      label: (input.labels && input.labels[idx]) ? String(input.labels[idx]) : 'Constraint ' + (idx + 1),
    })),
  ];
}

function validateIntegerProblemInput(input) {
  validateLpProblemInput(input);
  if (!Array.isArray(input.integer_vars)) throw new Error('Problem input is incomplete.');
  const varCount = input.objective.length;
  input.integer_vars.forEach((idx) => {
    if (!Number.isInteger(Number(idx)) || Number(idx) < 0 || Number(idx) >= varCount) {
      throw new Error('Integer variable indexes are invalid.');
    }
  });
}

function integerFlagsFromInput(input, varCount) {
  validateIntegerProblemInput(input);
  const flags = Array(varCount).fill(false);
  input.integer_vars.forEach((idx) => { flags[Number(idx)] = true; });
  return flags;
}

function getGoalProblemInput(goalTable, constraintTable) {
  const objectives = goalTable.rows.map((goal) => ({
    coefficients: goal.cells.map(Number),
    target: Number(goal.target),
    priority: Number(goal.priority),
    direction: goal.direction,
  }));
  const constraints = [];
  const signs = [];
  const rhs = [];
  constraintTable.rows.forEach((row) => {
    const coeffs = row.cells.map(Number);
    const rowHasValues = row.cells.some((value) => value !== '') || row.rhs !== '';
    if (rowHasValues) {
      constraints.push(coeffs);
      signs.push(row.sign);
      rhs.push(Number(row.rhs));
    }
  });
  const input = { objectives, constraints, signs, rhs };
  validateGoalProblemInput(input);
  return input;
}

function validateGoalProblemInput(input) {
  if (!isPlainObject(input)) throw new Error('Problem input is incomplete.');
  if (!Array.isArray(input.objectives) || !Array.isArray(input.constraints) || !Array.isArray(input.signs) || !Array.isArray(input.rhs)) {
    throw new Error('Problem input is incomplete.');
  }
  if (input.objectives.length === 0) throw new Error('Add at least one goal.');
  let varCount = null;
  input.objectives.forEach((objective) => {
    if (!isPlainObject(objective) || !Array.isArray(objective.coefficients)) throw new Error('Problem input is incomplete.');
    const count = validateNumericArray('Goal coefficients', objective.coefficients);
    if (varCount === null) varCount = count;
    if (count !== varCount) throw new Error('Constraint dimensions do not match the objective.');
    validateNumericValue('Goal target', objective.target);
    if (objective.priority !== undefined) validateNumericValue('Goal priority', objective.priority);
    if (objective.weight !== undefined) validateNumericValue('Goal weight', objective.weight);
    if (objective.wt_plus !== undefined) validateNumericValue('Wt(d+)', objective.wt_plus);
    if (objective.prty_plus !== undefined) validateNumericValue('Prty(d+)', objective.prty_plus);
    if (objective.wt_minus !== undefined) validateNumericValue('Wt(d-)', objective.wt_minus);
    if (objective.prty_minus !== undefined) validateNumericValue('Prty(d-)', objective.prty_minus);
    if (objective.direction !== undefined) validateDirection(objective.direction);
  });
  if (input.signs.length !== input.constraints.length || input.rhs.length !== input.constraints.length) {
    throw new Error('Problem input is incomplete.');
  }
  input.constraints.forEach((row) => {
    validateNumericArray('Constraint', row);
    if (row.length !== varCount) throw new Error('Constraint dimensions do not match the objective.');
  });
  input.signs.forEach(validateSign);
  if (input.constraints.length > 0) {
    validateNumericArray('RHS', input.rhs, input.constraints.length);
  }
}

function applyGoalProblemInput(goalTable, constraintTable, input) {
  validateGoalProblemInput(input);
  const varCount = input.objectives[0].coefficients.length;
  goalTable.cols = varCount;
  goalTable.numVars = varCount;
  goalTable.rows = input.objectives.map((objective) => ({
    cells: objective.coefficients.map(inputValue),
    target: inputValue(objective.target),
    priority: inputValue(objective.priority),
    direction: objective.direction,
  }));
  constraintTable.cols = varCount;
  constraintTable.numVars = varCount;
  constraintTable.rows = input.constraints.map((row, idx) => ({
    cells: row.map(inputValue),
    sign: input.signs[idx],
    rhs: inputValue(input.rhs[idx]),
    label: (input.labels && input.labels[idx]) ? String(input.labels[idx]) : '',
  }));
  const paddedVarNames = Array.isArray(input.varNames) && input.varNames.length >= varCount
    ? input.varNames.map(String)
    : Array.from({ length: varCount }, (_, i) => (input.varNames && input.varNames[i]) ? String(input.varNames[i]) : 'x' + (i + 1));
  goalTable.varNames = paddedVarNames;
  constraintTable.varNames = paddedVarNames;
}

function getTransportationProblemInput(page) {
  const input = {
    supply: page.supply.map(Number),
    demand: page.demand.map(Number),
    costs: page.costs.map((row) => row.map(Number)),
    sourceNames: page.sourceNames ? page.sourceNames.map(String) : [],
    destNames: page.destNames ? page.destNames.map(String) : [],
  };
  validateTransportationProblemInput(input);
  return input;
}

function validateTransportationProblemInput(input) {
  if (!isPlainObject(input) || !Array.isArray(input.costs) || !Array.isArray(input.supply) || !Array.isArray(input.demand)) {
    throw new Error('Problem input is incomplete.');
  }
  const dims = validateNumericMatrix(input.costs);
  validateNumericArray('Supply', input.supply, dims.rows);
  validateNumericArray('Demand', input.demand, dims.cols);
}

function applyTransportationProblemInput(page, input) {
  validateTransportationProblemInput(input);
  page.numRows = input.costs.length;
  page.numCols = input.costs[0].length;
  page.costs = input.costs.map((row) => row.map(inputValue));
  page.supply = input.supply.map(inputValue);
  page.demand = input.demand.map(inputValue);
  page.sourceNames = Array.isArray(input.sourceNames) && input.sourceNames.length >= page.numRows
    ? input.sourceNames.map(String)
    : Array.from({ length: page.numRows }, (_, i) => (input.sourceNames && input.sourceNames[i]) ? String(input.sourceNames[i]) : 'Source ' + (i + 1));
  page.destNames = Array.isArray(input.destNames) && input.destNames.length >= page.numCols
    ? input.destNames.map(String)
    : Array.from({ length: page.numCols }, (_, j) => (input.destNames && input.destNames[j]) ? String(input.destNames[j]) : 'Destination ' + (j + 1));
}

function getAssignmentProblemInput(page) {
  const input = {
    cost_matrix: page.matrix.map((row) => row.map(Number)),
    optimization: page.optimization || 'min',
    rowNames: page.rowNames ? page.rowNames.map(String) : [],
    colNames: page.colNames ? page.colNames.map(String) : [],
  };
  validateAssignmentProblemInput(input);
  return input;
}

function validateAssignmentProblemInput(input) {
  if (!isPlainObject(input) || !Array.isArray(input.cost_matrix)) throw new Error('Problem input is incomplete.');
  validateNumericMatrix(input.cost_matrix);
  if (input.optimization !== undefined && !['max', 'min'].includes(input.optimization)) throw new Error('Assignment optimization must be "max" or "min".');
  if (input.minimize !== undefined && typeof input.minimize !== 'boolean') throw new Error('Assignment mode is invalid.');
  if (input.mode !== undefined && typeof input.mode !== 'string') throw new Error('Assignment mode is invalid.');
}

function applyAssignmentProblemInput(page, input) {
  validateAssignmentProblemInput(input);
  page.numRows = input.cost_matrix.length;
  page.numCols = input.cost_matrix[0].length;
  page.matrix = input.cost_matrix.map((row) => row.map(inputValue));
  if (input.optimization !== undefined) page.optimization = input.optimization;
  else if (input.minimize !== undefined) page.optimization = input.minimize ? 'min' : 'max';
  page.rowNames = Array.isArray(input.rowNames) && input.rowNames.length >= page.numRows
    ? input.rowNames.map(String)
    : Array.from({ length: page.numRows }, (_, i) => (input.rowNames && input.rowNames[i]) ? String(input.rowNames[i]) : 'Job ' + (i + 1));
  page.colNames = Array.isArray(input.colNames) && input.colNames.length >= page.numCols
    ? input.colNames.map(String)
    : Array.from({ length: page.numCols }, (_, j) => (input.colNames && input.colNames[j]) ? String(input.colNames[j]) : 'Machine ' + (j + 1));
}

function validateNumericMatrix(matrix) {
  if (!Array.isArray(matrix) || matrix.length === 0 || !Array.isArray(matrix[0]) || matrix[0].length === 0) {
    throw new Error('Problem input is incomplete.');
  }
  const cols = matrix[0].length;
  matrix.forEach((row) => {
    if (!Array.isArray(row) || row.length !== cols) throw new Error('Matrix rows must have consistent dimensions.');
    validateNumericArray('Matrix row', row, cols);
  });
  return { rows: matrix.length, cols };
}

function validateNumericArray(name, values, expectedLength) {
  if (!Array.isArray(values) || values.length === 0) throw new Error(`${name} is incomplete.`);
  if (expectedLength !== undefined && values.length !== expectedLength) throw new Error('Problem input is incomplete.');
  values.forEach((value) => validateNumericValue(name, value));
  return values.length;
}

function validateNumericValue(name, value) {
  if (value === null || value === undefined || value === '' || isNaN(Number(value))) {
    throw new Error(`${name} values must be numeric.`);
  }
}

function validateSign(sign) {
  if (!['<=', '=', '>='].includes(sign)) throw new Error('Constraint sign is invalid.');
}

function validateOptimization(optimization) {
  if (!['max', 'min'].includes(optimization)) throw new Error('Optimization must be max or min.');
}

function validateDirection(direction) {
  if (!['max', 'min'].includes(direction)) throw new Error('Goal direction must be max or min.');
}

function cloneJsonValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function inputValue(value) {
  return value === null || value === undefined ? '' : String(value);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
