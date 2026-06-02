# CognitiveFlow: Fuzzy Cognitive Map Workspace & Simulator

CognitiveFlow is a premium, high-fidelity browser-based environment for modeling, simulating, and evaluating **Fuzzy Cognitive Maps (FCMs)**.

## Getting Started

1. Set this directory as your active workspace in your editor.
2. Run a local development server by executing:
   ```bash
   npm start
   ```
3. Open `http://localhost:8080` in your web browser.

---

## Core Features

- **Interactive Network Editor**: Easily create, connect, and customize concepts. Double-click to create nodes, drag edge connectors to build links, and click to adjust weights with immediate visual feedback.
- **Auto-Layout Physics**: Uses a customized force-directed layout (Hooke's and Coulomb's laws) to instantly clean up complex, messy maps.
- **Dynamic Simulation Engine**: Simulates state propagation over discrete time steps. View calculations in real-time. Supports Sigmoid, Bipolar, Linear, and Threshold transfer functions.
- **Cycle & Chaos Detection**: Automatically flags when simulations settle into a single stable value, bounce back-and-forth in a repeating limit cycle, or diverge.
- **Scenario Management & Comparison**: Capture a baseline, modify weights or initial concept inputs, run a test scenario, and compare convergence values side-by-side using beautiful interactive bar charts.
- **Rich Preset Systems**: Explore four detailed preset environments: Social-Ecological Sustainability, Traffic Congestion Planning, Marketing & Brand Trust Strategy, and Personal Health/Stress Analysis.
- **Import/Export**: Save maps locally in a clean JSON format and reload them easily.

---

## Mathematical Formulation

Fuzzy Cognitive Maps model how concepts influence one another through causal links. Each concept $C_i$ has an activation state $A_i(t) \in [0, 1]$ (or $[-1, 1]$ in bipolar configurations). The connection from $C_j$ to $C_i$ has a weight $W_{ji} \in [-1, 1]$.

At each iteration $t+1$, CognitiveFlow computes the new activation of each concept:

### 1. Kosko's Activation Model
$$A_i(t+1) = f\left( \sum_{j=1}^{N} A_j(t) \cdot W_{ji} \right)$$

### 2. Modified Kosko Model (Includes previous state memory)
$$A_i(t+1) = f\left( \sum_{j=1}^{N} A_j(t) \cdot W_{ji} + A_i(t) \right)$$

Where $f(x)$ is the transfer function:

- **Sigmoid (Logistic)**: $f(x) = \frac{1}{1 + e^{-\lambda x}}$
- **Bipolar Sigmoid**: $f(x) = \frac{2}{1 + e^{-\lambda x}} - 1$
- **Linear Clamped**: $f(x) = \max(\min(x, 1), 0)$ (or $-1$ for Bipolar)
- **Threshold**: $f(x) = 1$ if $x \ge \theta$, else $0$.
