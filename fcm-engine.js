/**
 * CognitiveFlow - Fuzzy Cognitive Map Core Math Engine
 * Author: Antigravity
 */

export class Concept {
    constructor({ id, name, initialValue = 0.5, description = '', activationFunction = 'sigmoid' }) {
        this.id = id || `concept_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.name = name;
        this.value = initialValue;
        this.initialValue = initialValue;
        this.description = description;
        this.activationFunction = activationFunction; // 'sigmoid', 'bipolar', 'linear', 'threshold'
    }
}

export class Edge {
    constructor({ source, target, weight = 0.5, description = '' }) {
        this.source = source; // Source concept ID
        this.target = target; // Target concept ID
        this.weight = parseFloat(weight); // Weight in [-1.0, 1.0]
        this.description = description;
    }
}

export class FCMEngine {
    constructor() {
        this.concepts = new Map(); // id -> Concept
        this.edges = []; // Array of Edge objects
        this.history = []; // Array of state snapshots: { step, values: { conceptId: value } }
        this.maxSteps = 100;
        this.epsilon = 0.0001; // Convergence threshold
    }

    clear() {
        this.concepts.clear();
        this.edges = [];
        this.history = [];
    }

    addConcept(name, initialValue = 0.5, description = '', id = null, activationFunction = 'sigmoid') {
        const concept = new Concept({ id, name, initialValue, description, activationFunction });
        this.concepts.set(concept.id, concept);
        return concept;
    }

    removeConcept(id) {
        this.concepts.delete(id);
        this.edges = this.edges.filter(edge => edge.source !== id && edge.target !== id);
    }

    addEdge(sourceId, targetId, weight = 0.5, description = '') {
        // Remove existing edge between same source and target if any
        this.removeEdge(sourceId, targetId);
        
        const edge = new Edge({ source: sourceId, target: targetId, weight, description });
        this.edges.push(edge);
        return edge;
    }

    removeEdge(sourceId, targetId) {
        this.edges = this.edges.filter(edge => !(edge.source === sourceId && edge.target === targetId));
    }

    getConceptsArray() {
        return Array.from(this.concepts.values());
    }

    resetSimulation() {
        this.history = [];
        for (const concept of this.concepts.values()) {
            concept.value = concept.initialValue;
        }
        // Record step 0
        this.recordHistory(0);
    }

    recordHistory(step) {
        const values = {};
        for (const concept of this.concepts.values()) {
            values[concept.id] = concept.value;
        }
        this.history.push({ step, values });
    }

    /**
     * Compute next step of the simulation
     * @param {string} modelType - 'kosko' or 'modified'
     * @param {object} globalOptions - { lambda: 1.0, threshold: 0.5, forceBipolar: false }
     */
    step(modelType = 'modified', globalOptions = {}) {
        const lambda = globalOptions.lambda !== undefined ? globalOptions.lambda : 1.0;
        const threshold = globalOptions.threshold !== undefined ? globalOptions.threshold : 0.5;
        
        const nextValues = {};
        const concepts = this.getConceptsArray();

        for (const targetConcept of concepts) {
            let sum = 0;
            // Find all incoming edges to this concept
            const incomingEdges = this.edges.filter(edge => edge.target === targetConcept.id);
            
            for (const edge of incomingEdges) {
                const sourceConcept = this.concepts.get(edge.source);
                if (sourceConcept) {
                    sum += sourceConcept.value * edge.weight;
                }
            }

            // Apply model calculation
            let x = sum;
            if (modelType === 'modified') {
                x += targetConcept.value;
            }

            // Transfer function
            const actFn = targetConcept.activationFunction || 'sigmoid';
            nextValues[targetConcept.id] = this.transferFunction(x, actFn, lambda, threshold);
        }

        // Apply new values
        let maxDiff = 0;
        for (const [id, value] of Object.entries(nextValues)) {
            const concept = this.concepts.get(id);
            if (concept) {
                const diff = Math.abs(concept.value - value);
                if (diff > maxDiff) maxDiff = diff;
                concept.value = value;
            }
        }

        const nextStep = this.history.length;
        this.recordHistory(nextStep);

        return {
            step: nextStep,
            maxDiff,
            converged: maxDiff < this.epsilon
        };
    }

    /**
     * Mathematical Transfer Functions
     */
    transferFunction(x, type, lambda, threshold) {
        switch (type) {
            case 'sigmoid':
                // Output range [0, 1]
                return 1 / (1 + Math.exp(-lambda * x));
            
            case 'bipolar':
                // Output range [-1, 1]
                return (2 / (1 + Math.exp(-lambda * x))) - 1;
            
            case 'linear':
                // Clamped linear range [0, 1] (or [-1, 1] if input is negative)
                return Math.max(-1, Math.min(1, x));
                
            case 'threshold':
                // Binary step function
                return x >= threshold ? 1 : 0;
                
            default:
                return 1 / (1 + Math.exp(-x));
        }
    }

    /**
     * Run simulation until convergence or max steps
     */
    runSimulation(modelType = 'modified', globalOptions = {}) {
        this.resetSimulation();
        const maxSteps = globalOptions.maxSteps || this.maxSteps;
        let converged = false;
        let convergenceStep = -1;
        let cycleDetected = false;
        let cyclePeriod = 0;
        let cycleStates = null;

        for (let i = 1; i <= maxSteps; i++) {
            const result = this.step(modelType, globalOptions);
            
            if (result.converged) {
                converged = true;
                convergenceStep = i;
                break;
            }

            // Check for Limit Cycles (repeating patterns in history)
            const cycleCheck = this.checkLimitCycle();
            if (cycleCheck.detected) {
                cycleDetected = true;
                cyclePeriod = cycleCheck.period;
                cycleStates = cycleCheck.states;
                convergenceStep = i; // Cease running
                break;
            }
        }

        return {
            stepsRun: this.history.length - 1,
            converged,
            convergenceStep,
            cycleDetected,
            cyclePeriod,
            cycleStates,
            finalStates: this.history[this.history.length - 1].values
        };
    }

    /**
     * Detect if the system is trapped in a limit cycle (oscillations)
     */
    checkLimitCycle() {
        const hLen = this.history.length;
        if (hLen < 6) return { detected: false }; // Need enough history

        // Try periods from 2 up to half history length (max 15)
        const maxPeriod = Math.min(15, Math.floor(hLen / 2));
        
        for (let p = 2; p <= maxPeriod; p++) {
            let isCycle = true;
            
            // Compare the last 'p' steps with the preceding 'p' steps
            for (let i = 1; i <= p; i++) {
                const state1 = this.history[hLen - i].values;
                const state2 = this.history[hLen - i - p].values;
                
                // Compare all concept values
                for (const conceptId of this.concepts.keys()) {
                    if (Math.abs(state1[conceptId] - state2[conceptId]) > this.epsilon) {
                        isCycle = false;
                        break;
                    }
                }
                if (!isCycle) break;
            }

            if (isCycle) {
                // Return the cycle states in forward order
                const cycle = [];
                for (let i = p - 1; i >= 0; i--) {
                    cycle.push(this.history[hLen - 1 - i].values);
                }
                return {
                    detected: true,
                    period: p,
                    states: cycle
                };
            }
        }

        return { detected: false };
    }

    /**
     * JSON Serialization
     */
    toJSON() {
        const concepts = this.getConceptsArray().map(c => ({
            id: c.id,
            name: c.name,
            initialValue: c.initialValue,
            description: c.description,
            activationFunction: c.activationFunction,
            // Keep track of layout if present
            x: c.x,
            y: c.y
        }));
        
        return JSON.stringify({
            concepts,
            edges: this.edges
        }, null, 2);
    }

    /**
     * JSON Deserialization
     */
    fromJSON(jsonString) {
        this.clear();
        try {
            const data = JSON.parse(jsonString);
            
            if (data.concepts && Array.isArray(data.concepts)) {
                for (const c of data.concepts) {
                    const concept = this.addConcept(c.name, c.initialValue, c.description, c.id, c.activationFunction);
                    if (c.x !== undefined) concept.x = c.x;
                    if (c.y !== undefined) concept.y = c.y;
                }
            }
            
            if (data.edges && Array.isArray(data.edges)) {
                for (const e of data.edges) {
                    this.addEdge(e.source, e.target, e.weight, e.description);
                }
            }
            return true;
        } catch (e) {
            console.error('Failed to parse FCM JSON data', e);
            return false;
        }
    }
}
