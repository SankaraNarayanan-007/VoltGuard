// Replace with the IP address printed in your Wokwi serial terminal
const ESP32_IP = "localhost:9080";

// TABS SYSTEM FOR THE SINGLE PAGE ENGINE
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

// --------------------------------------------------------------------
// SOH & RUL Calculation Engine
// --------------------------------------------------------------------

// Rolling history for degradation tracking
const voltageHistory = [];
const tempHistory = [];
const MAX_HISTORY = 60; // last 60 readings

// Battery design specs (tune to your battery)
const V_NOMINAL = 3.7;   // nominal voltage
const V_MAX     = 4.2;   // fully charged
const V_MIN     = 3.0;   // cutoff voltage
const TEMP_OPTIMAL = 25; // optimal temp in °C
const BATTERY_DESIGN_LIFE_YEARS = 5; // expected lifespan at ideal conditions

function calculateSOH(voltage, temperature, batteryLevel) {
    // SOH based on voltage deviation from nominal + thermal stress factor
    const voltageRatio = Math.min(
        ((voltage - V_MIN) / (V_MAX - V_MIN)) * 100,
        100
    );

    // Thermal stress: every degree above 40°C or below 0°C degrades SOH
    const tempStress = temperature > 40
        ? (temperature - 40) * 0.5
        : temperature < 0
            ? Math.abs(temperature) * 0.3
            : 0;

    // Combine voltage health + battery level + thermal penalty
    const rawSOH = (voltageRatio * 0.5) + (batteryLevel * 0.5) - tempStress;
    return Math.max(0, Math.min(100, rawSOH)).toFixed(1);
}

function calculateRUL(soh, temperature, voltage) {
    // Track degradation rate using recent voltage history
    voltageHistory.push(voltage);
    tempHistory.push(temperature);
    if (voltageHistory.length > MAX_HISTORY) voltageHistory.shift();
    if (tempHistory.length > MAX_HISTORY) tempHistory.shift();

    // Degradation rate: how fast SOH is declining
    // Higher temp = faster degradation (Arrhenius approximation)
    const avgTemp = tempHistory.reduce((a, b) => a + b, 0) / tempHistory.length;
    const thermalFactor = avgTemp > 35
        ? 1 + ((avgTemp - 35) * 0.04)  // accelerated aging above 35°C
        : avgTemp < 10
            ? 1 + ((10 - avgTemp) * 0.02)
            : 1.0;

    // RUL = remaining % of SOH above 80% threshold / degradation rate
    // 80% SOH is typically considered end-of-life for EV batteries
    const SOH_EOL = 80;
    const remainingHealth = Math.max(0, soh - SOH_EOL);
    const rulYears = (remainingHealth / 100) * BATTERY_DESIGN_LIFE_YEARS / thermalFactor;

    return Math.max(0, rulYears).toFixed(2);
}

// --------------------------------------------------------------------
// Real-time Cloud MQTT Subscription Setup
// --------------------------------------------------------------------

const client = new Paho.MQTT.Client(
    "broker.hivemq.com",
    Number(8884),           // 8884 = WSS (secure WebSocket) for HTTPS pages
    "voltguard_dashboard_ui_" + Math.floor(Math.random() * 10000)
);

client.onConnectionLost = (responseObject) => {
    console.warn("MQTT Connection Lost. Attempting reconnection...");
    if (responseObject.errorCode !== 0) {
        setTimeout(() => client.connect({ onSuccess: onConnect, useSSL: true }), 3000);
    }
};

client.onMessageArrived = (message) => {
    try {
        const data = JSON.parse(message.payloadString);
        console.log("Real-time telemetry frame arrived:", data);
        localStorage.setItem("voltguard_data", JSON.stringify(data));
        updateUIElements(data);
    } catch (e) {
        console.error("Malformed message frame content arrived:", e);
    }
};

function onConnect() {
    console.log("Connected to Cloud Broker! Subscribed to live telemetry feed.");
    client.subscribe("voltguard/telemetry/data");
}

client.connect({
    onSuccess: onConnect,
    useSSL: true,           // SSL required on HTTPS (Vercel)
    cleanSession: true
});

// --------------------------------------------------------------------
// UI Update Engine
// --------------------------------------------------------------------

function updateUIElements(data) {

    const voltage     = parseFloat(data.voltage);
    const temperature = parseFloat(data.temperature);
    const humidity    = parseFloat(data.humidity);
    const batteryLevel = parseFloat(data.batteryLevel);

    // 1. Telemetry Screen
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

    // 3. SOH — calculated from live data
    const soh = calculateSOH(voltage, temperature, batteryLevel);
    const sohEl = document.getElementById("soh-value");
    if (sohEl) sohEl.innerText = `${soh}%`;

    // 4. RUL — calculated from SOH + thermal history
    const rul = calculateRUL(parseFloat(soh), temperature, voltage);
    const rulEl = document.getElementById("rul-value");
    if (rulEl) rulEl.innerText = `${rul} Years`;

    // 5. Risk Assessment
    const riskStatusBox = document.getElementById("risk-visual-box");
    const riskLevelText = document.getElementById("risk-level-text");
    if (riskStatusBox && riskLevelText) {
        riskLevelText.innerText = `${data.status} RISK`;
        if (data.status === "ALERT") {
            riskStatusBox.style.background  = "#ef4444";
            riskStatusBox.style.boxShadow   = "0 0 20px #ef4444";
        } else if (data.status === "WARNING") {
            riskStatusBox.style.background  = "#eab308";
            riskStatusBox.style.boxShadow   = "0 0 20px #eab308";
        } else {
            riskStatusBox.style.background  = "#22c55e";
            riskStatusBox.style.boxShadow   = "0 0 20px #22c55e";
        }
    }

    // 6. AI Diagnostics
    const aiVerdictText = document.getElementById("ai-verdict");
    if (aiVerdictText) {
        aiVerdictText.innerText =
            data.status === "ALERT"
                ? "Critical Outlier State Detected"
                : data.status === "WARNING"
                    ? "Warning: Non-Normative Stress Signs"
                    : "System Environment Normal";
    }
}