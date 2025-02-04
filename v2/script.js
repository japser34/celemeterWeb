// Map and Data Variables
let map, polyline, lastPositionMarker, measureControl;
let allData = [];
let hasGPS = false;
let colorScale, speedScale;
let mapSegments = [];
let currentLines = new Map();
const highlightMarker = L.circleMarker([0, 0], {
    radius: 6,
    color: '#FF0000',
    fillColor: '#FF0000',
    fillOpacity: 0.8
});

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

// Event Listeners
dropZone.addEventListener('dragover', handleDragOver);
dropZone.addEventListener('dragleave', handleDragLeave);
dropZone.addEventListener('drop', handleFileDrop);
fileInput.addEventListener('change', handleFileSelect);

// Event Handlers
function handleDragOver(e) {
    e.preventDefault();
    dropZone.classList.add('dragover');
}

function handleDragLeave() {
    dropZone.classList.remove('dragover');
}

function handleFileDrop(e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) processFile(e.dataTransfer.files[0]);
}

function handleFileSelect(e) {
    if (e.target.files[0]) processFile(e.target.files[0]);
}

// Page Navigation
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(`${pageId}Page`).classList.add('active');
    document.querySelector(`button[onclick="showPage('${pageId}')"]`).classList.add('active');
    
    if (pageId === 'map' && !map) initMapView();
    if (pageId === 'graph') updateChart();
}

// File Processing
async function processFile(file) {
    try {
        const text = await file.text();
        parseData(text);
        setupUI();
        
        if (hasGPS) {
            showPage('map');
            updateMapVisualization();
        } else {
            showPage('graph');
        }
    } catch (error) {
        alert('Error processing file: ' + error.message);
    }
}

// Data Parsing
function parseData(text) {
    allData = [];
    hasGPS = false;
    
    text.split('\n').forEach(line => {
        if (!line.startsWith('>23|01:')) return;
        const parts = line.split(/[:<]/)[1].split(',');

        try {
            const entry = {
                // Energy Monitoring
                time: parseFloat(parts[0]),
                voltage: parseFloat(parts[1]),
                current10A: parseFloat(parts[2]),
                avgPower10A: parseFloat(parts[3]),
                totalEnergy10A: parseInt(parts[4]),
                current50A: parseFloat(parts[5]),
                avgPower50A: parseFloat(parts[6]),
                totalEnergy50A: parseInt(parts[7]),
                totalEnergyBoth: parseInt(parts[8]),

                // GPS Data
                lat: parseFloat(parts[9]),
                lon: parseFloat(parts[10]),
                speed: parseFloat(parts[11]),
                course: parseFloat(parts[12]),

                // Button States
                btn1State: parseInt(parts[13]),   // Regen/Boost
                btn2State: parseInt(parts[16]),   // Full Power
                btn3State: parseInt(parts[19]),   // Cruise Control
                btn4State: parseInt(parts[22]),   // Speed Mode
                btn5State: parseInt(parts[25]),   // System Status
                btn6State: parseInt(parts[28]),   // Constant Current

                // IMU Data
                imuAccelX: parseFloat(parts[33]),
                imuAccelY: parseFloat(parts[34]),
                imuAccelZ: parseFloat(parts[35]),
                imuGyroX: parseFloat(parts[36]),
                imuGyroY: parseFloat(parts[37]),
                imuGyroZ: parseFloat(parts[38]),
                imuTemp: parseFloat(parts[39]),

                // System Metrics
                systemVoltage: parseFloat(parts[48]),
                supercapsVoltage: parseFloat(parts[49])
            };

            // GPS Validation
            const validLat = !isNaN(entry.lat)
            const validLon = !isNaN(entry.lon)
            
            if (validLat && validLon) {
                hasGPS = true;
            } else {
                entry.lat = null;
                entry.lon = null;
            }

            allData.push(entry);
        } catch (e) {
            console.error('Error parsing line:', line, e);
        }
    });
    console.log('File has GPS data:', hasGPS);
}

// UI Setup
function setupUI() {
    const mapButton = document.getElementById('btnMap');
    mapButton.disabled = !hasGPS;
    mapButton.title = hasGPS 
        ? 'Show map visualization' 
        : 'No GPS data available in file';

    document.getElementById('btnGraph').disabled = false;
    createColumnSelector();
    initChart();
}

function createColumnSelector() {
    const selector = document.getElementById('columnsSelector');
    selector.innerHTML = '';
    
    const fields = [
        {id: 'voltage', name: 'Voltage (V)'},
        {id: 'speed', name: 'Speed (km/h)'},
        {id: 'systemVoltage', name: 'System Voltage (V)'},
        {id: 'imuAccelX', name: 'X Acceleration (G)'},
        {id: 'imuAccelY', name: 'Y Acceleration (G)'},
        {id: 'imuAccelZ', name: 'Z Acceleration (G)'}
    ];

    fields.forEach(field => {
        const div = document.createElement('div');
        div.innerHTML = `
            <input type="checkbox" id="${field.id}" value="${field.id}">
            <label for="${field.id}">${field.name}</label>
        `;
        selector.appendChild(div);
    });

    selector.addEventListener('change', updateChart);
}

// Chart Functions
let svg, x, y;
function initChart() {
    const margin = {top: 20, right: 30, bottom: 40, left: 50};
    const container = document.querySelector('.chart-container');
    const width = container.clientWidth - margin.left - margin.right;
    const height = container.clientHeight - margin.top - margin.bottom;

    d3.select('#chart').html('');
    
    svg = d3.select('#chart')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    x = d3.scaleLinear()
        .domain(d3.extent(allData, d => d.time))
        .range([0, width]);

    y = d3.scaleLinear()
        .domain([0, 1])
        .range([height, 0]);

    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.append('g')
        .call(d3.axisLeft(y));
}

function updateChart() {
    const selected = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
                        .map(cb => cb.value);

    // Remove unselected lines
    currentLines.forEach((_, key) => {
        if (!selected.includes(key)) {
            svg.selectAll(`.${key}`).remove();
            currentLines.delete(key);
        }
    });

    // Add new lines
    selected.forEach(field => {
        if (!currentLines.has(field)) {
            const line = d3.line()
                .x(d => x(d.time))
                .y(d => y(d[field]))
                .defined(d => !isNaN(d[field]));

            svg.append('path')
                .datum(allData)
                .attr('class', field)
                .attr('fill', 'none')
                .attr('stroke', d3.schemeCategory10[field])
                .attr('d', line);

            currentLines.set(field, true);
        }
    });

    // Update Y axis domain
    const allValues = selected.flatMap(field => 
        allData.map(d => d[field]).filter(v => !isNaN(v))
    );
    y.domain([d3.min(allValues), d3.max(allValues)]);
    svg.select('.y-axis').call(d3.axisLeft(y));
}

// Map Functions
function initMapView() {
    if (!map) {
        map = L.map('map', {
            maxZoom: 22,
            zoomControl: false
        });

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

        highlightMarker.addTo(map);
    }
}

function updateMapVisualization() {
    if (!map) return;

    // Clear existing elements
    if (polyline) map.removeLayer(polyline);
    mapSegments.forEach(segment => map.removeLayer(segment));
    mapSegments = [];

    const validGPS = allData.filter(d => d.lat && d.lon);
    if (validGPS.length === 0) return;

    // Set map bounds
    const bounds = L.latLngBounds(validGPS.map(d => [d.lat, d.lon]));
    map.fitBounds(bounds);

    // Create color scale
    const speeds = validGPS.map(d => d.speed);
    colorScale = d3.scaleSequential(d3.interpolateViridis)
        .domain([d3.min(speeds), d3.max(speeds)]);

    // Create path segments
    for (let i = 1; i < validGPS.length; i++) {
        const prev = validGPS[i-1];
        const current = validGPS[i];

        const segment = L.polyline(
            [[prev.lat, prev.lon], [current.lat, current.lon]],
            { 
                color: colorScale(prev.speed), 
                weight: 4,
                opacity: 0.8
            }
        ).addTo(map);

        segment.bindPopup(createPopupContent(prev));
        mapSegments.push(segment);
    }

    // Update last position marker
    updateLastPositionMarker(validGPS);
    addMapHover();
}

function createPopupContent(data) {
    return `
        <strong>Time:</strong> ${data.time.toFixed(1)}s<br>
        <strong>Speed:</strong> ${data.speed.toFixed(1)} km/h<br>
        <strong>Voltage:</strong> ${data.voltage.toFixed(2)}V<br>
        <strong>Mode:</strong> ${getPowerMode(data)}<br>
        <strong>Coords:</strong> ${data.lat.toFixed(6)}, ${data.lon.toFixed(6)}
    `;
}

function updateLastPositionMarker(validGPS) {
    if (lastPositionMarker) map.removeLayer(lastPositionMarker);
    const lastPoint = validGPS[validGPS.length-1];
    
    lastPositionMarker = L.marker([lastPoint.lat, lastPoint.lon], {
        icon: L.divIcon({
            className: 'car-marker',
            html: '🚗',
            iconSize: [50, 50],  // Size of the icon container
            iconAnchor: [25, 25],  // Center of the icon (half of iconSize)
            popupAnchor: [0, -25]  // Position popup above the icon
        }),
        autoPanPadding: [20, 20],
        autoPan: true
    }).addTo(map).bindPopup(`Last position: ${lastPoint.time.toFixed(1)}s`);
    
    map.panTo([lastPoint.lat, lastPoint.lon]);
}



function addMapHover() {
    const validGPS = allData.filter(d => d.lat && d.lon);
    const tooltip = document.getElementById('tooltip');

    map.on('mousemove', (e) => {
        let closest = validGPS[0];
        let minDist = Infinity;

        validGPS.forEach(point => {
            const dist = map.distance(e.latlng, [point.lat, point.lon]);
            if (dist < minDist) {
                minDist = dist;
                closest = point;
            }
        });

        if (minDist < 30) {
            tooltip.style.display = 'block';
            tooltip.style.left = `${e.originalEvent.pageX + 15}px`;
            tooltip.style.top = `${e.originalEvent.pageY + 15}px`;
            tooltip.innerHTML = createPopupContent(closest);
            
            highlightMarker.setLatLng([closest.lat, closest.lon])
                           .setRadius(closest.speed/5 + 3);
        } else {
            tooltip.style.display = 'none';
            highlightMarker.setRadius(0);
        }
    });
}

// Helper Functions
function getPowerMode(data) {
    if (data.btn1State) return 'Boost';
    if (data.btn2State) return 'Power';
    return 'None';
}

function reset() {
    allData = [];
    hasGPS = false;
    document.getElementById('btnGraph').disabled = true;
    document.getElementById('btnMap').disabled = true;
    d3.select('#chart').html('');
    if (map) map.remove();
    map = null;
    showPage('upload');
}