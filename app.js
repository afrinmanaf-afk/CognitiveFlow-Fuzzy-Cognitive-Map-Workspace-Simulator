/**
 * CognitiveFlow - Application Controller & Orchestrator
 * Author: Antigravity
 */

import { FCMEngine } from './fcm-engine.js';
import { GraphRenderer } from './graph-renderer.js';

// Global Instances
const engine = new FCMEngine();
let renderer = null;
let lineChart = null;
let barChart = null;

// Stored Scenarios for Comparison
const scenarios = new Map(); // name -> { conceptName: value }

// Preset Configurations
const PRESETS = {
    eco: {
        concepts: [
            { id: 'c_forest', name: 'Forest Conservation', initialValue: 0.8, x: 250, y: 150, activationFunction: 'sigmoid', description: 'Total protected woodlands and biodiverse ecosystems.' },
            { id: 'c_deforest', name: 'Deforestation Rate', initialValue: 0.2, x: 550, y: 150, activationFunction: 'sigmoid', description: 'Rate of industrial logging, agriculture expansion, and clearing.' },
            { id: 'c_tourism', name: 'Eco-Tourism Intensity', initialValue: 0.4, x: 180, y: 350, activationFunction: 'sigmoid', description: 'Visitor frequency and revenue generated from nature sights.' },
            { id: 'c_jobs', name: 'Local Employment', initialValue: 0.3, x: 400, y: 450, activationFunction: 'sigmoid', description: 'Percentage of the local workforce earning stable incomes.' },
            { id: 'c_water', name: 'Soil & Water Quality', initialValue: 0.8, x: 620, y: 350, activationFunction: 'sigmoid', description: 'Overall cleanliness of water tables, river health, and soil integrity.' }
        ],
        edges: [
            { source: 'c_forest', target: 'c_tourism', weight: 0.8, description: 'Pristine forests attract nature tourists.' },
            { source: 'c_forest', target: 'c_water', weight: 0.6, description: 'Intact tree root networks prevent soil erosion and filter water.' },
            { source: 'c_deforest', target: 'c_water', weight: -0.9, description: 'Clearing land triggers soil degradation and stream siltation.' },
            { source: 'c_tourism', target: 'c_jobs', weight: 0.7, description: 'Eco-tourism feeds services, hospitality, and guide jobs.' },
            { source: 'c_deforest', target: 'c_jobs', weight: 0.5, description: 'Logging and commercial logging provides raw manual labor jobs.' },
            { source: 'c_jobs', target: 'c_deforest', weight: 0.2, description: 'Economic growth creates housing and farming demand.' },
            { source: 'c_jobs', target: 'c_forest', weight: 0.4, description: 'Higher regional wealth yields funding for national reserve guards.' },
            { source: 'c_tourism', target: 'c_forest', weight: 0.5, description: 'Tourism profits build community pressure to expand parks.' }
        ]
    },
    traffic: {
        concepts: [
            { id: 'c_transit', name: 'Public Transit Quality', initialValue: 0.3, x: 220, y: 150, activationFunction: 'sigmoid', description: 'Reliability, coverage, speed, and affordability of trains and buses.' },
            { id: 'c_cars', name: 'Car Ownership', initialValue: 0.7, x: 500, y: 150, activationFunction: 'sigmoid', description: 'Average registered private vehicles per urban resident.' },
            { id: 'c_congest', name: 'Road Congestion', initialValue: 0.8, x: 360, y: 300, activationFunction: 'sigmoid', description: 'Average travel delay times on primary metropolitan arteries.' },
            { id: 'c_pollution', name: 'Emissions & Air Quality', initialValue: 0.7, x: 600, y: 350, activationFunction: 'sigmoid', description: 'Atmospheric PM2.5, NO2, and CO2 indices in city centers.' },
            { id: 'c_budget', name: 'City Capital Budget', initialValue: 0.6, x: 150, y: 400, activationFunction: 'sigmoid', description: 'Liquid financial reserve capacity of the municipal treasury.' }
        ],
        edges: [
            { source: 'c_transit', target: 'c_cars', weight: -0.8, description: 'Fast, cheap trains reduce personal car dependency.' },
            { source: 'c_cars', target: 'c_congest', weight: 0.85, description: 'Higher grid car count raises highway blockages.' },
            { source: 'c_congest', target: 'c_pollution', weight: 0.9, description: 'Idle stop-and-go cars burn fossil fuels highly inefficiently.' },
            { source: 'c_transit', target: 'c_congest', weight: -0.6, description: 'Mass transit riders replace single-occupant cars.' },
            { source: 'c_budget', target: 'c_transit', weight: 0.75, description: 'Financial capital directly supports subway expansions.' },
            { source: 'c_congest', target: 'c_budget', weight: -0.4, description: 'Severe gridlock throttles logistics and reduces local tax revenue.' },
            { source: 'c_pollution', target: 'c_budget', weight: -0.3, description: 'Public health emergencies and compliance cleanups drain municipal funds.' }
        ]
    },
    business: {
        concepts: [
            { id: 'c_mktg', name: 'Marketing Spend', initialValue: 0.4, x: 180, y: 160, activationFunction: 'sigmoid', description: 'Capital allocated to advertising, sponsorship, and PR campaigns.' },
            { id: 'c_trust', name: 'Brand Trust', initialValue: 0.5, x: 420, y: 160, activationFunction: 'sigmoid', description: 'Consensus reputation of the brand for honesty and delivery.' },
            { id: 'c_quality', name: 'Product Quality', initialValue: 0.8, x: 280, y: 350, activationFunction: 'sigmoid', description: 'Rigorous engineering standards, defect prevention, and product usability.' },
            { id: 'c_sales', name: 'Sales Revenue', initialValue: 0.4, x: 550, y: 280, activationFunction: 'sigmoid', description: 'Gross capital earned from active product purchases.' },
            { id: 'c_complaints', name: 'Customer Complaints', initialValue: 0.2, x: 550, y: 420, activationFunction: 'sigmoid', description: 'Incoming support calls, negative reviews, and return requests.' }
        ],
        edges: [
            { source: 'c_mktg', target: 'c_trust', weight: 0.4, description: 'Consistent campaigns foster customer brand recognition.' },
            { source: 'c_trust', target: 'c_sales', weight: 0.8, description: 'Highly trusted firms acquire purchases much faster.' },
            { source: 'c_quality', target: 'c_trust', weight: 0.75, description: 'Flawless products are the single biggest driver of long-term reputation.' },
            { source: 'c_quality', target: 'c_complaints', weight: -0.85, description: 'Robust quality assurance keeps product failures low.' },
            { source: 'c_complaints', target: 'c_trust', weight: -0.7, description: 'Poor support handling and public complaints erode user confidence.' },
            { source: 'c_sales', target: 'c_mktg', weight: 0.6, description: 'A portion of revenues is systematically reinvested into ad campaigns.' }
        ]
    },
    health: {
        concepts: [
            { id: 'c_work', name: 'Workload Pressure', initialValue: 0.8, x: 180, y: 180, activationFunction: 'sigmoid', description: 'Total tasks assigned, working hours, and deadlines.' },
            { id: 'c_sleep', name: 'Sleep Quality', initialValue: 0.6, x: 480, y: 180, activationFunction: 'sigmoid', description: 'Average rest hours and deep REM cycles achieved.' },
            { id: 'c_stress', name: 'Stress Levels', initialValue: 0.7, x: 330, y: 320, activationFunction: 'sigmoid', description: 'Elevated cognitive anxiety and biological cortisol production.' },
            { id: 'c_exercise', name: 'Physical Exercise', initialValue: 0.4, x: 600, y: 340, activationFunction: 'sigmoid', description: 'Cardio training, yoga, or physical activity.' },
            { id: 'c_prod', name: 'Daily Productivity', initialValue: 0.7, x: 150, y: 420, activationFunction: 'sigmoid', description: 'Ratio of tasks completed on schedule to backlog.' }
        ],
        edges: [
            { source: 'c_work', target: 'c_stress', weight: 0.85, description: 'Excessive workloads generate immediate panic and strain.' },
            { source: 'c_stress', target: 'c_sleep', weight: -0.75, description: 'High anxiety prevents falling asleep and fragments sleep patterns.' },
            { source: 'c_sleep', target: 'c_prod', weight: 0.8, description: 'Refreshed brain achieves cognitive focus and high output.' },
            { source: 'c_stress', target: 'c_prod', weight: -0.6, description: 'Burnout and panic cause errors and analysis paralysis.' },
            { source: 'c_exercise', target: 'c_stress', weight: -0.7, description: 'Aerobic activity triggers endorphins and clears mental strain.' },
            { source: 'c_exercise', target: 'c_sleep', weight: 0.65, description: 'Physical tire helps induce deep muscular sleep cycles.' },
            { source: 'c_work', target: 'c_exercise', weight: -0.5, description: 'Excessive overtime leaves no leisure slots for gym sessions.' },
            { source: 'c_prod', target: 'c_stress', weight: -0.4, description: 'Knocking items off the checklist relieves workload pressure anxiety.' }
        ]
    }
};

// Colors for Chart Lines
const CHART_COLORS = [
    '#6366f1', // Indigo
    '#10b981', // Emerald
    '#f43f5e', // Rose
    '#f59e0b', // Amber
    '#0ea5e9', // Sky
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#14b8a6', // Teal
];

// Hex to transparent rgba helper
const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/* ==========================================================================
   Page Init & Event Setup
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    // Canvas dimensions sync
    const svgCanvas = document.getElementById('fcm-canvas');

    // 1. Initialize Visual Network Graph Renderer
    renderer = new GraphRenderer(svgCanvas, engine, {
        onSelectConcept: (concept) => showInspector('concept', concept),
        onSelectEdge: (edge) => showInspector('edge', edge),
        onClearSelection: () => showInspector('empty'),
        onGraphChanged: () => {
            updateMatrixTable();
            updateCharts();
        }
    });

    // 2. Initialize Charts
    initCharts();

    // 3. Bind UI Button Actions
    bindHeaderActions();
    bindInspectorActions();
    bindSimulationActions();
    bindScenarioActions();
    bindModalActions();

    // 4. Load the First Preset (Socio-Ecological) to show a beautiful starting workspace
    loadPreset('eco');
});

/* ==========================================================================
   Charts Setup (Chart.js)
   ========================================================================== */
function initCharts() {
    const ctxLine = document.getElementById('trajectory-line-chart').getContext('2d');
    const ctxBar = document.getElementById('scenario-bar-chart').getContext('2d');

    // Configuration defaults
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = 'Inter, sans-serif';

    // Line Chart
    lineChart = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 10, font: { size: 10 } }
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    borderColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1,
                    titleColor: '#fff',
                    bodyColor: '#cbd5e1'
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    title: { display: true, text: 'Simulation Steps', font: { size: 9, weight: 'bold' } }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    min: -1.05,
                    max: 1.05,
                    title: { display: true, text: 'Activation Value', font: { size: 9, weight: 'bold' } }
                }
            }
        }
    });

    // Bar Chart
    barChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 10, font: { size: 10 } }
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    borderColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.04)' }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    min: -1.05,
                    max: 1.05
                }
            }
        }
    });
}

function updateCharts() {
    if (!lineChart) return;

    const history = engine.history;
    if (history.length === 0) {
        lineChart.data.labels = [];
        lineChart.data.datasets = [];
        lineChart.update();
        return;
    }

    const concepts = engine.getConceptsArray();
    const steps = history.map(h => h.step);

    lineChart.data.labels = steps;
    lineChart.data.datasets = concepts.map((c, idx) => {
        const color = CHART_COLORS[idx % CHART_COLORS.length];
        
        // Extract this concept's values across all history frames
        const values = history.map(h => h.values[c.id] !== undefined ? h.values[c.id] : 0);

        return {
            label: c.name,
            data: values,
            borderColor: color,
            backgroundColor: hexToRgba(color, 0.05),
            borderWidth: 2.5,
            pointRadius: steps.length < 20 ? 3 : 0,
            pointHoverRadius: 5,
            tension: 0.15
        };
    });

    lineChart.update();
}

function updateBarChart() {
    if (!barChart) return;

    const concepts = engine.getConceptsArray();
    barChart.data.labels = concepts.map(c => c.name);

    const datasets = [];
    let idx = 0;
    
    for (const [scenName, scenValues] of scenarios.entries()) {
        const color = CHART_COLORS[idx % CHART_COLORS.length];
        
        const data = concepts.map(c => {
            return scenValues[c.id] !== undefined ? scenValues[c.id] : 0;
        });

        datasets.push({
            label: scenName,
            data,
            backgroundColor: hexToRgba(color, 0.7),
            borderColor: color,
            borderWidth: 1,
            borderRadius: 4
        });
        idx++;
    }

    barChart.data.datasets = datasets;
    barChart.update();
}

/* ==========================================================================
   Matrix Table & UI Rendering
   ========================================================================== */
function updateMatrixTable() {
    const tbody = document.querySelector('#matrix-table tbody');
    tbody.innerHTML = '';

    const concepts = engine.getConceptsArray();
    
    concepts.forEach((c) => {
        const tr = document.createElement('tr');
        
        const initial = c.initialValue.toFixed(3);
        const stableVal = c.value.toFixed(3);
        const delta = (c.value - c.initialValue);
        
        let deltaClass = '';
        let deltaText = delta.toFixed(3);
        if (delta > 0.001) {
            deltaClass = 'delta-pos';
            deltaText = `+${deltaText}`;
        } else if (delta < -0.001) {
            deltaClass = 'delta-neg';
        }

        tr.innerHTML = `
            <td style="font-weight: 500; color: #fff;">${c.name}</td>
            <td style="font-family: monospace;">${initial}</td>
            <td style="font-family: monospace; font-weight: bold;">${stableVal}</td>
            <td class="${deltaClass}" style="font-family: monospace;">${deltaText}</td>
        `;
        
        tbody.appendChild(tr);
    });
}

function showInspector(state, data = null) {
    // Deactivate all first
    document.querySelectorAll('.inspector-state').forEach(el => el.classList.remove('active'));

    if (state === 'empty') {
        document.getElementById('inspector-empty').classList.add('active');
    } 
    else if (state === 'concept') {
        const el = document.getElementById('inspector-concept');
        el.classList.add('active');

        // Populate fields
        document.getElementById('ins-node-id').textContent = data.id;
        document.getElementById('ins-node-name').value = data.name;
        document.getElementById('ins-node-init').value = data.initialValue;
        document.getElementById('ins-node-init-val').textContent = data.initialValue.toFixed(2);
        document.getElementById('ins-node-function').value = data.activationFunction || 'sigmoid';
        document.getElementById('ins-node-desc').value = data.description || '';
    } 
    else if (state === 'edge') {
        const el = document.getElementById('inspector-edge');
        el.classList.add('active');

        const src = engine.concepts.get(data.source);
        const dst = engine.concepts.get(data.target);

        document.getElementById('ins-edge-source').textContent = src ? src.name : 'Unknown';
        document.getElementById('ins-edge-target').textContent = dst ? dst.name : 'Unknown';
        document.getElementById('ins-edge-weight').value = data.weight;
        document.getElementById('ins-edge-weight-val').textContent = data.weight >= 0 ? `+${data.weight.toFixed(2)}` : data.weight.toFixed(2);
        document.getElementById('ins-edge-desc').value = data.description || '';
    }
}

/* ==========================================================================
   Action Binders
   ========================================================================== */
function bindHeaderActions() {
    // Load Presets Modal Trigger
    document.getElementById('btn-presets').addEventListener('click', () => {
        openModal('modal-presets');
    });

    // Import/Export Modal Trigger
    document.getElementById('btn-import-export').addEventListener('click', () => {
        document.getElementById('ie-json-textarea').value = engine.toJSON();
        openModal('modal-ie');
    });

    // Clear Workspace
    document.getElementById('btn-clear-workspace').addEventListener('click', () => {
        if (confirm('Are you sure you want to completely erase the current fuzzy map?')) {
            engine.clear();
            scenarios.clear();
            updateSavedScenariosUI();
            renderer.clearSelection();
            renderer.draw();
            engine.resetSimulation();
            updateMatrixTable();
            updateCharts();
            updateBarChart();
        }
    });

    // About/Guide Modal Trigger
    document.getElementById('btn-guide').addEventListener('click', () => {
        openModal('modal-guide');
    });
}

function bindInspectorActions() {
    // Concept: Name Edit
    document.getElementById('ins-node-name').addEventListener('input', (e) => {
        const selected = renderer.selectedElement;
        if (selected && selected.type === 'node') {
            selected.data.name = e.target.value;
            renderer.draw();
            updateMatrixTable();
            updateCharts();
        }
    });

    // Concept: Initial Value Slider
    const initSlider = document.getElementById('ins-node-init');
    initSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        document.getElementById('ins-node-init-val').textContent = val.toFixed(2);
        
        const selected = renderer.selectedElement;
        if (selected && selected.type === 'node') {
            selected.data.initialValue = val;
            selected.data.value = val; // Also update current simulation display value
            renderer.draw();
            updateMatrixTable();
            
            // Soft reset simulation history to start from these values
            engine.resetSimulation();
            updateCharts();
        }
    });

    // Concept: Activation Function Dropdown
    document.getElementById('ins-node-function').addEventListener('change', (e) => {
        const selected = renderer.selectedElement;
        if (selected && selected.type === 'node') {
            selected.data.activationFunction = e.target.value;
            renderer.draw();
            engine.resetSimulation();
            updateCharts();
            updateMatrixTable();
        }
    });

    // Concept: Notes Description
    document.getElementById('ins-node-desc').addEventListener('input', (e) => {
        const selected = renderer.selectedElement;
        if (selected && selected.type === 'node') {
            selected.data.description = e.target.value;
        }
    });

    // Concept: Delete Button
    document.getElementById('btn-delete-node').addEventListener('click', () => {
        const selected = renderer.selectedElement;
        if (selected && selected.type === 'node') {
            engine.removeConcept(selected.data.id);
            renderer.clearSelection();
            renderer.draw();
            engine.resetSimulation();
            updateMatrixTable();
            updateCharts();
        }
    });

    // Edge: Weight Influence Slider
    const weightSlider = document.getElementById('ins-edge-weight');
    weightSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        document.getElementById('ins-edge-weight-val').textContent = val >= 0 ? `+${val.toFixed(2)}` : val.toFixed(2);
        
        const selected = renderer.selectedElement;
        if (selected && selected.type === 'edge') {
            selected.data.weight = val;
            renderer.draw();
            engine.resetSimulation();
            updateCharts();
        }
    });

    // Edge: Mechanism Notes
    document.getElementById('ins-edge-desc').addEventListener('input', (e) => {
        const selected = renderer.selectedElement;
        if (selected && selected.type === 'edge') {
            selected.data.description = e.target.value;
        }
    });

    // Edge: Delete Button
    document.getElementById('btn-delete-edge').addEventListener('click', () => {
        const selected = renderer.selectedElement;
        if (selected && selected.type === 'edge') {
            engine.removeEdge(selected.data.source, selected.data.target);
            renderer.clearSelection();
            renderer.draw();
            engine.resetSimulation();
            updateMatrixTable();
            updateCharts();
        }
    });
}

function bindSimulationActions() {
    // 1. Run Complete Simulation button
    document.getElementById('btn-sim-play').addEventListener('click', () => {
        runFullSimulation();
    });

    // 2. Iterate Single Step
    document.getElementById('btn-sim-step').addEventListener('click', () => {
        const model = document.getElementById('sim-model').value;
        const lambda = parseFloat(document.getElementById('sim-lambda').value);
        const threshold = parseFloat(document.getElementById('sim-threshold').value);
        
        // If history is empty, reset to prepare
        if (engine.history.length === 0) {
            engine.resetSimulation();
        }

        const res = engine.step(model, { lambda, threshold });
        
        // Update statuses
        const statusBox = document.getElementById('sim-status-box');
        const badge = document.getElementById('sim-status-badge');
        const msg = document.getElementById('sim-status-msg');

        badge.className = 'status-badge running';
        badge.textContent = `Step ${res.step}`;
        
        if (res.converged) {
            badge.className = 'status-badge converged';
            badge.textContent = 'Converged';
            msg.textContent = `Stable state converged at step ${res.step} (\u03B4 < ${engine.epsilon})`;
        } else {
            msg.textContent = `Single step completed. Residual \u03B4: ${res.maxDiff.toFixed(5)}`;
        }

        renderer.draw();
        updateMatrixTable();
        updateCharts();
    });

    // 3. Reset Simulation values
    document.getElementById('btn-sim-reset').addEventListener('click', () => {
        engine.resetSimulation();
        
        const badge = document.getElementById('sim-status-badge');
        const msg = document.getElementById('sim-status-msg');
        badge.className = 'status-badge';
        badge.textContent = 'Idle';
        msg.textContent = 'Values reset back to concepts\' initial values.';

        renderer.draw();
        updateMatrixTable();
        updateCharts();
    });

    // 4. Slope lambda slider
    const lambdaSlider = document.getElementById('sim-lambda');
    lambdaSlider.addEventListener('input', (e) => {
        document.getElementById('sim-lambda-val').textContent = parseFloat(e.target.value).toFixed(1);
    });

    // 5. Physics layout float triggers
    const physToggle = document.getElementById('btn-physics-toggle');
    physToggle.addEventListener('click', () => {
        const active = !renderer.physicsEnabled;
        renderer.togglePhysics(active);
        physToggle.style.background = active ? 'var(--accent-indigo)' : '';
        physToggle.style.color = active ? '#fff' : '';
    });

    document.getElementById('btn-auto-layout').addEventListener('click', () => {
        renderer.triggerAutoLayout();
    });

    // Zoom Buttons
    document.getElementById('btn-zoom-in').addEventListener('click', () => {
        renderer.zoom = Math.min(4.0, renderer.zoom * 1.15);
        renderer.updateViewportTransform();
    });
    document.getElementById('btn-zoom-out').addEventListener('click', () => {
        renderer.zoom = Math.max(0.2, renderer.zoom / 1.15);
        renderer.updateViewportTransform();
    });
    document.getElementById('btn-zoom-reset').addEventListener('click', () => {
        renderer.zoom = 1.0;
        renderer.panX = 0;
        renderer.panY = 0;
        renderer.updateViewportTransform();
    });
}

function runFullSimulation() {
    const model = document.getElementById('sim-model').value;
    const lambda = parseFloat(document.getElementById('sim-lambda').value);
    const threshold = parseFloat(document.getElementById('sim-threshold').value);
    const epsilon = parseFloat(document.getElementById('sim-epsilon').value);

    engine.epsilon = epsilon;

    const res = engine.runSimulation(model, { lambda, threshold });
    
    // UI Update
    const badge = document.getElementById('sim-status-badge');
    const msg = document.getElementById('sim-status-msg');

    if (res.converged) {
        badge.className = 'status-badge converged';
        badge.textContent = 'Stable';
        msg.textContent = `Converged in ${res.convergenceStep} steps (\u03B5 < ${epsilon})`;
    } else if (res.cycleDetected) {
        badge.className = 'status-badge cycle';
        badge.textContent = 'Oscillation';
        msg.textContent = `Limit cycle (Period ${res.cyclePeriod}) caught at step ${res.convergenceStep}`;
    } else {
        badge.className = 'status-badge';
        badge.textContent = 'Limit Reached';
        msg.textContent = `Failed to stabilize within ${res.stepsRun} steps. Try increasing \u03BB or \u03B5.`;
    }

    renderer.draw();
    updateMatrixTable();
    updateCharts();
}

function bindScenarioActions() {
    // Tab Toggling
    const tabLine = document.getElementById('tab-btn-line');
    const tabCompare = document.getElementById('tab-btn-compare');
    const wrapperLine = document.getElementById('chart-wrapper-line');
    const wrapperCompare = document.getElementById('chart-wrapper-compare');

    tabLine.addEventListener('click', () => {
        tabLine.classList.add('active');
        tabCompare.classList.remove('active');
        wrapperLine.classList.add('active');
        wrapperCompare.classList.remove('active');
    });

    tabCompare.addEventListener('click', () => {
        tabCompare.classList.add('active');
        tabLine.classList.remove('active');
        wrapperCompare.classList.add('active');
        wrapperLine.classList.remove('active');
        updateBarChart(); // Draw compare immediately
    });

    // Save Scenario Snapshot
    document.getElementById('btn-save-scenario').addEventListener('click', () => {
        const input = document.getElementById('scenario-name');
        let name = input.value.trim();
        
        if (!name) {
            name = `Scenario ${scenarios.size + 1}`;
        }

        if (scenarios.has(name)) {
            if (!confirm(`Scenario "${name}" already exists. Overwrite?`)) return;
        }

        // Capture current values
        const currentVals = {};
        for (const concept of engine.concepts.values()) {
            currentVals[concept.id] = concept.value;
        }

        scenarios.set(name, currentVals);
        input.value = ''; // Clear text field

        updateSavedScenariosUI();
        updateBarChart();

        // Switch automatically to comparison tab to show user
        tabCompare.click();
    });
}

function updateSavedScenariosUI() {
    const container = document.getElementById('scenarios-container');
    container.innerHTML = '';

    scenarios.forEach((val, name) => {
        const badge = document.createElement('div');
        badge.className = 'scenario-badge';
        badge.innerHTML = `
            <span>${name}</span>
            <i class="fa-solid fa-circle-xmark remove-scen" title="Remove snapshot"></i>
        `;
        
        // Remove scenario listener
        badge.querySelector('.remove-scen').addEventListener('click', (e) => {
            e.stopPropagation();
            scenarios.delete(name);
            updateSavedScenariosUI();
            updateBarChart();
        });

        // Click badge to restore scenario stable values back into active concept weights/states
        badge.addEventListener('click', () => {
            for (const concept of engine.concepts.values()) {
                if (val[concept.id] !== undefined) {
                    concept.value = val[concept.id];
                }
            }
            renderer.draw();
            updateMatrixTable();
        });

        container.appendChild(badge);
    });
}

function bindModalActions() {
    // Bind all close modals
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            closeAllModals();
        });
    });

    // Dynamic loading of Presets click
    document.querySelectorAll('.preset-card').forEach(card => {
        card.addEventListener('click', () => {
            const key = card.getAttribute('data-preset');
            loadPreset(key);
            closeAllModals();
        });
    });

    // Import Button click
    document.getElementById('btn-ie-import').addEventListener('click', () => {
        const text = document.getElementById('ie-json-textarea').value;
        const ok = engine.fromJSON(text);
        if (ok) {
            renderer.clearSelection();
            renderer.draw();
            engine.resetSimulation();
            updateMatrixTable();
            updateCharts();
            scenarios.clear();
            updateSavedScenariosUI();
            updateBarChart();
            closeAllModals();
        } else {
            alert('Invalid Fuzzy Cognitive Map JSON structure. Please check input formats.');
        }
    });

    // Copy to clipboard
    document.getElementById('btn-ie-copy').addEventListener('click', () => {
        const textarea = document.getElementById('ie-json-textarea');
        textarea.select();
        document.execCommand('copy');
        alert('Map JSON copied to clipboard!');
    });

    // File Selector upload
    document.getElementById('ie-file-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const contents = event.target.result;
            document.getElementById('ie-json-textarea').value = contents;
        };
        reader.readAsText(file);
    });
}

/* ==========================================================================
   Model Loading Utility
   ========================================================================== */
function loadPreset(key) {
    const data = PRESETS[key];
    if (!data) return;

    engine.clear();
    scenarios.clear();
    updateSavedScenariosUI();
    renderer.clearSelection();

    // Reconstruct nodes
    data.concepts.forEach(c => {
        const concept = engine.addConcept(c.name, c.initialValue, c.description, c.id, c.activationFunction);
        concept.x = c.x;
        concept.y = c.y;
    });

    // Reconstruct edges
    data.edges.forEach(e => {
        engine.addEdge(e.source, e.target, e.weight, e.description);
    });

    // Auto fit/zoom to map view
    renderer.zoom = 1.0;
    renderer.panX = 0;
    renderer.panY = 0;
    renderer.updateViewportTransform();

    // Settle layouts
    renderer.draw();

    // Soft reset simulation so state is prepared
    engine.resetSimulation();
    
    // Update dashboard tables, charts
    updateMatrixTable();
    updateCharts();
    updateBarChart();
    
    // Clear simulation status message
    const badge = document.getElementById('sim-status-badge');
    const msg = document.getElementById('sim-status-msg');
    badge.className = 'status-badge';
    badge.textContent = 'Ready';
    msg.textContent = `Loaded Preset: ${cardTitle(key)} model workspace.`;
}

function cardTitle(key) {
    switch(key) {
        case 'eco': return 'Socio-Ecological Sustainability';
        case 'traffic': return 'Smart City Traffic Congestion';
        case 'business': return 'Marketing & Corporate Strategy';
        case 'health': return 'Stress & Burnout';
        default: return 'Custom Map';
    }
}

function openModal(id) {
    const overlay = document.getElementById(id);
    overlay.style.display = 'flex';
    setTimeout(() => {
        overlay.classList.add('active');
    }, 10);
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 300);
    });
}
