/**
 * AuraDC - Waste Heat to Electricity (ORC & TEG) Thermodynamic Simulator
 * Models Organic Rankine Cycle & Thermoelectric Generators for Data Center liquid heat recovery.
 */

export class HeatRecoveryEngine {
  constructor() {
    // Configuration & State Defaults
    this.techMode = 'TEG'; // 'ORC' or 'TEG'
    
    // Thermal Gradient Inputs
    this.tHotIn = 65;      // °C (Hot liquid from server cooling loop)
    this.tHotOut = 45;     // °C (Liquid temp returning to server after heat exchanger)
    this.tColdIn = 18;     // °C (Cold external air/water source)
    this.flowRateLpm = 120; // Liters per minute of hot liquid
    
    // Working Fluid & Tech Parameters
    this.workingFluid = 'R245fa'; // 'R245fa', 'R134a', 'R1233zd', 'Isobutane'
    this.fluidDensity = 1000;    // kg/m³ (water equivalent)
    this.fluidCp = 4.184;        // kJ/(kg·K) (water equivalent)
    
    // Efficiencies
    this.orcExpanderEff = 0.68;  // Isentropic efficiency of turbine/expander
    this.generatorEff = 0.92;    // Electrical generator efficiency
    this.tegEffFactor = 0.08;    // Fraction of Carnot for TEGs (typical 5-8%)
    this.pumpEff = 0.65;         // Parasitic pump efficiency
    this.fanEff = 0.70;          // Condenser fan efficiency
    
    // Financial & Operating Costs
    this.elecPriceKwh = 0.12;    // $ / kWh
    this.co2Factor = 0.71;       // kg CO2 saved per kWh (India Grid Average: ~0.71 kg CO2/kWh)
    this.heatBoilerFactor = 0.20; // kg CO2 saved per kWh of thermal heat reused (displacing natural gas/electric boilers)
    this.annualHours = 8760;     // Hours/year
    this.datacenterPowerKw = 420;// Current total DC power for PUE impact
    this.datacenterPue = 1.18;
  }

  setParams(newParams) {
    Object.assign(this, newParams);
  }

  // Set standard industry presets
  applyPreset(presetKey) {
    if (presetKey === 'd2c') {
      // Direct to chip liquid cooling
      this.tHotIn = 65;
      this.tHotOut = 45;
      this.tColdIn = 18;
      this.flowRateLpm = 150;
      this.techMode = 'ORC';
      this.workingFluid = 'R245fa';
    } else if (presetKey === 'immersion1') {
      // Single phase immersion
      this.tHotIn = 52;
      this.tHotOut = 38;
      this.tColdIn = 15;
      this.flowRateLpm = 200;
      this.techMode = 'ORC';
      this.workingFluid = 'R134a';
    } else if (presetKey === 'immersion2') {
      // Two-phase high temp immersion
      this.tHotIn = 78;
      this.tHotOut = 50;
      this.tColdIn = 20;
      this.flowRateLpm = 180;
      this.techMode = 'ORC';
      this.workingFluid = 'R1233zd';
    } else if (presetKey === 'teg_chip') {
      // Direct chip TEG solid state
      this.tHotIn = 70;
      this.tHotOut = 55;
      this.tColdIn = 22;
      this.flowRateLpm = 60;
      this.techMode = 'TEG';
    } else if (presetKey === 'air_hot_aisle') {
      // Low temp air hot aisle
      this.tHotIn = 42;
      this.tHotOut = 32;
      this.tColdIn = 22;
      this.flowRateLpm = 80;
      this.techMode = 'ORC';
      this.workingFluid = 'R134a';
    }
  }

  // Core Thermodynamic Calculations
  calculate() {
    const tHotK = this.tHotIn + 273.15;
    const tColdK = this.tColdIn + 273.15;
    const deltaT = Math.max(0.1, this.tHotIn - this.tColdIn);

    // 1. Carnot Theoretical Maximum Efficiency Limit (1 - T_cold / T_hot)
    const carnotEfficiency = 1 - (tColdK / tHotK);

    // 2. Thermal Energy Input Q_in (kW)
    // Q_in = m_dot * Cp * (T_hot_in - T_hot_out)
    // Mass flow rate m_dot (kg/s) = (L/min) / 60 * density (kg/L)
    const massFlowKgPerSec = (this.flowRateLpm / 60.0) * (this.fluidDensity / 1000.0);
    const qInKw = massFlowKgPerSec * this.fluidCp * Math.max(1, this.tHotIn - this.tHotOut);

    // 3. Real Cycle Efficiency calculation
    let grossEfficiency = 0;
    
    if (this.techMode === 'ORC') {
      // Empirical/Thermodynamic model for ORC based on working fluid & temperatures
      // Low temp ORC typical efficiency is roughly 40-55% of Carnot limit
      let fluidFactor = 0.45; // Base fraction of Carnot
      if (this.workingFluid === 'R245fa') fluidFactor = 0.48;
      if (this.workingFluid === 'R1233zd') fluidFactor = 0.52;
      if (this.workingFluid === 'Isobutane') fluidFactor = 0.46;
      if (this.workingFluid === 'R134a') fluidFactor = 0.42;

      grossEfficiency = carnotEfficiency * fluidFactor * this.orcExpanderEff * this.generatorEff;
    } else {
      // Thermoelectric Generator (TEG) Seebeck Effect Model
      // ZT factor typically 0.8 - 1.0 for modern Bismuth Telluride
      // Efficiency = Carnot * [ (sqrt(1+ZT_avg) - 1) / (sqrt(1+ZT_avg) + T_cold/T_hot) ]
      const zt = 0.85;
      const tAvgK = (tHotK + tColdK) / 2.0;
      const sqrtZt = Math.sqrt(1 + zt);
      const tegCarnotFraction = (sqrtZt - 1) / (sqrtZt + (tColdK / tHotK));
      grossEfficiency = carnotEfficiency * tegCarnotFraction;
    }

    // 4. Gross Power Generated (kW)
    const pGrossKw = qInKw * grossEfficiency;

    // 5. Parasitic Power Consumption (kW)
    // Pumps & Fans required to circulate hot liquid and cold fluid/air condenser
    let pPumpKw = 0;
    let pFanKw = 0;

    if (this.techMode === 'ORC') {
      // ORC working fluid pump + primary heat loop pump
      // Pump work proportional to flow rate & pressure lift
      const pressureLiftBar = Math.max(2.0, (this.tHotIn - 30) * 0.15); // Pressure delta across ORC
      pPumpKw = (massFlowKgPerSec * (pressureLiftBar * 100)) / (this.fluidDensity * this.pumpEff);
      
      // Condenser cooling fan / water loop parasitic power
      const qRejectedKw = Math.max(0, qInKw - pGrossKw);
      pFanKw = (qRejectedKw * 0.025) / this.fanEff; // ~2.5% of rejected thermal load
    } else {
      // TEG parasitics (liquid cooling block pumping)
      pPumpKw = (massFlowKgPerSec * 1.5 * 100) / (this.fluidDensity * this.pumpEff);
      pFanKw = (qInKw * 0.015) / this.fanEff;
    }

    const pParasiticKw = pPumpKw + pFanKw;

    // 6. Net Electricity Power Output (kW)
    const pNetKw = pGrossKw - pParasiticKw;

    // 7. Net System Efficiency
    const netEfficiency = qInKw > 0 ? Math.max(-0.2, pNetKw / qInKw) : 0;

    // 8. Sustainability & Financial Impact (Avoided Emissions Model)
    const annualEnergyKwh = Math.max(0, pNetKw) * this.annualHours;
    const annualSavingsDollar = annualEnergyKwh * this.elecPriceKwh;
    
    // CO2 Avoided = (Electricity Generated * Grid Emission Factor) + (Direct Thermal Reused * Boiler Emission Factor)
    // India Grid Average: ~0.71 kg CO2 / kWh
    const grossCo2AvoidedKg = (Math.max(0, pGrossKw) * this.annualHours) * this.co2Factor;
    const parasiticCo2EmittedKg = (pParasiticKw * this.annualHours) * this.co2Factor;
    const netCo2AvoidedKg = Math.max(0, grossCo2AvoidedKg - parasiticCo2EmittedKg);
    const annualCo2OffsetTons = netCo2AvoidedKg / 1000.0;

    // Capital Cost estimate & ROI payback
    let approxCapex = 0;
    if (this.techMode === 'ORC') {
      approxCapex = Math.max(3000, pGrossKw * 1800); // ~$1,800 per kW installed ORC
    } else {
      approxCapex = Math.max(2000, pGrossKw * 2400); // ~$2,400 per kW TEG
    }

    const roiYears = annualSavingsDollar > 0 ? (approxCapex / annualSavingsDollar) : 99;

    // PUE Impact Calculation
    // New PUE = (Total Facility Power - Net Recovered Power) / IT Power
    // Assuming 85% of total power is IT power
    const itPowerKw = this.datacenterPowerKw / this.datacenterPue;
    const newFacilityPowerKw = Math.max(itPowerKw, this.datacenterPowerKw - Math.max(0, pNetKw));
    const newPue = newFacilityPowerKw / itPowerKw;
    const pueImprovement = Math.max(0, this.datacenterPue - newPue);

    return {
      techMode: this.techMode,
      workingFluid: this.workingFluid,
      tHotIn: this.tHotIn,
      tHotOut: this.tHotOut,
      tColdIn: this.tColdIn,
      deltaT: deltaT,
      flowRateLpm: this.flowRateLpm,
      
      // Thermodynamic results
      carnotEfficiency: carnotEfficiency * 100, // %
      qInKw: qInKw,                             // kW
      grossEfficiency: grossEfficiency * 100,  // %
      pGrossKw: pGrossKw,                       // kW
      
      // Parasitic breakdown
      pPumpKw: pPumpKw,
      pFanKw: pFanKw,
      pParasiticKw: pParasiticKw,
      
      // Net Results
      pNetKw: pNetKw,
      netEfficiency: netEfficiency * 100,       // %
      isNetPositive: pNetKw > 0,
      
      // Financial & Sustainability
      annualEnergyKwh: annualEnergyKwh,
      annualSavingsDollar: annualSavingsDollar,
      annualCo2OffsetTons: annualCo2OffsetTons,
      approxCapex: approxCapex,
      roiYears: roiYears,
      
      // PUE Impact
      currentPue: this.datacenterPue,
      newPue: newPue,
      pueImprovement: pueImprovement
    };
  }
}
