function defaultVariableName(index) {
  return `x${index + 1}`;
}
function createTableState(rows, cols, opts = {}) {
  const hasSign = opts.sign !== false;
  const hasRhs = opts.rhs !== false;
  const hasExtra = opts.extra || null;
  const labelRow = opts.labelRow !== false;
  const hasLabels = !!opts.labels;

  const varNames = opts.varNames
    ? [...opts.varNames]
    : Array.from({ length: cols }, (_, i) => defaultVariableName(i));

  const data = [];
  for (let r = 0; r < rows; r++) {
    const row = { cells: Array(cols).fill('') };
    if (hasSign) row.sign = '<=';
    if (hasRhs) row.rhs = '';
    if (hasExtra) row[hasExtra.key] = '';
    if (hasLabels) row.label = '';
    data.push(row);
  }

  return {
    cols,
    rows: data,
    hasSign,
    hasRhs,
    hasExtra,
    labelRow,
    hasLabels,
    varNames,
    numVars: cols,

    get numRows() { return this.rows.length; },

    get numCols() { return this.cols; },

    addRow() {
      const row = { cells: Array(this.cols).fill('') };
      if (this.hasSign) row.sign = '<=';
      if (this.hasRhs) row.rhs = '';
      if (this.hasExtra) row[this.hasExtra.key] = '';
      if (this.hasLabels) row.label = '';
      this.rows.push(row);
    },

    removeRow() {
      if (this.rows.length > 1) this.rows.pop();
    },

    addCol() {
      this.cols++;
      this.numVars = this.cols;
      this.varNames.push(defaultVariableName(this.cols - 1));
      for (const row of this.rows) row.cells.push('');
    },

    removeCol() {
      if (this.cols > 1) {
        this.cols--;
        this.numVars = this.cols;
        this.varNames.pop();
        for (const row of this.rows) row.cells.pop();
      }
    },

    getRowValues(rowIdx) {
      const row = this.rows[rowIdx];
      return row.cells.map(Number);
    },

    getAllValues() {
      return this.rows.map(r => ({
        cells: r.cells.map(Number),
        sign: this.hasSign ? r.sign : null,
        rhs: this.hasRhs ? Number(r.rhs) : null,
        extra: this.hasExtra ? r[this.hasExtra.key] : null,
      }));
    },

    validate() {
      for (let i = 0; i < this.rows.length; i++) {
        const row = this.rows[i];
        for (let j = 0; j < row.cells.length; j++) {
          if (row.cells[j] !== '' && isNaN(Number(row.cells[j]))) {
            return { valid: false, msg: `Row ${i + 1}, col ${j + 1}: must be numeric` };
          }
        }
        if (this.hasRhs && row.rhs !== '' && isNaN(Number(row.rhs))) {
          return { valid: false, msg: `Row ${i + 1} RHS: must be numeric` };
        }
        if (this.hasExtra) {
          const val = row[this.hasExtra.key];
          if (this.hasExtra.validate && val !== '' && !this.hasExtra.validate(val)) {
            return { valid: false, msg: `Row ${i + 1} ${this.hasExtra.label}: invalid` };
          }
        }
      }
      return { valid: true };
    },
  };
}

function makeVarLabels(count) {
  const labels = [];
  for (let i = 0; i < count; i++) {
    labels.push(defaultVariableName(i));
  }
  return labels;
}

function createTransportTableState(rows, cols) {
  const supply = Array(rows).fill('');
  const demand = Array(cols).fill('');
  const costs = Array.from({ length: rows }, () => Array(cols).fill(''));
  return {
    supply,
    demand,
    costs,
    get numRows() { return this.supply.length; },
    get numCols() { return this.demand.length; },
    addRow() {
      this.supply.push('');
      this.costs.push(Array(this.demand.length).fill(''));
    },
    removeRow() {
      if (this.numRows > 1) {
        this.supply.pop();
        this.costs.pop();
      }
    },
    addCol() {
      this.demand.push('');
      for (const row of this.costs) row.push('');
    },
    removeCol() {
      if (this.numCols > 1) {
        this.demand.pop();
        for (const row of this.costs) row.pop();
      }
    },
  };
}

function createAssignmentTableState(rows, cols) {
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(''));
  return {
    matrix,
    get numRows() { return this.matrix.length; },
    get numCols() { return this.matrix.length > 0 ? this.matrix[0].length : 0; },
    addRow() {
      this.matrix.push(Array(this.numCols || 1).fill(''));
    },
    removeRow() {
      if (this.numRows > 1) this.matrix.pop();
    },
    addCol() {
      for (const row of this.matrix) row.push('');
    },
    removeCol() {
      if (this.numCols > 1) {
        for (const row of this.matrix) row.pop();
      }
    },
  };
}

function renderTableControls() {
  return '';
}


