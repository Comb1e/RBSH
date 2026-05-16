export interface TaskTypeDef {
  slug: string;
  description: string;
  keywords: string[];
  skillDirs: string[];
}

export const TASK_TYPES: TaskTypeDef[] = [
  {
    slug: "math_modeling",
    description:
      "Mathematical modeling — building equations, fitting data to models, solving ODEs/PDEs, optimization, simulation, sensitivity analysis, dynamical systems, eigenvalue analysis, non-dimensionalization",
    keywords: [
      "mathematical model",
      "differential equation",
      "ODE",
      "PDE",
      "optimization",
      "sensitivity analysis",
      "curve fitting",
      "regression",
      "dynamical system",
      "equilibrium",
      "eigenvalue",
      "monte carlo",
      "SIR model",
      "Lotka-Volterra",
      "non-dimensional",
      "solve_ivp",
      "scipy.integrate",
      "numerical simulation",
      "stochastic model",
      "agent-based model",
      "bifurcation",
      "phase portrait",
      "linear programming",
      "nonlinear programming",
      "constraint optimization",
      "parameter estimation",
      "model fitting",
    ],
    skillDirs: ["math_modeling"],
  },
];
