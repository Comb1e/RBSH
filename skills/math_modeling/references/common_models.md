# Common Mathematical Models — Ready-to-Use Templates

A library of well-known models with parameters, equations, and Python code.

## Table of Contents

1. [Population Dynamics](#population)
2. [Epidemiology](#epidemiology)
3. [Economics & Finance](#economics)
4. [Physics & Engineering](#physics)
5. [Optimization Templates](#optimization-templates)

---

## 1. Population Dynamics {#population}

### Logistic Growth

**Equation**: dN/dt = rN(1 - N/K)

- r = intrinsic growth rate [1/time]
- K = carrying capacity [individuals]
- Equilibria: N* = 0 (unstable), N* = K (stable)

```python
def logistic(t, N, r, K):
    return r * N * (1 - N / K)

# Analytical solution:
# N(t) = K / (1 + (K/N0 - 1) * exp(-r*t))
def logistic_exact(t, N0, r, K):
    return K / (1 + (K / N0 - 1) * np.exp(-r * t))
```

### Lotka-Volterra (Predator-Prey)

**Equations**:

- dx/dt = αx - βxy (prey)
- dy/dt = δxy - γy (predators)

```python
def lotka_volterra(t, y, alpha, beta, delta, gamma):
    x, pred = y
    dxdt = alpha * x - beta * x * pred
    dydt = delta * x * pred - gamma * pred
    return [dxdt, dydt]

# Equilibrium: x* = gamma/delta, y* = alpha/beta
# Conserved quantity: V = delta*x - gamma*ln(x) + beta*y - alpha*ln(y)
```

### Competition Model (2-species)

```python
def competition(t, y, r1, r2, K1, K2, alpha12, alpha21):
    N1, N2 = y
    dN1 = r1 * N1 * (1 - (N1 + alpha12 * N2) / K1)
    dN2 = r2 * N2 * (1 - (N2 + alpha21 * N1) / K2)
    return [dN1, dN2]
```

---

## 2. Epidemiology {#epidemiology}

### SIR Model

**Equations**:

- dS/dt = -β·S·I/N
- dI/dt = β·S·I/N - γ·I
- dR/dt = γ·I
- R₀ = β/γ (epidemic if R₀ > 1)

```python
def sir(t, y, beta, gamma, N):
    S, I, R = y
    dS = -beta * S * I / N
    dI =  beta * S * I / N - gamma * I
    dR =  gamma * I
    return [dS, dI, dR]

R0 = beta / gamma
herd_immunity_threshold = 1 - 1 / R0
```

### SEIR Model (with incubation period)

```python
def seir(t, y, beta, sigma, gamma, N):
    S, E, I, R = y
    dS = -beta * S * I / N
    dE =  beta * S * I / N - sigma * E
    dI =  sigma * E - gamma * I
    dR =  gamma * I
    return [dS, dE, dI, dR]
# sigma = 1/incubation_period
```

### SIS Model (no immunity)

```python
def sis(t, y, beta, gamma, N):
    S, I = y
    dS = -beta * S * I / N + gamma * I
    dI =  beta * S * I / N - gamma * I
    return [dS, dI]
# Endemic equilibrium (if R0 > 1): I* = N(1 - 1/R0)
```

---

## 3. Economics & Finance {#economics}

### Solow Growth Model

```python
def solow(t, k, s, delta, alpha, n, g):
    """Capital per effective worker: dk/dt = s*f(k) - (n+g+delta)*k"""
    f_k = k ** alpha   # Cobb-Douglas production per effective worker
    return s * f_k - (n + g + delta) * k

# Steady state: k* = (s / (n + g + delta))^(1/(1-alpha))
def solow_steady_state(s, delta, alpha, n=0.01, g=0.02):
    return (s / (n + g + delta)) ** (1 / (1 - alpha))
```

### Black-Scholes Option Pricing

```python
from scipy.stats import norm
import numpy as np

def black_scholes(S, K, T, r, sigma, option='call'):
    """
    S: current stock price
    K: strike price
    T: time to expiry (years)
    r: risk-free rate
    sigma: volatility
    """
    d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)

    if option == 'call':
        price = S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)
    else:  # put
        price = K * np.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)
    return price

def black_scholes_greeks(S, K, T, r, sigma):
    d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    delta = norm.cdf(d1)
    gamma = norm.pdf(d1) / (S * sigma * np.sqrt(T))
    theta = (-(S * norm.pdf(d1) * sigma) / (2 * np.sqrt(T))
             - r * K * np.exp(-r * T) * norm.cdf(d2)) / 365
    vega  = S * norm.pdf(d1) * np.sqrt(T) / 100
    return {'delta': delta, 'gamma': gamma, 'theta': theta, 'vega': vega}
```

### Geometric Brownian Motion (stock price simulation)

```python
def gbm(S0, mu, sigma, T, dt, n_paths=1000):
    n_steps = int(T / dt)
    t = np.linspace(0, T, n_steps + 1)

    # Simulate paths
    dW = np.random.normal(0, np.sqrt(dt), (n_paths, n_steps))
    W  = np.cumsum(dW, axis=1)
    W  = np.hstack([np.zeros((n_paths, 1)), W])

    S = S0 * np.exp((mu - 0.5 * sigma**2) * t + sigma * W)
    return t, S
```

---

## 4. Physics & Engineering {#physics}

### Damped Harmonic Oscillator

```python
def harmonic_oscillator(t, y, omega0, zeta):
    """
    d²x/dt² + 2*zeta*omega0*dx/dt + omega0²*x = 0
    y = [x, v]
    zeta < 1: underdamped, zeta = 1: critically damped, zeta > 1: overdamped
    """
    x, v = y
    dxdt = v
    dvdt = -2 * zeta * omega0 * v - omega0**2 * x
    return [dxdt, dvdt]

# Analytical solutions:
# Underdamped: x(t) = A*exp(-zeta*omega0*t)*cos(omega_d*t + phi)
# omega_d = omega0 * sqrt(1 - zeta²)
```

### Van der Pol Oscillator (nonlinear, stiff)

```python
def van_der_pol(t, y, mu):
    x, v = y
    return [v, mu * (1 - x**2) * v - x]

# Use stiff solver for large mu
sol = solve_ivp(van_der_pol, [0, 50], [2, 0], args=(10,),
                method='Radau', rtol=1e-6)
```

### Heat Conduction (1D, steady-state)

```python
# d²T/dx² + Q/(k*A) = 0, T(0) = T0, T(L) = TL
# Analytical: T(x) = T0 + (TL - T0)*x/L - Q*x*(L-x)/(2*k*A)

def heat_steady(x, T0, TL, L, Q=0, k=1, A=1):
    return T0 + (TL - T0) * x / L - Q * x * (L - x) / (2 * k * A)
```

### Lorenz System (chaos)

```python
def lorenz(t, y, sigma=10, rho=28, beta=8/3):
    x, y_, z = y
    dx = sigma * (y_ - x)
    dy = x * (rho - z) - y_
    dz = x * y_ - beta * z
    return [dx, dy, dz]
# Chaotic for sigma=10, rho=28, beta=8/3
# Lyapunov exponent ≈ 0.9 → predictability horizon ~1/λ ≈ 1 time unit
```

---

## 5. Optimization Templates {#optimization-templates}

### Linear Programming (resource allocation)

```python
from scipy.optimize import linprog

# Minimize c @ x, subject to A_ub @ x <= b_ub, A_eq @ x == b_eq, lb <= x <= ub
# Maximize: negate c

c = [-5, -4, -3]        # maximize 5x1 + 4x2 + 3x3
A_ub = [
    [6, 4, 2],           # 6x1 + 4x2 + 2x3 <= 240
    [3, 2, 5],           # 3x1 + 2x2 + 5x3 <= 270
    [5, 6, 5],           # 5x1 + 6x2 + 5x3 <= 420
]
b_ub = [240, 270, 420]
bounds = [(0, None)] * 3

result = linprog(c, A_ub=A_ub, b_ub=b_ub, bounds=bounds, method='highs')
optimal_value = -result.fun   # negate back
optimal_x = result.x
```

### Nonlinear Constrained Optimization

```python
from scipy.optimize import minimize

def objective(x):
    return (x[0] - 1)**2 + (x[1] - 2.5)**2

constraints = [
    {'type': 'ineq', 'fun': lambda x: x[0] - 2*x[1] + 2},   # >= 0
    {'type': 'ineq', 'fun': lambda x: -x[0] - 2*x[1] + 6},
    {'type': 'ineq', 'fun': lambda x: -x[0] + 2*x[1] + 2},
]
bounds = [(0, None), (0, None)]

result = minimize(objective, x0=[2, 0], method='SLSQP',
                  bounds=bounds, constraints=constraints)
```

### Multi-objective Optimization (Pareto front)

```python
def pareto_front(objective1, objective2, param_range):
    """Weighted sum scalarization — vary weights to trace Pareto front."""
    pareto = []
    for w in np.linspace(0, 1, 50):
        def combined(x):
            return w * objective1(x) + (1 - w) * objective2(x)
        res = minimize(combined, x0=np.zeros(n_vars), method='L-BFGS-B')
        pareto.append((objective1(res.x), objective2(res.x)))
    return pareto
```

### Least Squares Parameter Fitting

```python
from scipy.optimize import least_squares
from scipy.integrate import solve_ivp

def residuals(params, t_obs, y_obs, model_fn, y0):
    """Residuals between ODE solution and observed data."""
    try:
        sol = solve_ivp(model_fn, [t_obs[0], t_obs[-1]], y0,
                        args=(params,), t_eval=t_obs, method='RK45')
        return (sol.y[0] - y_obs).flatten()
    except Exception:
        return np.full(len(t_obs), 1e10)

result = least_squares(residuals, x0=params_init,
                       bounds=(lower_bounds, upper_bounds),
                       args=(t_data, y_data, model, y0),
                       method='trf', loss='soft_l1')   # robust to outliers

params_fit = result.x
# Covariance estimate:
J = result.jac
cov = np.linalg.inv(J.T @ J) * (result.fun @ result.fun) / (len(y_data) - len(params_fit))
param_std = np.sqrt(np.diag(cov))
```
