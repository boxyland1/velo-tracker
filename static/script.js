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

// Éléments DOM (inchangés)
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

// Initialiser la carte (inchangé)
function initMap() {
    map = L.map('map').setView([47.9027, 1.9086], 13); // Fleury-les-Aubrais/Orléans
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    console.log('Carte initialisée');
}

// Calcul distance (inchangé)
function calculateDistance(pos1, pos2) {
    const R = 6371e3;
    const φ1 = pos1.latitude * Math.PI/180;
    const φ2 = pos2.latitude * Math.PI/180;
    const Δφ = (pos2.latitude-pos1.latitude) * Math.PI/180;
    const Δλ = (pos2.longitude-pos1.longitude) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c / 1000;
}

// Format temps (inchangé)
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

// Démarrer tracking - FIX GPS
function startTracking() {
    tracking = true;
    positions = [];
    startTime = Date.now();
    maxSpeed = 0;
    totalDistance = 0;
    
    startBtn.disabled = true;
    stopBtn.disabled = false;
    status.textContent = '🚀 GPS activé... Bouge !';
    
    if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').then(lock => { wakeLock = lock; });
    }
    
    // GPS FIX: précision MOYENNE + timeout long + age 10s
    watchId = navigator.geolocation.watchPosition(
        updatePosition,
        errorGPS,
        { 
            enableHighAccuracy: false,  // ✅ Cell/WiFi rapide (fix indoor)
            timeout: 15000,            // ✅ 15s au lieu 5s
            maximumAge: 10000          // ✅ Réutilise 10s
        }
    );
    
    timerInterval = setInterval(updateDisplay, 1000);
    console.log('Tracking démarré - GPS low accuracy');
}

// Arrêter (inchangé + console)
async function stopTracking() {
    tracking = false;
    if (watchId) navigator.geolocation.clearWatch(watchId);
    if (timerInterval) clearInterval(timerInterval);
    if (wakeLock) wakeLock.release();
    
    startBtn.disabled = false;
    stopBtn.disabled = true;
    status.textContent = '✅ Terminé !';
    
    if (positions.length > 1) {
        const data = {
            distance: totalDistance,
            vitesse_moy: totalDistance / ((Date.now() - startTime) / 3600000),
            vitesse_max: maxSpeed,
            denivele: positions[positions.length-1]?.altitude - positions[0]?.altitude || 0,
            duree: (Date.now() - startTime) / 1000,
            calories: totalDistance * 50,
            difficulte: Math.random() * 10
        };
        await fetch('/save_sortie', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        console.log('Sauvegardé:', data);
    }
}

// Mise à jour position - FIX VITESSE + POLYLINE
function updatePosition(position) {
    const pos = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        altitude: position.coords.altitude || 0,
        accuracy: position.coords.accuracy || 999
    };
    positions.push(pos);
    
    // Distance cumulative
    if (positions.length > 1) {
        const dist = calculateDistance(positions[positions.length-2], pos);
        totalDistance += dist;
    }
    
    // Vitesse: speed OU calculée (fix null)
    let vitesse = 0;
    if (position.coords.speed) {
        vitesse = position.coords.speed * 3.6;  // m/s -> km/h
    } else if (positions.length > 2) {
        const timeDiff = (position.timestamp - positions[positions.length-2].timestamp || 0) / 1000 / 3600;
        vitesse = (calculateDistance(positions[positions.length-2], pos) / timeDiff) || 0;
    }
    if (vitesse > maxSpeed) maxSpeed = vitesse;
    
    console.log('Pos:', pos.latitude.toFixed(4), vitesse.toFixed(1));  // Debug
    
    // Carte
    if (!currentMarker) {
        currentMarker = L.marker([pos.latitude, pos.longitude]).addTo(map);
    } else {
        currentMarker.setLatLng([pos.latitude, pos.longitude]);
    }
    if (positions.length > 1) {
        if (!polyline) {
            polyline = L.polyline([], {color: 'red'}).addTo(map);
        }
        polyline.setLatLngs(positions.map(p => [p.latitude, p.longitude]));
        map.fitBounds(polyline.getBounds().pad(0.1));
    }
    status.textContent = `📍 ${vitesse.toFixed(1)} km/h`;
}

// Erreur GPS - AFFICHAGE
function errorGPS(err) {
    let msg = '';
    switch(err.code) {
        case 1: msg = '🚫 GPS refusé - Activez localisation'; break;
        case 2: msg = '📡 Pas de signal GPS - Dehors/secouez'; break;
        case 3: msg = '⏳ Timeout - Réessayez'; break;
        default: msg = '❌ Erreur inconnue';
    }
    console.error('GPS:', err.code, err.message);
    status.textContent = msg;
}

// updateDisplay (inchangé + vitesse actuelle)
function updateDisplay() {
    if (!startTime) return;
    const elapsed = (Date.now() - startTime) / 1000;
    distanceEl.textContent = totalDistance.toFixed(2) + ' km';
    vitesseEl.textContent = (totalDistance / (elapsed/3600)).toFixed(1) + ' km/h';  // Moyenne
    dureeEl.textContent = formatTime(elapsed);
    vitesseMaxEl.textContent = maxSpeed.toFixed(1) + ' km/h';
    caloriesEl.textContent = Math.round(totalDistance * 50) + ' kcal';
    if (positions.length) {
        const last = positions[positions.length-1];
        latEl.textContent = last.latitude.toFixed(6);
        lonEl.textContent = last.longitude.toFixed(6);
        altEl.textContent = last.altitude.toFixed(0) + ' m';
        accuracyEl.textContent = last.accuracy.toFixed(0) + ' m';
    }
}

// Init + Historique (inchangé)
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    startBtn.addEventListener('click', startTracking);
    stopBtn.addEventListener('click', stopTracking);
    
    document.getElementById('historiqueBtn').addEventListener('click', async function() {
        try {
            const res = await fetch('/historique');
            const data = await res.json();
            if (data.sorties.length === 0) return alert('Aucune sortie');
            let html = '📈 Dernières sorties:\n\n';
            data.sorties.slice(0,10).forEach(s => {
                html += `${new Date(s[1]).toLocaleDateString('fr-FR')}: ${s[2].toFixed(2)}km\n`;
            });
            alert(html);
        } catch(e) { alert('Erreur historique'); }
    });
    console.log('✅ Vélo Tracker FIXÉ prêt !');
});