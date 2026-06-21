// ---------------------------------------------------------------
// SESSION GUARD — redirect to login if not authenticated
// ---------------------------------------------------------------
const session = JSON.parse(localStorage.getItem('voltguard_session') || 'null');
if (!session) {
    window.location.href = 'login.html';
}

// Inject user greeting + logout button into sidebar brand area
window.addEventListener('DOMContentLoaded', () => {
    const brand = document.querySelector('.brand');
    if (brand && session) {
        const userBar = document.createElement('div');
        userBar.className = 'user-bar';
        userBar.innerHTML = `
            <span class="user-name">👤 ${session.name}</span>
            <button class="logout-btn" onclick="handleLogout()">Sign Out</button>
        `;
        brand.parentElement.insertBefore(userBar, brand.nextSibling);
    }

    // Request notification permission on load
    requestNotificationPermission();
});

function handleLogout() {
    localStorage.removeItem('voltguard_session');
    window.location.href = 'login.html';
}

// ---------------------------------------------------------------
// BROWSER PUSH NOTIFICATIONS
// ---------------------------------------------------------------
let notificationPermission = false;
let lastNotifiedStatus = null; // prevent repeat spam

function requestNotificationPermission() {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
        notificationPermission = true;
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            notificationPermission = permission === 'granted';
        });
    }
}

function sendNotification(title, body, type = 'warning') {
    if (!notificationPermission) return;

    // Don't spam same status repeatedly
    if (lastNotifiedStatus === type) return;
    lastNotifiedStatus = type;

    const icons = {
        alert:   '🔴',
        warning: '🟡',
        normal:  '🟢'
    };

    new Notification(`${icons[type]} VoltGuard AI — ${title}`, {
        body,
        icon: 'car-bg.png',
        badge: 'car-bg.png',
        tag: 'voltguard-alert',   // replaces previous notification instead of stacking
        renotify: true
    });
}

// ---------------------------------------------------------------
// TABS SYSTEM
// ---------------------------------------------------------------
function switchTab(tabId) {
    document.querySelectorAll('.nav-item').forEach(btn =>
        btn.classList.remove('active')
    );
    document.querySelectorAll('.tab-content').forEach(content =>
        content.classList.remove('active')
    );
    const selectedButton = Array.from(
        document.querySelectorAll('.nav-item')
    ).find(btn => btn.getAttribute('onclick').includes(tabId));
    if (selectedButton) selectedButton.classList.add('active');
    const targetPanel = document.getElementById(tabId);
    if (targetPanel) targetPanel.classList.add('active');
}

// ---------------------------------------------------------------
// SOH & RUL CALCULATION ENGINE (Physics-based, Cumulative)
// ---------------------------------------------------------------

// Battery constants (LiFePO4 / Li-ion EV pack typical values)
const V_MAX  = 4.2;    // Full charge voltage (V)
const V_MIN  = 3.0;    // Cutoff voltage (V)
const V_NOM  = 3.7;    // Nominal voltage (V)
const TEMP_REF = 25;   // Reference temperature (°C)
const BATTERY_DESIGN_CAPACITY = 100; // % — baseline
const BATTERY_DESIGN_LIFE_CYCLES = 1500; // typical Li-ion cycle life
const BATTERY_DESIGN_LIFE_YEARS  = 5;

// Rolling history buffers (last 60 readings ≈ 1 min at 1Hz)
const voltageHistory = [];
const tempHistory    = [];
const MAX_HISTORY    = 60;

// Cumulative degradation accumulator (persists across readings)
let cumulativeDegradation = 0; // in % capacity lost
let cycleCount = 0;
let prevVoltage = null;
let chargingCycles = 0;

/**
 * SOH — State of Health
 *
 * Combines three degradation factors:
 *  1. Voltage-based capacity fade (how far below V_MAX we sit)
 *  2. Thermal stress (Arrhenius model: every 10°C above 25°C doubles degradation rate)
 *  3. Cumulative cycle damage (estimated from voltage direction reversals)
 *
 * Returns 0–100 %
 */
function calculateSOH(voltage, temperature, batteryLevel) {
    // ── Factor 1: Voltage capacity ratio ──────────────────────────
    const voltageRatio = Math.min(
        ((voltage - V_MIN) / (V_MAX - V_MIN)) * 100, 100
    );

    // ── Factor 2: Thermal stress (Arrhenius approximation) ────────
    // Each 10°C above 25°C doubles the degradation rate → each reading
    // contributes a tiny thermal degradation increment.
    const tempDelta = temperature - TEMP_REF;
    const arrheniusFactor = Math.pow(2, tempDelta / 10); // >1 if hot, <1 if cold
    const thermalDegIncrement = (arrheniusFactor - 1) * 0.001; // per reading
    cumulativeDegradation += Math.max(0, thermalDegIncrement);

    // ── Factor 3: Charge cycle counting ───────────────────────────
    // Detect a new charge cycle when voltage reverses from falling to rising
    if (prevVoltage !== null) {
        if (voltage > prevVoltage + 0.05) {  // rising edge = charging started
            cycleCount++;
            // Each cycle degrades capacity by (100 / design_cycles) %
            cumulativeDegradation += (100 / BATTERY_DESIGN_LIFE_CYCLES);
        }
    }
    prevVoltage = voltage;

    // ── Composite SOH ─────────────────────────────────────────────
    // Weighted blend: 50% real-time voltage + 35% battery level + 15% cumulative loss
    const rawSOH =
        (voltageRatio    * 0.50) +
        (batteryLevel    * 0.35) -
        (cumulativeDegradation * 0.15);

    return Math.max(0, Math.min(100, rawSOH)).toFixed(1);
}

/**
 * RUL — Remaining Useful Life (in years)
 *
 * Uses:
 *  1. How much SOH remains above the End-of-Life threshold (80%)
 *  2. Rolling average thermal acceleration factor
 *  3. Voltage stress factor (high/low voltage accelerates aging)
 *
 * Returns years remaining
 */
function calculateRUL(soh, temperature, voltage) {
    voltageHistory.push(voltage);
    tempHistory.push(temperature);
    if (voltageHistory.length > MAX_HISTORY) voltageHistory.shift();
    if (tempHistory.length   > MAX_HISTORY) tempHistory.shift();

    // ── Rolling average thermal acceleration ──────────────────────
    const avgTemp = tempHistory.reduce((a, b) => a + b, 0) / tempHistory.length;
    // Arrhenius: aging doubles per 10°C above reference
    const thermalAccel = Math.pow(2, (avgTemp - TEMP_REF) / 10);

    // ── Voltage stress factor ─────────────────────────────────────
    // Operating near V_MAX or V_MIN accelerates degradation
    const vCenter = (V_MAX + V_MIN) / 2;  // 3.6V ideal midpoint
    const vDeviation = Math.abs(voltage - vCenter) / (V_MAX - V_MIN);
    const voltageStress = 1 + (vDeviation * 0.5); // up to 1.5× if at extremes

    // ── RUL calculation ───────────────────────────────────────────
    // EOL threshold = 80% SOH (industry standard for EV batteries)
    const healthRemaining = Math.max(0, parseFloat(soh) - 80);
    const totalUsable     = 100 - 80; // = 20 points of usable SOH range

    const healthFraction = healthRemaining / totalUsable;
    const rulYears = (healthFraction * BATTERY_DESIGN_LIFE_YEARS)
                     / (thermalAccel * voltageStress);

    return Math.max(0, rulYears).toFixed(2);
}

// ---------------------------------------------------------------
// MQTT — Secure WebSocket for HTTPS (Vercel)
// ---------------------------------------------------------------
const client = new Paho.MQTT.Client(
    "broker.hivemq.com",
    Number(8884),
    "voltguard_dashboard_ui_" + Math.floor(Math.random() * 10000)
);

client.onConnectionLost = (responseObject) => {
    console.warn("MQTT Connection Lost. Reconnecting...");
    if (responseObject.errorCode !== 0) {
        setTimeout(() => client.connect({ onSuccess: onConnect, useSSL: true }), 3000);
    }
};

client.onMessageArrived = (message) => {
    try {
        const data = JSON.parse(message.payloadString);
        console.log("Telemetry received:", data);
        localStorage.setItem("voltguard_data", JSON.stringify(data));
        updateUIElements(data);
    } catch (e) {
        console.error("Malformed MQTT message:", e);
    }
};

function onConnect() {
    console.log("Connected to HiveMQ broker.");
    client.subscribe("voltguard/telemetry/data");
}

client.connect({
    onSuccess: onConnect,
    useSSL: true,
    cleanSession: true
});

// ---------------------------------------------------------------
// UI UPDATE ENGINE
// ---------------------------------------------------------------
function updateUIElements(data) {
    const voltage      = parseFloat(data.voltage);
    const temperature  = parseFloat(data.temperature);
    const humidity     = parseFloat(data.humidity);
    const batteryLevel = parseFloat(data.batteryLevel);

    // 1. Telemetry
    const voltText = document.getElementById("main-voltage");
    const tempText = document.getElementById("main-temp");
    const humText  = document.getElementById("main-hum");
    if (voltText) voltText.innerText = `${voltage.toFixed(1)}V`;
    if (tempText) tempText.innerText = `${temperature.toFixed(1)}°C`;
    if (humText)  humText.innerText  = `${humidity.toFixed(1)}%`;

    // 2. Battery Health
    const healthPercent  = document.getElementById("health-percentage");
    const batteryBarFill = document.getElementById("battery-fill-bar");
    if (healthPercent && batteryBarFill) {
        healthPercent.innerText = `${batteryLevel.toFixed(1)}%`;
        batteryBarFill.style.height = `${batteryLevel}%`;
        if (batteryLevel > 70) {
            batteryBarFill.style.background = "linear-gradient(to top, #22c55e, #4ade80)";
        } else if (batteryLevel > 40) {
            batteryBarFill.style.background = "linear-gradient(to top, #eab308, #fde047)";
        } else {
            batteryBarFill.style.background = "linear-gradient(to top, #ef4444, #fca5a5)";
        }
    }

    // 3. SOH
    const soh   = calculateSOH(voltage, temperature, batteryLevel);
    const sohEl = document.getElementById("soh-value");
    if (sohEl) sohEl.innerText = `${soh}%`;

    // 4. RUL
    const rul   = calculateRUL(parseFloat(soh), temperature, voltage);
    const rulEl = document.getElementById("rul-value");
    if (rulEl) rulEl.innerText = `${rul} Years`;

    // 5. Risk
    const riskStatusBox = document.getElementById("risk-visual-box");
    const riskLevelText = document.getElementById("risk-level-text");
    if (riskStatusBox && riskLevelText) {
        riskLevelText.innerText = `${data.status} RISK`;
        if (data.status === "ALERT") {
            riskStatusBox.style.background = "#ef4444";
            riskStatusBox.style.boxShadow  = "0 0 20px #ef4444";
        } else if (data.status === "WARNING") {
            riskStatusBox.style.background = "#eab308";
            riskStatusBox.style.boxShadow  = "0 0 20px #eab308";
        } else {
            riskStatusBox.style.background = "#22c55e";
            riskStatusBox.style.boxShadow  = "0 0 20px #22c55e";
        }
    }

    // 6. AI Diagnostics
    const aiVerdictText = document.getElementById("ai-verdict");
    if (aiVerdictText) {
        aiVerdictText.innerText =
            data.status === "ALERT"   ? "Critical Outlier State Detected" :
            data.status === "WARNING" ? "Warning: Non-Normative Stress Signs" :
                                        "System Environment Normal";
    }

    // 7. Browser push notifications based on status
    if (data.status === "ALERT") {
        sendNotification(
            "Critical Alert",
            `Voltage: ${voltage.toFixed(1)}V | Temp: ${temperature.toFixed(1)}°C | Battery: ${batteryLevel.toFixed(1)}% — Immediate attention required!`,
            "alert"
        );
    } else if (data.status === "WARNING") {
        sendNotification(
            "Warning Detected",
            `Voltage: ${voltage.toFixed(1)}V | Temp: ${temperature.toFixed(1)}°C — Non-normal stress signs detected.`,
            "warning"
        );
    } else {
        // Reset so normal→alert triggers again
        if (lastNotifiedStatus !== null) lastNotifiedStatus = null;
    }
}