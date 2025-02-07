let map = null;
let data = {}; 
// data = {[\data\], \hasgps bool\, \timeoffset float\, \polyline\}

/// --- NAV --- ///

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
      showMap();
      if (map) setTimeout(() => map.invalidateSize(), 0)
   }
}



// map

let polyline = null;


function showMap() {
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
   } else {
      console.log('Map already initialized');
   }

   updateMapVisualization();
}

function updateMapVisualization() {

}


/// --- UTILS --- ///

const popupElement = document.getElementById('popup')

function popup(message) {
   console.log('showing popup: ', message)
   popupElement.innerHTML = message;
   popupElement.classList.add('active')

   setTimeout(() => {
      popupElement.classList.remove('active');
   }, 3000);

}



/// --- FILE PROCESSING --- ///

// file input

const overlay = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

fileInput.addEventListener('change', handleFileSelect)

window.addEventListener('dragover', (e) => {
   e.preventDefault();
   overlay.classList.add('active');
});

window.addEventListener('dragleave', (e) => {
   if (e.clientX <= 0 || e.clientY <=0 ||
      e.clientX >= window.innerWidth || e.clientY >= window.innerHeight){
      overlay.classList.remove('active');
   }
});

window.addEventListener('drop', (e) => {
   e.preventDefault();
   overlay.classList.remove('active');
   handleFileDrop(e.dataTransfer.files);
})

function handleFileSelect(e) {
   const files = e.target.files;
   handleFileDrop(files)
}

function handleFileDrop(files) {
   console.log('files: ', files)
   if (files.length > 0) {
      popup('opening ' + files[0].name)
      processFile(files[0])
   };
}

// file procesing

async function processFile(file) {
   const rawData = await file.text();
   const {convertedData, hasGPS, timeOffset} = await convertData(rawData);
   const timestamp = Date.now();
   const fileName = `${file.name}_${timestamp}`;
   data[fileName][0] = convertedData;
   data[fileName][1] = hasGPS;
   data[fileName][2] = timeOffset;
   data[fileName][3] = null;


   document.getElementById('mapBtn').disabled = !hasGPS;
   document.getElementById('graphBtn').disabled = false;

   popup('File ' + file.name + ' processed');
}

async function convertData(rawData) {
   let convertedData = [];
   let hasGPS = false;
   let isFirstLine = true;
   let timeOffset = 0;

   rawData.split('\n').forEach(line => {
      if (!line.startsWith('>23|01:')) return;

      try {
         const parts = line.split(/[:<]/)[1].split(',');
         if (!hasGPS && !isNaN(parseFloat(parts[9])) && !isNaN(parseFloat(parts[10]))) {
            hasGPS = true
         }
         segments = convertDataSegments(parts);
         if (isFirstLine) {
            timeOffset = segments.time;
            console.log('Converting', line)
            isFirstLine = false;
         }
         segments.time -= timeOffset;
         convertedData.push(segments);
      } catch (exception) {
         console.error('Error converting line', line, 'error: ', exception)
      }
   });

   return { convertedData, hasGPS, timeOffset}
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