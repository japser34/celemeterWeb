


function showMap() {
   
      const map = L.map('map').setView([51.505, -0.09], 13);

      const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
         maxZoom: 19,
         attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(map);



}

showMap();






window.addEventListener('drop', (e) => {
   e.preventDefault();
   handleFileDrop(e.dataTransfer.files);
})


function handleFileDrop(files) {
   console.log('files: ', files)
   if (files.length > 0) {
      popup('opening ' + files[0].name)
      //processFile(files[0])
   };
}

