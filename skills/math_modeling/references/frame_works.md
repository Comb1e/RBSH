# Mathematical Modeling Frameworks — Deep Reference

## Table of Contents

1. [Ordinary Differential Equations (ODEs)](#odes)
2. [Difference Equations & Recurrences](#difference-equations)
3. [Partial Differential Equations (PDEs)](#pdes)
4. [Stochastic Models](#stochastic)
5. [Optimization](#optimization)
6. [Statistical / Regression Models](#regression)
7. [Markov Chains](#markov)
8. [Agent-Based Models](#abm)
9. [Graph / Network Models](#networks)

---

## 1. Ordinary Differential Equations (ODEs) {#odes}

**When**: Continuous-time dynamics, well-mixed systems, deterministic.

### Key analysis steps

1. Find equilibria: set f(y\*) = 0
2. Linearize: J = ∂f/∂y evaluated at y\*
3. Eigenvalues of J determine stability:
   - All Re(λ) < 0 → stable
   - Any Re(λ) > 0 → unstable
   - Re(λ) = 0 → need higher-order analysis

### Solver choice guide

| System type                | Solver                     | Why                            |
| -------------------------- | -------------------------- | ------------------------------ |
| Non-stiff, smooth          | `RK45` (default)           | Fast, accurate                 |
| Stiff (fast + slow scales) | `Radau` or `BDF`           | Stable for stiff               |
| High accuracy needed       | `DOP853`                   | 8th order                      |
| Event detection needed     | `solve_ivp` with `events=` | Finds zeros of event functions |

```python
# Stiff solver example
sol = solve_ivp(model, t_span, y0, method='Radau', rtol=1e-8, atol=1e-10)

# Event detection: stop when I(t) peaks
def peak_event(t, y, *args):
    return model(t, y, *args)[1]   # dI/dt = 0 at peak
peak_event.terminal = True
peak_event.direction = -1
```

### Bifurcation analysis

Track how equilibria change as a parameter varies. Key bifurcations:

- **Saddle-node**: two equilibria collide and annihilate (fold)
- **Transcritical**: two equilibria exchange stability
- **Hopf**: equilibrium loses stability, limit cycle appears

---

## 2. Difference Equations & Recurrences {#difference-equations}

**When**: Discrete time steps (generations, seasons, annual data), digital systems.

```python
import numpy as np

def logistic_map(r, x0, n_steps):
    """Discrete logistic: x_{n+1} = r * x_n * (1 - x_n)"""
    x = np.zeros(n_steps)
    x[0] = x0
    for n in range(n_steps - 1):
        x[n+1] = r * x[n] * (1 - x[n])
    return x

# Matrix form for linear recurrences: x_{n+1} = A x_n
# Stability: |eigenvalues of A| < 1
A = np.array([[0, 1], [-0.5, 1.2]])
eigenvalues = np.linalg.eigvals(A)
stable = all(abs(lam) < 1 for lam in eigenvalues)
```

---

## 3. Partial Differential Equations (PDEs) {#pdes}

**When**: Spatial variation matters (heat, diffusion, wave propagation, fluid flow).

### Method of lines (spatial discretization)

```python
from scipy.integrate import solve_ivp
import numpy as np

def heat_equation(t, u, dx, alpha):
    """1D heat equation: du/dt = alpha * d²u/dx²"""
    n = len(u)
    dudt = np.zeros(n)
    # Interior: second-order finite difference
    dudt[1:-1] = alpha * (u[2:] - 2*u[1:-1] + u[:-2]) / dx**2
    # Boundary conditions (Dirichlet: u=0 at ends)
    dudt[0] = 0
    dudt[-1] = 0
    return dudt

# Setup
L, nx = 1.0, 50
dx = L / (nx - 1)
x = np.linspace(0, L, nx)
u0 = np.sin(np.pi * x)   # initial condition
alpha = 0.01

sol = solve_ivp(heat_equation, [0, 10], u0,
                args=(dx, alpha), method='BDF', max_step=0.1)
```

### Stability criterion (explicit schemes)

For forward Euler + finite differences: Δt ≤ Δx² / (2α) (CFL condition)

---

## 4. Stochastic Models {#stochastic}

**When**: Small populations, intrinsic randomness, rare events matter.

### Stochastic differential equations (SDEs)

```python
import numpy as np

def euler_maruyama(f, g, y0, t_span, dt, params, n_paths=100):
    """Euler-Maruyama scheme for dy = f dt + g dW"""
    t = np.arange(t_span[0], t_span[1], dt)
    Y = np.zeros((n_paths, len(t), len(y0)))
    Y[:, 0, :] = y0

    for i, _ in enumerate(t[:-1]):
        dW = np.random.normal(0, np.sqrt(dt), (n_paths, len(y0)))
        drift     = f(t[i], Y[:, i, :], params)
        diffusion = g(t[i], Y[:, i, :], params)
        Y[:, i+1, :] = Y[:, i, :] + drift * dt + diffusion * dW

    return t, Y

# Plot envelope
# mean = Y.mean(axis=0); std = Y.std(axis=0)
# ax.fill_between(t, mean - 2*std, mean + 2*std, alpha=0.3)
```

### Gillespie algorithm (exact stochastic simulation)

```python
import numpy as np

def gillespie_ssa(propensities_fn, stoichiometry, state0, t_max, params):
    """Exact stochastic simulation algorithm."""
    state = np.array(state0, dtype=float)
    t = 0.0
    history = [(t, state.copy())]

    while t < t_max:
        props = propensities_fn(state, params)
        total = sum(props)
        if total == 0:
            break

        # Time to next event
        tau = np.random.exponential(1.0 / total)

        # Which event occurs?
        r = np.random.uniform(0, total)
        cumulative = 0
        for j, p in enumerate(props):
            cumulative += p
            if r <= cumulative:
                state += stoichiometry[j]
                break

        t += tau
        history.append((t, state.copy()))

    return history
```

---

## 5. Optimization {#optimization}

**When**: Find the best solution subject to constraints.

### Problem taxonomy

| Type                  | Characteristics                         | Solver                                   |
| --------------------- | --------------------------------------- | ---------------------------------------- |
| Linear programming    | Linear objective + constraints          | `linprog`, `scipy.optimize`              |
| Quadratic programming | Quadratic objective, linear constraints | `quadprog`, `cvxpy`                      |
| Nonlinear (NLP)       | General nonlinear                       | `minimize` (SLSQP, L-BFGS-B)             |
| Integer/combinatorial | Decision variables must be integers     | `milp`, `PuLP`, `ortools`                |
| Global optimization   | Many local minima                       | `differential_evolution`, `basinhopping` |
| Convex optimization   | Guaranteed global optimum               | `cvxpy`                                  |

```python
import cvxpy as cp
import numpy as np

# Convex optimization example: portfolio optimization
n = 10
mu = np.random.randn(n)     # expected returns
Sigma = np.random.randn(n, n)
Sigma = Sigma.T @ Sigma      # positive semi-definite covariance

w = cp.Variable(n)
risk = cp.quad_form(w, Sigma)
ret  = mu @ w

problem = cp.Problem(
    cp.Maximize(ret - 0.5 * risk),
    [cp.sum(w) == 1, w >= 0]
)
problem.solve()
optimal_weights = w.value
```

### Global optimization

```python
from scipy.optimize import differential_evolution

bounds = [(-5, 5)] * n_vars
result = differential_evolution(
    objective, bounds,
    seed=42, maxiter=1000, tol=1e-8, workers=-1   # parallel
)
```

---

## 6. Statistical / Regression Models {#regression}

**When**: Data → model parameters; prediction from observations.

### Model selection criteria

- **AIC** = 2k - 2 ln(L) — penalizes complexity; good for prediction
- **BIC** = k ln(n) - 2 ln(L) — heavier penalty; good for identification
- **R²** — fraction of variance explained (use adjusted R² for multiple features)
- **Cross-validation RMSE** — best for predictive accuracy

```python
from sklearn.model_selection import cross_val_score
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import PolynomialFeatures
import numpy as np

# Polynomial regression with regularization
degrees = [1, 2, 3, 4, 5]
cv_scores = {}
for d in degrees:
    pipe = make_pipeline(PolynomialFeatures(d), Ridge(alpha=1.0))
    scores = cross_val_score(pipe, X, y, cv=5, scoring='neg_root_mean_squared_error')
    cv_scores[d] = -scores.mean()

best_degree = min(cv_scores, key=cv_scores.get)
```

### Bayesian parameter inference

```python
import pymc as pm   # or use scipy for simpler cases

with pm.Model() as sir_model:
    # Priors
    beta = pm.Beta('beta', alpha=2, beta=5)
    gamma = pm.Beta('gamma', alpha=2, beta=5)

    # ODE solution (use pytensor or scipy wrapper)
    I_pred = pm.Deterministic('I_pred', solve_sir(beta, gamma, y0, t_obs))

    # Likelihood
    sigma = pm.HalfNormal('sigma', sigma=10)
    obs = pm.Normal('obs', mu=I_pred, sigma=sigma, observed=I_data)

    trace = pm.sample(2000, tune=1000, return_inferencedata=True)
```

---

## 7. Markov Chains {#markov}

**When**: System transitions between discrete states; memoryless.

```python
import numpy as np

# Transition matrix P[i,j] = P(go to j | currently in i)
P = np.array([
    [0.7, 0.2, 0.1],
    [0.3, 0.5, 0.2],
    [0.1, 0.3, 0.6],
])

# Stationary distribution: solve πP = π, sum(π) = 1
eigenvalues, eigenvectors = np.linalg.eig(P.T)
idx = np.argmin(np.abs(eigenvalues - 1.0))
pi = np.real(eigenvectors[:, idx])
pi /= pi.sum()

# Mean first passage time (from state i to state j)
# Solve system of linear equations
```

---

## 8. Agent-Based Models {#abm}

**When**: Individual heterogeneity matters; emergent behavior from local rules.

### Structure

```python
import random
import numpy as np

class Agent:
    def __init__(self, agent_id, state, position):
        self.id = agent_id
        self.state = state
        self.pos = np.array(position, dtype=float)

    def step(self, neighbors, params):
        """Update agent state based on neighbors."""
        if self.state == 'S':
            infected_neighbors = sum(1 for n in neighbors if n.state == 'I')
            if random.random() < 1 - (1 - params['beta'])**infected_neighbors:
                self.state = 'I'
        elif self.state == 'I':
            if random.random() < params['gamma']:
                self.state = 'R'

class Model:
    def __init__(self, n_agents, params):
        self.agents = [Agent(i, 'S', np.random.rand(2)) for i in range(n_agents)]
        self.agents[0].state = 'I'
        self.params = params

    def get_neighbors(self, agent, radius=0.1):
        return [a for a in self.agents
                if a is not agent and np.linalg.norm(a.pos - agent.pos) < radius]

    def run(self, n_steps):
        history = []
        for _ in range(n_steps):
            for agent in self.agents:
                neighbors = self.get_neighbors(agent)
                agent.step(neighbors, self.params)
            counts = {s: sum(1 for a in self.agents if a.state == s)
                      for s in ['S', 'I', 'R']}
            history.append(counts)
        return history
```

---

## 9. Graph / Network Models {#networks}

**When**: Relationships between entities drive dynamics.

```python
import networkx as nx
import numpy as np

# Create network
G = nx.barabasi_albert_graph(1000, 3)   # scale-free

# Key metrics
degree_seq = sorted(dict(G.degree()).values(), reverse=True)
clustering = nx.average_clustering(G)
path_length = nx.average_shortest_path_length(G)
betweenness = nx.betweenness_centrality(G)

# Epidemic threshold on network: 1/lambda_max
A = nx.adjacency_matrix(G).toarray()
eigenvalues = np.linalg.eigvalsh(A)
lambda_max = eigenvalues.max()
epidemic_threshold = 1.0 / lambda_max   # beta/gamma must exceed this

# SIR on network
def network_sir(G, beta, gamma, seed_node, n_steps):
    state = {n: 'S' for n in G.nodes()}
    state[seed_node] = 'I'
    history = [dict(state)]

    for _ in range(n_steps):
        new_state = dict(state)
        for node in G.nodes():
            if state[node] == 'I':
                if random.random() < gamma:
                    new_state[node] = 'R'
            elif state[node] == 'S':
                infected_nbrs = sum(1 for nb in G.neighbors(node) if state[nb] == 'I')
                if random.random() < 1 - (1 - beta)**infected_nbrs:
                    new_state[node] = 'I'
        state = new_state
        history.append(dict(state))
    return history
```
