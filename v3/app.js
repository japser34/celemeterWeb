// Map-related variables
let map = null;
let polyline = null;
let mapSegments = [];
let lastPositionMarker = null;
let highlightMarker = null;
let speedScale, colorScale;

// Page management
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(`${pageId}Page`).classList.add('active');

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeButton = document.querySelector(`[onclick="showPage('${pageId}')"]`);
    activeButton.classList.add('active');

    if (pageId === 'map') {
        initMapView();
        if (map) setTimeout(() => map.invalidateSize(), 0);
    }
}

// File handling
const overlay = document.getElementById('overlay');
const fileInput = document.getElementById('hiddenFileInput');

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

async function processFile(file) {
    const text = await file.text();
    const { convertedData, hasGPS } = await convertData(text);
    
    window.allData = convertedData.map(parts => ({
        time: parseFloat(parts[0]),
        speed: parseFloat(parts[9]),
        lat: parseFloat(parts[10]),
        lon: parseFloat(parts[11]),
        voltage: parseFloat(parts[7])
    }));

    document.getElementById('btnGraph').disabled = false;
    document.getElementById('btnMap').disabled = !hasGPS;
}

async function convertData(data) {
    let convertedData = [];
    let hasGPS = false;
    
    data.split('\n').forEach(line => {
        if (!line.startsWith('>23|01:')) return;

        try {
            const parts = line.split(/[:<]/)[1].split(',');
            if (!isNaN(parseFloat(parts[9])) && !isNaN(parseFloat(parts[10]))) {
                hasGPS = true;
            }
            convertedData.push(parts);
        } catch {
            console.error('Error converting line:', line);
        }
    });

    return { convertedData, hasGPS };
}

// Map functionality
function initMapView() {
    if (!map) {
        map = L.map('map', {
            maxZoom: 22,
            zoomControl: false
        }).setView([0, 0], 0);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);

        L.control.zoom({ position: 'topright' }).addTo(map);
        L.control.scale({ imperial: false }).addTo(map);

        highlightMarker = L.circleMarker([0,0], {
            radius: 0,
            color: 'red',
            fillOpacity: 0.5
        }).addTo(map);
    }

    updateMapVisualization();
    addMapHover();
}

function updateMapVisualization() {
    if (polyline) map.removeLayer(polyline);
    mapSegments.forEach(segment => map.removeLayer(segment));
    mapSegments = [];

    if (!window.allData) return;
    const validGPS = window.allData.filter(d => d.lat && d.lon);
    if (validGPS.length === 0) return;

    const speeds = validGPS.map(d => d.speed);
    speedScale = d3.scaleLinear()
        .domain([d3.min(speeds), d3.max(speeds)])
        .range([0, 1]);

    colorScale = d3.scaleSequential(d3.interpolateViridis)
        .domain([d3.min(speeds), d3.max(speeds)]);

    for (let i = 1; i < validGPS.length; i++) {
        const prev = validGPS[i-1];
        const current = validGPS[i];

        const segment = L.polyline(
            [[prev.lat, prev.lon], [current.lat, current.lon]],
            { color: colorScale(prev.speed), weight: 4 }
        ).addTo(map);

        segment.bindPopup(`
            Time: ${prev.time.toFixed(1)}s<br>
            Speed: ${prev.speed.toFixed(1)} km/h<br>
            Voltage: ${prev.voltage.toFixed(2)}V
        `);
        mapSegments.push(segment);
    }

    updateLegend(speeds);
    updateLastPositionMarker(validGPS);
}

function updateLegend(speeds) {
    const legendSteps = 5;
    let legendHTML = '';
    for (let i = 0; i <= legendSteps; i++) {
        const value = d3.min(speeds) + (d3.max(speeds) - d3.min(speeds)) * (i/legendSteps);
        legendHTML += `
            <div style="background:${colorScale(value)};padding:5px;color:${i > legendSteps/2 ? 'white' : 'black'}">
                ${value.toFixed(1)} km/h
            </div>
        `;
    }
    
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = () => {
        const div = L.DomUtil.create('div', 'legend');
        div.innerHTML = `<h4>Speed (km/h)</h4>${legendHTML}`;
        return div;
    };
    legend.addTo(map);
}

function updateLastPositionMarker(validGPS) {
    if (lastPositionMarker) map.removeLayer(lastPositionMarker);
    const lastPoint = validGPS[validGPS.length-1];

    lastPositionMarker = L.marker([lastPoint.lat, lastPoint.lon], {
        icon: L.divIcon({
            className: 'car-marker',
            html: '🚗',
            iconSize: [30, 30]
        })
    }).addTo(map)
    .bindPopup(`Last position: ${lastPoint.time.toFixed(1)}s`);
}

function addMapHover() {
    const tooltip = document.createElement('div');
    tooltip.id = 'mapTooltip';
    tooltip.style.position = 'absolute';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.backgroundColor = 'white';
    tooltip.style.padding = '8px';
    tooltip.style.borderRadius = '4px';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);

    map.on('mousemove', (e) => {
        if (!window.allData) return;
        const validGPS = window.allData.filter(d => d.lat && d.lon);
        
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
            tooltip.style.left = e.originalEvent.pageX + 15 + 'px';
            tooltip.style.top = e.originalEvent.pageY + 15 + 'px';
            tooltip.innerHTML = `
                <strong>Time:</strong> ${closest.time.toFixed(1)}s<br>
                <strong>Speed:</strong> ${closest.speed.toFixed(1)} km/h<br>
                <strong>Voltage:</strong> ${closest.voltage.toFixed(2)}V<br>
                <strong>Coords:</strong> ${closest.lat.toFixed(6)}, ${closest.lon.toFixed(6)}
            `;
            highlightMarker.setLatLng([closest.lat, closest.lon])
                           .setRadius(closest.speed/5 + 3);
        } else {
            tooltip.style.display = 'none';
            highlightMarker.setRadius(0);
        }
    });
}