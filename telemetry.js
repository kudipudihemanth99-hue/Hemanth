/**
 * AuraDC - Telemetry & Simulation Engine
 * Manages live simulated metrics for data center zones, 42U racks, and environmental telemetry.
 */

export class TelemetryEngine {
  constructor() {
    this.subscribers = [];
    this.zones = [
      { id: 'zone-a', name: 'Zone A - AI & GPU Compute', color: '#06b6d4' },
      { id: 'zone-b', name: 'Zone B - Core Database Cluster', color: '#8b5cf6' },
      { id: 'zone-c', name: 'Zone C - Cloud & Object Storage', color: '#3b82f6' }
    ];
    
    this.racks = [];
    this.metricsHistory = {
      pue: [1.18, 1.19, 1.17, 1.18, 1.18],
      totalPowerKw: [420, 425, 418, 430, 422],
      avgTemp: [23.4, 23.6, 23.5, 23.8, 23.4],
      coolingPowerKw: [75, 78, 74, 80, 76]
    };

    this.alerts = [];
    this.initRacks();
    this.startSimulation();
  }

  initRacks() {
    this.racks = [];
    this.zones.forEach(zone => {
      const rackCount = zone.id === 'zone-a' ? 12 : (zone.id === 'zone-b' ? 10 : 10);
      for (let i = 1; i <= rackCount; i++) {
        const rackNum = i < 10 ? `0${i}` : `${i}`;
        const rackId = `${zone.id === 'zone-a' ? 'A' : (zone.id === 'zone-b' ? 'B' : 'C')}-${rackNum}`;
        
        // Random initial status with slight thermal variation
        let status = 'healthy';
        let temp = Math.round(20 + Math.random() * 8 + (zone.id === 'zone-a' ? 4 : 0));
        let powerKw = Math.round(10 + Math.random() * 25);

        // Intentionally make a couple racks warning/critical for realistic operational testing
        if (rackId === 'A-04') {
          status = 'warning';
          temp = 37.5;
          powerKw = 34.2;
        } else if (rackId === 'B-07') {
          status = 'critical';
          temp = 42.1;
          powerKw = 38.0;
        }

        const blades = [];
        for (let u = 1; u <= 42; u += 2) { // 2U blades
          blades.push({
            uPosition: u,
            name: `Blade-U${u}`,
            status: u === 30 && rackId === 'B-07' ? 'critical' : (u === 14 && rackId === 'A-04' ? 'warning' : 'healthy'),
            cpuLoad: Math.round(30 + Math.random() * 55),
            ramUsage: Math.round(40 + Math.random() * 45),
            gpuTemp: zone.id === 'zone-a' ? Math.round(45 + Math.random() * 30) : null,
            fanRpm: Math.round(7500 + Math.random() * 2500),
            powerWatts: Math.round(450 + Math.random() * 350)
          });
        }

        this.racks.push({
          id: rackId,
          zoneId: zone.id,
          name: `Rack ${rackId}`,
          status,
          temp,
          powerKw,
          pueContribution: 1.18 + (temp > 35 ? 0.08 : 0),
          humidity: Math.round(42 + Math.random() * 6),
          workloadType: zone.id === 'zone-a' ? 'LLM Fine-Tuning' : (zone.id === 'zone-b' ? 'PostgreSQL Cluster' : 'NVMe Storage Matrix'),
          blades
        });
      }
    });

    // Populate initial alerts
    this.alerts = [
      {
        id: 'alt-101',
        time: new Date(Date.now() - 3 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        rackId: 'B-07',
        severity: 'critical',
        title: 'Thermal Threshold Exceeded',
        message: 'Rack B-07 temperature reached 42.1°C (Fan Assembly #2 Failure on U30).'
      },
      {
        id: 'alt-102',
        time: new Date(Date.now() - 12 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        rackId: 'A-04',
        severity: 'warning',
        title: 'High GPU Load & Thermal Rise',
        message: 'Rack A-04 temperature rising above 37°C during AI Batch Training.'
      }
    ];
  }

  startSimulation() {
    setInterval(() => {
      // Small real-time fluctuations
      let totalPower = 0;
      let totalTemp = 0;

      this.racks.forEach(rack => {
        // Fluctuate temp slightly
        const delta = (Math.random() - 0.49) * 0.4;
        rack.temp = Math.max(18, Math.min(48, parseFloat((rack.temp + delta).toFixed(1))));
        
        // Power fluctuation
        const pDelta = (Math.random() - 0.49) * 0.5;
        rack.powerKw = Math.max(5, parseFloat((rack.powerKw + pDelta).toFixed(1)));

        // Update status thresholds
        if (rack.temp > 40) {
          rack.status = 'critical';
        } else if (rack.temp > 34) {
          rack.status = 'warning';
        } else if (rack.status !== 'isolated') {
          rack.status = 'healthy';
        }

        totalPower += rack.powerKw;
        totalTemp += rack.temp;
      });

      // Calculate global telemetry
      const avgTemp = parseFloat((totalTemp / this.racks.length).toFixed(1));
      const ITPower = parseFloat(totalPower.toFixed(1));
      const coolingPower = parseFloat((ITPower * 0.18 + (avgTemp > 25 ? 12 : 5)).toFixed(1));
      const pue = parseFloat(((ITPower + coolingPower) / ITPower).toFixed(2));

      // Append metrics history (keep last 15 points)
      this.metricsHistory.pue.push(pue);
      this.metricsHistory.totalPowerKw.push(ITPower);
      this.metricsHistory.avgTemp.push(avgTemp);
      this.metricsHistory.coolingPowerKw.push(coolingPower);

      if (this.metricsHistory.pue.length > 15) {
        this.metricsHistory.pue.shift();
        this.metricsHistory.totalPowerKw.shift();
        this.metricsHistory.avgTemp.shift();
        this.metricsHistory.coolingPowerKw.shift();
      }

      this.notifySubscribers();
    }, 3000);
  }

  subscribe(callback) {
    this.subscribers.push(callback);
  }

  notifySubscribers() {
    this.subscribers.forEach(cb => cb(this.getGlobalSnapshot()));
  }

  getGlobalSnapshot() {
    const criticalCount = this.racks.filter(r => r.status === 'critical').length;
    const warningCount = this.racks.filter(r => r.status === 'warning').length;
    const healthyCount = this.racks.filter(r => r.status === 'healthy').length;

    const currentPue = this.metricsHistory.pue[this.metricsHistory.pue.length - 1];
    const currentPower = this.metricsHistory.totalPowerKw[this.metricsHistory.totalPowerKw.length - 1];
    const currentAvgTemp = this.metricsHistory.avgTemp[this.metricsHistory.avgTemp.length - 1];

    return {
      pue: currentPue,
      totalPowerKw: currentPower,
      avgTemp: currentAvgTemp,
      healthyCount,
      warningCount,
      criticalCount,
      totalRacks: this.racks.length,
      alerts: this.alerts,
      history: this.metricsHistory
    };
  }

  getRackById(rackId) {
    return this.racks.find(r => r.id === rackId);
  }

  // Simulation Trigger Actions
  triggerEmergencyCooling(zoneId = null) {
    this.racks.forEach(r => {
      if (!zoneId || r.zoneId === zoneId) {
        r.temp = Math.max(19, r.temp - 4.5);
        if (r.temp < 34 && r.status !== 'isolated') r.status = 'healthy';
      }
    });
    this.alerts.unshift({
      id: `alt-${Date.now()}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      rackId: zoneId || 'ALL ZONES',
      severity: 'info',
      title: 'Emergency Chiller Override Engaged',
      message: 'Cooling boosted by 25% across target data center zone.'
    });
    this.notifySubscribers();
  }

  isolateRack(rackId) {
    const rack = this.getRackById(rackId);
    if (rack) {
      rack.status = 'isolated';
      rack.temp = 21.0;
      rack.powerKw = 2.0; // Standby idle
      this.alerts.unshift({
        id: `alt-${Date.now()}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        rackId: rack.id,
        severity: 'info',
        title: 'Rack Maintenance Isolation',
        message: `Rack ${rack.id} powered down for maintenance. Workloads migrated.`
      });
      this.notifySubscribers();
    }
  }

  migrateWorkload(sourceRackId, targetRackId) {
    const src = this.getRackById(sourceRackId);
    const tgt = this.getRackById(targetRackId);
    if (src && tgt) {
      src.powerKw = Math.max(8, src.powerKw - 15);
      src.temp = Math.max(22, src.temp - 6);
      if (src.status === 'critical' || src.status === 'warning') src.status = 'healthy';

      tgt.powerKw += 12;
      tgt.temp += 3;

      this.alerts.unshift({
        id: `alt-${Date.now()}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        rackId: `${sourceRackId} ➔ ${targetRackId}`,
        severity: 'info',
        title: 'Automated VM Live Migration',
        message: `Successfully migrated 14 VM instances from ${sourceRackId} to ${targetRackId}.`
      });
      this.notifySubscribers();
    }
  }

  addRacksToZone(zoneId, count) {
    const zone = this.zones.find(z => z.id === zoneId);
    if (!zone) return;

    // Find highest rack number in zone
    const zoneRacks = this.racks.filter(r => r.zoneId === zoneId);
    let maxNum = 0;
    zoneRacks.forEach(r => {
      const numMatch = r.id.match(/-(\d+)/);
      if (numMatch) {
        const num = parseInt(numMatch[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });

    const prefix = zoneId === 'zone-a' ? 'A' : (zoneId === 'zone-b' ? 'B' : 'C');
    
    for (let i = 1; i <= count; i++) {
      const num = maxNum + i;
      const rackNumStr = num < 10 ? `0${num}` : `${num}`;
      const rackId = `${prefix}-${rackNumStr}`;
      
      const blades = [];
      for (let u = 1; u <= 42; u += 2) {
        blades.push({
          uPosition: u,
          name: `Blade-U${u}`,
          status: 'healthy',
          cpuLoad: Math.round(10 + Math.random() * 20),
          ramUsage: Math.round(20 + Math.random() * 20),
          gpuTemp: zoneId === 'zone-a' ? Math.round(35 + Math.random() * 10) : null,
          fanRpm: Math.round(4000 + Math.random() * 1000),
          powerWatts: Math.round(200 + Math.random() * 100)
        });
      }

      this.racks.push({
        id: rackId,
        zoneId: zone.id,
        name: `Rack ${rackId}`,
        status: 'healthy',
        temp: Math.round(20 + Math.random() * 4),
        powerKw: Math.round(8 + Math.random() * 5),
        pueContribution: 1.18,
        humidity: Math.round(40 + Math.random() * 5),
        workloadType: zone.id === 'zone-a' ? 'LLM Fine-Tuning' : (zone.id === 'zone-b' ? 'PostgreSQL Cluster' : 'NVMe Storage Matrix'),
        blades
      });
    }

    this.alerts.unshift({
      id: `alt-${Date.now()}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      rackId: zoneId.toUpperCase(),
      severity: 'info',
      title: 'Hardware Provisioned',
      message: `Successfully deployed ${count} new 42U racks to ${zone.name}.`
    });

    this.notifySubscribers();
  }

  updateZoneSettings(zoneId, targetTemp, powerLimitKw) {
    const zoneRacks = this.racks.filter(r => r.zoneId === zoneId);
    if (zoneRacks.length > 0) {
      // Adjust all racks in this zone to drift towards the new target temp
      // and cap their power
      zoneRacks.forEach(r => {
        r.temp = targetTemp + (Math.random() - 0.5) * 2;
        // Simple mock of power capping per rack
        r.powerKw = Math.min(r.powerKw, powerLimitKw / zoneRacks.length);
      });

      this.alerts.unshift({
        id: `alt-${Date.now()}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        rackId: zoneId.toUpperCase(),
        severity: 'info',
        title: 'Zone Settings Updated',
        message: `Updated target temp to ${targetTemp}°C and power cap to ${powerLimitKw}kW for ${zoneId.toUpperCase()}.`
      });

      this.notifySubscribers();
    }
  }
}
