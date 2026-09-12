/**
 * AuraDC - Rack Visualization & Inspector Module
 * Renders the data center grid layout, thermal heatmap overlay, and a beautiful 3D 42U blade inspector modal.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export class RackView {
  constructor(telemetryEngine, onSelectRackForAI) {
    this.telemetry = telemetryEngine;
    this.onSelectRackForAI = onSelectRackForAI;
    this.currentZoneFilter = 'all';
    this.heatmapMode = false;
    this.selectedRackId = null;

    // 3D properties
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.animationId = null;
    this.blades = []; // Store 3D blade meshes

    this.initDOM();

    window.addEventListener('themeChanged', () => {
      if (this.modalBackdrop && this.modalBackdrop.classList.contains('active')) {
        this.openRackInspector(this.selectedRackId); // Re-render modal to apply theme
      }
    });
  }

  initDOM() {
    this.floorContainer = document.getElementById('datacenter-floor');
    this.modalBackdrop = document.getElementById('rack-modal-backdrop');
    this.modalCloseBtn = document.getElementById('modal-close-btn');

    if (this.modalCloseBtn) {
      this.modalCloseBtn.addEventListener('click', () => this.closeModal());
    }

    if (this.modalBackdrop) {
      this.modalBackdrop.addEventListener('click', (e) => {
        if (e.target === this.modalBackdrop) this.closeModal();
      });
    }

    // Hardware Modal DOM
    this.hardwareModal = document.getElementById('hardware-modal-backdrop');
    this.hardwareDeployBtn = document.getElementById('hardware-modal-deploy-btn');
    this.hardwareCancelBtn = document.getElementById('hardware-modal-cancel-btn');
    this.hardwareCloseBtn = document.getElementById('hardware-modal-close-btn');

    const closeHardwareModal = () => this.hardwareModal.classList.remove('active');
    
    if (this.hardwareCloseBtn) this.hardwareCloseBtn.addEventListener('click', closeHardwareModal);
    if (this.hardwareCancelBtn) this.hardwareCancelBtn.addEventListener('click', closeHardwareModal);
    
    if (this.hardwareDeployBtn) {
      this.hardwareDeployBtn.addEventListener('click', () => {
        const count = parseInt(document.getElementById('hardware-rack-count').value) || 1;
        const zoneId = this.hardwareDeployBtn.dataset.zone;
        if (zoneId) {
          this.telemetry.addRacksToZone(zoneId, count);
          closeHardwareModal();
          this.render(); // Re-render the grid
        }
      });
    }

    // Edit Zone Modal DOM
    this.editZoneModal = document.getElementById('edit-zone-modal-backdrop');
    this.editZoneSaveBtn = document.getElementById('edit-zone-modal-save-btn');
    this.editZoneCancelBtn = document.getElementById('edit-zone-modal-cancel-btn');
    this.editZoneCloseBtn = document.getElementById('edit-zone-modal-close-btn');

    const closeEditZoneModal = () => this.editZoneModal.classList.remove('active');
    
    if (this.editZoneCloseBtn) this.editZoneCloseBtn.addEventListener('click', closeEditZoneModal);
    if (this.editZoneCancelBtn) this.editZoneCancelBtn.addEventListener('click', closeEditZoneModal);
    
    if (this.editZoneSaveBtn) {
      this.editZoneSaveBtn.addEventListener('click', () => {
        const zoneId = this.editZoneSaveBtn.dataset.zone;
        const targetTemp = parseFloat(document.getElementById('edit-zone-temp').value) || 22;
        const powerAlloc = parseFloat(document.getElementById('edit-zone-power').value) || 250;
        
        if (zoneId) {
          // Update zone logic
          this.telemetry.updateZoneSettings(zoneId, targetTemp, powerAlloc);
          closeEditZoneModal();
          this.render(); // Re-render the grid
        }
      });
    }

    // Heatmap mode toggle button
    const heatmapBtn = document.getElementById('toggle-heatmap-btn');
    if (heatmapBtn) {
      heatmapBtn.addEventListener('click', () => {
        this.heatmapMode = !this.heatmapMode;
        heatmapBtn.classList.toggle('active', this.heatmapMode);
        heatmapBtn.innerHTML = this.heatmapMode 
          ? `<i class="ph-duotone ph-fire"></i> Thermal Heatmap (Active)`
          : `<i class="ph-duotone ph-thermometer-simple"></i> Toggle Heatmap Overlay`;
        this.render();
      });
    }

    // Zone filter buttons
    const filterBtns = document.querySelectorAll('.zone-filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentZoneFilter = btn.dataset.zone;
        this.render();
      });
    });
  }

  render() {
    if (!this.floorContainer) return;
    this.floorContainer.innerHTML = '';

    if (this.heatmapMode) {
      this.floorContainer.classList.add('heatmap-mode');
    } else {
      this.floorContainer.classList.remove('heatmap-mode');
    }

    const zonesToRender = this.currentZoneFilter === 'all' 
      ? this.telemetry.zones 
      : this.telemetry.zones.filter(z => z.id === this.currentZoneFilter);

    zonesToRender.forEach(zone => {
      const zoneRacks = this.telemetry.racks.filter(r => r.zoneId === zone.id);
      
      const zoneEl = document.createElement('div');
      zoneEl.className = 'zone-section';

      zoneEl.innerHTML = `
        <div class="zone-header" style="display:flex; justify-content:space-between; align-items:center;">
          <div class="zone-title-box">
            <span class="zone-badge" style="background:${zone.color}20; color:${zone.color}; border-color:${zone.color}40">${zone.id.toUpperCase()}</span>
            <h3 style="font-size:15px; font-weight:600;">${zone.name}</h3>
          </div>
          <div style="display:flex; align-items:center; gap:12px;">
            <span style="font-size:12px; color:var(--text-muted); font-family:var(--font-mono);">${zoneRacks.length} Server Racks Operational</span>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-sm add-hardware-btn" data-zone="${zone.id}" data-zonename="${zone.name}" style="padding:4px 8px; font-size:13px;"><i class="ph-bold ph-plus"></i> Add</button>
              <button class="btn btn-sm edit-zone-btn" data-zone="${zone.id}" data-zonename="${zone.name}" style="padding:4px 8px; font-size:13px;"><i class="ph-bold ph-pencil"></i> Edit</button>
            </div>
          </div>
        </div>
        <div class="rack-grid" id="grid-${zone.id}"></div>
      `;

      this.floorContainer.appendChild(zoneEl);
      const gridContainer = zoneEl.querySelector(`#grid-${zone.id}`);

      zoneRacks.forEach(rack => {
        const rackCard = this.createRackCard(rack);
        gridContainer.appendChild(rackCard);
      });
      
      const addBtns = zoneEl.querySelectorAll('.add-hardware-btn');
      addBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          document.getElementById('hardware-modal-zone-name').textContent = btn.dataset.zonename;
          this.hardwareDeployBtn.dataset.zone = btn.dataset.zone;
          document.getElementById('hardware-rack-count').value = 1;
          this.hardwareModal.classList.add('active');
        });
      });

      const editBtns = zoneEl.querySelectorAll('.edit-zone-btn');
      editBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const zoneId = btn.dataset.zone;
          const zoneName = btn.dataset.zonename;
          
          if (this.editZoneModal) {
            const zData = this.telemetry.getGlobalSnapshot().zones.find(z => z.id === zoneId);
            document.getElementById('edit-zone-modal-zone-name').textContent = zoneName;
            document.getElementById('edit-zone-temp').value = zData ? Math.round(zData.avgTemp) : 22;
            document.getElementById('edit-zone-power').value = zData ? Math.round(zData.powerKw) : 250;
            
            this.editZoneSaveBtn.dataset.zone = zoneId;
            this.editZoneModal.classList.add('active');
          }
        });
      });
    });
  }

  createRackCard(rack) {
    const card = document.createElement('div');
    
    // Determine thermal class for heatmap mode
    let heatClass = 'heat-cool';
    if (rack.temp >= 40) heatClass = 'heat-hot';
    else if (rack.temp >= 33) heatClass = 'heat-warm';
    else if (rack.temp >= 24) heatClass = 'heat-optimal';

    card.className = `rack-card status-${rack.status} ${heatClass}`;
    card.dataset.rackId = rack.id;

    // Build chassis U-units mini representation
    let chassisUnitsHTML = '';
    for (let u = 0; u < 12; u++) {
      let unitState = 'active';
      if (rack.status === 'warning' && u % 4 === 0) unitState = 'active-warning';
      if (rack.status === 'critical' && u === 6) unitState = 'active-critical';
      chassisUnitsHTML += `<div class="chassis-unit ${unitState}"></div>`;
    }

    card.innerHTML = `
      <div class="rack-card-header">
        <span class="rack-id">${rack.id}</span>
        <span class="rack-status-pill" style="background-color: var(--status-${rack.status === 'isolated' ? 'info' : rack.status})"></span>
      </div>
      <div class="rack-chassis-preview">
        ${chassisUnitsHTML}
      </div>
      <div class="rack-metrics">
        <span>${rack.powerKw} kW</span>
        <span class="rack-temp-val" style="color: ${rack.temp >= 40 ? 'var(--status-critical)' : (rack.temp >= 33 ? 'var(--status-warning)' : 'var(--text-main)')}">
          ${rack.temp}°C
        </span>
      </div>
    `;

    card.addEventListener('click', () => this.openRackInspector(rack.id));

    return card;
  }

  openRackInspector(rackId) {
    this.selectedRackId = rackId;
    const rack = this.telemetry.getRackById(rackId);
    if (!rack) return;

    const modalTitle = document.getElementById('modal-rack-id');
    const modalZone = document.getElementById('modal-rack-zone');
    const modalStatusPill = document.getElementById('modal-status-pill');
    const modalBody = document.getElementById('modal-body-content');

    if (modalTitle) modalTitle.textContent = `42U Rack Inspection: ${rack.id}`;
    if (modalZone) modalZone.textContent = `Zone: ${rack.workloadType}`;
    if (modalStatusPill) {
      modalStatusPill.className = `status-indicator-badge`;
      modalStatusPill.style.color = `var(--status-${rack.status === 'isolated' ? 'info' : rack.status})`;
      modalStatusPill.innerHTML = `<span class="pulse-dot"></span> Status: ${rack.status.toUpperCase()}`;
    }

    const isDark = document.body.classList.contains('dark-mode');

    // Reconstruct Modal Body to include 3D Canvas
    modalBody.innerHTML = `
      <div class="rack-42u-container" style="padding: 0; overflow: hidden; position: relative; height: 500px; background: ${isDark ? '#020617' : '#f8fafc'}; border: 1px solid rgba(255,255,255,${isDark ? '0.1' : '0.9'}); border-radius: 12px; box-shadow: inset 0 2px 4px #fff;">
        <div id="rack-3d-canvas" style="width: 100%; height: 100%;"></div>
        <div style="position: absolute; top: 12px; left: 12px; font-size: 11px; font-weight: 700; color: ${isDark ? 'var(--text-muted)' : '#0f172a'}; text-transform: uppercase;">Live 3D Thermal Model</div>
      </div>
      
      <div class="blade-details-panel">
        <div class="detail-stat-grid">
          <div class="detail-card">
            <div class="detail-card-label">Rack Thermal Probe</div>
            <div class="detail-card-value" style="color:${rack.temp >= 40 ? 'var(--status-critical)' : 'var(--text-main)'}">${rack.temp} °C</div>
          </div>
          <div class="detail-card">
            <div class="detail-card-label">Total Rack Draw</div>
            <div class="detail-card-value">${rack.powerKw} kW</div>
          </div>
          <div class="detail-card">
            <div class="detail-card-label">Ambient Humidity</div>
            <div class="detail-card-value">${rack.humidity} %</div>
          </div>
          <div class="detail-card">
            <div class="detail-card-label">PUE Impact</div>
            <div class="detail-card-value">${rack.pueContribution}</div>
          </div>
        </div>

        <div style="background:rgba(255,255,255,${isDark ? '0.03' : '0.6'}); border:1px solid rgba(255,255,255,${isDark ? '0.08' : '0.9'}); border-radius:var(--radius-md); padding:16px;">
          <h4 style="font-size:13px; font-weight:700; margin-bottom:12px; color:${isDark ? 'white' : '#0f172a'};">Automated Operations & Controls</h4>
          <div style="display:flex; flex-wrap:wrap; gap:10px;">
            <button class="btn btn-primary" id="btn-ai-diagnose-rack">
              <i class="ph-duotone ph-robot"></i> Ask AI Copilot to Diagnose
            </button>
            <button class="btn" id="btn-migrate-rack">
              <i class="ph-duotone ph-arrows-left-right"></i> Live Migrate Workloads
            </button>
            <button class="btn" id="btn-isolate-rack" style="color:var(--status-warning);">
              <i class="ph-duotone ph-power"></i> Put in Maintenance Mode
            </button>
          </div>
        </div>
      </div>
    `;

    this.modalBackdrop.classList.add('active');

    // Initialize 3D Canvas
    setTimeout(() => {
      this.initRack3D(rack);
    }, 100);

    // Attach button listeners inside modal
    document.getElementById('btn-ai-diagnose-rack')?.addEventListener('click', () => {
      this.closeModal();
      if (this.onSelectRackForAI) {
        this.onSelectRackForAI(`Perform full thermal and health diagnostic on Rack ${rack.id}. Recommend mitigation steps.`);
      }
    });

    document.getElementById('btn-migrate-rack')?.addEventListener('click', () => {
      // Find a healthy target rack
      const targetRack = this.telemetry.racks.find(r => r.status === 'healthy' && r.id !== rack.id);
      if (targetRack) {
        this.telemetry.migrateWorkload(rack.id, targetRack.id);
        this.openRackInspector(rack.id); // Refresh view
      }
    });

    document.getElementById('btn-isolate-rack')?.addEventListener('click', () => {
      this.telemetry.isolateRack(rack.id);
      this.closeModal();
      this.render();
    });
  }

  initRack3D(rackData) {
    const container = document.getElementById('rack-3d-canvas');
    if (!container) return;

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.renderer) {
      this.renderer.dispose();
      container.innerHTML = '';
    }

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 100);
    this.camera.position.set(4, 5, 6);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.toneMapping = THREE.ReinhardToneMapping;
    container.appendChild(this.renderer.domElement);

    // Post-processing Bloom
    const renderScene = new RenderPass(this.scene, this.camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(container.clientWidth, container.clientHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = isDark ? 0.2 : 0.6;
    bloomPass.strength = isDark ? 2.5 : 1.2;
    bloomPass.radius = 0.8;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderScene);
    this.composer.addPass(bloomPass);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 2.0;

    const isDark = document.body.classList.contains('dark-mode');

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, isDark ? 0.2 : 1.0);
    this.scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, isDark ? 1.5 : 2.0);
    dirLight.position.set(5, 10, 5);
    this.scene.add(dirLight);

    // Dynamic Orbiting Lights
    this.orbitLight1 = new THREE.PointLight(0x06b6d4, isDark ? 3 : 1.5, 20);
    this.scene.add(this.orbitLight1);
    this.orbitLight2 = new THREE.PointLight(0x3b82f6, isDark ? 3 : 1.5, 20);
    this.scene.add(this.orbitLight2);

    // Futuristic Floor Grid
    const gridHelper = new THREE.GridHelper(10, 20, isDark ? 0x06b6d4 : 0x0284c7, isDark ? 0x111111 : 0x94a3b8);
    gridHelper.position.y = -3.7;
    this.scene.add(gridHelper);

    // Group for entire rack
    const rackGroup = new THREE.Group();
    this.scene.add(rackGroup);

    // Chassis Frame (Glass/Tech look)
    const frameGeo = new THREE.BoxGeometry(2.2, 8.4, 2.2);
    const frameMat = new THREE.MeshPhysicalMaterial({ 
      color: isDark ? 0x050505 : 0xffffff, 
      metalness: isDark ? 0.9 : 0.1, 
      roughness: 0.0, 
      transparent: true, 
      opacity: isDark ? 0.4 : 0.1,
      transmission: 0.9,
      clearcoat: 1.0
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    rackGroup.add(frame);

    // Glowing wireframe edges
    const edges = new THREE.EdgesGeometry(frameGeo);
    const lineMat = new THREE.LineBasicMaterial({ color: isDark ? 0x06b6d4 : 0x0284c7, linewidth: 2, transparent: true, opacity: isDark ? 0.6 : 0.4 });
    const line = new THREE.LineSegments(edges, lineMat);
    rackGroup.add(line);

    // Scanning Laser (Futuristic effect)
    const laserGeo = new THREE.PlaneGeometry(2.5, 2.5);
    const laserMat = new THREE.MeshBasicMaterial({ 
      color: 0x06b6d4, 
      transparent: true, 
      opacity: 0.4, 
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const scanner = new THREE.Mesh(laserGeo, laserMat);
    scanner.rotation.x = Math.PI / 2;
    rackGroup.add(scanner);
    
    this.blades = [];

    // Populate 42U Server Blades
    const totalBlades = 12; // Simplified for visual
    const bladeHeight = 0.5;
    const spacing = 0.65;
    const startY = -3.5;

    for (let i = 0; i < totalBlades; i++) {
      // Create blade
      const bladeGeo = new THREE.BoxGeometry(1.9, bladeHeight, 1.9);
      
      // Determine color based on rack status and blade index
      let baseColor = 0x0ea5e9; // Blue default
      let isAlert = false;
      
      if (rackData.status === 'critical' && i === 6) {
        baseColor = 0xef4444; // Red
        isAlert = true;
      } else if (rackData.status === 'warning' && i % 4 === 0) {
        baseColor = 0xf59e0b; // Orange
      } else if (rackData.temp >= 40) {
        baseColor = 0xf43f5e; // Rose hot
      }

      const bladeMat = new THREE.MeshPhysicalMaterial({
        color: isDark ? 0x000000 : 0xf8fafc,
        emissive: baseColor,
        emissiveIntensity: isAlert ? 1.2 : (isDark ? 0.4 : 0.6),
        metalness: 0.2,
        roughness: 0.1,
        clearcoat: 1.0,
        transmission: 0.8,
        transparent: true
      });

      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.y = startY + (i * spacing);
      blade.userData = { isAlert, baseIntensity: bladeMat.emissiveIntensity };
      
      this.blades.push(blade);
      rackGroup.add(blade);

      // Highly Emissive Inner Cyber Core
      const innerBladeGeo = new THREE.BoxGeometry(1.7, 0.3, 1.7);
      const innerBladeMat = new THREE.MeshBasicMaterial({ color: baseColor, transparent: true, opacity: 0.9 });
      const innerBlade = new THREE.Mesh(innerBladeGeo, innerBladeMat);
      blade.add(innerBlade);

      // Add a small LED light on the front panel
      const ledGeo = new THREE.BoxGeometry(0.1, 0.05, 0.1);
      const ledMat = new THREE.MeshBasicMaterial({ color: baseColor });
      const led = new THREE.Mesh(ledGeo, ledMat);
      led.position.set(0.7, 0, 0.95);
      
      // Halo glow for LED
      const haloGeo = new THREE.PlaneGeometry(0.3, 0.3);
      const haloMat = new THREE.MeshBasicMaterial({ color: baseColor, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.set(0, 0, 0.06);
      led.add(halo);

      blade.add(led);
    }

    // Animation Loop and Resize Observer
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
      
      // Floating animation for the rack group
      if (rackGroup) {
        rackGroup.position.y = Math.sin(time * 1.5) * 0.15;
      }
      
      // Orbiting dynamic lights
      if (this.orbitLight1 && this.orbitLight2) {
        this.orbitLight1.position.set(Math.cos(time) * 6, 2, Math.sin(time) * 6);
        this.orbitLight2.position.set(Math.cos(time + Math.PI) * 6, -2, Math.sin(time + Math.PI) * 6);
      }
      
      // Animate scanning laser
      scanner.position.y = Math.sin(time * 2.5) * 3.8;
      
      // Make alerts blink
      this.blades.forEach(blade => {
        if (blade.userData.isAlert) {
          blade.material.emissiveIntensity = 0.5 + Math.sin(time * 2) * 1.5;
        }
      });

      this.composer.render();
    };
    animate();
  }

  closeModal() {
    if (this.modalBackdrop) this.modalBackdrop.classList.remove('active');
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
  }
}
