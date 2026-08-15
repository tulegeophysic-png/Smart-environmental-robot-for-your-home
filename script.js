const CONFIG = {
    PM25_WARN: 50,
    PM25_DANGER: 100,
    GAS_DANGER: 500,
    TEMP_WARN: 35,
    OBSTACLE_ALERT_DIST: 20
};

let isRobotPowerOn = true;
let isManualCharging = false;
let isAutoCharging = false;
let robotBattery = 100;
let lastAlertTime = 0;
let envChart = null;
let currentRoomIndex = 0;

const rooms = [
    { id: 'room-living', name: 'Phòng Khách', aqiEl: 'aqi-living' },
    { id: 'room-bed', name: 'Phòng Ngủ', aqiEl: 'aqi-bed' },
    { id: 'room-kitchen', name: 'Phòng Bếp', aqiEl: 'aqi-kitchen' },
    { id: 'room-office', name: 'Phòng Làm Việc', aqiEl: 'aqi-office' }
];

function initChart() {
    const ctx = document.getElementById('envChart').getContext('2d');
    envChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Nhiệt độ (°C)', borderColor: '#eab308', backgroundColor: 'rgba(234,179,8,0.1)', data: [], fill: true, tension: 0.3 },
                { label: 'PM2.5 (µg/m³)', borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.1)', data: [], fill: true, tension: 0.3 },
                // Đổi nhãn thành Độ ẩm (%) với màu sắc riêng biệt
                { label: 'Độ ẩm (%)', borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', data: [], fill: true, tension: 0.3 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
                y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
            },
            plugins: { legend: { labels: { color: '#f8fafc', font: { size: 11 } } } }
        }
    });
}

function updateChart(data) {
    if (!envChart) return;
    const now = new Date().toLocaleTimeString();
    if (envChart.data.labels.length > 7) {
        envChart.data.labels.shift();
        envChart.data.datasets.forEach(ds => ds.data.shift());
    }
    envChart.data.labels.push(now);
    envChart.data.datasets[0].data.push(data.temp);
    envChart.data.datasets[1].data.push(data.pm25);
    // Đẩy dữ liệu độ ẩm vào dataset thứ 3
    envChart.data.datasets[2].data.push(data.humidity);
    envChart.update();
}

function addLog(msg, type = 'info') {
    const logBox = document.getElementById('log-console');
    if (!logBox) return;
    const timeStr = new Date().toLocaleTimeString();
    const p = document.createElement('p');
    p.className = `log-item ${type}`;
    p.textContent = `[${timeStr}] ${msg}`;
    logBox.appendChild(p);
    logBox.scrollTop = logBox.scrollHeight;
}

function processBattery() {
    const cardBat = document.getElementById('card-battery');
    
    if (isManualCharging || isAutoCharging) {
        if (robotBattery < 100) {
            robotBattery += Math.floor(Math.random() * 3) + 3;
            if (robotBattery >= 100) {
                robotBattery = 100;
                isAutoCharging = false;
                isManualCharging = false;
                document.getElementById('btn-charge').textContent = "Gọi Về Sạc";
                addLog("[BATTERY] Pin đã đầy 100%. Tự động ngắt sạc.", "info");
            }
        }
    } else if (isRobotPowerOn) {
        if (robotBattery > 0) {
            robotBattery -= Math.floor(Math.random() * 2) + 1;
            if (robotBattery < 0) robotBattery = 0;
        }

        if (robotBattery <= 10 && !isAutoCharging) {
            isAutoCharging = true;
            addLog(`⚡ [BATTERY] Pin nguy cấp (${robotBattery}%)! Kích hoạt chế độ Tự quay về Trạm sạc.`, 'danger');
        }
    }

    document.getElementById('val-battery').textContent = robotBattery;

    cardBat.classList.remove('theme-green', 'theme-yellow', 'theme-red');
    if (robotBattery <= 10) cardBat.classList.add('theme-red');
    else if (robotBattery <= 30) cardBat.classList.add('theme-yellow');
    else cardBat.classList.add('theme-green');
}

function updateMetricsColors(data) {
    const cardGas = document.getElementById('card-gas');
    const cardPm25 = document.getElementById('card-pm25');
    const cardTemp = document.getElementById('card-temp');

    cardGas.classList.remove('theme-green', 'theme-yellow', 'theme-red');
    if (data.gas >= CONFIG.GAS_DANGER) cardGas.classList.add('theme-red');
    else if (data.gas > 100) cardGas.classList.add('theme-yellow');
    else cardGas.classList.add('theme-green');

    cardPm25.classList.remove('theme-green', 'theme-yellow', 'theme-red');
    if (data.pm25 >= CONFIG.PM25_DANGER) cardPm25.classList.add('theme-red');
    else if (data.pm25 >= CONFIG.PM25_WARN) cardPm25.classList.add('theme-yellow');
    else cardPm25.classList.add('theme-green');

    cardTemp.classList.remove('theme-green', 'theme-yellow', 'theme-red');
    if (data.temp >= CONFIG.TEMP_WARN) cardTemp.classList.add('theme-yellow');
    else cardTemp.classList.add('theme-green');
}

function updateHeatmap(room, data) {
    rooms.forEach(r => document.getElementById(r.id)?.classList.remove('active-robot'));

    const activeBox = document.getElementById(room.id);
    const aqiText = document.getElementById(room.aqiEl);

    if (activeBox) {
        activeBox.classList.add('active-robot');
        activeBox.classList.remove('status-good', 'status-warn', 'status-danger');

        if (data.gas >= CONFIG.GAS_DANGER || data.pm25 > CONFIG.PM25_DANGER) {
            activeBox.classList.add('status-danger');
            aqiText.textContent = "AQI: 🔴 Nguy hiểm!";
        } else if (data.pm25 > CONFIG.PM25_WARN || data.temp > CONFIG.TEMP_WARN) {
            activeBox.classList.add('status-warn');
            aqiText.textContent = "AQI: 🟡 Cảnh báo";
        } else {
            activeBox.classList.add('status-good');
            aqiText.textContent = "AQI: 🟢 Tốt";
        }
    }
}

function handleSmartHome(data) {
    const devPurifier = document.getElementById('dev-air-purifier');
    const devFan = document.getElementById('dev-fan');
    const devAc = document.getElementById('dev-ac');

    if (data.pm25 > CONFIG.PM25_WARN) {
        if (!devPurifier.classList.contains('active')) {
            devPurifier.classList.add('active');
            devPurifier.querySelector('.status-badge').textContent = 'ON';
            addLog(`[SMART HOME] Bụi cao -> Tự động bật Máy Lọc Khí.`, 'warn');
        }
    } else {
        devPurifier.classList.remove('active');
        devPurifier.querySelector('.status-badge').textContent = 'OFF';
    }

    if (data.gas >= CONFIG.GAS_DANGER) {
        if (!devFan.classList.contains('active')) {
            devFan.classList.add('active');
            devFan.querySelector('.status-badge').textContent = 'ON (CẤP TỐC)';
            addLog(`[SMART HOME] Rò rỉ Gas đạt ${data.gas} PPM (Ngưỡng >= 500 PPM) -> Bật Quạt Thông Gió KHẨN CẤP.`, 'danger');
        }
    } else {
        devFan.classList.remove('active');
        devFan.querySelector('.status-badge').textContent = 'OFF';
    }

    if (data.temp > CONFIG.TEMP_WARN) {
        if (!devAc.classList.contains('active')) {
            devAc.classList.add('active');
            devAc.querySelector('.status-badge').textContent = 'ON';
        }
    } else {
        devAc.classList.remove('active');
        devAc.querySelector('.status-badge').textContent = 'OFF';
    }
}

function updateAIAssistant(data) {
    const aiMessage = document.getElementById('ai-message');
    const aiStatus = document.getElementById('ai-status');

    if (data.gas >= CONFIG.GAS_DANGER) {
        aiStatus.textContent = "⚠️ CẢNH BÁO KHẨN CẤP";
        aiMessage.textContent = `PHÁT HIỆN RÒ RỈ GAS (${data.gas} PPM)! Đã kích hoạt quạt thông gió và gửi tin nhắn khẩn cấp!`;
    } else if (data.pm25 > CONFIG.PM25_WARN) {
        aiStatus.textContent = "Đang xử lý...";
        aiMessage.textContent = "Chất lượng không khí kém (Bụi mịn cao). Tôi đã bật máy lọc không khí để bảo vệ sức khỏe.";
    } else if (data.temp > CONFIG.TEMP_WARN) {
        aiStatus.textContent = "Đang làm mát...";
        aiMessage.textContent = "Nhiệt độ phòng tăng cao. Tôi đã bật điều hòa để đảm bảo sự thoải mái.";
    } else {
        aiStatus.textContent = "Đang giám sát ổn định...";
        aiMessage.textContent = "Môi trường hiện tại rất tốt. Tôi vẫn đang tiếp tục theo dõi các chỉ số xung quanh.";
    }
}

function speakAIStatus() {
    if (!('speechSynthesis' in window)) {
        alert("Trình duyệt không hỗ trợ đọc giọng nói!");
        return;
    }
    window.speechSynthesis.cancel();
    
    const temp = document.getElementById('val-temp').textContent;
    const pm25 = document.getElementById('val-pm25').textContent;
    const gas = document.getElementById('val-gas').textContent;
    const motionDist = document.getElementById('val-motion').textContent;
    const roomName = rooms[currentRoomIndex].name;
    
    let text = `Trợ lý AuraBot xin báo cáo. Robot đang ở ${roomName}. Pin còn ${robotBattery} phần trăm. Khoảng cách vật cản phía trước là ${motionDist} xăng-ti-mét. Nhiệt độ phòng là ${temp} độ C. Bụi mịn P M 2.5 là ${pm25}. `;
    
    if (parseFloat(gas) >= CONFIG.GAS_DANGER) {
        text += `Báo động đỏ! Phát hiện rò rỉ khí gas nguy hiểm ở mức ${gas} P P M! Vui lòng kiểm tra ngay!`;
    } else if (parseFloat(pm25) >= CONFIG.PM25_WARN) {
        text += "Cảnh báo không khí ô nhiễm nhẹ. Hệ thống đã tự động bật máy lọc không khí.";
    } else {
        text += "Chất lượng môi trường hiện tại đang rất tốt.";
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    window.speechSynthesis.speak(utterance);
    addLog("[AI VOICE] Trợ lý AI đang đọc thông số hệ thống.", "info");
}

function toggleRobotPower(cb) {
    isRobotPowerOn = cb.checked;
    const textEl = document.getElementById('robot-state-text');
    if (isRobotPowerOn) {
        textEl.textContent = "Đang hoạt động";
        textEl.style.color = "var(--color-green)";
        addLog("[SYSTEM] Bật hệ thống Robot.", 'info');
    } else {
        textEl.textContent = "Đã tắt (OFF)";
        textEl.style.color = "var(--text-secondary)";
        addLog("[SYSTEM] Đã tắt nguồn Robot.", 'warn');
    }
}

function toggleManualCharging() {
    isManualCharging = !isManualCharging;
    document.getElementById('btn-charge').textContent = isManualCharging ? "Dừng Sạc" : "Gọi Về Sạc";
    addLog(isManualCharging ? "[BATTERY] Bật chế độ sạc thủ công." : "[BATTERY] Tắt sạc thủ công.");
}

function resetBattery() {
    robotBattery = 100;
    document.getElementById('val-battery').textContent = "100";
    addLog("[BATTERY] Đã khôi phục mức Pin 100%.");
}

function dismissEmergency() {
    document.getElementById('emergency-banner').classList.add('hidden');
    document.body.classList.remove('alarm-active');
    addLog("[EMERGENCY] Người dùng đã xác nhận tắt báo động đỏ.", 'warn');
}

function exportToExcel() {
    alert("Xuất báo cáo dữ liệu lịch sử thành công!");
    addLog("[EXCEL] Xuất báo cáo CSV thành công.", "info");
}

window.addEventListener('DOMContentLoaded', () => {
    initChart();

    setInterval(() => {
        processBattery();

        if (!isRobotPowerOn) return;

        currentRoomIndex = (currentRoomIndex + 1) % rooms.length;
        const currentRoom = rooms[currentRoomIndex];

        let simulatedGas = Math.floor(Math.random() * 20);
        if (Math.random() < 0.08) { 
            simulatedGas = Math.floor(Math.random() * 150) + 500;
        }

        const simulatedDist = Math.floor(Math.random() * 145) + 5;

        const sensorData = {
            temp: parseFloat((Math.random() * (36 - 26) + 26).toFixed(1)),
            humidity: parseFloat((Math.random() * (75 - 50) + 50).toFixed(1)),
            pm25: parseFloat((Math.random() * (110 - 15) + 15).toFixed(1)),
            co2: parseFloat((Math.random() * (1300 - 400) + 400).toFixed(0)),
            gas: simulatedGas,
            motionDist: simulatedDist
        };

        document.getElementById('val-temp').textContent = sensorData.temp;
        document.getElementById('val-humidity').textContent = sensorData.humidity;
        document.getElementById('val-pm25').textContent = sensorData.pm25;
        document.getElementById('val-co2').textContent = sensorData.co2;
        document.getElementById('val-gas').textContent = sensorData.gas;
        document.getElementById('val-motion').textContent = sensorData.motionDist;

        const cardMotion = document.getElementById('card-motion');
        const motionStatusText = document.getElementById('motion-status');
        
        cardMotion.classList.remove('theme-green', 'theme-yellow', 'theme-red', 'theme-blue');
        
        if (sensorData.motionDist <= CONFIG.OBSTACLE_ALERT_DIST) {
            cardMotion.classList.add('theme-red');
            motionStatusText.textContent = "⚠️ Vật cản gần! Đổi hướng.";
            addLog(`🤖 [NAVIGATION] Vật cản ở khoảng cách ${sensorData.motionDist}cm! Robot tiến hành né tránh.`, 'warn');
        } else if (sensorData.motionDist <= 50) {
            cardMotion.classList.add('theme-yellow');
            motionStatusText.textContent = "🔍 Vật cản tầm trung.";
        } else {
            cardMotion.classList.add('theme-green');
            motionStatusText.textContent = "✅ Đường đi thoáng.";
        }

        const banner = document.getElementById('emergency-banner');
        if (sensorData.gas >= CONFIG.GAS_DANGER) {
            banner.classList.remove('hidden');
            document.body.classList.add('alarm-active');
            addLog(`🚨 [BÁO ĐỘNG ĐỎ] Phát hiện rò rỉ Gas vượt ngưỡng (${sensorData.gas} PPM >= 500 PPM) tại ${currentRoom.name}!`, 'danger');
            
            const now = Date.now();
            if (now - lastAlertTime > 20000) {
                addLog(`📲 [TELEGRAM/ZALO] Đã phát tin nhắn cấp cứu khẩn cấp tới Điện thoại chủ nhà!`, 'danger');
                lastAlertTime = now;
            }
        }

        updateMetricsColors(sensorData);
        updateHeatmap(currentRoom, sensorData);
        handleSmartHome(sensorData);
        updateAIAssistant(sensorData);
        updateChart(sensorData);

        addLog(`[SENSORS] Vị trí: ${currentRoom.name} | Temp=${sensorData.temp}°C | Humidity=${sensorData.humidity}% | Gas=${sensorData.gas}PPM`);
    }, 3000);
});