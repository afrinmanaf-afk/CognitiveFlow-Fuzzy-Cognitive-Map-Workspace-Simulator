/**
 * CognitiveFlow - Interactive SVG Graph Renderer
 * Author: Antigravity
 */

export class GraphRenderer {
    constructor(svgElement, engine, callbacks = {}) {
        this.svg = svgElement;
        this.engine = engine;
        
        // Callbacks to notify app of user actions
        this.onSelectConcept = callbacks.onSelectConcept || (() => {});
        this.onSelectEdge = callbacks.onSelectEdge || (() => {});
        this.onClearSelection = callbacks.onClearSelection || (() => {});
        this.onGraphChanged = callbacks.onGraphChanged || (() => {});

        // Layout Constants
        this.nodeRadius = 25;
        this.connectorOffset = 32;

        // Visual Interaction States
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        
        this.draggedNode = null;
        this.dragStart = { x: 0, y: 0 };
        
        this.connectingSource = null;
        this.connectingLine = null;
        
        this.selectedElement = null; // { type: 'node'|'edge', data: Concept|Edge }

        // Physics Engine State
        this.physicsEnabled = false;
        this.physicsInterval = null;

        // Initialize SVG elements
        this.initSVG();
        this.bindEvents();
    }

    initSVG() {
        // Clear all SVG elements first
        this.svg.innerHTML = '';

        // Add defs for glow filters and markers
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `
            <!-- Arrow markers for edges -->
            <marker id="arrow-positive" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#10b981" />
            </marker>
            <marker id="arrow-negative" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#f43f5e" />
            </marker>
            <marker id="arrow-neutral" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#94a3b8" />
            </marker>

            <!-- Selected Arrow markers -->
            <marker id="arrow-selected" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#6366f1" />
            </marker>

            <!-- Glow Filters for premium visuals -->
            <filter id="glow-node" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-edge-pos" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComponentTransfer in="blur" result="glow">
                    <feFuncA type="linear" slope="0.6"/>
                </feComponentTransfer>
                <feMerge>
                    <feMergeNode in="glow" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        `;
        this.svg.appendChild(defs);

        // Grid Background
        const grid = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        grid.setAttribute('width', '100%');
        grid.setAttribute('height', '100%');
        grid.setAttribute('fill', 'url(#grid-pattern)');
        grid.style.pointerEvents = 'none';

        // Custom Grid Pattern in defs
        const gridPattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        gridPattern.setAttribute('id', 'grid-pattern');
        gridPattern.setAttribute('width', '40');
        gridPattern.setAttribute('height', '40');
        gridPattern.setAttribute('patternUnits', 'userSpaceOnUse');
        gridPattern.innerHTML = `
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.03)" stroke-width="1" />
        `;
        defs.appendChild(gridPattern);

        // View Container (holds all drawn shapes, transforms during zoom/pan)
        this.container = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.container.setAttribute('class', 'graph-container');
        this.svg.appendChild(this.container);

        // Layers inside the container
        this.linksLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.nodesLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.guiLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g'); // Temp vectors (e.g. connections, previews)
        
        this.container.appendChild(this.linksLayer);
        this.container.appendChild(this.nodesLayer);
        this.container.appendChild(this.guiLayer);

        this.updateViewportTransform();
    }

    bindEvents() {
        // Wheel Zoom
        this.svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomIntensity = 0.06;
            const mouseX = e.clientX - this.svg.getBoundingClientRect().left;
            const mouseY = e.clientY - this.svg.getBoundingClientRect().top;
            
            // Current coordinates in graph space
            const graphX = (mouseX - this.panX) / this.zoom;
            const graphY = (mouseY - this.panY) / this.zoom;
            
            // Calculate new zoom
            const factor = e.deltaY < 0 ? (1 + zoomIntensity) : (1 - zoomIntensity);
            this.zoom = Math.max(0.2, Math.min(4.0, this.zoom * factor));
            
            // Adjust pan so mouse point remains at same graph coordinate
            this.panX = mouseX - graphX * this.zoom;
            this.panY = mouseY - graphY * this.zoom;
            
            this.updateViewportTransform();
        });

        // Mouse Down for Pan / Drag
        this.svg.addEventListener('mousedown', (e) => {
            // Middle mouse, Right click, or Space/Ctrl-Left click initiates Panning
            if (e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey)) {
                e.preventDefault();
                this.isPanning = true;
                this.panStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
                this.svg.style.cursor = 'grabbing';
                return;
            }

            // Normal left click on canvas closes selection
            if (e.button === 0 && e.target === this.svg) {
                this.clearSelection();
            }
        });

        // Mouse Move
        window.addEventListener('mousemove', (e) => {
            // Pan Workspace
            if (this.isPanning) {
                this.panX = e.clientX - this.panStart.x;
                this.panY = e.clientY - this.panStart.y;
                this.updateViewportTransform();
                return;
            }

            // Drag Node
            if (this.draggedNode) {
                const rect = this.svg.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                // Convert screen mouse coordinates into zoom/panned graph space
                this.draggedNode.x = (mouseX - this.panX) / this.zoom;
                this.draggedNode.y = (mouseY - this.panY) / this.zoom;
                
                this.draw(); // Redraw graph
                return;
            }

            // Connection Link Drawing
            if (this.connectingSource) {
                const rect = this.svg.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                const targetX = (mouseX - this.panX) / this.zoom;
                const targetY = (mouseY - this.panY) / this.zoom;

                const srcConcept = this.engine.concepts.get(this.connectingSource);
                if (srcConcept && this.connectingLine) {
                    this.connectingLine.setAttribute('x1', srcConcept.x);
                    this.connectingLine.setAttribute('y1', srcConcept.y);
                    this.connectingLine.setAttribute('x2', targetX);
                    this.connectingLine.setAttribute('y2', targetY);
                }
            }
        });

        // Mouse Up
        window.addEventListener('mouseup', (e) => {
            if (this.isPanning) {
                this.isPanning = false;
                this.svg.style.cursor = 'default';
            }

            if (this.draggedNode) {
                this.draggedNode = null;
                this.onGraphChanged();
            }

            if (this.connectingSource) {
                // Determine if mouse is over a valid node
                const rect = this.svg.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                const graphX = (mouseX - this.panX) / this.zoom;
                const graphY = (mouseY - this.panY) / this.zoom;

                let targetConcept = null;
                for (const concept of this.engine.concepts.values()) {
                    const dist = Math.hypot(concept.x - graphX, concept.y - graphY);
                    if (dist < this.nodeRadius + 10 && concept.id !== this.connectingSource) {
                        targetConcept = concept;
                        break;
                    }
                }

                if (targetConcept) {
                    // Create causal connection with positive/neutral 0.5 default
                    const edge = this.engine.addEdge(this.connectingSource, targetConcept.id, 0.5);
                    this.selectEdge(edge);
                    this.onGraphChanged();
                }

                this.connectingSource = null;
                if (this.connectingLine) {
                    this.connectingLine.remove();
                    this.connectingLine = null;
                }
                this.draw();
            }
        });

        // Double Click to add new Concept node
        this.svg.addEventListener('dblclick', (e) => {
            if (e.target !== this.svg) return; // Only trigger double-click on empty grid space
            e.preventDefault();
            
            const rect = this.svg.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const x = (mouseX - this.panX) / this.zoom;
            const y = (mouseY - this.panY) / this.zoom;

            const name = `Concept ${this.engine.concepts.size + 1}`;
            const concept = this.engine.addConcept(name, 0.5);
            concept.x = x;
            concept.y = y;

            this.selectNode(concept);
            this.onGraphChanged();
            this.draw();
        });

        // Prevent standard context menu on Right Click
        this.svg.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    updateViewportTransform() {
        this.container.setAttribute('transform', `translate(${this.panX}, ${this.panY}) scale(${this.zoom})`);
    }

    clearSelection() {
        this.selectedElement = null;
        this.onClearSelection();
        this.draw();
    }

    selectNode(concept) {
        this.selectedElement = { type: 'node', data: concept };
        this.onSelectConcept(concept);
        this.draw();
    }

    selectEdge(edge) {
        this.selectedElement = { type: 'edge', data: edge };
        this.onSelectEdge(edge);
        this.draw();
    }

    /**
     * Redraw the Entire SVG Network Workspace
     */
    draw() {
        this.nodesLayer.innerHTML = '';
        this.linksLayer.innerHTML = '';

        const concepts = this.engine.getConceptsArray();
        const edges = this.engine.edges;

        // Initialize positions if not present
        concepts.forEach((concept, index) => {
            if (concept.x === undefined || concept.y === undefined) {
                // Circle layout default
                const angle = (index / concepts.length) * 2 * Math.PI;
                const r = Math.min(this.svg.clientWidth, this.svg.clientHeight) * 0.25 || 150;
                concept.x = (this.svg.clientWidth / 2) / this.zoom + r * Math.cos(angle);
                concept.y = (this.svg.clientHeight / 2) / this.zoom + r * Math.sin(angle);
            }
        });

        // 1. DRAW EDGES
        edges.forEach((edge) => {
            const src = this.engine.concepts.get(edge.source);
            const dst = this.engine.concepts.get(edge.target);

            if (!src || !dst) return;

            const isSelected = this.selectedElement && 
                               this.selectedElement.type === 'edge' && 
                               this.selectedElement.data === edge;

            // Draw line
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            
            // Adjust endpoint by target radius to prevent arrow marker overlapping inside circle
            const dx = dst.x - src.x;
            const dy = dst.y - src.y;
            const dist = Math.hypot(dx, dy);
            
            let x1 = src.x;
            let y1 = src.y;
            let x2 = dst.x;
            let y2 = dst.y;
            
            let pathD = '';
            
            // Handle curved arcs if there is a bidirectional link
            const reverseEdge = edges.find(e => e.source === edge.target && e.target === edge.source);
            
            if (reverseEdge) {
                // Quadratic bezier curve to clear overlapping path
                const cx = (src.x + dst.x) / 2 - dy * 0.15;
                const cy = (src.y + dst.y) / 2 + dx * 0.15;
                pathD = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
            } else {
                pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
            }
            
            path.setAttribute('d', pathD);
            path.setAttribute('class', 'fcm-edge');
            
            // Weight color coding
            let strokeColor = '#94a3b8'; // Neutral
            let markerId = 'arrow-neutral';
            
            if (edge.weight > 0) {
                strokeColor = '#10b981'; // Green Positive
                markerId = 'arrow-positive';
            } else if (edge.weight < 0) {
                strokeColor = '#f43f5e'; // Rose Negative
                markerId = 'arrow-negative';
            }

            if (isSelected) {
                strokeColor = '#6366f1'; // Glowing Indigo for selection
                markerId = 'arrow-selected';
                path.setAttribute('stroke-width', '4');
            } else {
                // Scale width based on absolute weight
                const thickness = 1.5 + Math.abs(edge.weight) * 3.5;
                path.setAttribute('stroke-width', thickness.toString());
            }

            path.setAttribute('stroke', strokeColor);
            path.setAttribute('fill', 'none');
            path.setAttribute('marker-end', `url(#${markerId})`);
            
            // Click target helper path (much thicker, invisible, for easy click selection)
            const clickHelper = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            clickHelper.setAttribute('d', pathD);
            clickHelper.setAttribute('stroke', 'transparent');
            clickHelper.setAttribute('stroke-width', '16');
            clickHelper.setAttribute('fill', 'none');
            clickHelper.style.cursor = 'pointer';
            
            clickHelper.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                if (e.button === 0) {
                    this.selectEdge(edge);
                }
            });

            // Midpoint label for edge weight
            const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            textGroup.style.cursor = 'pointer';
            
            let mx = (x1 + x2) / 2;
            let my = (y1 + y2) / 2;

            if (reverseEdge) {
                // Adjust label position for curve
                mx = (x1 + x2) / 2 - dy * 0.085;
                my = (y1 + y2) / 2 + dx * 0.085;
            }

            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', (mx - 18).toString());
            rect.setAttribute('y', (my - 9).toString());
            rect.setAttribute('width', '36');
            rect.setAttribute('height', '18');
            rect.setAttribute('rx', '4');
            rect.setAttribute('fill', isSelected ? '#312e81' : '#1e293b');
            rect.setAttribute('stroke', strokeColor);
            rect.setAttribute('stroke-width', '1');
            
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', mx.toString());
            text.setAttribute('y', (my + 4).toString());
            text.setAttribute('fill', isSelected ? '#a5b4fc' : '#e2e8f0');
            text.setAttribute('font-size', '10px');
            text.setAttribute('font-family', 'Inter, sans-serif');
            text.setAttribute('font-weight', 'bold');
            text.setAttribute('text-anchor', 'middle');
            text.textContent = edge.weight >= 0 ? `+${edge.weight.toFixed(2)}` : edge.weight.toFixed(2);
            
            textGroup.appendChild(rect);
            textGroup.appendChild(text);
            
            textGroup.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                if (e.button === 0) {
                    this.selectEdge(edge);
                }
            });

            this.linksLayer.appendChild(path);
            this.linksLayer.appendChild(clickHelper);
            this.linksLayer.appendChild(textGroup);
        });

        // 2. DRAW NODES
        concepts.forEach((concept) => {
            const isSelected = this.selectedElement && 
                               this.selectedElement.type === 'node' && 
                               this.selectedElement.data === concept;

            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.setAttribute('class', 'fcm-node');
            group.setAttribute('transform', `translate(${concept.x}, ${concept.y})`);
            
            // Dynamic pulse/glow mapping current node value
            const pulseScale = 1.0 + (concept.value * 0.12);
            const conceptVal = parseFloat(concept.value);
            
            // Circle outer glow based on current simulation value
            const outerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            outerCircle.setAttribute('r', (this.nodeRadius * pulseScale).toString());
            
            // Map values to elegant colors: Blue-indigo base, glows brighter when highly active
            let nodeFill = 'rgba(15, 23, 42, 0.9)'; // Sleek slate-900 glass
            let nodeStroke = isSelected ? '#6366f1' : 'rgba(99, 102, 241, 0.4)';
            
            if (conceptVal > 0.6) {
                nodeStroke = isSelected ? '#6366f1' : `rgba(16, 185, 129, ${0.4 + conceptVal * 0.5})`; // Vibrant green
            } else if (conceptVal < 0.4 && concept.activationFunction === 'bipolar') {
                nodeStroke = isSelected ? '#6366f1' : `rgba(244, 63, 94, ${0.4 + (1 - conceptVal) * 0.5})`; // Vibrant rose
            }

            outerCircle.setAttribute('fill', nodeFill);
            outerCircle.setAttribute('stroke', nodeStroke);
            outerCircle.setAttribute('stroke-width', isSelected ? '3' : '2');
            outerCircle.style.cursor = 'grab';
            outerCircle.style.filter = 'url(#glow-node)';
            
            // Hover events
            outerCircle.addEventListener('mouseover', () => {
                if (!this.connectingSource) outerCircle.setAttribute('stroke-width', '4');
            });
            outerCircle.addEventListener('mouseout', () => {
                if (!isSelected) outerCircle.setAttribute('stroke-width', '2');
            });

            // Drag behavior hooks
            outerCircle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                if (e.button === 0) {
                    if (e.altKey) {
                        // Alt-drag to connect
                        this.connectingSource = concept.id;
                        this.connectingLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        this.connectingLine.setAttribute('stroke', '#6366f1');
                        this.connectingLine.setAttribute('stroke-width', '2');
                        this.connectingLine.setAttribute('stroke-dasharray', '5,5');
                        this.guiLayer.appendChild(this.connectingLine);
                    } else {
                        // Standard node dragging
                        this.draggedNode = concept;
                        this.dragStart = { x: e.clientX - concept.x, y: e.clientY - concept.y };
                        this.selectNode(concept);
                    }
                }
            });

            // Circular Connector Handle (plus icon)
            const connector = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            connector.setAttribute('class', 'connector-handle');
            connector.setAttribute('transform', `translate(0, -${this.connectorOffset})`);
            connector.style.cursor = 'crosshair';

            const connectorCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            connectorCircle.setAttribute('r', '7');
            connectorCircle.setAttribute('fill', '#1e293b');
            connectorCircle.setAttribute('stroke', '#6366f1');
            connectorCircle.setAttribute('stroke-width', '1.5');
            
            const plus = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            plus.setAttribute('d', 'M -3 0 L 3 0 M 0 -3 L 0 3');
            plus.setAttribute('stroke', '#818cf8');
            plus.setAttribute('stroke-width', '1.5');

            connector.appendChild(connectorCircle);
            connector.appendChild(plus);

            connector.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (e.button === 0) {
                    this.connectingSource = concept.id;
                    this.connectingLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    this.connectingLine.setAttribute('stroke', '#6366f1');
                    this.connectingLine.setAttribute('stroke-width', '2.5');
                    this.connectingLine.setAttribute('stroke-dasharray', '6,4');
                    this.guiLayer.appendChild(this.connectingLine);
                }
            });

            // Node Activation Value Badge (mini circle at bottom-right)
            const badge = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            badge.setAttribute('transform', 'translate(18, 18)');
            
            const badgeBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            badgeBg.setAttribute('r', '9');
            badgeBg.setAttribute('fill', '#0f172a');
            badgeBg.setAttribute('stroke', nodeStroke);
            badgeBg.setAttribute('stroke-width', '1');
            
            const badgeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            badgeText.setAttribute('y', '3');
            badgeText.setAttribute('fill', '#f8fafc');
            badgeText.setAttribute('font-size', '8px');
            badgeText.setAttribute('font-family', 'Inter, sans-serif');
            badgeText.setAttribute('font-weight', 'bold');
            badgeText.setAttribute('text-anchor', 'middle');
            badgeText.textContent = concept.value.toFixed(1);

            badge.appendChild(badgeBg);
            badge.appendChild(badgeText);

            // Node Name Label
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('y', '4');
            text.setAttribute('fill', '#f1f5f9');
            text.setAttribute('font-size', '11px');
            text.setAttribute('font-family', 'Inter, sans-serif');
            text.setAttribute('font-weight', '500');
            text.setAttribute('text-anchor', 'middle');
            text.style.pointerEvents = 'none';

            // Truncate name if too long
            const truncatedName = concept.name.length > 12 ? concept.name.substr(0, 10) + '..' : concept.name;
            text.textContent = truncatedName;

            // Name Tooltip hover title
            const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            title.textContent = `${concept.name}\nInitial: ${concept.initialValue}\nCurrent: ${concept.value.toFixed(4)}`;
            group.appendChild(title);

            group.appendChild(outerCircle);
            group.appendChild(connector);
            group.appendChild(badge);
            group.appendChild(text);

            this.nodesLayer.appendChild(group);
        });
    }

    /**
     * Start/Stop Interactive Force-Directed Layout Physics
     */
    togglePhysics(enabled) {
        this.physicsEnabled = enabled;
        if (enabled) {
            if (this.physicsInterval) return;
            this.physicsInterval = setInterval(() => this.runPhysicsTick(), 25);
        } else {
            if (this.physicsInterval) {
                clearInterval(this.physicsInterval);
                this.physicsInterval = null;
            }
        }
    }

    /**
     * Electrostatic Repulsion & Spring Attraction physics equations
     */
    runPhysicsTick() {
        const concepts = this.engine.getConceptsArray();
        const edges = this.engine.edges;
        if (concepts.length === 0) return;

        // Constants
        const kRepulsion = 16000;
        const kAttraction = 0.08;
        const dRestLength = 160;
        const damping = 0.82;
        const centerGravity = 0.01;

        // Initialize velocity vectors
        const velocities = {};
        concepts.forEach(c => {
            velocities[c.id] = { vx: 0, vy: 0 };
        });

        // 1. Repulsion between ALL node pairs (Coulomb's Law)
        for (let i = 0; i < concepts.length; i++) {
            const c1 = concepts[i];
            for (let j = i + 1; j < concepts.length; j++) {
                const c2 = concepts[j];
                const dx = c1.x - c2.x;
                const dy = c1.y - c2.y;
                const distSqr = dx*dx + dy*dy || 1;
                const dist = Math.sqrt(distSqr);

                if (dist < 350) { // Local repulsion threshold
                    const force = kRepulsion / distSqr;
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;

                    velocities[c1.id].vx += fx;
                    velocities[c1.id].vy += fy;
                    velocities[c2.id].vx -= fx;
                    velocities[c2.id].vy -= fy;
                }
            }
        }

        // 2. Attraction along connected links (Hooke's Law)
        edges.forEach(edge => {
            const c1 = this.engine.concepts.get(edge.source);
            const c2 = this.engine.concepts.get(edge.target);
            if (!c1 || !c2) return;

            const dx = c1.x - c2.x;
            const dy = c1.y - c2.y;
            const dist = Math.hypot(dx, dy) || 1;

            // Compute spring force (attract or push back if too close)
            const force = kAttraction * (dist - dRestLength);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            // Apply force to nodes
            velocities[edge.source].vx -= fx;
            velocities[edge.source].vy -= fy;
            velocities[edge.target].vx += fx;
            velocities[edge.target].vy += fy;
        });

        // 3. Apply updates + Gravity center pull
        const cx = (this.svg.clientWidth / 2) / this.zoom;
        const cy = (this.svg.clientHeight / 2) / this.zoom;

        concepts.forEach(c => {
            if (this.draggedNode && this.draggedNode.id === c.id) return; // Don't move a user dragged node

            // Gravity force pulling towards SVG viewport center
            const gdx = cx - c.x;
            const gdy = cy - c.y;
            velocities[c.id].vx += gdx * centerGravity;
            velocities[c.id].vy += gdy * centerGravity;

            // Apply velocities with damping
            c.vx = (c.vx || 0) * damping + velocities[c.id].vx;
            c.vy = (c.vy || 0) * damping + velocities[c.id].vy;

            // Clamp max velocity per tick to prevent explosion
            const speed = Math.hypot(c.vx, c.vy);
            if (speed > 12) {
                c.vx = (c.vx / speed) * 12;
                c.vy = (c.vy / speed) * 12;
            }

            c.x += c.vx;
            c.y += c.vy;
        });

        this.draw();
    }

    /**
     * One-time automated layout execution (auto-settles graph layout)
     */
    triggerAutoLayout() {
        // Run physics for 80 steps rapidly
        this.togglePhysics(false);
        for (let step = 0; step < 120; step++) {
            this.runPhysicsTick();
        }
        this.draw();
        this.onGraphChanged();
    }
}
