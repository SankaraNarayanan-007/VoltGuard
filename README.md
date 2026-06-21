<div align="center">

# ⚡ VoltGuard AI

**AI-Powered EV Battery Health & Optimization System**

[![Status](https://img.shields.io/badge/status-proof%20of%20concept-yellow)](.)
[![Platform](https://img.shields.io/badge/platform-ESP32%20%7C%20Web-blue)](.)
[![License](https://img.shields.io/badge/license-Educational%20%2F%20Research-lightgrey)](.)

*Bringing battery intelligence to every electric vehicle — not just the premium ones.*

</div>

---

## The Problem

EV batteries represent **40–50% of the total vehicle cost**, yet most owners only see a basic charge percentage. There's no visibility into how the battery is actually aging, whether charging habits are causing harm, or how much useful life remains.

The result: thermal stress goes undetected, fast-charging damage accumulates silently, and battery replacements arrive as expensive surprises.

---

## What VoltGuard AI Does

VoltGuard AI sits between the raw battery data and the driver — acting as an intelligent analytics layer that turns sensor readings into actionable battery intelligence.

```
Virtual EV Battery Simulator
         ↓
VoltGuard AI Analytics Engine
         ↓
      Digital Twin
         ↓
  Web Dashboard / App
```

It monitors, estimates, predicts, and advises — continuously.

---

## Features

### 🔋 Real-Time Battery Monitoring
- Voltage, current, and temperature tracking
- State of Charge (SOC) estimation
- Charge cycle counting
- Thermal risk detection with Arrhenius-based stress modeling

### 🧠 Battery Intelligence
- **State of Health (SOH)** — physics-based calculation combining voltage ratio, thermal degradation, and cumulative cycle damage
- **Remaining Useful Life (RUL)** — estimated years remaining above the 80% EOL threshold, adjusted for rolling thermal acceleration and voltage stress
- **Degradation analysis** — tracks cumulative capacity fade per reading

### ⚡ Smart Charging Advisor
- Recommends optimal charge target (typically 80% ceiling for longevity)
- Flags thermal conditions that make charging harmful (> 40°C, < 5°C)
- Estimates time to target for a 7.2 kW Level 2 AC charger
- Generates personalised charging tips based on live state
- Cycle Longevity Score — composite health indicator updated in real time

### 🪞 Digital Twin
- Virtual battery state mirrored from live telemetry
- Real-time SOH and RUL simulation
- Predictive health forecasting under different usage profiles
- Supports Normal, Aggressive, and Fleet simulation modes

### 🚨 Alerts & Notifications
- Browser push notifications for ALERT and WARNING states
- OLED dashboard alerts on the hardware prototype
- Piezo buzzer for critical conditions
- Risk classification: NORMAL → WARNING → ALERT

---

## System Architecture

```
┌─────────────────────────────────────┐
│       Virtual Battery Simulator      │
│  (ESP32 / Wokwi — DHT22 + Pot)      │
└────────────────┬────────────────────┘
                 │ MQTT over WSS
                 ▼
┌─────────────────────────────────────┐
│       VoltGuard AI Analytics         │
│  SOH Engine · RUL Engine · Risk      │
│  Smart Charging Advisor              │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│          Digital Twin Layer          │
│  State tracking · Health forecasting │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│       Web Dashboard (VoltGuard UI)   │
│  Realtime Metrics · SOH · RUL        │
│  Risk Eval · AI Diagnostics          │
│  Smart Charging Tab                  │
└─────────────────────────────────────┘
```

---

## Hardware Prototype

Built and simulated on **Wokwi** using an ESP32 DevKit V1.

| Component | Purpose |
|-----------|---------|
| ESP32 DevKit V1 | Main controller |
| SSD1306 OLED | On-device battery dashboard |
| DHT22 Sensor | Temperature simulation |
| Potentiometer | Voltage simulation |
| Green LED | Healthy status indicator |
| Red LED | Warning indicator |
| Piezo Buzzer | Critical alert |

### Pin Configuration

| Component | GPIO |
|-----------|------|
| OLED SDA | 21 |
| OLED SCL | 22 |
| DHT22 Data | 15 |
| Potentiometer Signal | 34 |
| Green LED | 18 |
| Red LED | 19 |
| Buzzer | 23 |

---

## Battery Simulator Parameters

The virtual simulator generates telemetry across three usage profiles:

| Parameter | Range |
|-----------|-------|
| Voltage | 47.2 V – 48.0 V |
| Current | 10 A – 20 A |
| Temperature | 30°C – 48°C |
| Charge Cycles | 100 – 700 |
| SOC | 0 – 100% |
| Charging Type | Normal / Fast |

**Simulation Modes**

| Mode | Behaviour |
|------|-----------|
| Normal User | Moderate charging, low thermal stress, slow degradation |
| Aggressive User | Frequent fast charging, high thermal stress, accelerated degradation |
| Fleet Vehicle | High utilisation, heavy cycle count, sustained load |

---

## Dashboard Tabs

| Tab | What It Shows |
|-----|--------------|
| Realtime Metrics | Live voltage, temperature, humidity |
| Battery Health | Visual fill bar with colour-coded capacity |
| State of Health (SOH) | Composite degradation score (0–100%) |
| Remaining Useful Life (RUL) | Estimated years above the 80% EOL threshold |
| Risk Evaluation | NORMAL / WARNING / ALERT classification |
| AI Diagnostics | Plain-language system verdict |
| Smart Charging | Charging recommendation, target level, thermal status, longevity score |

---

## Analytics Models

### SOH (State of Health)
Three-factor weighted model:

```
SOH = (voltageRatio × 0.50)
    + (batteryLevel × 0.35)
    − (cumulativeDegradation × 0.15)
```

Degradation accumulates from:
- **Thermal stress** — Arrhenius model: aging doubles per 10°C above 25°C
- **Cycle counting** — each detected charge cycle consumes `100 / 1500` % capacity

### RUL (Remaining Useful Life)
```
RUL = (healthRemaining / 20) × designLifeYears
      ÷ (thermalAcceleration × voltageStress)
```

- EOL threshold: 80% SOH (industry standard)
- Rolling 60-reading averages smooth thermal and voltage inputs
- Voltage stress peaks at extremes (near 4.2 V or 3.0 V)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Firmware | Arduino C/C++ on ESP32 |
| Simulation | Wokwi virtual hardware |
| Transport | MQTT over WebSocket (HiveMQ) |
| Frontend | Vanilla JS + CSS (no framework) |
| Analytics | Custom physics-based models |
| Notifications | Web Push API |

---

## Project Status

**Current stage: Proof of Concept**

| Area | Status |
|------|--------|
| Virtual battery simulation | ✅ Complete |
| Battery health analytics (SOH, RUL) | ✅ Complete |
| OLED hardware dashboard | ✅ Complete |
| Alert system (browser + buzzer) | ✅ Complete |
| Smart charging advisor | ✅ Complete |
| Digital twin dashboard (web) | 🔄 In progress |
| Mobile application UI | 🔄 In progress |
| Predictive intelligence layer | 🔄 In progress |

---

## Roadmap

- [ ] Real EV CAN Bus integration
- [ ] Edge AI prediction models (TensorFlow Lite on ESP32)
- [ ] Cloud analytics platform
- [ ] Mobile application (iOS / Android)
- [ ] Fleet management dashboard
- [ ] Battery health certification report export
- [ ] Predictive maintenance scheduling engine

---

## License

This project is intended for **educational, research, and prototype demonstration** purposes.

---

<div align="center">

Built by the VoltGuard AI Development Team  
*Intelligent battery analytics for the future of electric mobility.* ⚡🚗

</div>
