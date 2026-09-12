/**
 * AuraDC - AI Operations Copilot Engine
 * Context-aware natural language assistant for data center monitoring, diagnostic audits, and automated operations.
 */

export class AiAssistant {
  constructor(telemetryEngine) {
    this.telemetry = telemetryEngine;
    this.chatHistory = [];
    this.initDOM();
  }

  initDOM() {
    this.container = document.getElementById('copilot-chat-container');
    this.input = document.getElementById('copilot-input-field');
    this.sendBtn = document.getElementById('copilot-send-btn');
    this.suggestionsContainer = document.getElementById('copilot-suggestions');

    if (this.sendBtn && this.input) {
      this.sendBtn.addEventListener('click', () => this.handleUserSubmit());
      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleUserSubmit();
      });
    }

    // Default suggestions
    this.renderSuggestions([
      "How can I save CO₂ and electricity?",
      "How is CO2 saved calculated?",
      "Show 4-pillar feasibility analysis",
      "Diagnose thermal anomalies"
    ]);

    // Initial greeting message
    this.addAssistantMessage(`👋 **Hello! I am Preeti, your AI Assistant.**<br><br>I monitor thermal telemetry, power usage (PUE), HVAC load, and blade server health across all zones in real-time.<br><br>**Here is what I can do for you:**<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px;"><div style="background:rgba(2,132,199,0.1); border:1px solid rgba(2,132,199,0.3); padding:8px; border-radius:6px; font-size:11px;">🌱 <strong>Save CO₂ & Energy</strong><br>Auto-route waste heat to TECs</div><div style="background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); padding:8px; border-radius:6px; font-size:11px;">⚡ <strong>Optimize Power</strong><br>AI workload migration & undervolt</div><div style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); padding:8px; border-radius:6px; font-size:11px;">🌡️ <strong>Thermal Diagnosis</strong><br>Identify hot spots & anomalies</div><div style="background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); padding:8px; border-radius:6px; font-size:11px;">📊 <strong>PUE Analytics</strong><br>Real-time efficiency tracking</div></div><br>How can I assist your data center operations today?`);
  }

  renderSuggestions(suggestions) {
    if (!this.suggestionsContainer) return;
    this.suggestionsContainer.innerHTML = '';
    suggestions.forEach(text => {
      const chip = document.createElement('div');
      chip.className = 'suggestion-chip';
      chip.textContent = text;
      chip.addEventListener('click', () => {
        if (this.input) this.input.value = text;
        this.handleUserSubmit();
      });
      this.suggestionsContainer.appendChild(chip);
    });
  }

  handleUserSubmit(promptOverride = null) {
    const text = promptOverride || (this.input ? this.input.value.trim() : '');
    if (!text) return;

    if (this.input) this.input.value = '';
    this.addUserMessage(text);

    // Show typing state
    const typingId = this.showTypingIndicator();

    setTimeout(() => {
      this.removeTypingIndicator(typingId);
      this.processQuery(text);
    }, 600);
  }

  addUserMessage(text) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble user';
    bubble.textContent = text;
    this.container.appendChild(bubble);
    this.scrollToBottom();
  }

  addAssistantMessage(markdownText, actionCard = null) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble assistant';

    // Simple markdown formatting (bold, code, lists)
    let formatted = markdownText
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.7); color:var(--primary); font-weight:600; padding:2px 5px; border-radius:4px; font-family:var(--font-mono);">$1</code>')
      .replace(/\n/g, '<br>');

    bubble.innerHTML = formatted;

    if (actionCard) {
      const cardEl = document.createElement('div');
      cardEl.className = 'chat-card-action';
      cardEl.innerHTML = `
        <div style="font-weight:600; font-size:12px; color:var(--primary);">${actionCard.title}</div>
        <div style="font-size:11px; color:var(--text-muted);">${actionCard.description}</div>
        <button class="btn btn-primary" style="margin-top:6px; font-size:11px; padding:4px 10px;" id="${actionCard.buttonId}">
          ${actionCard.buttonText}
        </button>
      `;
      bubble.appendChild(cardEl);

      setTimeout(() => {
        document.getElementById(actionCard.buttonId)?.addEventListener('click', actionCard.onExecute);
      }, 50);
    }

    this.container.appendChild(bubble);
    this.scrollToBottom();
  }

  showTypingIndicator() {
    const id = `typing-${Date.now()}`;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble assistant';
    bubble.id = id;
    bubble.innerHTML = `<span style="opacity:0.6; font-style:italic;">Preeti is analyzing telemetry...</span>`;
    this.container.appendChild(bubble);
    this.scrollToBottom();
    return id;
  }

  removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  scrollToBottom() {
    if (this.container) {
      this.container.scrollTop = this.container.scrollHeight;
    }
  }

  processQuery(query) {
    const snapshot = this.telemetry.getGlobalSnapshot();
    const lower = query.toLowerCase();

    // Query 0: Auto Assist CO2 & Electricity
    if (lower.includes('save') && (lower.includes('co2') || lower.includes('electric') || lower.includes('power') || lower.includes('energy') || lower.includes('carbon'))) {
      this.addAssistantMessage(`🌍 **Preeti's Auto-Assist: Energy & CO₂ Optimization**
      
I have analyzed the current datacenter workload. To immediately save CO₂ and reduce wasted electricity, I recommend the following automated actions:

1. **Activate Solid-State TEG Recovery:** Divert excess liquid heat from the server loops to the Thermoelectric Generators. This will convert wasted thermal energy directly back into clean DC electricity for the server racks.
2. **AI Workload Migration:** Shift non-critical batch processing from overloaded zones to underutilized zones to optimize server cooling efficiency and lower PUE.
3. **Dynamic Undervolting:** Apply AI-driven undervolting to idle GPUs across the facility, saving up to 15% power without impacting active workloads.

Would you like me to automatically execute these optimizations?`);
      return;
    }

    // Query -1: CO2 Avoidance Science & Math
    if (lower.includes('co2') || lower.includes('carbon') || lower.includes('avoided') || lower.includes('calculate')) {
      this.addAssistantMessage(`🌱 **How CO₂ Savings Are Calculated in EmberGrid**

CO₂ savings represent **avoided grid emissions**, calculated as:

$$\\text{CO}_2 \\text{ Avoided (kg)} = E_{\\text{net}} (\\text{kWh}) \\times \\text{Grid Emission Factor} (\\text{kg CO}_2/\\text{kWh})$$

**Key Factors Used:**
1. **Grid Electricity Displacement:** Uses **0.71 kg CO₂/kWh** (India's average grid emission factor). Every kWh of clean electricity generated on-site by ORC/TEG avoids drawing coal-generated power from the grid.
2. **Direct Heating Boiler Displacement:** Uses **0.20 kg CO₂/kWh** thermal when warm liquid heat is routed directly to district heating, turning off fossil gas/electric boilers.
3. **Deduction of Parasitic Draw:** Charging the Carnot battery or running fluid pumps consumes power. EmberGrid subtracts this parasitic draw to report **Net Avoided Emissions** only.`, {
        title: "Open SIH Presentation Deck",
        description: "View Slide 7 (CO2 Science & Math Deep Dive).",
        buttonId: "action-open-deck-co2",
        buttonText: "📊 View Presentation Deck",
        onExecute: () => {
          if (window.auraApp) {
            window.auraApp.switchTab('sih-presentation');
            window.auraApp.sihPresentationView.goToSlide(7);
          }
        }
      });
      return;
    }

    // Query -2: Feasibility & Honest Claim
    if (lower.includes('feasibility') || lower.includes('honest') || lower.includes('judge') || lower.includes('claim') || lower.includes('slide')) {
      this.addAssistantMessage(`⚖️ **EmberGrid 4-Pillar Feasibility & Honest Claim for Judges**

1. **Technical Feasibility:** Software decision layer built and demoed in 36 hours; upgrades to Modbus/SNMP sensor telemetry.
2. **Technology Feasibility:** ORC hardware is mature worldwide; Carnot batteries are proven in pilots.
3. **Economic Feasibility:** Payback period **< 6 years** for liquid loops; improves PUE from 1.18 ➔ 1.15.
4. **Market/Policy Feasibility:** EU mandates 10-20% heat reuse by 2026–2028; aligns with India's DC growth.

🌟 **The Honest Frontier Claim:**
*"ORC is proven, heat-reuse is mandated internationally, but Carnot batteries + AI-optimized thermal routing for data centers specifically is an emerging frontier — EmberGrid is the missing decision layer that makes this investment viable."*`, {
        title: "Open Feasibility Slide",
        description: "View Slide 4 (4-Pillar Feasibility Analysis).",
        buttonId: "action-open-deck-feas",
        buttonText: "📊 View Feasibility Matrix",
        onExecute: () => {
          if (window.auraApp) {
            window.auraApp.switchTab('sih-presentation');
            window.auraApp.sihPresentationView.goToSlide(4);
          }
        }
      });
      return;
    }

    // Query 0: Waste Heat to Electricity (ORC & TEG)
    if (lower.includes('orc') || lower.includes('teg') || lower.includes('rankine') || lower.includes('waste heat') || lower.includes('harvest') || lower.includes('carnot') || lower.includes('parasitic')) {
      this.addAssistantMessage(`⚡ **Data Center Waste Heat to Energy Diagnostic (ORC vs TEG)**

**Step 1: Technology Pathway**
• **Organic Rankine Cycle (ORC):** Uses organic working fluids (e.g. \`R245fa\`, \`R134a\`) with low boiling points. Highly efficient for medium-to-large liquid cooling loops (50 kW to 10 MW thermal).
• **Thermoelectric Generators (TEGs):** Solid-state semiconductor modules converting $\\Delta T$ directly to DC electricity via the Seebeck effect ($V = N \\cdot \\alpha \\cdot \\Delta T$). Best for direct-to-chip micro loops.

**Step 2 & 4: Carnot Limit & Parasitic Load Challenge**
• **Carnot Theoretical Efficiency:** At $T_{hot} = 65^\\circ\\text{C}$ and $T_{cold} = 18^\\circ\\text{C}$, theoretical max limit is **13.88%**.
• **Real Cycle Efficiency:** Typical ORC delivers **4.5% - 8.0%** net conversion.
• **Parasitic Load Defense:** Working fluid pumps and condenser cooling fans consume power. If $\\Delta T < 20^\\circ\\text{C}$, parasitic pumping power exceeds turbine generation!

**Copilot Recommendation:** Maintain liquid return temperature $\\ge 55^\\circ\\text{C}$ using Direct-to-Chip or Immersion cooling to ensure **net positive electrical generation** and reduce facility PUE.`, {
        title: "Launch Heat Recovery Simulator",
        description: "Open interactive ORC/TEG thermodynamic modeler & architecture schematic.",
        buttonId: "action-open-heat-rec",
        buttonText: "⚡ Open Heat-to-Electricity Simulator",
        onExecute: () => {
          if (window.auraApp) window.auraApp.switchTab('heat-recovery');
        }
      });
      return;
    }

    // Query 1: Thermal / Temperature Anomalies
    if (lower.includes('temp') || lower.includes('thermal') || lower.includes('hot') || lower.includes('heat') || lower.includes('anomaly')) {
      const warmRacks = this.telemetry.racks.filter(r => r.temp >= 33);
      if (warmRacks.length === 0) {
        this.addAssistantMessage(`✅ **Thermal Audit Clean**
        
All ${snapshot.totalRacks} server racks are operating within optimal temperature ranges (Average: **${snapshot.avgTemp}°C**). No thermal anomalies detected.`);
      } else {
        const rackListStr = warmRacks.map(r => `• **Rack ${r.id}** (${r.workloadType}): **${r.temp}°C** [${r.status.toUpperCase()}]`).join('\n');
        
        this.addAssistantMessage(`🚨 **Thermal Anomaly Diagnostic Report**
        
Identified **${warmRacks.length} rack(s)** operating above nominal threshold (33°C):
${rackListStr}

**Recommended Action:** Trigger Emergency Cooling Override to increase chilled air airflow across affected zones.`, {
          title: "Automated Thermal Mitigation",
          description: "Boost chiller airflow to drop zone temperatures by ~4.5°C.",
          buttonId: "action-chiller-boost",
          buttonText: "⚡ Execute Emergency Cooling Override",
          onExecute: () => {
            this.telemetry.triggerEmergencyCooling();
            this.addAssistantMessage("✅ **Chiller Override Activated!** Zone temperature offset applied.");
          }
        });
      }
      return;
    }

    // Query 2: PUE / Power Optimization
    if (lower.includes('pue') || lower.includes('power') || lower.includes('energy') || lower.includes('efficiency')) {
      const isGood = snapshot.pue < 1.22;
      this.addAssistantMessage(`⚡ **Power Usage Effectiveness (PUE) Telemetry**

• **Current Global PUE:** \`${snapshot.pue}\` ${isGood ? '(Optimal Tier 4 Data Center)' : '(Elevated Facility Overhead)'}
• **Total IT Load:** **${snapshot.totalPowerKw} kW**
• **Estimated Facility/Cooling Load:** **${Math.round(snapshot.totalPowerKw * (snapshot.pue - 1))} kW**

**Copilot Insights:**
1. Dynamically rebalance workload from elevated thermal nodes (Zone A & B) to under-utilized nodes in Zone C.
2. Maintain hot-aisle containment temperature setpoints at 24°C.`);
      return;
    }

    // Query 3: Live VM Migration
    if (lower.includes('migrate') || lower.includes('vm') || lower.includes('rebalance') || lower.includes('workload')) {
      const critical = this.telemetry.racks.find(r => r.status === 'critical' || r.status === 'warning');
      const target = this.telemetry.racks.find(r => r.status === 'healthy' && r.id !== (critical?.id));

      if (critical && target) {
        this.addAssistantMessage(`🔄 **Live Workload Rebalancing Plan**

Targeting active source rack **${critical.id}** (${critical.temp}°C, ${critical.powerKw} kW draw).
Destination node selected: **${target.id}** (Optimal status, ${target.temp}°C).`, {
          title: "VM Live Migration Execution",
          description: `Migrate 14 VM workload instances from ${critical.id} ➔ ${target.id} without zero downtime.`,
          buttonId: "action-vm-migrate",
          buttonText: "🚀 Execute Live Migration",
          onExecute: () => {
            this.telemetry.migrateWorkload(critical.id, target.id);
            this.addAssistantMessage(`✅ **Live Migration Completed!** Workloads successfully transferred to ${target.id}. Rack ${critical.id} load reduced.`);
          }
        });
      } else {
        this.addAssistantMessage(`ℹ️ **Workload Balance Optimal**

All compute clusters are balanced evenly across Zone A, Zone B, and Zone C. No forced VM migrations required.`);
      }
      return;
    }

    // Query 4: Alarm / Incident Summary
    if (lower.includes('alarm') || lower.includes('alert') || lower.includes('critical') || lower.includes('issue') || lower.includes('log')) {
      const logs = snapshot.alerts.slice(0, 4).map(a => `• \`[${a.time}]\` **${a.severity.toUpperCase()}** - ${a.title} (${a.rackId}): ${a.message}`).join('\n');
      this.addAssistantMessage(`⚠️ **Active Incident Log Summary**

${logs}`);
      return;
    }

    // Default Fallback Intelligent Response
    this.addAssistantMessage(`🔍 **Ember Operations Analysis** for query: "${query}"

• **Total Active Racks:** ${snapshot.totalRacks} Racks (${snapshot.healthyCount} Healthy, ${snapshot.warningCount} Warning, ${snapshot.criticalCount} Critical)
• **System Power:** ${snapshot.totalPowerKw} kW | PUE: ${snapshot.pue}
• **Average Temp:** ${snapshot.avgTemp} °C

You can ask me to **diagnose thermal spikes**, **run PUE optimizations**, **execute emergency cooling**, or **migrate workloads**.`);
  }
}
