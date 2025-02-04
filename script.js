const map = L.map('map').setView([37.7749, -122.4194], 13); // Set initial view to San Francisco

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 22,
}).addTo(map);

function handleFileDrop(event) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result;
            parseGPSData(content, file.name);
            showPopup(file.name);
        };
        reader.readAsText(file);
    }
}

function parseGPSData(content, fileName) {
    const gpsData = [];
    const regex = />23\|01:(.*?)(<.*)?$/gm;
    let match;

    while ((match = regex.exec(content)) !== null) {
        const data = match[1].split(','); 

        if (data.length >= 12) {
            const lat = parseFloat(data[9].trim());
            const lon = parseFloat(data[10].trim());
            const speed = parseFloat(data[11].trim());
            const time = data[0].trim();

            if (!isNaN(lat) && !isNaN(lon) && !isNaN(speed)) {
                gpsData.push({ coords: [lat, lon], speed: speed, time: time });
            }
        }
    }

    if (gpsData.length > 0) {
        for (let i = 0; i < gpsData.length - 1; i++) {
            const start = gpsData[i].coords;
            const end = gpsData[i + 1].coords;
            const speed = gpsData[i].speed;
            const time = gpsData[i].time;

            const color = getColorGradient(speed);

            const segment = L.polyline([start, end], { color: color }).addTo(map);

            segment.bindTooltip(`Snelheid: ${speed} km/h<br>Locatie: ${start[0].toFixed(6)}, ${start[1].toFixed(6)}<br>Tijd: ${time}`, { permanent: false, direction: 'top' });

            segment.on('mouseover', function() {
                this.openTooltip();
            });
            segment.on('mouseout', function() {
                this.closeTooltip();
            });
        }

        map.fitBounds(L.polyline(gpsData.map(data => data.coords)).getBounds());

        const lastPosition = gpsData[gpsData.length - 1].coords;
        const lastSpeed = gpsData[gpsData.length - 1].speed;
        const lastTime = gpsData[gpsData.length - 1].time;
        const lastMarker = L.marker(lastPosition).addTo(map);
        lastMarker.bindTooltip(`Laatse locatie<br>Snelheid: ${lastSpeed} km/h<br>Locatie: ${lastPosition[0].toFixed(6)}, ${lastPosition[1].toFixed(6)}<br>Tijd: ${lastTime}`, { permanent: false, direction: 'top' });

        lastMarker.on('mouseover', function() {
            this.openTooltip();
        });
        lastMarker.on('mouseout', function() {
            this.closeTooltip();
        });
    } else {
        alert(`Geen geldige GPS-gegevens gevonden in "${fileName}".`);
    }
}

function getColorGradient(speed) {
    const minSpeed = 0;
    const maxSpeed = 30;

    const normalizedSpeed = Math.min(Math.max((speed - minSpeed) / (maxSpeed - minSpeed), 0), 1);

    const startColor = [0, 255, 0];
    const endColor = [255, 0, 0];

    const color = startColor.map((start, index) => {
        return Math.round(start + normalizedSpeed * (endColor[index] - start));
    });

    return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

function showPopup(filename) {
    const popup = document.getElementById('popup');
    popup.textContent = `Bestand geüpload: ${filename}`;
    popup.style.display = 'block';

    setTimeout(() => {
        popup.style.display = 'none';
    }, 3000);
}

function preventDefaults(event) {
    event.preventDefault();
    event.stopPropagation();
}

document.body.addEventListener('dragover', preventDefaults, false);
document.body.addEventListener('dragleave', preventDefaults, false);
document.body.addEventListener('drop', handleFileDrop, false);

document.body.addEventListener('dragover', (event) => {
    event.preventDefault();
    document.body.classList.add('drag-over');
});

document.body.addEventListener('dragleave', () => {
    document.body.classList.remove('drag-over');
});

document.body.addEventListener('drop', () => {
    document.body.classList.remove('drag-over');
});
