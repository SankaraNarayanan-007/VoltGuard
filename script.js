// Replace with the IP address printed in your Wokwi serial terminal
const ESP32_IP = "localhost:9080";

// TABS SYSTEM FOR THE SINGLE PAGE ENGINE
function switchTab(tabId) {
    // Remove active classes from all nav buttons
    document.querySelectorAll('.nav-item').forEach(btn =>
        btn.classList.remove('active')
    );

    // Remove active classes from all section panels
    document.querySelectorAll('.tab-content').forEach(content =>
        content.classList.remove('active')
    );

    // Activate the clicked button element
    const selectedButton = Array.from(
        document.querySelectorAll('.nav-item')
    ).find(btn => btn.getAttribute('onclick').includes(tabId));

    if (selectedButton) {
        selectedButton.classList.add('active');
    }

    // Show corresponding page view container
    const targetPanel = document.getElementById(tabId);

    if (targetPanel) {
        targetPanel.classList.add('active');
    }
}

// --------------------------------------------------------------------
// Real-time Cloud MQTT Subscription Setup
// --------------------------------------------------------------------

// Connect via WebSocket port 8000 to the public HiveMQ Broker
const client = new Paho.MQTT.Client(
    "broker.hivemq.com",
    Number(8000),
    "voltguard_dashboard_ui_" + Math.floor(Math.random() * 10000)
);

client.onConnectionLost = (responseObject) => {
    console.warn("MQTT Connection Lost. Attempting reconnection...");

    if (responseObject.errorCode !== 0) {
        setTimeout(() => {
            client.connect({
                onSuccess: onConnect
            });
        }, 3000);
    }
};

client.onMessageArrived = (message) => {
    try {
        // Parse the incoming string payload pushed from the ESP32
        const data = JSON.parse(message.payloadString);

        console.log("Real-time telemetry frame arrived:", data);

        // Cache data context locally
        localStorage.setItem(
            "voltguard_data",
            JSON.stringify(data)
        );

        // Push parsed keys down to dashboard elements
        updateUIElements(data);

    } catch (e) {
        console.error(
            "Malformed message frame content arrived:",
            e
        );
    }
};

// Callback when browser establishes socket channel
function onConnect() {
    console.log(
        "Connected to Cloud Broker! Subscribed to live telemetry feed."
    );

    client.subscribe("voltguard/telemetry/data");
}

// Initialize connection automatically
client.connect({
    onSuccess: onConnect,
    useSSL: false,
    cleanSession: true
});

// --------------------------------------------------------------------
// UI Update Engine
// --------------------------------------------------------------------

function updateUIElements(data) {

    // 1. Update Core Metric Fields (Telemetry Screen)
    const voltText = document.getElementById("main-voltage");
    const tempText = document.getElementById("main-temp");
    const humText = document.getElementById("main-hum");

    // Matched keys with MicroPython payload structure
    if (voltText) {
        voltText.innerText =
            `${parseFloat(data.voltage).toFixed(1)}V`;
    }

    if (tempText) {
        tempText.innerText =
            `${parseFloat(data.temperature).toFixed(1)}°C`;
    }

    if (humText) {
        humText.innerText =
            `${parseFloat(data.humidity).toFixed(1)}%`;
    }

    // --------------------------------------------------------------
    // 2. Dynamic Component Adjustments (Battery Health Page)
    // --------------------------------------------------------------

    const healthPercent =
        document.getElementById("health-percentage");

    const batteryBarFill =
        document.getElementById("battery-fill-bar");

    if (healthPercent && batteryBarFill) {

        // Matched key with MicroPython payload structure
        const fixedHealth =
            parseFloat(data.batteryLevel).toFixed(1);

        healthPercent.innerText = `${fixedHealth}%`;
        batteryBarFill.style.height = `${fixedHealth}%`;

        // Dynamic Health Color Grading
        if (fixedHealth > 70) {
            batteryBarFill.style.background =
                "linear-gradient(to top, #22c55e, #4ade80)";

        } else if (fixedHealth > 40) {
            batteryBarFill.style.background =
                "linear-gradient(to top, #eab308, #fde047)";

        } else {
            batteryBarFill.style.background =
                "linear-gradient(to top, #ef4444, #fca5a5)";
        }
    }

    // --------------------------------------------------------------
    // 3. Dynamic Threshold Styling (Risk Assessment Page)
    // --------------------------------------------------------------

    const riskStatusBox =
        document.getElementById("risk-visual-box");

    const riskLevelText =
        document.getElementById("risk-level-text");

    if (riskStatusBox && riskLevelText) {

        riskLevelText.innerText = `${data.status} RISK`;

        if (data.status === "ALERT") {

            riskStatusBox.style.background = "#ef4444";
            riskStatusBox.style.boxShadow =
                "0 0 20px #ef4444";

        } else if (data.status === "WARNING") {

            riskStatusBox.style.background = "#eab308";
            riskStatusBox.style.boxShadow =
                "0 0 20px #eab308";

        } else {

            riskStatusBox.style.background = "#22c55e";
            riskStatusBox.style.boxShadow =
                "0 0 20px #22c55e";
        }
    }

    // --------------------------------------------------------------
    // 4. Inferred Prognostics Engine UI (AI Insights Page)
    // --------------------------------------------------------------

    const aiVerdictText =
        document.getElementById("ai-verdict");

    if (aiVerdictText) {

        aiVerdictText.innerText =
            data.status === "ALERT"
                ? "Critical Outlier State Detected"
                : data.status === "WARNING"
                    ? "Warning: Non-Normative Stress Signs"
                    : "System Environment Normal";
    }
}

// Removed old fetchTelemetry loops since data is now
// delivered directly through client.onMessageArrived