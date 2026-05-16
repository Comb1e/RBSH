---
name: math-modeling
description: >
  Apply rigorous mathematical modeling techniques to real-world problems. Use this skill whenever
  a user wants to: build or analyze a mathematical model, fit data to equations, solve differential
  equations, perform optimization, run simulations, analyze dynamical systems, or translate a
  physical/biological/economic phenomenon into math. Also trigger for: "model this system",
  "find the best fit", "simulate X over time", "optimize subject to constraints", "predict future
  values", "sensitivity analysis", "what are the equilibria", "eigenvalue analysis", or any
  request combining math with a real-world domain. Don't wait for the user to say "mathematical
  model" — if they're describing a system and want to understand or predict it, use this skill.
---

# Mathematical Modeling Techniques Skill

A structured workflow for translating real-world problems into mathematical models, analyzing
them rigorously, and communicating results clearly.

---

## Workflow Overview

1. **Problem Formulation** — Define scope, variables, assumptions
2. **Model Selection** — Choose the right mathematical framework
3. **Model Construction** — Write equations / code
4. **Analysis** — Solve, simulate, or optimize
5. **Validation & Sensitivity** — Check the model, test robustness
6. **Interpretation** — Communicate results in domain language

---

## Step 1 — Problem Formulation

Before writing a single equation, clarify:

| Question                                    | Why it matters              |
| ------------------------------------------- | --------------------------- |
| What is the system?                         | Scope and boundaries        |
| What are the inputs vs. outputs?            | Variables vs. parameters    |
| What do we want to _predict_ or _optimize_? | Defines success             |
| What time/space scale matters?              | Continuous vs. discrete     |
| What can we ignore?                         | Justifiable simplifications |

**State assumptions explicitly.** Good modeling is as much about what you _leave out_ as what you include.

```
Example framing:
"We model the spread of an infectious disease in a closed population of N individuals.
 We assume homogeneous mixing, no births/deaths, and a fixed recovery rate γ."
```

---

## Step 2 — Model Selection

Choose a framework based on the problem structure. Read `references/frameworks.md` for
detailed guidance; the table below is a quick selector:

| Structure                        | Framework                                     |
| -------------------------------- | --------------------------------------------- |
| Change over time, continuous     | Ordinary Differential Equations (ODEs)        |
| Change over time, discrete steps | Difference equations / recurrences            |
| Spatial variation                | PDEs or cellular automata                     |
| Uncertainty / stochastic         | Stochastic DEs, Markov chains, Monte Carlo    |
| Maximizing/minimizing            | Optimization (LP, NLP, integer programming)   |
| Data → parameters                | Regression, least squares, Bayesian inference |
| Network/graph structure          | Graph theory, network models                  |
| Agent interactions               | Agent-based modeling                          |
| Equilibrium behavior             | Game theory, fixed-point analysis             |

**If multiple frameworks fit**, prefer the simplest one that captures the essential dynamics.
State why you chose it.

---

## Step 3 — Model Construction

### Dimensional analysis first

Before writing equations, check units. Every term in an equation must have consistent
dimensions. This catches errors early.

```
Example: In dN/dt = rN(1 - N/K)
  [dN/dt] = individuals/time
  [r] = 1/time
  [N] = individuals
  [K] = individuals   ✓ dimensionally consistent
```

### ODE models

```python
from scipy.integrate import solve_ivp
import numpy as np
import matplotlib.pyplot as plt

def model(t, y, params):
    # Unpack state variables and parameters
    S, I, R = y
    beta, gamma, N = params

    dS = -beta * S * I / N
    dI =  beta * S * I / N - gamma * I
    dR =  gamma * I
    return [dS, dI, dR]

# Initial conditions and time span
y0 = [990, 10, 0]
t_span = (0, 160)
params = (0.3, 0.1, 1000)

sol = solve_ivp(model, t_span, y0, args=(params,),
                dense_output=True, max_step=0.5)
```

### Optimization models

```python
from scipy.optimize import minimize, linprog
import numpy as np

# Nonlinear optimization with constraints
def objective(x):
    return x[0]**2 + x[1]**2   # minimize

constraints = [
    {'type': 'ineq', 'fun': lambda x: x[0] + x[1] - 1},   # x0 + x1 >= 1
]
bounds = [(0, None), (0, None)]

result = minimize(objective, x0=[1, 1], method='SLSQP',
                  bounds=bounds, constraints=constraints)
```

### Regression / curve fitting

```python
from scipy.optimize import curve_fit

def model_func(x, a, b, c):
    return a * np.exp(-b * x) + c

popt, pcov = curve_fit(model_func, x_data, y_data, p0=[1, 0.1, 0])
perr = np.sqrt(np.diag(pcov))   # parameter standard errors
```

For more framework-specific code patterns, see `references/frameworks.md`.

---

## Step 4 — Analysis

### Analytical methods (when possible)

- **Equilibria**: Set derivatives to zero and solve
- **Stability**: Linearize around equilibrium; check eigenvalues of Jacobian
- **Conservation laws**: Identify invariant quantities
- **Dimensional reduction**: Non-dimensionalize to find key dimensionless groups

```python
# Jacobian and eigenvalue stability analysis
from sympy import symbols, Matrix, solve, diff

S, I, R, beta, gamma, N_sym = symbols('S I R beta gamma N')
f1 = -beta * S * I / N_sym
f2 =  beta * S * I / N_sym - gamma * I

J = Matrix([[diff(f1, S), diff(f1, I)],
            [diff(f2, S), diff(f2, I)]])

# Evaluate at disease-free equilibrium (S=N, I=0)
J_eq = J.subs([(S, N_sym), (I, 0)])
eigenvals = J_eq.eigenvals()
```

### Numerical methods

- Use `solve_ivp` (adaptive RK45) for stiff or nonlinear ODEs
- Use `fsolve` or `root` for algebraic systems
- Use Monte Carlo for stochastic systems (run ≥1000 replications)

### Key quantities to report

- Equilibria and their stability
- Characteristic timescales (1/eigenvalue magnitudes)
- Peak values, timing, steady states
- Threshold conditions (e.g., R₀ in epidemiology)

---

## Step 5 — Validation & Sensitivity Analysis

**Never skip this step.** A model is only as good as its validation.

### Validation checklist

- [ ] Does the model reproduce known limiting cases?
- [ ] Do units check out?
- [ ] Does behavior match qualitative expectations?
- [ ] If data exist, does the model fit within uncertainty?

### Sensitivity analysis

Quantify how much outputs change with parameter perturbations:

```python
def sensitivity_analysis(param_name, param_values, base_params, run_model):
    """Vary one parameter, record output metric."""
    results = []
    for val in param_values:
        p = base_params.copy()
        p[param_name] = val
        metric = run_model(p)
        results.append(metric)
    return np.array(results)

# Normalized sensitivity index: (dY/Y) / (dp/p)
def sensitivity_index(Y_vals, p_vals):
    dY = np.gradient(Y_vals, p_vals)
    p_mid = p_vals[len(p_vals)//2]
    Y_mid = Y_vals[len(Y_vals)//2]
    return dY * p_mid / Y_mid
```

For complex models, use `SALib` for Sobol or Morris global sensitivity:

```python
from SALib.sample import sobol as sobol_sample
from SALib.analyze import sobol as sobol_analyze
```

---

## Step 6 — Interpretation & Communication

### Structure every result explanation as:

1. **What the model predicts** (in plain language)
2. **Why** (mechanistic explanation from the math)
3. **Caveats** (which assumptions were needed; what could change)
4. **Actionable insight** (what should a decision-maker do?)

### Visualization standards

- Label all axes with units
- Show uncertainty bands (confidence intervals or Monte Carlo envelope)
- Mark equilibria, thresholds, or critical points on plots
- Provide a parameter table alongside every figure

```python
# Standard plot template
fig, ax = plt.subplots(figsize=(8, 5))
ax.plot(t, S, label='Susceptible', color='steelblue')
ax.plot(t, I, label='Infected',    color='crimson')
ax.plot(t, R, label='Recovered',   color='seagreen')
ax.axhline(y=equilibrium_I, linestyle='--', color='gray', label='Equilibrium')
ax.set_xlabel('Time (days)')
ax.set_ylabel('Population')
ax.set_title('SIR Model Dynamics')
ax.legend()
plt.tight_layout()
```

---

## Quick Reference: Non-Dimensionalization

Non-dimensionalizing simplifies equations and reveals the true degrees of freedom:

1. Identify characteristic scales: T* (time), X* (space/population), etc.
2. Substitute τ = t/T*, u = x/X* into the equations
3. Group terms into dimensionless parameters (these are what actually control behavior)

```
Example — Logistic growth: dN/dt = rN(1 - N/K)
Let u = N/K, τ = rt  →  du/dτ = u(1 - u)
Now there are ZERO free parameters — universal behavior.
```

---

## Common Pitfalls

| Pitfall                | Fix                                                        |
| ---------------------- | ---------------------------------------------------------- |
| Overfitting to data    | Use train/test split; penalize complexity (AIC/BIC)        |
| Ignoring units         | Dimensional analysis before every model                    |
| Circular validation    | Validate on data _not_ used for fitting                    |
| Assuming stability     | Always compute eigenvalues at equilibria                   |
| Too many parameters    | Reduce with dimensional analysis or identifiability checks |
| Ignoring stochasticity | When N is small, deterministic models mislead              |

---

## Reference Files

- `references/frameworks.md` — Detailed guidance for each modeling framework with worked examples
- `references/common_models.md` — Ready-to-use canonical models (SIR, Lotka-Volterra, logistic, linear programming templates, etc.)

Read a reference file when you need depth on a specific framework or need a starting-point template.
