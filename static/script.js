let tracking = false;
let positions = [];
let startTime = null;
let watchId = null;
let timerInterval = null;
let maxSpeed = 0;
let totalDistance = 0;
let wakeLock = null;
let map = null;
let polyline = null;
let currentMarker = null;

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const status = document.getElementById('status');

// Éléments DOM
const distanceEl = document.getElementById('distance');
const vitesseEl = document.getElementById('vitesse');
const dureeEl = document.getElementById('duree');
const deniveleEl = document.getElementById('denivele');
const caloriesEl = document.getElementById('calories');
const vitesseMaxEl = document.getElementById('vitesse_max');
const latEl = document.getElementById('lat');
const lonEl = document.getElementById('lon');
const altEl = document.getElementById('alt');
const accuracyEl = document.getElementById('accuracy');

// Initialiser la carte
function initMap() {
    map = L.map('map').setView([47.9027, 1.9086], 13); // Orléans
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    console.log('Carte initialisée');
}

// Calcul distance entre 2 points
function calculateDistance(pos1, pos2) {
    const R = 6371e3; // Rayon Terre
    const φ1 = pos1.latitude * Math.PI/180;
    const φ2 = pos2.latitude * Math.PI/180;
    const Δφ = (pos2.latitude-pos1.latitude) * Math.PI/180;
    const Δλ = (pos2.longitude-pos1.longitude) * Math.PI/180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c / 1000; // km
}

// Format temps
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

// Démarrer tracking
function startTracking() {
    tracking = true;
    positions = [];
    startTime = Date.now();
    maxSpeed = 0;
    totalDistance = 0;
    
    startBtn.disabled = true;
    stopBtn.disabled = false;
    status.textContent = 'Tracking en cours...';
    
    // Wake Lock (Android/iOS)
    if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').then(lock => {
            wakeLock = lock;
        });
    }
    
    // GPS
    watchId = navigator.geolocation.watchPosition(
        updatePosition,
        errorGPS,
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 1000 }
    );
    
    // Timer
    timerInterval = setInterval(updateDisplay, 1000);
    
    console.log('Tracking démarré');
}

// Arrêter tracking
async function stopTracking() {
    tracking = false;
    
    if (watchId) navigator.geolocation.clearWatch(watchId);
    if (timerInterval) clearInterval(timerInterval);
    if (wakeLock) wakeLock.release();
    
    startBtn.disabled = false;
    stopBtn.disabled = true;
    status.textContent = 'Terminé - Sauvegarde...';
    
    // Sauvegarder
    if (positions.length > 1) {
        const data = {
            distance: totalDistance,
            vitesse_moy: totalDistance / ((Date.now() - startTime) / 3600000),
            vitesse_max: maxSpeed,
            denivele: positions[positions.length-1].altitude - positions[0].altitude || 0,
            duree: (Date.now() - startTime) / 1000,
            calories: totalDistance * 50, // Estimation
            difficulte: Math.random() * 10
        };
        
        await fetch('/save_sortie', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        
        status.textContent = 'Sortie sauvegardée !';
    }
    
    console.log('Tracking arrêté');
}

// Mise à jour position
function updatePosition(position) {
    const pos = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        altitude: position.coords.altitude || 0,
        accuracy: position.coords.accuracy
    };
    
    positions.push(pos);
    
    // Distance
    if (positions.length > 1) {
        const dist = calculateDistance(positions[positions.length-2], pos);
        totalDistance += dist;
    }
    
    // Vitesse
    const vitesse = position.coords.speed * 3.6 || 0; // m/s -> km/h
    if (vitesse > maxSpeed) maxSpeed = vitesse;
    
    // Carte
    if (map && !currentMarker) {
        currentMarker = L.marker([pos.latitude, pos.longitude]).addTo(map);
    } else if (currentMarker) {
        currentMarker.setLatLng([pos.latitude, pos.longitude]);
    }
    
    if (positions.length > 1 && polyline) {
        polyline.setLatLngs(positions.map(p => [p.latitude, p.longitude]));
    } else if (positions.length > 1) {
        polyline = L.polyline(positions.map(p => [p.latitude, p.longitude]), {
            color: 'red'
        }).addTo(map);
    }
    
    map.fitBounds(polyline.getBounds());
}

// Erreur GPS
function errorGPS(err) {
    console.error('GPS Error:', err);
    status.textContent = 'Erreur GPS';
}

// Mise à jour affichage
function updateDisplay() {
    if (!startTime) return;
    
    const elapsed = (Date.now() - startTime) / 1000;
    const vitesse = positions.length ? maxSpeed : 0;
    
    distanceEl.textContent = totalDistance.toFixed(2) + ' km';
    vitesseEl.textContent = vitesse.toFixed(1) + ' km/h';
    dureeEl.textContent = formatTime(elapsed);
    vitesseMaxEl.textContent = maxSpeed.toFixed(1) + ' km/h';
    caloriesEl.textContent = Math.round(totalDistance * 50) + ' kcal';
    
    if (positions.length) {
        const lastPos = positions[positions.length-1];
        latEl.textContent = lastPos.latitude.toFixed(6);
        lonEl.textContent = lastPos.longitude.toFixed(6);
        altEl.textContent = lastPos.altitude.toFixed(0);
        accuracyEl.textContent = lastPos.accuracy.toFixed(0);
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    
    startBtn.addEventListener('click', startTracking);
    stopBtn.addEventListener('click', stopTracking);
    
    console.log('Velo Tracker prêt');
});
// Bouton historique
document.getElementById('historiqueBtn').addEventListener('click', async function() {
    try {
        const response = await fetch('/historique');
        const data = await response.json();
        
        if (data.sorties.length === 0) {
            alert('Aucune sortie enregistrée');
            return;
        }
        
        let html = '📈 Historique des sorties\n\n';
        data.sorties.slice(0, 10).forEach(sortie => { // 10 dernières
            const date = new Date(sortie[1]).toLocaleDateString('fr-FR');
            html += `${date}: ${sortie[2].toFixed(2)}km - ${sortie[9]?.toFixed(1) || 0}/10\n`;
        });
        alert(html);
    } catch (e) {
        alert('Erreur chargement historique');
    }
});