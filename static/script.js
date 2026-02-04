let tracking = false;
let positions = [];
let startTime = null;
let watchId = null;
let maxSpeed = 0;
let totalDistance = 0;
let map = null;
let polyline = null;
let currentMarker = null;
let prevLat = null, prevLng = null;
let prevTime = null;  // NOUVEAU pour vitesse calc

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const status = document.getElementById('status');
const distanceEl = document.getElementById('distance');
const vitesseEl = document.getElementById('vitesse');
const vitesseMaxEl = document.getElementById('vitesseMax') || {textContent: '0'};

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;  // Rayon Terre m
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function initMap() {
  map = L.map('map').setView([47.9029, 1.9039], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
}

function updatePosition(position) {
  const lat = position.coords.latitude;
  const lng = position.coords.longitude;
  const now = Date.now();
  positions.push({latitude: lat, longitude: lng, time: now});
  
  status.textContent = `📍 ${positions.length} pts live`;
  
  // Distance cumul
  if (prevLat !== null) {
    totalDistance += calculateDistance(prevLat, prevLng, lat, lng);
  }
  prevLat = lat; prevLng = lng;
  
  // VITESSE CALCULÉE Haversine (fiable, pas GPS null!)
  let currentSpeed = 0;
  if (prevTime !== null && positions.length > 1) {
    const timeDiff = (now - prevTime) / 1000 / 3600;  // heures
    if (timeDiff > 0) {
      const distSeg = calculateDistance(prevLat, prevLng, lat, lng);
      currentSpeed = (distSeg / timeDiff) / 1000;  // km/h
      if (currentSpeed > maxSpeed) maxSpeed = currentSpeed;
    }
  }
  prevTime = now;
  
  // UI live
  distanceEl.textContent = (totalDistance/1000).toFixed(2) + ' km';
  vitesseEl.textContent = currentSpeed.toFixed(1) + ' km/h';
  vitesseMaxEl.textContent = maxSpeed.toFixed(1) + ' km/h';
  
  // Carte live
  if (!currentMarker) currentMarker = L.marker([lat, lng]).addTo(map);
  else currentMarker.setLatLng([lat, lng]);
  if (polyline) polyline.setLatLngs(positions.map(p => [p.latitude, p.longitude]));
  else polyline = L.polyline(positions.map(p => [p.latitude, p.longitude]), {color: 'red'}).addTo(map);
  map.panTo([lat, lng]);
}

function errorGPS(error) {
  status.textContent = `❌ GPS ${error.code}`;
  console.error(error);
}

function startTracking() {
  tracking = true;
  positions = []; totalDistance = 0; maxSpeed = 0;
  startTime = Date.now();
  prevTime = null;
  status.textContent = '🚴 Live...';
  startBtn.style.display = 'none'; stopBtn.style.display = 'block';
  
  watchId = navigator.geolocation.watchPosition(updatePosition, errorGPS, {
    enableHighAccuracy: false, timeout: 3000, maximumAge: 1000
  });
}

function stopTracking() {
  tracking = false;
  if (watchId) navigator.geolocation.clearWatch(watchId);
  
  navigator.geolocation.getCurrentPosition(updatePosition, ()=>{}, {timeout:2000});
  
  const dureeH = (Date.now() - startTime) / 3600000;
  const vmoy = dureeH > 0 ? totalDistance / dureeH : 0;
  vitesseEl.textContent = vmoy.toFixed(1) + ' km/h MOY';
  status.textContent = `✅ ${positions.length} pts, VMoy ${vmoy.toFixed(1)}`;
  
  localStorage.setItem('lastRide', JSON.stringify({positions, totalDistance, vmoy: vmoy, maxSpeed, date: new Date().toLocaleDateString('fr-FR')}));
  alert(`OK ! ${positions.length} pts, V ${maxSpeed.toFixed(1)}, VMoy ${vmoy.toFixed(1)} km/h`);
}

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  startBtn?.addEventListener('click', startTracking);
  stopBtn?.addEventListener('click', stopTracking);
  console.log('✅ Tracker vitesse Haversine prêt !');
});