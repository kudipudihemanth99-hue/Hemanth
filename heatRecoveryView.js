/**
 * AuraDC - Waste Heat Recovery View Component
 * Interactive UI rendering ORC & TEG thermodynamic simulations with beautiful Three.js 3D architecture.
 */

import { HeatRecoveryEngine } from './heatRecovery.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export class HeatRecoveryView {
  constructor(containerId, onAskCopilot) {
    this.container = document.getElementById(containerId);
    this.engine = new HeatRecoveryEngine();
    this.onAskCopilot = onAskCopilot;
    
    // 3D Scene state
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.animationId = null;
    this.materials = {};
    this.objects = {};
    
    this.init();
    
    window.addEventListener('themeChanged', () => {
      if (this.animationId) cancelAnimationFrame(this.animationId);
      if (this.renderer) this.renderer.dispose();
      this.init();
    });
  }

  init() {
    if (!this.container) return;
    this.renderLayout();
    this.bindEvents();
    
    setTimeout(() => {
      this.init3DScene();
      this.updateCalculations();
    }, 50);
  }

  renderLayout() {
    const isDark = document.body.classList.contains('dark-mode');
    
    this.container.innerHTML = `
      <div class="heat-recovery-container">
        <!-- Top Banner -->
        <div class="hr-header-card" style="background: ${isDark ? 'rgba(11, 15, 25, 0.7)' : 'rgba(255,255,255,0.7)'}; backdrop-filter: blur(40px); border-radius: 24px; padding: 24px; border: 1px solid rgba(255,255,255,${isDark ? '0.1' : '0.9'}); margin-bottom: 24px; box-shadow: 0 15px 35px rgba(0,50,150,0.05), inset 0 2px 5px ${isDark ? 'transparent' : '#fff'};">
          <div>
            <h2 style="font-size:22px; font-weight:700; color:${isDark ? 'white' : '#0f172a'}; display:flex; align-items:center; gap:10px;">
              <i class="ph-duotone ph-lightning" style="color:var(--primary); font-size:28px; text-shadow: 0 0 15px var(--primary-glow);"></i>
              Waste Heat-to-Electricity Simulator
            </h2>
            <p style="font-size:14px; color:var(--text-muted); margin-top:6px;">
              Predictive thermodynamic conversion of warm liquid waste heat into clean electrical power.
            </p>
          </div>
          
          <div class="hr-preset-bar" style="margin-top: 16px;">
            <span style="font-size:11px; font-weight:600; color:var(--text-muted); letter-spacing:0.5px;">PRESETS:</span>
            <button class="btn btn-preset active" data-preset="d2c">Direct-to-Chip (65°C)</button>
            <button class="btn btn-preset" data-preset="immersion1">Immersion (52°C)</button>
            <button class="btn btn-preset" data-preset="immersion2">Two-Phase (78°C)</button>
          </div>
        </div>

        <div class="hr-main-grid" style="display: grid; grid-template-columns: 350px 1fr; gap: 24px;">
          
          <!-- LEFT COLUMN: Controls -->
          <div class="hr-control-panel" style="display: flex; flex-direction: column; gap: 16px;">
            <div class="zone-section">
              <h3 class="section-title"><i class="ph-duotone ph-gear"></i> Technology</h3>
              <div class="tech-toggle-group" style="display:flex; gap:8px; margin-top:12px;">
                <button class="btn tech-btn active" id="btn-tech-orc" style="flex:1;">ORC Turbine</button>
                <button class="btn tech-btn" id="btn-tech-teg" style="flex:1;">TEG Matrix</button>
              </div>
              <div id="orc-fluid-selector" style="margin-top:16px;">
                <label style="font-size:12px; color:var(--text-muted);">Working Fluid:</label>
                <select class="hr-select" id="select-working-fluid" style="width:100%; padding:8px; border-radius:8px; background:${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.6)'}; color:${isDark ? 'white' : '#0f172a'}; border:1px solid rgba(255,255,255,${isDark ? '0.1' : '0.9'}); margin-top:4px;">
                  <option value="R245fa">R245fa (Standard)</option>
                  <option value="R134a">R134a (High Pressure)</option>
                </select>
              </div>
            </div>

            <div class="zone-section">
              <h3 class="section-title"><i class="ph-duotone ph-thermometer-simple"></i> Thermodynamics</h3>
              
              <div class="slider-group" style="margin-top:12px;">
                <div class="slider-header" style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted); margin-bottom:4px;">
                  <span>Hot Source ($T_{hot}$)</span>
                  <span id="val-t-hot" style="color:${isDark ? 'white' : '#0f172a'}; font-weight:bold;">65 °C</span>
                </div>
                <input type="range" min="35" max="95" value="65" id="slider-t-hot" style="width:100%;">
              </div>

              <div class="slider-group" style="margin-top:12px;">
                <div class="slider-header" style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted); margin-bottom:4px;">
                  <span>Cold Sink ($T_{cold}$)</span>
                  <span id="val-t-cold" style="color:${isDark ? 'white' : '#0f172a'}; font-weight:bold;">18 °C</span>
                </div>
                <input type="range" min="5" max="35" value="18" id="slider-t-cold" style="width:100%;">
              </div>
              
              <div class="slider-group" style="margin-top:12px;">
                <div class="slider-header" style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted); margin-bottom:4px;">
                  <span>Flow Rate</span>
                  <span id="val-flow-rate" style="color:${isDark ? 'white' : '#0f172a'}; font-weight:bold;">150 L/min</span>
                </div>
                <input type="range" min="20" max="500" step="10" value="150" id="slider-flow-rate" style="width:100%;">
              </div>
            </div>
          </div>

          <!-- RIGHT COLUMN: 3D Vis & Analytics -->
          <div class="hr-analytics-panel" style="display: flex; flex-direction: column; gap: 24px;">
            
            <!-- 3D Canvas -->
            <div class="zone-section" style="padding: 0; overflow: hidden; height: 400px; position: relative;">
               <div id="three-canvas-container" style="width: 100%; height: 100%; background: ${isDark ? '#030508' : '#f8fafc'};"></div>
               <div style="position: absolute; top: 16px; left: 16px; z-index: 10; pointer-events: none;">
                 <h3 style="font-size:16px; font-weight:700; color:${isDark ? 'white' : '#0f172a'};"><i class="ph-duotone ph-cube"></i> Live System Architecture</h3>
                 <div id="diagram-tech-badge" style="font-size:11px; color:var(--primary); margin-top:4px;">TEC (Thermoelectric) Active</div>
               </div>
            </div>

            <!-- Metrics -->
            <div class="zone-section">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h3 class="section-title">Net Efficiency Analysis</h3>
                <button class="btn btn-primary" id="btn-copilot-ask-hr" style="font-size:12px; padding:6px 12px; border-radius: 20px;">
                  <i class="ph-duotone ph-sparkle"></i> AI Analysis
                </button>
              </div>

              <div id="feasibility-banner" style="padding: 16px; border-radius: 12px; margin-bottom: 16px; display:flex; gap:16px; align-items:center; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3);">
                <!-- Dynamic -->
              </div>

              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                <div style="background: ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.6)'}; padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,${isDark ? '0.1' : '0.9'}); box-shadow: inset 0 1px 2px ${isDark ? 'transparent' : '#fff'};">
                  <div style="font-size:11px; color:var(--text-muted);">Carnot Limit</div>
                  <div id="res-carnot-eff" style="font-size:18px; font-weight:800; color:${isDark ? 'white' : '#0f172a'}; margin-top:4px;">13.8%</div>
                </div>
                <div style="background: ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.6)'}; padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,${isDark ? '0.1' : '0.9'}); box-shadow: inset 0 1px 2px ${isDark ? 'transparent' : '#fff'};">
                  <div style="font-size:11px; color:var(--text-muted);">Thermal Input</div>
                  <div id="res-q-in" style="font-size:18px; font-weight:800; color:${isDark ? 'white' : '#0f172a'}; margin-top:4px;">209 kW</div>
                </div>
                <div style="background: ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.6)'}; padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,${isDark ? '0.1' : '0.9'}); box-shadow: inset 0 1px 2px ${isDark ? 'transparent' : '#fff'};">
                  <div style="font-size:11px; color:var(--text-muted);">Gross Output</div>
                  <div id="res-p-gross" style="font-size:18px; font-weight:800; color:var(--primary); margin-top:4px;">10.4 kW</div>
                </div>
                <div style="background: ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.6)'}; padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,${isDark ? '0.1' : '0.9'}); box-shadow: inset 0 1px 2px ${isDark ? 'transparent' : '#fff'};">
                  <div style="font-size:11px; color:var(--text-muted);">Net Power</div>
                  <div id="res-p-net" style="font-size:18px; font-weight:800; color:#10b981; margin-top:4px;">7.6 kW</div>
                </div>
                <div style="background: ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.6)'}; padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,${isDark ? '0.1' : '0.9'}); box-shadow: inset 0 1px 2px ${isDark ? 'transparent' : '#fff'};">
                  <div style="font-size:11px; color:var(--text-muted);">CO₂ Avoided / Yr</div>
                  <div id="res-co2-saved" style="font-size:18px; font-weight:800; color:#10b981; margin-top:4px;">0 Tons</div>
                </div>
                <div style="background: ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.6)'}; padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,${isDark ? '0.1' : '0.9'}); box-shadow: inset 0 1px 2px ${isDark ? 'transparent' : '#fff'};">
                  <div style="font-size:11px; color:var(--text-muted);">Cost Saved / Yr</div>
                  <div id="res-cost-saved" style="font-size:18px; font-weight:800; color:#10b981; margin-top:4px;">$0</div>
                </div>
              </div>
              
            </div>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    this.container.querySelectorAll('.btn-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.engine.applyPreset(btn.dataset.preset);
        this.syncInputsFromEngine();
        this.updateCalculations();
      });
    });

    const btnOrc = this.container.querySelector('#btn-tech-orc');
    const btnTeg = this.container.querySelector('#btn-tech-teg');
    const fluidSelector = this.container.querySelector('#orc-fluid-selector');

    btnOrc?.addEventListener('click', () => {
      btnOrc.classList.add('active'); btnTeg.classList.remove('active');
      btnOrc.style.background = 'var(--primary)';
      btnOrc.style.color = 'white';
      btnTeg.style.background = 'transparent';
      btnTeg.style.color = 'var(--text-muted)';
      if (fluidSelector) fluidSelector.style.display = 'block';
      this.engine.techMode = 'ORC';
      this.updateCalculations();
    });

    btnTeg?.addEventListener('click', () => {
      btnTeg.classList.add('active'); btnOrc.classList.remove('active');
      btnTeg.style.background = 'var(--primary)';
      btnTeg.style.color = 'white';
      btnOrc.style.background = 'transparent';
      btnOrc.style.color = 'var(--text-muted)';
      if (fluidSelector) fluidSelector.style.display = 'none';
      this.engine.techMode = 'TEG';
      this.updateCalculations();
    });

    // Initialize toggle styles
    btnOrc.style.background = 'var(--primary)';
    btnOrc.style.color = 'white';

    const bindSlider = (id, engineProp, valId, suffix) => {
      const el = this.container.querySelector(id);
      if (el) {
        el.addEventListener('input', (e) => {
          this.engine[engineProp] = parseFloat(e.target.value);
          this.container.querySelector(valId).textContent = `${e.target.value} ${suffix}`;
          this.updateCalculations();
        });
      }
    };

    bindSlider('#slider-t-hot', 'tHotIn', '#val-t-hot', '°C');
    bindSlider('#slider-t-cold', 'tColdIn', '#val-t-cold', '°C');
    bindSlider('#slider-flow-rate', 'flowRateLpm', '#val-flow-rate', 'L/min');

    this.container.querySelector('#btn-copilot-ask-hr')?.addEventListener('click', () => {
      if (this.onAskCopilot) {
        const res = this.engine.calculate();
        const prompt = `Analyze feasibility for ${res.techMode} waste heat recovery: Hot liquid at ${res.tHotIn}°C, Cold source at ${res.tColdIn}°C. Net power output: ${res.pNetKw.toFixed(2)} kW.`;
        this.onAskCopilot(prompt);
      }
    });
  }

  syncInputsFromEngine() {
    this.container.querySelector('#slider-t-hot').value = this.engine.tHotIn;
    this.container.querySelector('#val-t-hot').textContent = `${this.engine.tHotIn} °C`;
    
    this.container.querySelector('#slider-t-cold').value = this.engine.tColdIn;
    this.container.querySelector('#val-t-cold').textContent = `${this.engine.tColdIn} °C`;
    
    this.container.querySelector('#slider-flow-rate').value = this.engine.flowRateLpm;
    this.container.querySelector('#val-flow-rate').textContent = `${this.engine.flowRateLpm} L/min`;
  }

  init3DScene() {
    const container = this.container.querySelector('#three-canvas-container');
    if (!container) return;

    const isDark = document.body.classList.contains('dark-mode');

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(isDark ? 0x030508 : 0xf8fafc, 0.01);

    this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    this.camera.position.set(0, 10, 15);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.toneMapping = THREE.ReinhardToneMapping;
    this.renderer.setClearColor(isDark ? 0x030508 : 0xf8fafc, 0); // Transparent to blend
    container.appendChild(this.renderer.domElement);

    // Post-processing Bloom
    const renderScene = new RenderPass(this.scene, this.camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(container.clientWidth, container.clientHeight), 1.2, 0.4, 0.85);
    bloomPass.threshold = isDark ? 0.2 : 0.6;
    bloomPass.strength = isDark ? 2.5 : 1.2;
    bloomPass.radius = 0.8;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderScene);
    this.composer.addPass(bloomPass);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.5;

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, isDark ? 0.3 : 1.2);
    this.scene.add(ambient);
    
    const spot = new THREE.SpotLight(0xffffff, isDark ? 1.5 : 2);
    spot.position.set(5, 12, 5);
    spot.angle = Math.PI/3;
    spot.penumbra = 0.5;
    this.scene.add(spot);

    // Dynamic Orbiting Lights
    this.orbitLight1 = new THREE.PointLight(0x00f0ff, isDark ? 2 : 1, 20);
    this.scene.add(this.orbitLight1);
    this.orbitLight2 = new THREE.PointLight(0xff0055, isDark ? 2 : 1, 20);
    this.scene.add(this.orbitLight2);

    // Futuristic Floor Grid
    const gridHelper = new THREE.GridHelper(20, 40, isDark ? 0x06b6d4 : 0x0284c7, isDark ? 0x111111 : 0x94a3b8);
    gridHelper.position.y = -1;
    this.scene.add(gridHelper);

    // Materials (Upgraded to Glass & Gloss)
    this.materials = {
      hot: new THREE.MeshPhysicalMaterial({ color: 0xffedd5, emissive: 0xf97316, emissiveIntensity: 0.8, roughness: 0.1, metalness: 0.2, clearcoat: 1.0, transmission: 0.9, transparent: true }),
      cold: new THREE.MeshPhysicalMaterial({ color: 0xe0f2fe, emissive: 0x0284c7, emissiveIntensity: 0.8, roughness: 0.1, metalness: 0.2, clearcoat: 1.0, transmission: 0.9, transparent: true }),
      pType: new THREE.MeshPhysicalMaterial({ color: 0xfff1f2, emissive: 0xe11d48, emissiveIntensity: 0.5, roughness: 0.1, metalness: 0.2, clearcoat: 1.0, transmission: 0.9, transparent: true }),
      nType: new THREE.MeshPhysicalMaterial({ color: 0xf0fdfa, emissive: 0x0d9488, emissiveIntensity: 0.5, roughness: 0.1, metalness: 0.2, clearcoat: 1.0, transmission: 0.9, transparent: true }),
      base: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5, metalness: 0.5 }),
      turbine: new THREE.MeshPhysicalMaterial({ color: 0xf8fafc, emissive: 0x3b82f6, emissiveIntensity: 0.4, roughness: 0.1, metalness: 0.5, clearcoat: 1.0, transmission: 0.8, transparent: true }),
      pipe: new THREE.MeshPhysicalMaterial({ color: 0xe2e8f0, roughness: 0.1, metalness: 0.2, clearcoat: 1.0, transmission: 0.9, transparent: true })
    };

    // Helper function to add tech wireframes
    const addWireframe = (mesh, color) => {
      const edges = new THREE.EdgesGeometry(mesh.geometry);
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending }));
      mesh.add(line);
    };

    // Base Platform
    const baseGeo = new THREE.CylinderGeometry(8, 8, 0.2, 64);
    const baseMesh = new THREE.Mesh(baseGeo, this.materials.base);
    baseMesh.position.y = -3.5;
    addWireframe(baseMesh, 0x06b6d4);
    this.scene.add(baseMesh);

    // ORC Module Generation
    this.orcGroup = new THREE.Group();
    
    // Evaporator (Hot)
    const evapGeo = new THREE.BoxGeometry(2.5, 3.5, 2.5);
    this.objects.evaporator = new THREE.Mesh(evapGeo, this.materials.hot);
    this.objects.evaporator.position.set(-4, 1.5, 0);
    addWireframe(this.objects.evaporator, 0xffffff);
    // Inner Emissive Core for Evaporator
    const evapCoreGeo = new THREE.BoxGeometry(2.1, 3.1, 2.1);
    const evapCoreMat = new THREE.MeshBasicMaterial({ color: 0xff0055, transparent: true, opacity: 0.8 });
    this.objects.evaporator.add(new THREE.Mesh(evapCoreGeo, evapCoreMat));
    this.orcGroup.add(this.objects.evaporator);

    // Condenser (Cold)
    const condGeo = new THREE.BoxGeometry(2.5, 3.5, 2.5);
    this.objects.condenser = new THREE.Mesh(condGeo, this.materials.cold);
    this.objects.condenser.position.set(4, 1.5, 0);
    addWireframe(this.objects.condenser, 0xffffff);
    // Inner Emissive Core for Condenser
    const condCoreGeo = new THREE.BoxGeometry(2.1, 3.1, 2.1);
    const condCoreMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 });
    this.objects.condenser.add(new THREE.Mesh(condCoreGeo, condCoreMat));
    this.orcGroup.add(this.objects.condenser);

    // Turbine (Center)
    const turbGeo = new THREE.CylinderGeometry(1.5, 1.5, 2.5, 32);
    this.objects.turbine = new THREE.Mesh(turbGeo, this.materials.turbine);
    this.objects.turbine.position.set(0, 2.0, 2);
    this.objects.turbine.rotation.z = Math.PI / 2;
    addWireframe(this.objects.turbine, 0xffffff);
    // Inner Emissive Core for Turbine
    const turbCoreGeo = new THREE.CylinderGeometry(1.1, 1.1, 2.3, 32);
    const turbCoreMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.8 });
    this.objects.turbine.add(new THREE.Mesh(turbCoreGeo, turbCoreMat));
    this.orcGroup.add(this.objects.turbine);

    // Connecting Pipes (ORC)
    this.orcParticles = [];
    const createPipe = (p1, p2, mat, pColor) => {
      const distance = p1.distanceTo(p2);
      const geom = new THREE.CylinderGeometry(0.2, 0.2, distance, 16);
      const mesh = new THREE.Mesh(geom, this.materials.pipe);
      mesh.position.copy(p1).lerp(p2, 0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), p2.clone().sub(p1).normalize());
      addWireframe(mesh, pColor);
      this.orcGroup.add(mesh);
      
      const pGeo = new THREE.SphereGeometry(0.1, 8, 8);
      const pMat = new THREE.MeshBasicMaterial({ color: pColor, blending: THREE.AdditiveBlending });
      const particle = new THREE.Mesh(pGeo, pMat);
      this.orcGroup.add(particle);
      this.orcParticles.push({ mesh: particle, start: p1, end: p2, progress: Math.random() });
    };

    createPipe(new THREE.Vector3(-4, 0.5, 0), new THREE.Vector3(0, 0.5, 2), null, 0xff2a5f);
    createPipe(new THREE.Vector3(0, 3.5, 2), new THREE.Vector3(4, 3.5, 0), null, 0xf59e0b);
    createPipe(new THREE.Vector3(4, 0.5, 0), new THREE.Vector3(-4, 3.5, 0), null, 0x00f0ff);
    
    this.scene.add(this.orcGroup);

    // Components - TEC Module
    this.tecGroup = new THREE.Group();
    
    const plateGeo = new THREE.BoxGeometry(8, 0.4, 8);
    const hotPlate = new THREE.Mesh(plateGeo, this.materials.hot);
    hotPlate.position.y = 2;
    addWireframe(hotPlate, 0xffffff);
    this.tecGroup.add(hotPlate);

    const coldPlate = new THREE.Mesh(plateGeo, this.materials.cold);
    coldPlate.position.y = -2;
    addWireframe(coldPlate, 0xffffff);
    this.tecGroup.add(coldPlate);

    this.tecParticles = [];
    const pillarGeo = new THREE.BoxGeometry(0.8, 3.6, 0.8);
    let isPType = true;

    for (let x = -3; x <= 3; x += 1.5) {
      for (let z = -3; z <= 3; z += 1.5) {
        const pillar = new THREE.Mesh(pillarGeo, isPType ? this.materials.pType : this.materials.nType);
        pillar.position.set(x, 0, z);
        addWireframe(pillar, isPType ? 0xff0055 : 0x00ffff);
        this.tecGroup.add(pillar);

        // Inner Emissive Core
        const innerGeo = new THREE.BoxGeometry(0.3, 3.4, 0.3);
        const innerMat = new THREE.MeshBasicMaterial({ color: isPType ? 0xff0055 : 0x00ffff, transparent: true, opacity: 0.8 });
        const core = new THREE.Mesh(innerGeo, innerMat);
        pillar.add(core);

        const partGeo = new THREE.SphereGeometry(0.15, 8, 8);
        const partMat = new THREE.MeshBasicMaterial({ color: isPType ? 0xff0055 : 0x00ffff, blending: THREE.AdditiveBlending });
        const particle = new THREE.Mesh(partGeo, partMat);
        this.tecGroup.add(particle);

        this.tecParticles.push({
          mesh: particle,
          start: new THREE.Vector3(x, 1.8, z),
          end: new THREE.Vector3(x, -1.8, z),
          progress: Math.random()
        });

        isPType = !isPType;
      }
    }
    
    this.tecGroup.visible = false;
    this.scene.add(this.tecGroup);

    // Handle Resize via ResizeObserver so it works when tab becomes visible
    const resizeObserver = new ResizeObserver(() => {
      if(this.camera && this.renderer && container.clientWidth > 0) {
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.composer.setSize(container.clientWidth, container.clientHeight);
      }
    });
    resizeObserver.observe(container);

    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      this.controls.update();
      
      const time = Date.now() * 0.002;
      const flowRate = (this.engine.flowRateLpm / 150);

      // Orbiting lights animation
      if (this.orbitLight1 && this.orbitLight2) {
        this.orbitLight1.position.set(Math.cos(time) * 8, 2, Math.sin(time) * 8);
        this.orbitLight2.position.set(Math.cos(time + Math.PI) * 8, 2, Math.sin(time + Math.PI) * 8);
      }

      // Fluid floating animation
      if (this.orcGroup && this.tecGroup) {
        this.orcGroup.position.y = Math.sin(time * 2) * 0.2;
        this.tecGroup.position.y = Math.sin(time * 2) * 0.2;
      }

      if (this.engine.techMode === 'ORC') {
        if (this.objects.turbine) {
          this.objects.turbine.rotation.y += 0.08 * flowRate;
          this.materials.turbine.emissiveIntensity = 0.4 + Math.sin(time) * 0.3;
        }
        
        this.orcParticles.forEach(p => {
          p.progress += 0.015 * flowRate;
          if (p.progress > 1) p.progress = 0;
          p.mesh.position.copy(p.start).lerp(p.end, p.progress);
        });
      } else if (this.engine.techMode === 'TEG') {
        this.tecParticles.forEach(p => {
          p.progress += 0.02 * flowRate;
          if (p.progress > 1) p.progress = 0;
          p.mesh.position.copy(p.start).lerp(p.end, p.progress);
        });
      }

      this.composer.render();
    };
    animate();
  }

  updateCalculations() {
    const res = this.engine.calculate();

    this.container.querySelector('#res-carnot-eff').textContent = `${res.carnotEfficiency.toFixed(1)}%`;
    this.container.querySelector('#res-q-in').textContent = `${res.qInKw.toFixed(1)} kW`;
    this.container.querySelector('#res-p-gross').textContent = `${res.pGrossKw.toFixed(2)} kW`;
    
    // Format Cost Savings to currency
    const costFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    this.container.querySelector('#res-co2-saved').textContent = `${res.annualCo2OffsetTons.toFixed(1)} Tons`;
    this.container.querySelector('#res-cost-saved').textContent = costFormatter.format(res.annualSavingsDollar);

    const pNetEl = this.container.querySelector('#res-p-net');
    
    if (res.isNetPositive) {
      pNetEl.textContent = `+${res.pNetKw.toFixed(2)} kW`;
      pNetEl.style.color = '#10b981';
      
      const banner = this.container.querySelector('#feasibility-banner');
      banner.style.background = 'rgba(16,185,129,0.1)';
      banner.style.borderColor = 'rgba(16,185,129,0.3)';
      banner.innerHTML = `
        <i class="ph-fill ph-check-circle" style="font-size:24px; color:#10b981;"></i>
        <div>
          <div style="font-weight:bold; color:#10b981;">Feasible & Net Positive</div>
          <div style="font-size:12px; color:var(--text-muted);">System generates +${res.pNetKw.toFixed(2)} kW clean electricity after parasitic loads.</div>
        </div>
      `;
    } else {
      pNetEl.textContent = `${res.pNetKw.toFixed(2)} kW`;
      pNetEl.style.color = '#ef4444';

      const banner = this.container.querySelector('#feasibility-banner');
      banner.style.background = 'rgba(239,68,68,0.1)';
      banner.style.borderColor = 'rgba(239,68,68,0.3)';
      banner.innerHTML = `
        <i class="ph-fill ph-warning-circle" style="font-size:24px; color:#ef4444;"></i>
        <div>
          <div style="font-weight:bold; color:#ef4444;">Unfeasible - Parasitic Deficit</div>
          <div style="font-size:12px; color:var(--text-muted);">Parasitic load exceeds generation due to low ΔT. Increase liquid temp.</div>
        </div>
      `;
    }

    if(this.materials.hot) {
      // Adjust emissive glow based on T Hot
      const intensity = (res.tHotIn - 35) / 60; 
      this.materials.hot.emissiveIntensity = 0.2 + (intensity * 0.8);
    }
    
    const badgeTech = this.container.querySelector('#diagram-tech-badge');
    if (badgeTech) {
      badgeTech.textContent = res.techMode === 'ORC' ? 'ORC Turbine Cycle Active' : 'Solid-State TEG Active';
    }
    
    if (this.orcGroup && this.tecGroup) {
      this.orcGroup.visible = (res.techMode === 'ORC');
      this.tecGroup.visible = (res.techMode === 'TEG');
    }
  }
}
