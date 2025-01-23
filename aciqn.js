const map = L.map('map').setView([28.7041, 77.1025], 7); // Initial map centered on Delhi

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

const openRouteAPIKey = '5b3ce3597851110001cf624804acb333d67c4cef8d421b8c0c543346'; // OpenRouteService API key
const aqicnAPIKey = 'YOUR_AQICN_API_KEY'; // AQICN API key (replace with your own)

document.getElementById('submit').addEventListener('click', async () => {
    const start = document.getElementById('start').value;
    const end = document.getElementById('end').value;
    const mode = 'driving-car'; // Default mode of transportation

    if (!start || !end) {
        alert('Please enter both start and end locations!');
        return;
    }

    try {
        const startCoords = await getCoordinates(start);
        const endCoords = await getCoordinates(end);

        await getRouteAndAQI(startCoords, endCoords, mode);
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred. Please try again.');
    }
});

async function getCoordinates(location) {
    const url = `https://api.waqi.info/feed/${location}/?token=${aqicnAPIKey}`;  // Using AQICN API to get city coordinates
    const response = await fetch(url);

    if (!response.ok) throw new Error('Failed to fetch coordinates');
    const data = await response.json();

    if (!data.data || !data.data.city || !data.data.city.geo) {
        throw new Error('No coordinates found for the given location');
    }

    const coords = data.data.city.geo;
    return `${coords[0]},${coords[1]}`; // Return "latitude,longitude"
}

async function getRouteAndAQI(start, end, mode) {
    const url = `https://api.openrouteservice.org/v2/directions/${mode}?api_key=${openRouteAPIKey}&start=${start}&end=${end}`;
    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!data.features) {
            alert('No route found. Please check your coordinates.');
            return;
        }

        const coordinates = data.features[0].geometry.coordinates;

        // Extract distance and duration
        const distance = (data.features[0].properties.segments[0].distance / 1000).toFixed(2); // Convert meters to km
        const duration = (data.features[0].properties.segments[0].duration / 60).toFixed(2); // Convert seconds to minutes

        // Update route info
        document.getElementById('route-info').innerHTML = `
            <p><strong>Estimated Distance:</strong> ${distance} km</p>
            <p><strong>Estimated Time:</strong> ${duration} minutes</p>
        `;

        // Render route on map
        const routeLine = L.polyline(
            coordinates.map(coord => [coord[1], coord[0]]),
            { color: 'blue' }
        ).addTo(map);

        map.fitBounds(routeLine.getBounds());

        // Fetch and display AQI with region names for all intermediate points
        await fetchAndDisplayAQI(coordinates);
    } catch (error) {
        console.error('Error fetching route:', error);
        alert('Error fetching route. Please check your API key and input.');
    }
}

async function fetchAndDisplayAQI(coordinates) {
    const aqiInfoDiv = document.getElementById('aqi-info');
    aqiInfoDiv.innerHTML = '<h3>AQI Along the Route</h3>';

    for (let i = 0; i < coordinates.length; i += Math.floor(coordinates.length / 10)) { // Fetch AQI for every 10% of points
        const [lon, lat] = coordinates[i];
        const aqiData = await fetchAQI(lat, lon);

        const aqiValue = aqiData.data.aqi; // Get the AQI index
        const description = getAQIDescription(aqiValue);

        const regionName = await fetchRegionName(lat, lon);

        aqiInfoDiv.innerHTML += `<p>${regionName} (Lat: ${lat.toFixed(2)}, Lon: ${lon.toFixed(2)}) - AQI: ${aqiValue} (${description})</p>`;

        L.marker([lat, lon])
            .addTo(map)
            .bindPopup(`${regionName}<br>AQI: ${aqiValue} (${description})`)
            .openPopup();
    }
}

async function fetchAQI(lat, lon) {
    const url = `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${aqicnAPIKey}`;
    const response = await fetch(url);

    if (!response.ok) throw new Error('Failed to fetch AQI data');
    return await response.json();
}

async function fetchRegionName(lat, lon) {
    const url = `https://api.openrouteservice.org/geocode/reverse?api_key=${openRouteAPIKey}&point.lat=${lat}&point.lon=${lon}`;
    const response = await fetch(url);

    if (!response.ok) throw new Error('Failed to fetch region name');
    const data = await response.json();

    if (data.features && data.features.length > 0) {
        return data.features[0].properties.label; // Return the full name of the location
    }

    return 'Unknown Location'; // Fallback if no name is found
}

function getAQIDescription(aqi) {
    const descriptions = ['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];
    return descriptions[Math.min(Math.max(aqi - 1, 0), descriptions.length - 1)] || 'Unknown';
}
