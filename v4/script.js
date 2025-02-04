let data;
let map = null;

function showPage(pageId) {
    console.log('Showing page: ', pageId);
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(`${pageId}Page`).classList.add('active');

    document.querySelectorAll('.tab').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeButton = document.querySelector(`[onclick="showPage('${pageId}')"]`);
    activeButton.classList.add('active');

    if (pageId === 'map') {
        console.log('Initializing map 1');
        initMapView();
        if (map) setTimeout(() => map.invalidateSize(), 0);
    }
}


//////////////////////////
// Map functionality
//////////////////////////
let measureControl, polyline, mapSegments = [];
function initMapView() {
    if (!map) {
        console.log('Initializing map 2');
        map = L.map('map', {
            maxZoom: 22,
        }).setView([0, 0], 0);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);

        L.control.zoom({ position: 'topright' }).addTo(map);
        L.control.scale({ imperial: false }).addTo(map);

        measureControl = new L.Control.Measure({
            position: 'topleft',
            primaryLengthUnit: 'meters',
            secondaryLengthUnit: 'kilometers',
            primaryAreaUnit: 'sqmeters'
        });
        measureControl.addTo(map);
    }
    else {
        console.log('Map already initialized');
    }
}
//////////////////////
// utils
//////////////////////

function showMessage(content) {
    document.getElementById('message').innerHTML = content;
    console.log('Message: ', content);
}


// File handling
const overlay = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

fileInput.addEventListener('change', handleFileSelect);

window.addEventListener('dragover', (e) => {
    e.preventDefault();
    overlay.classList.add('active');
});

window.addEventListener('dragleave', (e) => {
    if (e.clientX <= 0 || e.clientY <= 0 || 
        e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        overlay.classList.remove('active');
    }
});

window.addEventListener('drop', (e) => {
    e.preventDefault();
    overlay.classList.remove('active');
    handleFileDrop(e.dataTransfer.files);
});

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) processFile(files[0]);
}

function handleFileDrop(files) {
    if (files.length > 0) processFile(files[0]);
}


/////////////////////////////////////////
// File processing
/////////////////////////////////////////

async function processFile(file) {
    showMessage('Processing file: ' + file.name);
    const text = await file.text();
    const { convertedData, hasGPS } = await convertData(text);

    document.getElementById('mapBtn').disabled = !hasGPS;
    document.getElementById('graphBtn').disabled = false;

    showMessage('File processed');
}

async function convertData(data) {
    let convertedData = [];
    let hasGPS = false;
    let isFirstLine = true;
    let timeOffset = 0;
    
    data.split('\n').forEach(line => {
        if (!line.startsWith('>23|01:')) return;

        try {
            const parts = line.split(/[:<]/)[1].split(',');
            if (!isNaN(parseFloat(parts[9])) && !isNaN(parseFloat(parts[10]))) {
                hasGPS = true;
            }
            segments = convertDataSegments(parts);
            if (isFirstLine) {
                timeOffset = segments.time;
                isFirstLine = false;
            }
            segments.time -= timeOffset;
            convertedData.push(segments);
        } catch {
            console.error('Error converting line:', line);
        }
    });

    return { convertedData, hasGPS };
}

function convertDataSegments(parts) {
    return {
        // Power measurements (1-9)
        time: parseFloat(parts[0]),
        voltage: parseFloat(parts[1]),
        current10A: parseFloat(parts[2]),
        avgPower10A: parseFloat(parts[3]),
        totalEnergy10A: parseInt(parts[4]),
        current50A: parseFloat(parts[5]),
        avgPower50A: parseFloat(parts[6]),
        totalEnergy50A: parseInt(parts[7]),
        totalEnergyBoth: parseInt(parts[8]),

        // GPS data (10-13)
        gpsLat: parseFloat(parts[9]),
        gpsLon: parseFloat(parts[10]),
        gpsSpeed: parseFloat(parts[11]),
        gpsCourse: parseFloat(parts[12]),

        // Button states and metrics (14-31)
        btn1State: parseInt(parts[13]),   // Regen/Boost mode (1=active)
        btn1LastChange: parseFloat(parts[14]),  // Local time when last toggled
        btn1TotalChanges: parseInt(parts[15]),  // Count of all toggle events
        
        btn2State: parseInt(parts[16]),   // Full power mode (1=active)
        btn2LastChange: parseFloat(parts[17]),
        btn2TotalChanges: parseInt(parts[18]),
        
        btn3State: parseInt(parts[19]),   // Cruise control (1=active)
        btn3LastChange: parseFloat(parts[20]),
        btn3TotalChanges: parseInt(parts[21]),
        
        btn4State: parseInt(parts[22]),   // Speed mode selector (1=active)
        btn4LastChange: parseFloat(parts[23]),
        btn4TotalChanges: parseInt(parts[24]),
        
        btn5State: parseInt(parts[25]),   // System status (nSYS_OK, 1=normal)
        btn5LastChange: parseFloat(parts[26]),
        btn5TotalChanges: parseInt(parts[27]),
        
        btn6State: parseInt(parts[28]),   // Constant current drive (CC_Drive, 1=active)
        btn6LastChange: parseFloat(parts[29]),
        btn6TotalChanges: parseInt(parts[30]),

        // GPS timing (32-33)
        gpsPpsTime: parseFloat(parts[31]),
        oscillatorDeviation: parseFloat(parts[32]),

        // IMU data (34-40)
        imuAccelX: parseFloat(parts[33]),
        imuAccelY: parseFloat(parts[34]),
        imuAccelZ: parseFloat(parts[35]),
        imuGyroX: parseFloat(parts[36]),
        imuGyroY: parseFloat(parts[37]),
        imuGyroZ: parseFloat(parts[38]),
        imuTemp: parseFloat(parts[39]),

        // Power monitoring (41-46)
        ltcConversionTime: parseFloat(parts[40]),
        ltcAVCC: parseFloat(parts[41]),
        ltcVREF: parseFloat(parts[42]),
        ltcTemp: parseFloat(parts[43]),
        sense50ATemp: parseFloat(parts[44]),
        sense10ATemp: parseFloat(parts[45]),

        // Storage metrics (47-48)
        sdWriteStart: parseFloat(parts[46]),
        sdWriteDuration: parseInt(parts[47]),

        // System power (49-50)
        systemVoltage: parseFloat(parts[48]),
        supercapsVoltage: parseFloat(parts[49])
    };
}
