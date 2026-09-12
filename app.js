/**
 * AuraDC - Main Application Controller & Telemetry Charts
 * Connects telemetry engine, rack visualizer, AI assistant, tab switching, and chart visualizations.
 */

import { TelemetryEngine } from './telemetry.js?v=9';
import { RackView } from './rackView.js?v=9';
import { AiAssistant } from './aiAssistant.js?v=9';
import { HeatRecoveryView } from './heatRecoveryView.js?v=9';
import { SihPresentationView } from './sihPresentationView.js?v=9';

class DataCenterApp {
  constructor() {
    this.telemetry = new TelemetryEngine();
    this.rackView = new RackView(this.telemetry, (prompt) => {
      if (this.copilot) {
        this.copilot.handleUserSubmit(prompt);
      }
    });
    this.copilot = new AiAssistant(this.telemetry);
    this.heatRecoveryView = new HeatRecoveryView('view-heat-recovery', (prompt) => {
      if (this.copilot) {
        this.copilot.handleUserSubmit(prompt);
      }
    });
    this.sihPresentationView = new SihPresentationView('view-sih-presentation', (prompt) => {
      if (this.copilot) {
        this.copilot.handleUserSubmit(prompt);
      }
    });

    this.currentTab = 'floorplan';
    this.initDOM();
    this.initCharts();
    
    // Subscribe to real-time telemetry updates
    this.telemetry.subscribe((snapshot) => this.onTelemetryUpdate(snapshot));
    
    // First render
    this.rackView.render();
    this.onTelemetryUpdate(this.telemetry.getGlobalSnapshot());
  }

  initDOM() {
    // Navigation items
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        this.switchTab(item.dataset.tab);
      });
    });

    // Copilot Drawer Toggle
    const toggleCopilotBtn = document.getElementById('toggle-copilot-btn');
    const appContainer = document.querySelector('.app-container');
    if (toggleCopilotBtn && appContainer) {
      toggleCopilotBtn.addEventListener('click', () => {
        appContainer.classList.toggle('copilot-collapsed');
      });
    }

    // Theme Toggle Logic
    const toggleThemeBtn = document.getElementById('toggle-theme-btn');
    if (toggleThemeBtn) {
      const themeIcon = toggleThemeBtn.querySelector('i');
      const isDark = localStorage.getItem('aura_theme') === 'dark';
      
      if (isDark) {
        document.body.classList.add('dark-mode');
        themeIcon.className = 'ph-duotone ph-sun';
      }
      
      toggleThemeBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const darkActive = document.body.classList.contains('dark-mode');
        localStorage.setItem('aura_theme', darkActive ? 'dark' : 'light');
        themeIcon.className = darkActive ? 'ph-duotone ph-sun' : 'ph-duotone ph-moon';
        
        // Notify other components (like Three.js scenes)
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { isDark: darkActive } }));
      });
    }

    // Language Toggle Logic
    const langSelect = document.getElementById('lang-select-main');
    
    const uiTranslations = {
      en: { floorplan: "Floor Plan", analytics: "Analytics", incidents: "Incidents", rebalance: "Live Rebalance", helpdesk: "About and Help Desk" },
      es: { floorplan: "Plano", analytics: "Análisis", incidents: "Incidentes", rebalance: "Equilibrar", helpdesk: "Acerca de y Ayuda" },
      fr: { floorplan: "Plan", analytics: "Analytique", incidents: "Incidents", rebalance: "Rééquilibrer", helpdesk: "À propos et Aide" },
      de: { floorplan: "Grundriss", analytics: "Analytik", incidents: "Vorfälle", rebalance: "Ausgleichen", helpdesk: "Über und Hilfe" },
      zh: { floorplan: "平面图", analytics: "分析", incidents: "事件", rebalance: "实时均衡", helpdesk: "关于和帮助" },
      hi: { floorplan: "मंजिल योजना", analytics: "विश्लेषण", incidents: "घटनाएं", rebalance: "संतुलन", helpdesk: "के बारे में और सहायता" }
    };

    const applyMainTranslation = (lang) => {
      if(!uiTranslations[lang]) return;
      const t = uiTranslations[lang];
      document.querySelector('[data-tab="floorplan"]').innerHTML = `<i class="ph-duotone ph-squares-four"></i> ${t.floorplan}`;
      document.querySelector('[data-tab="analytics"]').innerHTML = `<i class="ph-duotone ph-chart-line-up"></i> ${t.analytics}`;
      document.querySelector('[data-tab="incidents"]').innerHTML = `<i class="ph-duotone ph-warning-circle"></i> ${t.incidents}`;
      const helpDeskTab = document.querySelector('[data-tab="sih-presentation"]');
      if (helpDeskTab) helpDeskTab.innerHTML = `<i class="ph-duotone ph-info"></i> ${t.helpdesk}`;
      const rebalanceBtn = document.getElementById('header-btn-rebalance');
      if(rebalanceBtn) rebalanceBtn.innerHTML = `<i class="ph-duotone ph-arrows-left-right"></i> ${t.rebalance}`;
    };

    if (langSelect) {
      if (localStorage.getItem('aura_lang')) {
        const savedLang = localStorage.getItem('aura_lang');
        langSelect.value = savedLang;
        applyMainTranslation(savedLang);
      }
      langSelect.addEventListener('change', (e) => {
        const newLang = e.target.value;
        localStorage.setItem('aura_lang', newLang);
        applyMainTranslation(newLang);
      });
    }

    // Quick Simulation Action Buttons in Header
    document.getElementById('header-btn-cooling')?.addEventListener('click', () => {
      this.telemetry.triggerEmergencyCooling();
    });

    document.getElementById('header-btn-rebalance')?.addEventListener('click', () => {
      this.copilot.handleUserSubmit("Simulate VM live migration");
    });
  }

  switchTab(tabId) {
    this.currentTab = tabId;
    const views = document.querySelectorAll('.tab-view');
    views.forEach(v => {
      if (v.id === `view-${tabId}`) {
        v.classList.remove('hidden');
      } else {
        v.classList.add('hidden');
      }
    });

    if (tabId === 'floorplan') {
      this.rackView.render();
    } else if (tabId === 'analytics') {
      this.renderCharts();
    } else if (tabId === 'incidents') {
      this.renderIncidentsView();
    }
  }

  onTelemetryUpdate(snapshot) {
    // Update KPI cards in header & dashboard
    const kpiPue = document.getElementById('kpi-pue-val');
    const kpiPower = document.getElementById('kpi-power-val');
    const kpiTemp = document.getElementById('kpi-temp-val');
    const kpiRacks = document.getElementById('kpi-racks-val');
    const headerAlertBadge = document.getElementById('header-alert-count');

    if (kpiPue) kpiPue.textContent = snapshot.pue;
    if (kpiPower) kpiPower.textContent = `${snapshot.totalPowerKw} kW`;
    if (kpiTemp) kpiTemp.textContent = `${snapshot.avgTemp} °C`;
    if (kpiRacks) kpiRacks.textContent = `${snapshot.healthyCount} / ${snapshot.totalRacks}`;

    if (headerAlertBadge) {
      const activeAlertsCount = snapshot.warningCount + snapshot.criticalCount;
      headerAlertBadge.textContent = `${activeAlertsCount} Alerts`;
      headerAlertBadge.style.color = activeAlertsCount > 0 ? 'var(--status-critical)' : 'var(--status-healthy)';
    }

    // Refresh Rack View if active tab
    if (this.currentTab === 'floorplan') {
      this.rackView.render();
    }

    // Refresh Charts if analytics tab
    if (this.currentTab === 'analytics') {
      this.renderCharts();
    }

    // Refresh Incidents tab if active
    if (this.currentTab === 'incidents') {
      this.renderIncidentsView();
    }
  }

  initCharts() {
    this.pueCanvas = document.getElementById('chart-pue');
    this.powerCanvas = document.getElementById('chart-power');
    this.tempCanvas = document.getElementById('chart-temp');
  }

  renderCharts() {
    const history = this.telemetry.metricsHistory;
    this.drawSparkline(this.pueCanvas, history.pue, '#06b6d4', 'PUE (Target < 1.25)');
    this.drawSparkline(this.powerCanvas, history.totalPowerKw, '#8b5cf6', 'Total IT Draw (kW)');
    this.drawSparkline(this.tempCanvas, history.avgTemp, '#f59e0b', 'Ambient Temperature (°C)');
  }

  drawSparkline(canvas, dataPoints, color, label) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.parentElement.clientWidth || 400;
    const height = canvas.height = 200;

    ctx.clearRect(0, 0, width, height);

    if (!dataPoints || dataPoints.length < 2) return;

    const min = Math.min(...dataPoints) * 0.95;
    const max = Math.max(...dataPoints) * 1.05;
    const range = (max - min) || 1;

    // Draw Gridlines
    const isDark = document.body.classList.contains('dark-mode');
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 1;
    for (let y = 30; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Plot Line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';

    const step = width / (dataPoints.length - 1);

    dataPoints.forEach((val, i) => {
      const x = i * step;
      const y = height - ((val - min) / range) * (height - 40) - 20;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill Gradient under curve
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `${color}40`);
    gradient.addColorStop(1, `${color}00`);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw Data Point Circles
    dataPoints.forEach((val, i) => {
      const x = i * step;
      const y = height - ((val - min) / range) * (height - 40) - 20;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      const isDark = document.body.classList.contains('dark-mode');
      ctx.strokeStyle = isDark ? '#0f172a' : '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Draw Legend / Label
    ctx.font = '12px JetBrains Mono, monospace';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText(`${label}: Current ${dataPoints[dataPoints.length - 1]}`, 10, 20);
  }

  renderIncidentsView() {
    const container = document.getElementById('incidents-list-container');
    if (!container) return;

    const snapshot = this.telemetry.getGlobalSnapshot();
    let html = '';

    snapshot.alerts.forEach(alert => {
      html += `
        <div style="background:rgba(255,255,255,0.7); border:1px solid rgba(255,255,255,0.9); border-left:4px solid var(--status-${alert.severity === 'info' ? 'info' : alert.severity}); border-radius:var(--radius-md); padding:16px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; box-shadow: 0 10px 25px rgba(0,50,150,0.05);">
          <div>
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
              <span class="brand-tag" style="background:rgba(255,255,255,0.05); color:var(--text-main); border:1px solid rgba(255,255,255,0.1);">${alert.time}</span>
              <span style="font-weight:600; font-size:14px;">${alert.title}</span>
              <span style="font-size:11px; font-family:var(--font-mono); color:var(--primary);">[${alert.rackId}]</span>
            </div>
            <div style="font-size:13px; color:var(--text-muted);">${alert.message}</div>
          </div>
          <button class="btn btn-primary btn-incident-action" data-rack="${alert.rackId}" style="font-size:12px; padding:6px 12px;">
            Diagnose with AI
          </button>
        </div>
      `;
    });

    container.innerHTML = html || `<div style="color:var(--text-muted); text-align:center; padding:40px;">No active alerts logged.</div>`;

    container.querySelectorAll('.btn-incident-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const rackId = btn.dataset.rack;
        this.switchTab('floorplan');
        this.copilot.handleUserSubmit(`Diagnose thermal and operational status for ${rackId}`);
      });
    });
  }
}

// Bootstrap app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.auraApp = new DataCenterApp();
  
  // Re-render charts on theme change
  window.addEventListener('themeChanged', () => {
    if (window.auraApp.currentTab === 'analytics') {
      window.auraApp.renderCharts();
    }
  });
});
