let tracking = false;
let positions = [];
let startTime = null;
let watchId = null;
let timerInterval = null;  // FIX 3: Déclaré
let maxSpeed = 0;
let totalDistance = 0;
let map = null;
let polyline = null;
let currentMarker = null;
let prevLat = null, prevLng = null;
let prevTime = null;

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const status = document.getElementById('status');
const distanceEl = document.getElementById('distance');
const vitesseEl = document.getElementById('vitesse');
const dureeEl = document.getElementById('duree');
const vitesseMaxEl = document.getElementById('vitesseMax');

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
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
  
  // FIX 1: Sauvegarder OLD positions AVANT update
  const oldLat = prevLat;
  const oldLng = prevLng;
  const oldTime = prevTime;
  
  // Calcul distance cumul
  if (prevLat !== null) {
    totalDistance += calculateDistance(prevLat, prevLng, lat, lng);
  }
  
  // Update positions courantes
  prevLat = lat;
  prevLng = lng;
  prevTime = now;
  
  // Calcul vitesse avec OLD positions (FIX 1)
  let currentSpeed = 0;
  if (oldLat !== null && oldTime !== null) {
    const timeDiff = (now - oldTime) / 1000 / 3600;  // heures
    if (timeDiff > 0) {
      const distSeg = calculateDistance(oldLat, oldLng, lat, lng);
      currentSpeed = (distSeg / timeDiff) / 1000;  // km/h
      if (currentSpeed > maxSpeed) maxSpeed = currentSpeed;
    }
  }
  
  // UI live
  distanceEl.textContent = (totalDistance/1000).toFixed(2) + ' km';
  vitesseEl.textContent = currentSpeed.toFixed(1) + ' km/h';
  if (vitesseMaxEl) vitesseMaxEl.textContent = maxSpeed.toFixed(1) + ' km/h';
  
  // Carte live
  if (!currentMarker) currentMarker = L.marker([lat, lng]).addTo(map);
  else currentMarker.setLatLng([lat, lng]);
  if (polyline) polyline.setLatLngs(positions.map(p => [p.latitude, p.longitude]));
  else polyline = L.polyline(positions.map(p => [p.latitude, p.longitude]), {color: 'red'}).addTo(map);
  map.panTo([lat, lng]);
}

function errorGPS(error) {
  let code = error.code;
  let msg = `GPS ERR ${code} `;
  if (code===1) msg += 'Permission → Tel/site/Autoriser';
  if (code===2) msg += 'Signal → Dehors ciel ouvert';
  if (code===3) msg += 'Timeout → GPS lent';
  status.textContent = msg;
  alert(msg + ' Code:' + code);
  console.error('GPS:', error.message);
}

function startTracking() {
  tracking = true;
  positions = [];
  totalDistance = 0;
  maxSpeed = 0;
  startTime = Date.now();
  prevTime = null;
  prevLat = null;
  prevLng = null;
  
  status.textContent = '🚴 Live...';
  startBtn.style.display = 'none';
  stopBtn.style.display = 'block';
  
  // FIX 2: Timer durée
  timerInterval = setInterval(() => {
    const sec = Math.floor((Date.now() - startTime) / 1000);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (dureeEl) dureeEl.textContent = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  }, 1000);
  
  watchId = navigator.geolocation.watchPosition(updatePosition, errorGPS, {
    enableHighAccuracy: false,
    timeout: 3000,
    maximumAge: 1000
  });
}

function stopTracking() {
  tracking = false;
  if (watchId) navigator.geolocation.clearWatch(watchId);
  if (timerInterval) clearInterval(timerInterval);  // FIX 3: Clear timer
  
  // Force dernier point
  navigator.geolocation.getCurrentPosition(updatePosition, ()=>{}, {timeout:2000});
  
  // Calcul VMoy finale
  const dureeH = (Date.now() - startTime) / 3600000;
  const vmoy = dureeH > 0 ? (totalDistance / 1000) / dureeH : 0;
  
  vitesseEl.textContent = vmoy.toFixed(1) + ' km/h MOY';
  status.textContent = `✅ ${positions.length} pts, VMoy ${vmoy.toFixed(1)}`;
  
  localStorage.setItem('lastRide', JSON.stringify({
    positions, 
    totalDistance, 
    vmoy, 
    maxSpeed, 
    date: new Date().toLocaleDateString('fr-FR')
  }));
  
  alert(`OK ! ${positions.length} pts, VMax ${maxSpeed.toFixed(1)}, VMoy ${vmoy.toFixed(1)} km/h`);
  
  startBtn.style.display = 'block';
  stopBtn.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  if (startBtn) startBtn.addEventListener('click', startTracking);
  if (stopBtn) stopBtn.addEventListener('click', stopTracking);
  console.log('✅ Tracker vitesse Haversine prêt !');
});