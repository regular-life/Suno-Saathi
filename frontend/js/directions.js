/**
 * Directions functionality for Suno Saarthi
 * Handles route planning and displaying directions
 */

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const directionsBtn = document.getElementById('directions-btn');
    const directionsPanel = document.querySelector('.directions-panel');
    const closeDirectionsBtn = document.getElementById('close-directions');
    const originInput = document.getElementById('origin-input');
    const destinationInput = document.getElementById('destination-input');
    const getDirectionsBtn = document.getElementById('get-directions-btn');
    const routeSummary = document.getElementById('route-summary');
    const directionsList = document.getElementById('directions-list');
    const startNavigationBtn = document.getElementById('start-navigation-btn');
    const travelModeBtns = document.querySelectorAll('.travel-mode-btn');
    
    // Variables
    let currentTravelMode = 'driving';
    let currentRoute = null;
    
    // Event Listeners
    directionsBtn.addEventListener('click', toggleDirectionsPanel);
    closeDirectionsBtn.addEventListener('click', hideDirectionsPanel);
    getDirectionsBtn.addEventListener('click', getDirections);
    startNavigationBtn.addEventListener('click', startNavigation);
    
    // Set up travel mode buttons
    travelModeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            setTravelMode(this.getAttribute('data-mode'));
        });
    });
    
    // Initialize destination input from URL if present
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('destination')) {
        destinationInput.value = urlParams.get('destination');
    }
    
    /**
     * Toggle directions panel visibility
     */
    function toggleDirectionsPanel() {
        if (directionsPanel.classList.contains('active')) {
            hideDirectionsPanel();
        } else {
            showDirectionsPanel();
        }
    }
    
    /**
     * Show directions panel
     */
    function showDirectionsPanel() {
        directionsPanel.classList.add('active');
        
        // Try to get user's current location for origin
        if (navigator.geolocation && !originInput.value) {
            navigator.geolocation.getCurrentPosition(
                position => {
                    const { latitude, longitude } = position.coords;
                    reverseGeocode(latitude, longitude)
                        .then(placeName => {
                            originInput.value = placeName || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                        })
                        .catch(() => {
                            originInput.value = 'My location';
                        });
                },
                error => {
                    console.warn('Geolocation error:', error);
                }
            );
        }
    }
    
    /**
     * Hide directions panel
     */
    function hideDirectionsPanel() {
        directionsPanel.classList.remove('active');
    }
    
    /**
     * Set the travel mode
     * @param {string} mode - The travel mode (driving, walking, cycling)
     */
    function setTravelMode(mode) {
        // Update UI
        travelModeBtns.forEach(btn => {
            if (btn.getAttribute('data-mode') === mode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Set current mode
        currentTravelMode = mode;
        
        // If we already have a route, recalculate with new mode
        if (currentRoute) {
            getDirections();
        }
    }
    
    /**
     * Get directions based on origin and destination inputs
     */
    function getDirections() {
        const origin = originInput.value;
        const destination = destinationInput.value;
        
        if (!origin || !destination) {
            showNotification('Please enter both origin and destination', 'error');
            return;
        }
        
        // Show loading state
        getDirectionsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        
        // Get the directions using Mapbox API
        getMapboxDirections(origin, destination, currentTravelMode)
            .then(route => {
                // Store the current route
                currentRoute = route;
                
                // Display the route on the map
                displayRouteOnMap(route);
                
                // Show route summary and directions
                displayRouteSummary(route);
                displayDirectionSteps(route);
                
                // Show the start navigation button
                startNavigationBtn.classList.add('active');
                
                // Reset button
                getDirectionsBtn.innerHTML = 'Get Directions';
                
                // Show success notification
                showNotification('Route found!', 'success');
            })
            .catch(error => {
                console.error('Error getting directions:', error);
                showNotification('Could not find a route. Please try different locations.', 'error');
                getDirectionsBtn.innerHTML = 'Get Directions';
            });
    }
    
    /**
     * Get directions from Mapbox API
     * @param {string} origin - Origin location
     * @param {string} destination - Destination location
     * @param {string} mode - Travel mode
     * @returns {Promise<Object>} - Route data
     */
    async function getMapboxDirections(origin, destination, mode) {
        // Convert origin and destination to coordinates if they're not already
        const originCoords = await getCoordinates(origin);
        const destinationCoords = await getCoordinates(destination);
        
        // Map our travel modes to Mapbox profile IDs
        const profileId = getMapboxProfile(mode);
        
        // Build the Mapbox Directions API URL
        const url = `https://api.mapbox.com/directions/v5/mapbox/${profileId}/${originCoords[0]},${originCoords[1]};${destinationCoords[0]},${destinationCoords[1]}?alternatives=false&geometries=geojson&overview=full&steps=true&access_token=${mapboxgl.accessToken}`;
        
        // Fetch the route
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
            throw new Error('No route found');
        }
        
        // Attach additional data to the route
        const route = data.routes[0];
        route.origin = {
            coordinates: originCoords,
            name: origin
        };
        route.destination = {
            coordinates: destinationCoords,
            name: destination
        };
        route.travelMode = mode;
        
        return route;
    }
    
    /**
     * Map our travel modes to Mapbox profile IDs
     * @param {string} mode - Travel mode (driving, walking, cycling)
     * @returns {string} - Mapbox profile ID
     */
    function getMapboxProfile(mode) {
        switch (mode) {
            case 'walking':
                return 'walking';
            case 'cycling':
                return 'cycling';
            case 'driving':
            default:
                return 'driving-traffic';
        }
    }
    
    /**
     * Convert a location name to coordinates
     * @param {string} location - Location name or coordinates
     * @returns {Promise<Array>} - [longitude, latitude]
     */
    async function getCoordinates(location) {
        // Check if it's already coordinates
        if (isCoordinates(location)) {
            return parseCoordinates(location);
        }
        
        // Handle "My location" or current location
        if (location.toLowerCase() === 'my location') {
            return new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    position => {
                        resolve([position.coords.longitude, position.coords.latitude]);
                    },
                    error => {
                        console.error('Geolocation error:', error);
                        reject(error);
                    },
                    { enableHighAccuracy: true }
                );
            });
        }
        
        // Geocode the location
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?access_token=${mapboxgl.accessToken}&limit=1`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.features || data.features.length === 0) {
            throw new Error(`Location not found: ${location}`);
        }
        
        return data.features[0].center;
    }
    
    /**
     * Check if a string contains coordinates
     * @param {string} str - String to check
     * @returns {boolean} - Whether the string contains coordinates
     */
    function isCoordinates(str) {
        // Simple regex to match coordinate formats like "lat,lng" or "lat, lng"
        return /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/.test(str);
    }
    
    /**
     * Parse coordinates from a string
     * @param {string} str - String containing coordinates
     * @returns {Array} - [longitude, latitude]
     */
    function parseCoordinates(str) {
        const parts = str.split(',').map(part => parseFloat(part.trim()));
        // Mapbox expects [longitude, latitude]
        return [parts[1], parts[0]];
    }
    
    /**
     * Reverse geocode coordinates to get place name
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @returns {Promise<string>} - Place name
     */
    async function reverseGeocode(lat, lng) {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxgl.accessToken}&limit=1`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.features && data.features.length > 0) {
                return data.features[0].place_name;
            }
            
            return null;
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            return null;
        }
    }
    
    /**
     * Display the route on the map
     * @param {Object} route - Route object from Mapbox
     */
    function displayRouteOnMap(route) {
        // Access the map instance from the global scope
        const map = window.mapInstance;
        
        if (!map) {
            console.error('Map instance not found');
            return;
        }
        
        // Check if source exists, if not create it
        if (!map.getSource('route')) {
            map.addSource('route', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: []
                    }
                }
            });
            
            map.addLayer({
                id: 'route',
                type: 'line',
                source: 'route',
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': '#4285F4',
                    'line-width': 6,
                    'line-opacity': 0.8
                }
            });
        }
        
        // Update the route data
        map.getSource('route').setData({
            type: 'Feature',
            properties: {},
            geometry: route.geometry
        });
        
        // Add markers for origin and destination
        addRouteMarkers(route.origin.coordinates, route.destination.coordinates);
        
        // Fit the map to the route
        fitMapToRoute(route.geometry.coordinates);
    }
    
    /**
     * Add markers for origin and destination
     * @param {Array} originCoords - Origin coordinates [lng, lat]
     * @param {Array} destCoords - Destination coordinates [lng, lat]
     */
    function addRouteMarkers(originCoords, destCoords) {
        const map = window.mapInstance;
        
        // Remove existing markers
        const markers = document.querySelectorAll('.mapboxgl-marker');
        markers.forEach(marker => marker.remove());
        
        // Add origin marker
        new mapboxgl.Marker({ color: '#4285F4' })
            .setLngLat(originCoords)
            .addTo(map);
        
        // Add destination marker
        new mapboxgl.Marker({ color: '#EA4335' })
            .setLngLat(destCoords)
            .addTo(map);
    }
    
    /**
     * Fit the map to show the entire route
     * @param {Array} coordinates - Route coordinates
     */
    function fitMapToRoute(coordinates) {
        const map = window.mapInstance;
        
        // Create a bounds that includes all route coordinates
        const bounds = coordinates.reduce((bounds, coord) => {
            return bounds.extend(coord);
        }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));
        
        // Fit the map to the bounds
        map.fitBounds(bounds, {
            padding: 60,
            maxZoom: 15
        });
    }
    
    /**
     * Display route summary
     * @param {Object} route - Route object from Mapbox
     */
    function displayRouteSummary(route) {
        // Format the duration and distance
        const duration = formatDuration(route.duration);
        const distance = formatDistance(route.distance);
        
        // Build summary HTML
        const summaryHTML = `
            <div class="summary-header">
                <div class="summary-time">${duration}</div>
                <div class="summary-distance">${distance}</div>
            </div>
            <div class="summary-mode">
                <i class="${getTravelModeIcon(currentTravelMode)}"></i>
                ${capitalize(currentTravelMode)} directions
            </div>
        `;
        
        // Update the summary
        routeSummary.innerHTML = summaryHTML;
        routeSummary.classList.add('active');
    }
    
    /**
     * Display direction steps
     * @param {Object} route - Route object from Mapbox
     */
    function displayDirectionSteps(route) {
        // Clear previous steps
        directionsList.innerHTML = '';
        
        if (!route.legs || route.legs.length === 0) {
            return;
        }
        
        // Get steps from the first leg
        const steps = route.legs[0].steps;
        
        // Build steps HTML
        const stepsHTML = steps.map(step => {
            const instruction = sanitizeInstruction(step.maneuver.instruction);
            const distance = formatDistance(step.distance);
            const icon = getManeuverIcon(step.maneuver.type);
            
            return `
                <div class="direction-step">
                    <div class="step-icon">
                        <i class="${icon}"></i>
                    </div>
                    <div class="step-details">
                        <div class="step-instruction">${instruction}</div>
                        <div class="step-distance">${distance}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Update the directions list
        directionsList.innerHTML = stepsHTML;
        directionsList.classList.add('active');
    }
    
    /**
     * Start navigation mode
     */
    function startNavigation() {
        // Hide directions panel
        directionsPanel.classList.remove('active');
        
        // Show loading indicator
        showNotification('Preparing navigation...', 'info');
        
        // Ensure we have a route
        if (!currentRoute || !currentRoute.geometry) {
            showNotification('Please get directions first', 'error');
            return;
        }
        
        console.log('Starting navigation with route:', currentRoute);
        
        // Prepare navigation data
        const navigationData = {
            origin: {
                coordinates: [currentRoute.origin.coordinates[0], currentRoute.origin.coordinates[1]],
                name: currentRoute.origin.name || 'Current Location'
            },
            destination: {
                coordinates: [currentRoute.destination.coordinates[0], currentRoute.destination.coordinates[1]],
                name: currentRoute.destination.name
            },
            geometry: currentRoute.geometry,
            distance: currentRoute.distance,
            duration: currentRoute.duration,
            legs: currentRoute.legs
        };
        
        // Ensure steps have announced property
        if (navigationData.legs && navigationData.legs[0] && navigationData.legs[0].steps) {
            navigationData.legs[0].steps.forEach(step => {
                step.announced = false;
            });
        }
        
        console.log('Navigation data prepared:', navigationData);
        
        // Calculate arrival time
        const now = new Date();
        const arrivalTime = new Date(now.getTime() + (navigationData.duration * 1000));
        
        // Format arrival time
        const hours = arrivalTime.getHours();
        const minutes = arrivalTime.getMinutes();
        const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        // Store the current route in a global variable so it's accessible to voice commands
        window.currentRoute = currentRoute;
        
        // Hide the main container
        const mainContainer = document.querySelector('.container');
        if (mainContainer) {
            mainContainer.style.display = 'none';
        }
        
        // Make the navigation mode element visible
        const navigationMode = document.getElementById('navigation-mode');
        if (navigationMode) {
            // Update UI elements before showing
            document.getElementById('nav-destination-display').textContent = navigationData.destination.name;
            document.getElementById('nav-distance').textContent = formatDistance(navigationData.distance);
            document.getElementById('nav-duration').textContent = formatDuration(navigationData.duration);
            document.getElementById('nav-arrival').textContent = formattedTime;
            
            // Show the navigation mode UI
            navigationMode.classList.add('active');
            navigationMode.style.display = 'flex';
            
            // Initialize navigation with route data
            if (window.initializeNavigation) {
                setTimeout(() => {
                    window.initializeNavigation(navigationData);
                }, 300); // Small delay to ensure UI transition is smooth
            } else {
                console.error('Navigation module not properly loaded');
                showNotification('Error initializing navigation', 'error');
            }
        } else {
            console.error('Navigation mode element not found');
            showNotification('Navigation interface not available', 'error');
        }
    }
    
    /**
     * Format duration in seconds to a human-readable string for display
     * @param {number} seconds - Duration in seconds
     * @returns {string} - Formatted duration
     */
    function formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours} hr ${minutes} min`;
        }
        
        return `${minutes} min`;
    }
    
    /**
     * Format distance in meters to a human-readable string
     * @param {number} meters - Distance in meters
     * @returns {string} - Formatted distance
     */
    function formatDistance(meters) {
        if (meters < 1000) {
            return `${Math.round(meters)} m`;
        }
        
        const km = meters / 1000;
        return `${km.toFixed(1)} km`;
    }
    
    /**
     * Get icon class for a maneuver type
     * @param {string} type - Maneuver type
     * @returns {string} - FontAwesome icon class
     */
    function getManeuverIcon(type) {
        switch (type) {
            case 'turn':
            case 'continue':
                return 'fas fa-arrow-right';
            case 'merge':
                return 'fas fa-level-down-alt';
            case 'fork':
                return 'fas fa-code-branch';
            case 'roundabout':
                return 'fas fa-redo-alt';
            case 'exit roundabout':
                return 'fas fa-sign-out-alt';
            case 'arrive':
                return 'fas fa-flag-checkered';
            case 'depart':
                return 'fas fa-play';
            default:
                return 'fas fa-arrow-right';
        }
    }
    
    /**
     * Get icon class for travel mode
     * @param {string} mode - Travel mode
     * @returns {string} - FontAwesome icon class
     */
    function getTravelModeIcon(mode) {
        switch (mode) {
            case 'walking':
                return 'fas fa-walking';
            case 'cycling':
                return 'fas fa-bicycle';
            case 'driving':
            default:
                return 'fas fa-car';
        }
    }
    
    /**
     * Clean up instruction text from Mapbox
     * @param {string} instruction - Original instruction
     * @returns {string} - Sanitized instruction
     */
    function sanitizeInstruction(instruction) {
        if (!instruction) return '';
        
        // Replace HTML entities
        return instruction
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"');
    }
    
    /**
     * Capitalize first letter of a string
     * @param {string} string - String to capitalize
     * @returns {string} - Capitalized string
     */
    function capitalize(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    
    /**
     * Show a notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type (info, success, error)
     */
    function showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}); 