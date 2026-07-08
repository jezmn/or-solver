from pydantic import BaseModel, field_validator, model_validator
import math


VALID_SIGNS = {"<=", ">=", "="}
VALID_OPTIMIZATION = {"max", "min"}
MAX_VARS = 100
MAX_CONSTRAINTS = 100
MAX_MATRIX_DIM = 100


def _check_finite(v):
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        raise ValueError("Value must be finite")
    return v


def _check_finite_list(l):
    for item in l:
        if isinstance(item, (int, float)):
            _check_finite(float(item))
    return l


class SimplexInput(BaseModel):
    objective: list[float]
    constraints: list[list[float]]
    signs: list[str]
    rhs: list[float]
    optimization: str = "max"

    @field_validator("objective")
    @classmethod
    def objective_not_empty(cls, v):
        if len(v) == 0:
            raise ValueError("objective must not be empty")
        if len(v) > MAX_VARS:
            raise ValueError(f"objective length {len(v)} exceeds max {MAX_VARS}")
        _check_finite_list(v)
        return v

    @field_validator("constraints")
    @classmethod
    def constraints_not_empty(cls, v):
        if len(v) == 0:
            raise ValueError("constraints must not be empty")
        if len(v) > MAX_CONSTRAINTS:
            raise ValueError(f"constraints rows {len(v)} exceeds max {MAX_CONSTRAINTS}")
        for row in v:
            if len(row) == 0:
                raise ValueError("each constraint row must not be empty")
            if len(row) > MAX_VARS:
                raise ValueError(
                    f"constraint row length {len(row)} exceeds max {MAX_VARS}"
                )
            _check_finite_list(row)
        return v

    @field_validator("signs")
    @classmethod
    def signs_valid(cls, v, info):
        if any(s not in VALID_SIGNS for s in v):
            invalid = [s for s in v if s not in VALID_SIGNS]
            raise ValueError(
                f"invalid sign(s): {invalid}. Must be one of {VALID_SIGNS}"
            )
        return v

    @field_validator("rhs")
    @classmethod
    def rhs_finite(cls, v):
        _check_finite_list(v)
        return v

    @field_validator("optimization")
    @classmethod
    def optimization_valid(cls, v):
        if v not in VALID_OPTIMIZATION:
            raise ValueError(f"optimization must be one of {VALID_OPTIMIZATION}")
        return v

    @model_validator(mode="after")
    def dimensions_match(self):
        n = len(self.objective)
        m = len(self.constraints)
        for i, row in enumerate(self.constraints):
            if len(row) != n:
                raise ValueError(
                    f"constraint row {i} length {len(row)} != objective length {n}"
                )
        if len(self.signs) != m:
            raise ValueError(f"signs length {len(self.signs)} != constraints rows {m}")
        if len(self.rhs) != m:
            raise ValueError(f"rhs length {len(self.rhs)} != constraints rows {m}")
        return self


class DualInput(SimplexInput):
    pass


class TransportInput(BaseModel):
    supply: list[float]
    demand: list[float]
    costs: list[list[float]]
    optimization: str = "min"

    @field_validator("supply")
    @classmethod
    def supply_valid(cls, v):
        if len(v) == 0:
            raise ValueError("supply must not be empty")
        if len(v) > MAX_CONSTRAINTS:
            raise ValueError(f"supply length {len(v)} exceeds max {MAX_CONSTRAINTS}")
        for val in v:
            _check_finite(val)
            if val < 0:
                raise ValueError("supply must be non-negative")
        return v

    @field_validator("demand")
    @classmethod
    def demand_valid(cls, v):
        if len(v) == 0:
            raise ValueError("demand must not be empty")
        if len(v) > MAX_VARS:
            raise ValueError(f"demand length {len(v)} exceeds max {MAX_VARS}")
        for val in v:
            _check_finite(val)
            if val < 0:
                raise ValueError("demand must be non-negative")
        return v

    @field_validator("costs")
    @classmethod
    def costs_valid(cls, v):
        if len(v) == 0:
            raise ValueError("costs must not be empty")
        if len(v) > MAX_CONSTRAINTS:
            raise ValueError(f"costs rows {len(v)} exceeds max {MAX_CONSTRAINTS}")
        for row in v:
            if len(row) == 0:
                raise ValueError("each cost row must not be empty")
            if len(row) > MAX_VARS:
                raise ValueError(f"costs row length {len(row)} exceeds max {MAX_VARS}")
            _check_finite_list(row)
        return v

    @model_validator(mode="after")
    def dimensions_match(self):
        n = len(self.supply)
        m = len(self.demand)
        if len(self.costs) != n:
            raise ValueError(f"costs rows {len(self.costs)} != supply length {n}")
        for i, row in enumerate(self.costs):
            if len(row) != m:
                raise ValueError(
                    f"costs row {i} length {len(row)} != demand length {m}"
                )
        return self


class AssignmentInput(BaseModel):
    cost_matrix: list[list[float]]
    optimization: str = "min"

    @field_validator("cost_matrix")
    @classmethod
    def matrix_valid(cls, v):
        if len(v) == 0:
            raise ValueError("cost_matrix must not be empty")
        if len(v) > MAX_MATRIX_DIM:
            raise ValueError(f"cost_matrix rows {len(v)} exceeds max {MAX_MATRIX_DIM}")
        for row in v:
            if len(row) == 0:
                raise ValueError("each cost_matrix row must not be empty")
            if len(row) > MAX_MATRIX_DIM:
                raise ValueError(
                    f"cost_matrix row length {len(row)} exceeds max {MAX_MATRIX_DIM}"
                )
            _check_finite_list(row)
        return v

    @field_validator("optimization")
    @classmethod
    def optimization_valid(cls, v):
        if v not in VALID_OPTIMIZATION:
            raise ValueError(f"optimization must be one of {VALID_OPTIMIZATION}")
        return v

    @model_validator(mode="after")
    def not_ragged(self):
        if len(self.cost_matrix) > 0:
            width = len(self.cost_matrix[0])
            for i, row in enumerate(self.cost_matrix):
                if len(row) != width:
                    raise ValueError(
                        f"cost_matrix row {i} length {len(row)} != expected {width}"
                    )
        return self


class IntegerProgrammingInput(BaseModel):
    objective: list[float]
    constraints: list[list[float]]
    signs: list[str]
    rhs: list[float]
    integer_vars: list[int]
    optimization: str = "max"

    @field_validator("objective")
    @classmethod
    def objective_not_empty(cls, v):
        if len(v) == 0:
            raise ValueError("objective must not be empty")
        if len(v) > MAX_VARS:
            raise ValueError(f"objective length {len(v)} exceeds max {MAX_VARS}")
        _check_finite_list(v)
        return v

    @field_validator("constraints")
    @classmethod
    def constraints_not_empty(cls, v):
        if len(v) == 0:
            raise ValueError("constraints must not be empty")
        if len(v) > MAX_CONSTRAINTS:
            raise ValueError(f"constraints rows {len(v)} exceeds max {MAX_CONSTRAINTS}")
        for row in v:
            if len(row) == 0:
                raise ValueError("each constraint row must not be empty")
            if len(row) > MAX_VARS:
                raise ValueError(
                    f"constraint row length {len(row)} exceeds max {MAX_VARS}"
                )
            _check_finite_list(row)
        return v

    @field_validator("signs")
    @classmethod
    def signs_valid(cls, v):
        if any(s not in VALID_SIGNS for s in v):
            invalid = [s for s in v if s not in VALID_SIGNS]
            raise ValueError(
                f"invalid sign(s): {invalid}. Must be one of {VALID_SIGNS}"
            )
        return v

    @field_validator("rhs")
    @classmethod
    def rhs_finite(cls, v):
        _check_finite_list(v)
        return v

    @field_validator("optimization")
    @classmethod
    def optimization_valid(cls, v):
        if v not in VALID_OPTIMIZATION:
            raise ValueError(f"optimization must be one of {VALID_OPTIMIZATION}")
        return v

    @field_validator("integer_vars")
    @classmethod
    def integer_vars_valid(cls, v, info):
        if not isinstance(v, list):
            raise ValueError("integer_vars must be a list")
        return v

    @model_validator(mode="after")
    def validate_all(self):
        n = len(self.objective)
        m = len(self.constraints)
        for i, row in enumerate(self.constraints):
            if len(row) != n:
                raise ValueError(
                    f"constraint row {i} length {len(row)} != objective length {n}"
                )
        if len(self.signs) != m:
            raise ValueError(f"signs length {len(self.signs)} != constraints rows {m}")
        if len(self.rhs) != m:
            raise ValueError(f"rhs length {len(self.rhs)} != constraints rows {m}")
        for iv in self.integer_vars:
            if not (0 <= iv < n):
                raise ValueError(f"integer_var {iv} out of range [0, {n})")
        return self


class GoalObjective(BaseModel):
    coefficients: list[float]
    target: float
    wt_plus: float = 0
    prty_plus: int = 0
    wt_minus: float = 0
    prty_minus: int = 0

    @field_validator("coefficients")
    @classmethod
    def coefficients_not_empty(cls, v):
        if len(v) == 0:
            raise ValueError("goal coefficients must not be empty")
        if len(v) > MAX_VARS:
            raise ValueError(f"coefficients length {len(v)} exceeds max {MAX_VARS}")
        _check_finite_list(v)
        return v

    @field_validator("target")
    @classmethod
    def target_finite(cls, v):
        _check_finite(v)
        return v

    @field_validator("prty_plus", "prty_minus")
    @classmethod
    def priority_nonnegative(cls, v):
        if v < 0:
            raise ValueError("priority must be >= 0")
        return v


class GoalProgrammingInput(BaseModel):
    objectives: list[GoalObjective]
    constraints: list[list[float]]
    signs: list[str]
    rhs: list[float]

    @field_validator("objectives")
    @classmethod
    def objectives_not_empty(cls, v):
        if len(v) == 0:
            raise ValueError("objectives must not be empty")
        if len(v) > MAX_CONSTRAINTS:
            raise ValueError(f"objectives count {len(v)} exceeds max {MAX_CONSTRAINTS}")
        return v

    @field_validator("constraints")
    @classmethod
    def constraints_valid(cls, v):
        if len(v) > MAX_CONSTRAINTS:
            raise ValueError(f"constraints rows {len(v)} exceeds max {MAX_CONSTRAINTS}")
        for row in v:
            if len(row) > MAX_VARS:
                raise ValueError(
                    f"constraint row length {len(row)} exceeds max {MAX_VARS}"
                )
            for val in row:
                _check_finite(val)
        return v

    @field_validator("signs")
    @classmethod
    def signs_valid(cls, v):
        if any(s not in VALID_SIGNS for s in v):
            invalid = [s for s in v if s not in VALID_SIGNS]
            raise ValueError(
                f"invalid sign(s): {invalid}. Must be one of {VALID_SIGNS}"
            )
        return v

    @field_validator("rhs")
    @classmethod
    def rhs_finite(cls, v):
        _check_finite_list(v)
        return v

    @model_validator(mode="after")
    def dimensions_match(self):
        if len(self.constraints) != len(self.signs) or len(self.constraints) != len(
            self.rhs
        ):
            raise ValueError("constraints, signs, and rhs must have same length")
        return self


class SensitivityInput(BaseModel):
    objective: list[float]
    constraints: list[list[float]]
    signs: list[str]
    rhs: list[float]
    optimization: str = "max"

    @field_validator("objective")
    @classmethod
    def objective_not_empty(cls, v):
        if len(v) == 0:
            raise ValueError("objective must not be empty")
        if len(v) > MAX_VARS:
            raise ValueError(f"objective length {len(v)} exceeds max {MAX_VARS}")
        _check_finite_list(v)
        return v

    @field_validator("constraints")
    @classmethod
    def constraints_not_empty(cls, v):
        if len(v) == 0:
            raise ValueError("constraints must not be empty")
        if len(v) > MAX_CONSTRAINTS:
            raise ValueError(f"constraints rows {len(v)} exceeds max {MAX_CONSTRAINTS}")
        for row in v:
            if len(row) == 0:
                raise ValueError("each constraint row must not be empty")
            if len(row) > MAX_VARS:
                raise ValueError(
                    f"constraint row length {len(row)} exceeds max {MAX_VARS}"
                )
            _check_finite_list(row)
        return v

    @field_validator("signs")
    @classmethod
    def signs_valid(cls, v):
        if any(s not in VALID_SIGNS for s in v):
            invalid = [s for s in v if s not in VALID_SIGNS]
            raise ValueError(
                f"invalid sign(s): {invalid}. Must be one of {VALID_SIGNS}"
            )
        return v

    @field_validator("rhs")
    @classmethod
    def rhs_finite(cls, v):
        _check_finite_list(v)
        return v

    @field_validator("optimization")
    @classmethod
    def optimization_valid(cls, v):
        if v not in VALID_OPTIMIZATION:
            raise ValueError(f"optimization must be one of {VALID_OPTIMIZATION}")
        return v

    @model_validator(mode="after")
    def dimensions_match(self):
        n = len(self.objective)
        m = len(self.constraints)
        for i, row in enumerate(self.constraints):
            if len(row) != n:
                raise ValueError(
                    f"constraint row {i} length {len(row)} != objective length {n}"
                )
        if len(self.signs) != m:
            raise ValueError(f"signs length {len(self.signs)} != constraints rows {m}")
        if len(self.rhs) != m:
            raise ValueError(f"rhs length {len(self.rhs)} != constraints rows {m}")
        return self
