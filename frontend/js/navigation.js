/**
 * Navigation mode with Gemini AI integration for Suno Saarthi
 */

// Global variables
let navMap = null;
let currentRouteData = null;
let currentStep = 0;
let currentPosition = null;
let positionWatcher = null;
let isMuted = false;
let isSpeaking = false;
let isListening = false;
let recognition = null;
let speechSynthesisSupported = false;
let locationWatchAttempts = 0;
const MAX_LOCATION_ATTEMPTS = 3;

// Initialize navigation when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Set up event listeners
    document.getElementById('exit-navigation').addEventListener('click', exitNavigation);
    document.getElementById('nav-volume-btn').addEventListener('click', toggleVolume);
    document.getElementById('nav-recenter-btn').addEventListener('click', recenterMap);
    document.getElementById('nav-overview-btn').addEventListener('click', showRouteOverview);
    document.getElementById('nav-compact-btn').addEventListener('click', toggleCompactMode);
    
    // Set up voice input for both views
    const micNavBtn = document.getElementById('mic-nav-btn');
    if (micNavBtn) {
        micNavBtn.addEventListener('click', startVoiceInput);
    }
    
    const compactMicBtn = document.getElementById('compact-mic-btn');
    if (compactMicBtn) {
        compactMicBtn.addEventListener('click', startVoiceInput);
    }
    
    // Add event listener for the compact view back button
    const compactBackBtn = document.getElementById('compact-back-btn');
    if (compactBackBtn) {
        compactBackBtn.addEventListener('click', handleCompactBackButton);
    }
    
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('assistant-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Check if speech synthesis is supported
    checkSpeechSupport();
    
    // Initialize speech recognition if available
    initializeSpeechRecognition();
    
    // Create a global function to initialize navigation
    window.initializeNavigation = initializeNavigation;
});

/**
 * Check if speech synthesis is supported and set up accordingly
 */
function checkSpeechSupport() {
    // Check if speech synthesis is supported
    if (typeof window.speechSynthesis !== 'undefined') {
        speechSynthesisSupported = true;
        console.log('Speech synthesis supported');
        
        // Fix for Chrome and some browsers where speech gets cut off
        window.speechSynthesis.addEventListener('voiceschanged', () => {
            console.log('Voices loaded:', window.speechSynthesis.getVoices().length);
        });
        
        // Handle page visibility changes to prevent speech issues
        document.addEventListener('visibilitychange', handleVisibilityChange);
    } else {
        console.warn('Speech synthesis not supported in this browser');
        speechSynthesisSupported = false;
        
        // Update volume button to show it's disabled
        const volumeBtn = document.getElementById('nav-volume-btn');
        if (volumeBtn) {
            volumeBtn.style.opacity = '0.5';
            volumeBtn.title = 'Voice output not supported in this browser';
        }
    }
}

/**
 * Handle page visibility changes (fix for Chrome speech synthesis)
 */
function handleVisibilityChange() {
    if (document.hidden && isSpeaking) {
        window.speechSynthesis.cancel();
        isSpeaking = false;
    }
}

/**
 * Initialize navigation mode with route data
 * @param {Object} routeData - Route data from directions
 */
function initializeNavigation(routeData) {
    console.log('Initializing navigation with route data:', routeData);
    currentRouteData = routeData;
    currentStep = 0;
    
    // Ensure the navigation mode element is visible
    const navigationMode = document.getElementById('navigation-mode');
    if (navigationMode) {
        navigationMode.classList.add('active');
        navigationMode.style.display = 'flex';
    }
    
    // Initialize the navigation map
    initNavMap();
    
    // Start tracking user position
    startPositionTracking();
    
    // Update maneuver card with first step
    updateManeuverCard();
    
    // Speak welcome message
    speakText("Navigation started. I'll guide you to your destination.");
    
    // Add initial welcome message
    addAssistantMessage("Navigation started. I'll guide you to your destination. Feel free to ask me any questions along the way.");
}

/**
 * Initialize the navigation map
 */
function initNavMap() {
    console.log('Initializing navigation map with coordinates:', currentRouteData.geometry.coordinates[0]);
    
    // Initialize the map
    navMap = new mapboxgl.Map({
        container: 'nav-map',
        style: 'mapbox://styles/mapbox/dark-v10', // Use dark theme for navigation
        center: currentRouteData.geometry.coordinates[0],
        zoom: 15,
        pitch: 60, // Tilted view for better navigation experience
        bearing: 0
    });
    
    // Wait for map to load
    navMap.on('load', function() {
        console.log('Navigation map loaded successfully');
        
        // Add route line
        navMap.addSource('nav-route', {
            type: 'geojson',
            data: {
                type: 'Feature',
                properties: {},
                geometry: currentRouteData.geometry
            }
        });
        
        navMap.addLayer({
            id: 'nav-route-line',
            type: 'line',
            source: 'nav-route',
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
        
        // Add user location marker
        navMap.addSource('user-location', {
            type: 'geojson',
            data: {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'Point',
                    coordinates: currentRouteData.geometry.coordinates[0]
                }
            }
        });
        
        navMap.addLayer({
            id: 'user-location-point',
            type: 'circle',
            source: 'user-location',
            paint: {
                'circle-radius': 10,
                'circle-color': '#4285F4',
                'circle-stroke-width': 3,
                'circle-stroke-color': '#ffffff'
            }
        });
        
        // Add destination marker
        const destinationCoords = currentRouteData.destination.coordinates;
        new mapboxgl.Marker({ color: '#EA4335' })
            .setLngLat(destinationCoords)
            .addTo(navMap);
            
        // Fit map to show the route
        fitMapToRoute();
    });
    
    // Add error handler for debugging
    navMap.on('error', function(e) {
        console.error('Navigation map error:', e);
        addAssistantMessage("There was an error with the navigation map. Please try again.");
    });
}

/**
 * Fit the map to show the entire route
 */
function fitMapToRoute() {
    if (!navMap || !currentRouteData) return;
    
    try {
        // Create a bounds object
        const coordinates = currentRouteData.geometry.coordinates;
        const bounds = coordinates.reduce((bounds, coord) => {
            return bounds.extend(coord);
        }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));
        
        // Fit the map to the bounds
        navMap.fitBounds(bounds, {
            padding: 50,
            maxZoom: 15
        });
    } catch (error) {
        console.error('Error fitting map to route:', error);
    }
}

/**
 * Start tracking user position
 */
function startPositionTracking() {
    // Reset attempt counter
    locationWatchAttempts = 0;
    
    // Try to get position
    tryWatchPosition();
    
    // For testing/demo - simulate movement if no real geolocation (enable only for testing)
    // simulateMovement();
}

/**
 * Try to watch position with retry logic
 */
function tryWatchPosition() {
    if (navigator.geolocation) {
        console.log(`Attempting to get location (attempt ${locationWatchAttempts + 1}/${MAX_LOCATION_ATTEMPTS})`);
        
        // Show loading notification on first attempt
        if (locationWatchAttempts === 0) {
            showNotification('Getting your location...', 'info');
        }
        
        // Use high accuracy for navigation with timeout settings
        const options = {
            enableHighAccuracy: true,
            timeout: 10000,  // 10 seconds
            maximumAge: 0
        };
        
        try {
            // Clear any existing watcher
            if (positionWatcher) {
                navigator.geolocation.clearWatch(positionWatcher);
            }
            
            // Watch position
            positionWatcher = navigator.geolocation.watchPosition(
                updatePosition,
                handlePositionError,
                options
            );
        } catch (error) {
            console.error('Error starting position watch:', error);
            handlePositionError(error);
        }
    } else {
        console.error('Geolocation is not supported by this browser');
        handleUnsupportedGeolocation();
    }
}

/**
 * Handle position errors with retry logic
 */
function handlePositionError(error) {
    console.error('Geolocation error:', error);
    
    // Clear existing timeout message if present
    clearLocationTimeoutMessage();
    
    // Increment attempts counter
    locationWatchAttempts++;
    
    if (locationWatchAttempts < MAX_LOCATION_ATTEMPTS) {
        // Show retry message
        showNotification(`Location request failed. Retrying... (${locationWatchAttempts}/${MAX_LOCATION_ATTEMPTS})`, 'warning');
        
        // Add location timeout message to conversation
        addLocationTimeoutMessage();
        
        // Try again after a delay
        setTimeout(() => {
            tryWatchPosition();
        }, 2000);
    } else {
        // Give up after max attempts
        console.warn('Max location attempts reached, using fallback position');
        handleLocationFailure();
    }
}

/**
 * Add location timeout message to the conversation
 */
function addLocationTimeoutMessage() {
    const conversationContainer = document.getElementById('conversation-container');
    if (!conversationContainer) return;
    
    // Check if we already have a timeout message
    const existingMessage = document.getElementById('location-timeout-message');
    if (existingMessage) return;
    
    // Create a new message
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    messageDiv.id = 'location-timeout-message';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = 'Location request timed out. Trying again...';
    
    const actionButton = document.createElement('button');
    actionButton.textContent = 'Use Default Location';
    actionButton.className = 'action-button';
    actionButton.onclick = handleLocationFailure;
    
    messageContent.appendChild(document.createElement('br'));
    messageContent.appendChild(actionButton);
    
    const messageTime = document.createElement('div');
    messageTime.className = 'message-time';
    messageTime.textContent = 'Now';
    
    messageDiv.appendChild(messageContent);
    messageDiv.appendChild(messageTime);
    
    conversationContainer.appendChild(messageDiv);
    conversationContainer.scrollTop = conversationContainer.scrollHeight;
}

/**
 * Clear location timeout message
 */
function clearLocationTimeoutMessage() {
    const timeoutMessage = document.getElementById('location-timeout-message');
    if (timeoutMessage) {
        timeoutMessage.remove();
    }
}

/**
 * Handle unsupported geolocation
 */
function handleUnsupportedGeolocation() {
    addAssistantMessage("Your browser doesn't support location services. Using default location for navigation.");
    handleLocationFailure();
}

/**
 * Handle location failure by using default position
 */
function handleLocationFailure() {
    // Clear location timeout message if present
    clearLocationTimeoutMessage();
    
    // Show notification
    showNotification('Using default location for navigation', 'info');
    
    // Use a default position or route starting point
    let defaultPosition;
    
    // Use the first coordinate of the route if available
    if (currentRouteData && currentRouteData.geometry && currentRouteData.geometry.coordinates.length > 0) {
        defaultPosition = [
            currentRouteData.geometry.coordinates[0][0],
            currentRouteData.geometry.coordinates[0][1]
        ];
    } else {
        // Default to central Delhi coordinates if no route is available
        defaultPosition = [77.2090, 28.6139];
    }
    
    // Update position with this default
    currentPosition = defaultPosition;
    updatePositionOnMap(defaultPosition);
    
    // Add message to conversation
    addAssistantMessage("I'm using an approximate location. Navigation accuracy may be affected.");
}

/**
 * Update position on map
 */
function updatePositionOnMap(position) {
    // Add position to the map
    if (navMap && navMap.getSource('user-location')) {
        navMap.getSource('user-location').setData({
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'Point',
                coordinates: position
            }
        });
        
        // Recenter map if needed
        if (document.getElementById('nav-recenter-btn').classList.contains('active')) {
            recenterMap();
        }
    }
}

/**
 * Update user position on map
 * @param {GeolocationPosition} position - User's position
 */
function updatePosition(position) {
    // Successfully got position, clear timeout message
    clearLocationTimeoutMessage();
    
    // Reset attempt counter when we get a successful position
    locationWatchAttempts = 0;
    
    const { latitude, longitude } = position.coords;
    currentPosition = [longitude, latitude];
    
    // Update user location on map
    updatePositionOnMap(currentPosition);
    
    // Rotate map to match user heading if available
    if (position.coords.heading && navMap) {
        navMap.easeTo({
            bearing: position.coords.heading,
            duration: 300
        });
    }
    
    // Check if user is near the next maneuver point
    checkManeuverProgress();
}

/**
 * Check if user has reached the next maneuver point
 */
function checkManeuverProgress() {
    if (!currentPosition || !currentRouteData || !currentRouteData.legs) return;
    
    const steps = currentRouteData.legs[0].steps;
    if (currentStep >= steps.length) return;
    
    const currentManeuver = steps[currentStep].maneuver;
    const maneuverPoint = currentManeuver.location;
    
    // Calculate distance to next maneuver
    const distance = calculateDistance(
        currentPosition[1], currentPosition[0],
        maneuverPoint[1], maneuverPoint[0]
    );
    
    // Update distance on maneuver card
    const distanceText = document.getElementById('next-maneuver-distance');
    if (distanceText) {
        distanceText.textContent = `${Math.round(distance)} m`;
    }
    
    // Also update compact view if active
    const compactDistance = document.getElementById('compact-distance');
    if (compactDistance && document.getElementById('navigation-mode').classList.contains('compact')) {
        compactDistance.textContent = `${Math.round(distance)} m`;
    }
    
    // If within 30 meters of the maneuver point, announce it
    if (distance <= 30 && !steps[currentStep].announced) {
        steps[currentStep].announced = true;
        announceManeuver(steps[currentStep]);
        
        // If nearly at the maneuver point, prepare for the next one
        if (distance <= 15) {
            currentStep++;
            if (currentStep < steps.length) {
                updateManeuverCard();
            } else if (currentStep === steps.length) {
                // Arrived at destination
                announceArrival();
            }
        }
    }
}

/**
 * Update the maneuver card with the current step
 */
function updateManeuverCard() {
    if (!currentRouteData || !currentRouteData.legs || !currentRouteData.legs[0].steps) {
        console.error('No route data available for maneuver update');
        return;
    }
    
    const steps = currentRouteData.legs[0].steps;
    
    if (currentStep >= steps.length) {
        console.log('Navigation complete, reached destination');
        return;
    }
    
    const currentManeuver = steps[currentStep];
    
    // Update the maneuver card in the main navigation view
    const maneuverIcon = document.getElementById('maneuver-icon');
    const maneuverText = document.getElementById('maneuver-text');
    const maneuverDistance = document.getElementById('next-maneuver-distance');
    
    if (maneuverIcon && maneuverText && maneuverDistance) {
        // Set the icon based on maneuver type
        maneuverIcon.className = 'maneuver-icon fas';
        const iconClass = getManeuverIconClass(currentManeuver.maneuver.type);
        maneuverIcon.classList.add(iconClass);
        
        // Set the instruction text
        maneuverText.textContent = sanitizeInstruction(currentManeuver.maneuver.instruction);
        
        // Set the distance
        maneuverDistance.textContent = formatDistance(currentManeuver.distance);
    }
    
    // Also update the compact view if it's being used
    if (document.getElementById('navigation-mode').classList.contains('compact')) {
        updateCompactUI();
    }
}

/**
 * Announce the current maneuver via speech
 * @param {Object} step - The maneuver step
 */
function announceManeuver(step) {
    if (!step) return;
    
    // Format maneuver instruction for speech
    const instruction = sanitizeInstruction(step.maneuver.instruction);
    speakText(instruction);
}

/**
 * Announce arrival at destination
 */
function announceArrival() {
    const arrival = "You have arrived at your destination.";
    speakText(arrival);
    addAssistantMessage(arrival);
    
    // Show arrival UI
    document.getElementById('maneuver-text').textContent = "You have arrived";
    document.getElementById('maneuver-icon').className = "fas fa-flag-checkered";
    document.getElementById('next-maneuver-distance').textContent = "";
}

/**
 * Get FontAwesome icon class for a maneuver type
 * @param {string} type - Maneuver type
 * @returns {string} - Icon class
 */
function getManeuverIconClass(type) {
    const baseClass = "fas maneuver-icon ";
    
    switch (type) {
        case 'turn':
            return baseClass + 'fa-arrow-right';
        case 'depart':
            return baseClass + 'fa-play';
        case 'arrive':
            return baseClass + 'fa-flag-checkered';
        case 'merge':
            return baseClass + 'fa-compress-alt';
        case 'fork':
            return baseClass + 'fa-code-branch';
        case 'roundabout':
            return baseClass + 'fa-redo-alt';
        case 'exit roundabout':
            return baseClass + 'fa-sign-out-alt';
        case 'end of road':
            return baseClass + 'fa-map-signs';
        case 'new name':
            return baseClass + 'fa-road';
        case 'continue':
            return baseClass + 'fa-arrow-up';
        case 'slight right':
            return baseClass + 'fa-arrow-alt-circle-right';
        case 'slight left':
            return baseClass + 'fa-arrow-alt-circle-left';
        case 'right':
            return baseClass + 'fa-arrow-right';
        case 'left':
            return baseClass + 'fa-arrow-left';
        default:
            return baseClass + 'fa-arrow-right';
    }
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
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} - Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Radius of the Earth in meters
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in meters
    
    return distance;
}

/**
 * Convert degrees to radians
 * @param {number} deg - Degrees
 * @returns {number} - Radians
 */
function deg2rad(deg) {
    return deg * (Math.PI/180);
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
 * Exit navigation mode
 */
function exitNavigation() {
    console.log('Exiting navigation mode');
    
    // Show confirmation dialog
    if (confirm('Are you sure you want to exit navigation?')) {
        // Hide navigation mode UI
        const navigationMode = document.getElementById('navigation-mode');
        if (navigationMode) {
            // Reset compact mode if active
            if (navigationMode.classList.contains('compact')) {
                navigationMode.classList.remove('compact');
                document.getElementById('compact-nav-card').style.display = 'none';
                
                // Restore visibility of main navigation elements
                document.querySelector('.nav-map-container').style.display = 'block';
                document.querySelector('.nav-header').style.display = 'flex';
                document.querySelector('.route-info').style.display = 'flex';
                document.querySelector('.assistant-container').style.display = 'flex';
                document.querySelector('.nav-controls').style.display = 'flex';
            }
            
            // Hide the navigation mode
            navigationMode.classList.remove('active');
            navigationMode.style.display = 'none';
        }
        
        // Stop watching position
        if (positionWatcher) {
            navigator.geolocation.clearWatch(positionWatcher);
            positionWatcher = null;
        }
        
        // Stop speech
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        
        // Clean up variables
        currentRouteData = null;
        currentStep = 0;
        currentPosition = null;
        
        // Stop map animations
        if (navMap) {
            navMap.stop();
        }
        
        // Show the main container (start screen)
        const mainContainer = document.querySelector('.container');
        if (mainContainer) {
            mainContainer.style.display = 'block';
        }
        
        // Reset and show the main map
        if (window.mapInstance) {
            // Reset the view of the main map
            setTimeout(() => {
                window.mapInstance.resize();
                if (window.mapDefaultCenter) {
                    window.mapInstance.flyTo({
                        center: window.mapDefaultCenter,
                        zoom: 12,
                        bearing: 0,
                        pitch: 0
                    });
                }
            }, 100);
        }
        
        showNotification('Navigation ended', 'info');
    }
}

/**
 * Toggle audio announcements
 */
function toggleVolume() {
    // If speech synthesis is not supported, show message and return
    if (!speechSynthesisSupported) {
        showNotification('Voice output is not supported in this browser', 'warning');
        return;
    }
    
    isMuted = !isMuted;
    
    const volumeBtn = document.getElementById('nav-volume-btn');
    if (volumeBtn) {
        if (isMuted) {
            volumeBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
            showNotification('Voice guidance muted', 'info');
            
            // Stop any ongoing speech
            if (window.speechSynthesis && isSpeaking) {
                window.speechSynthesis.cancel();
                isSpeaking = false;
            }
        } else {
            volumeBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
            showNotification('Voice guidance enabled', 'info');
            
            // Announce current maneuver when unmuted
            if (currentRouteData && currentRouteData.legs && currentRouteData.legs[0].steps) {
                const steps = currentRouteData.legs[0].steps;
                if (currentStep < steps.length) {
                    const step = steps[currentStep];
                    speakText(sanitizeInstruction(step.maneuver.instruction));
                }
            }
        }
    }
}

/**
 * Recenter the map to user's current location
 */
function recenterMap() {
    if (!navMap) return;
    
    const recenterBtn = document.getElementById('nav-recenter-btn');
    
    // Toggle active state
    if (recenterBtn) {
        recenterBtn.classList.toggle('active');
    }
    
    // If we have current position, center on it
    if (currentPosition) {
        navMap.flyTo({
            center: currentPosition,
            zoom: 16,
            pitch: 60,
            essential: true
        });
        showNotification('Map centered on your location', 'info');
    } 
    // Otherwise try to get current position
    else {
        // Try to get current position first
        if (navigator.geolocation) {
            showNotification('Getting your location...', 'info');
            
            navigator.geolocation.getCurrentPosition(
                // Success callback
                position => {
                    const coords = [position.coords.longitude, position.coords.latitude];
                    currentPosition = coords;
                    
                    navMap.flyTo({
                        center: coords,
                        zoom: 16,
                        pitch: 60,
                        essential: true
                    });
                    
                    // Update the position marker
                    updatePositionOnMap(coords);
                    
                    showNotification('Map centered on your location', 'success');
                },
                // Error callback
                error => {
                    console.error('Error getting current position:', error);
                    
                    // Use route start point as fallback
                    if (currentRouteData && currentRouteData.geometry && 
                        currentRouteData.geometry.coordinates.length > 0) {
                        
                        const startPoint = currentRouteData.geometry.coordinates[0];
                        navMap.flyTo({
                            center: startPoint,
                            zoom: 14,
                            essential: true
                        });
                        
                        showNotification('Centered on route starting point', 'info');
                    } else {
                        showNotification('Could not determine location to center on', 'error');
                    }
                },
                { 
                    maximumAge: 0,
                    timeout: 5000,
                    enableHighAccuracy: true
                }
            );
        } else {
            showNotification('Location services not available', 'error');
        }
    }
}

/**
 * Show the entire route overview
 */
function showRouteOverview() {
    if (navMap && currentRouteData) {
        // Create a bounds that includes all route coordinates
        const bounds = currentRouteData.geometry.coordinates.reduce((bounds, coord) => {
            return bounds.extend(coord);
        }, new mapboxgl.LngLatBounds(
            currentRouteData.geometry.coordinates[0],
            currentRouteData.geometry.coordinates[0]
        ));
        
        // Fit the map to the bounds
        navMap.fitBounds(bounds, {
            padding: 60,
            pitch: 0,
            duration: 1000
        });
    }
}

/**
 * Speak text using speech synthesis with improved browser compatibility and fallbacks
 * @param {string} text - Text to speak
 */
function speakText(text) {
    if (isMuted || !text) return;
    
    // Check if speech synthesis is supported
    if (!window.speechSynthesis) {
        console.warn('Speech synthesis not supported in this browser');
        speechSynthesisSupported = false;
        return;
    }
    
    // Additional check to handle browsers that technically support it but it doesn't work
    if (!speechSynthesisSupported) return;
    
    try {
        // Cancel any ongoing speech
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Set preferred voice (English)
        let voices = window.speechSynthesis.getVoices();
        
        // Fix for Chrome where voices may not be loaded immediately
        if (voices.length === 0) {
            // Try to load voices synchronously
            speechSynthesis.onvoiceschanged = () => {
                voices = window.speechSynthesis.getVoices();
                continueWithSpeech(utterance, voices);
            };
            // Force voices to load
            speechSynthesis.getVoices();
        } else {
            continueWithSpeech(utterance, voices);
        }
    } catch (error) {
        console.error('Speech synthesis error:', error);
        // Disable speech if consistent errors occur
        if (error.name === 'NotAllowedError') {
            speechSynthesisSupported = false;
            showNotification('Voice output was blocked by your browser settings', 'error');
        }
    }
}

/**
 * Continue with speech after voices are loaded
 * @param {SpeechSynthesisUtterance} utterance - The utterance to speak
 * @param {Array} voices - Available voices
 */
function continueWithSpeech(utterance, voices) {
    try {
        // Find an English voice - prefer native speakers
        let englishVoice = voices.find(voice => 
            (voice.lang === 'en-US' || voice.lang === 'en-GB') && voice.localService
        );
        
        // Fallback: any English voice
        if (!englishVoice) {
            englishVoice = voices.find(voice => 
                voice.lang === 'en-US' || voice.lang === 'en-GB'
            );
        }
        
        // Fallback: any voice
        if (!englishVoice && voices.length > 0) {
            englishVoice = voices[0];
        }
        
        if (englishVoice) {
            utterance.voice = englishVoice;
        }
        
        // Set properties
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        // Handle events
        utterance.onstart = () => {
            isSpeaking = true;
            console.log('Speech started');
        };
        
        utterance.onend = () => {
            isSpeaking = false;
            console.log('Speech ended');
        };
        
        utterance.onerror = (event) => {
            console.error('Speech error:', event);
            isSpeaking = false;
            
            // Try to recover on next attempt
            if (event.error === 'network' || event.error === 'service-not-allowed') {
                setTimeout(() => {
                    // Try again with a simpler approach
                    const retryUtterance = new SpeechSynthesisUtterance(utterance.text);
                    window.speechSynthesis.speak(retryUtterance);
                }, 1000);
            }
        };
        
        // Fix for Safari - clean up any hanging speech synthesis
        window.speechSynthesis.cancel();
        
        // Fix for some browsers - split into smaller chunks if text is long
        if (utterance.text.length > 100) {
            const chunks = utterance.text.match(/.{1,100}([.!?]|$|\s)/g) || [utterance.text];
            
            chunks.forEach((chunk, index) => {
                if (!chunk.trim()) return;
                
                const chunkUtterance = new SpeechSynthesisUtterance(chunk.trim());
                if (englishVoice) chunkUtterance.voice = englishVoice;
                chunkUtterance.rate = utterance.rate;
                chunkUtterance.pitch = utterance.pitch;
                chunkUtterance.volume = utterance.volume;
                
                // Set small delay between chunks
                setTimeout(() => {
                    window.speechSynthesis.speak(chunkUtterance);
                }, index * 250);
            });
        } else {
            // Use a timeout to ensure any previous speech is fully cancelled
            setTimeout(() => {
                window.speechSynthesis.speak(utterance);
            }, 50);
        }
    } catch (error) {
        console.error('Error in continueWithSpeech:', error);
    }
}

/**
 * Initialize the speech recognition
 */
function initializeSpeechRecognition() {
    // Check if browser supports speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    // Try multiple ways to detect speech recognition support
    let speechRecognitionSupported = false;
    
    // Check if SpeechRecognition constructor exists
    if (SpeechRecognition) {
        speechRecognitionSupported = true;
    }
    
    // Additional compatibility check for Chrome, Edge, Safari
    try {
        // Attempt to create an instance - this will fail if not properly supported
        const testInstance = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        speechRecognitionSupported = true;
    } catch (e) {
        console.error("Error initializing speech recognition:", e);
        speechRecognitionSupported = false;
    }
    
    if (!speechRecognitionSupported) {
        console.error('Speech recognition not supported in this browser');
        // Disable mic buttons
        const micButtons = document.querySelectorAll('#mic-nav-btn, #compact-mic-btn');
        micButtons.forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.title = 'Speech recognition not supported in this browser';
        });
        
        addAssistantMessage("Sorry, voice input is not supported in your browser. Please try using the latest version of Chrome, Edge, or Safari. You can still type your messages.");
        return;
    }
    
    try {
        // Create speech recognition instance
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        
        // Set up event handlers
        recognition.onstart = function() {
            isListening = true;
            updateMicButtonState(true);
            console.log('Voice recognition started');
        };
        
        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            console.log('Voice input:', transcript);
            
            // Add the transcript to the input field
            const inputField = document.getElementById('assistant-input');
            if (inputField) {
                inputField.value = transcript;
                // Process immediately
                sendMessage();
            }
        };
        
        recognition.onend = function() {
            isListening = false;
            updateMicButtonState(false);
            console.log('Voice recognition ended');
        };
        
        recognition.onerror = function(event) {
            console.error('Recognition error:', event.error);
            isListening = false;
            updateMicButtonState(false);
            
            // Provide feedback about the error
            let errorMessage = "I couldn't understand that. Please try again.";
            if (event.error === 'no-speech') {
                errorMessage = "I didn't hear anything. Please try again.";
            } else if (event.error === 'not-allowed') {
                errorMessage = "Microphone access is blocked. Please enable it in your browser settings.";
            } else if (event.error === 'network') {
                errorMessage = "Network error occurred. Please check your internet connection.";
            } else if (event.error === 'aborted') {
                errorMessage = "Voice recognition was aborted.";
            } else if (event.error === 'audio-capture') {
                errorMessage = "No microphone was found. Please ensure your microphone is connected.";
            } else if (event.error === 'service-not-allowed') {
                errorMessage = "Speech recognition service is not allowed. Please try again later.";
            }
            
            addAssistantMessage(errorMessage);
        };
        
        console.log("Speech recognition initialized successfully");
    } catch (error) {
        console.error('Fatal error initializing speech recognition:', error);
        addAssistantMessage("Unfortunately, your browser doesn't fully support voice recognition. Please try typing your questions instead.");
    }
}

/**
 * Update the visual state of mic buttons
 * @param {boolean} active - Whether the mic is active
 */
function updateMicButtonState(active) {
    // Update main view mic button
    const micNavBtn = document.getElementById('mic-nav-btn');
    if (micNavBtn) {
        if (active) {
            micNavBtn.classList.add('active');
            micNavBtn.style.backgroundColor = '#EA4335'; // Red when active
        } else {
            micNavBtn.classList.remove('active');
            micNavBtn.style.backgroundColor = '#4285F4'; // Blue when inactive
        }
    }
    
    // Update compact view mic button
    const compactMicBtn = document.getElementById('compact-mic-btn');
    if (compactMicBtn) {
        if (active) {
            compactMicBtn.classList.add('active');
            compactMicBtn.style.backgroundColor = '#EA4335'; // Red when active
        } else {
            compactMicBtn.classList.remove('active');
            compactMicBtn.style.backgroundColor = '#4285F4'; // Blue when inactive
        }
    }
}

/**
 * Update the visual state of mic buttons and voice feedback text
 * @param {boolean} active - Whether the mic is active
 */
function updateMicButtonStatus(active) {
    // Update mic button state
    updateMicButtonState(active);
    
    // Update voice feedback text if in compact mode
    const voiceFeedbackText = document.getElementById('voice-feedback-text');
    if (voiceFeedbackText) {
        if (active) {
            voiceFeedbackText.textContent = "Listening...";
        } else {
            voiceFeedbackText.textContent = "Tap microphone to speak";
        }
    }
}

/**
 * Initiate voice input through the voice recognition module
 */
function startVoiceInput() {
    if (!window.voiceRecognition) {
        showNotification('Voice recognition is not available', 'error');
        return;
    }
    
    // Start recognition
    if (typeof window.voiceRecognition.startListening === 'function') {
        window.voiceRecognition.startListening();
    }
    
    // Update UI to show listening state
    updateMicButtonStatus(true);
    
    // Show notification
    showNotification('Listening for voice commands...', 'info');
}

/**
 * Send message to Gemini (or simulated assistant)
 */
function sendMessage() {
    const inputField = document.getElementById('assistant-input');
    const message = inputField.value.trim();
    
    if (!message) return;
    
    // First add the user's message to the conversation UI
    addUserMessage(message);
    
    // Clear input field
    inputField.value = '';
    
    // Process with Gemini (or simulated assistant)
    processUserMessage(message);
}

/**
 * Process user message and get response
 * @param {string} message - User message
 * @returns {Promise} - Promise that resolves when the message is processed
 */
function processUserMessage(message) {
    console.log('Processing user message:', message);
    
    // Show typing indicator while processing
    const typingIndicator = addTypingIndicator();
    
    // Check if Gemini API is available
    const geminiAvailable = window.gemini && typeof window.gemini.generateContent === 'function';
    console.log('Gemini API available?', geminiAvailable);
    
    // Try to use Gemini API for response if available
    if (geminiAvailable) {
        try {
            console.log('Using Gemini API for response');
            
            // Build navigation context for more informed responses
            const navigationContext = buildNavigationContext();
            console.log('Navigation context for prompt:', navigationContext);
            
            // Create a context-aware prompt
            const contextPrompt = `
You are Suno Saarthi, an in-car navigation assistant. You're currently helping the user navigate.

NAVIGATION CONTEXT:
${navigationContext}

USER QUERY: ${message}

Respond helpfully, keeping answers brief and focused on navigation. If the user asks about something unrelated to their journey, you can still answer but be concise. For driving safety, limit responses to 1-3 sentences when possible.
`;
            console.log('Sending prompt to Gemini with length:', contextPrompt.length);
            
            // Call Gemini API with the enhanced prompt
            window.gemini.generateContent(contextPrompt)
                .then(response => {
                    console.log('Received response from Gemini API:', response);
                    
                    // Remove typing indicator
                    removeTypingIndicator(typingIndicator);
                    
                    // Process the response text
                    let responseText = '';
                    try {
                        responseText = response.text();
                        console.log('Extracted response text:', responseText);
                    } catch (textError) {
                        console.error('Error extracting text from response:', textError);
                        responseText = 'Sorry, there was an error processing the response.';
                    }
                    
                    if (responseText) {
                        // Add assistant message to UI
                        addAssistantMessage(responseText);
                        
                        // Speak the text if not muted
                        if (!isMuted) {
                            speakText(responseText);
                        }
                    } else {
                        // Fallback response for empty result
                        const fallbackText = "I'm sorry, I couldn't process your request. Could you try again?";
                        console.warn('Empty response text, using fallback:', fallbackText);
                        addAssistantMessage(fallbackText);
                        if (!isMuted) speakText(fallbackText);
                    }
                })
                .catch(error => {
                    console.error('Error generating response from Gemini API:', error);
                    console.error('Error details:', error.message, error.stack);
                    
                    // Try using backend LLM API if available
                    tryBackendLLM(message, typingIndicator, navigationContext);
                });
        } catch (error) {
            console.error('Error calling Gemini API:', error);
            console.error('Error details:', error.message, error.stack);
            
            // Try backend or fallback
            tryBackendLLM(message, typingIndicator, buildNavigationContext());
        }
    } else {
        console.log('Gemini API not available, trying backend LLM');
        tryBackendLLM(message, typingIndicator, buildNavigationContext());
    }
}

/**
 * Try to use backend LLM API instead of Gemini
 * @param {string} message - User message
 * @param {HTMLElement} typingIndicator - Typing indicator element
 * @param {string} navigationContext - Navigation context
 */
function tryBackendLLM(message, typingIndicator, navigationContext) {
    // Check if we have API endpoint and it's configured
    if (window.API && typeof window.API.processNavigationPrompt === 'function') {
        console.log('Attempting to use backend LLM API');
        
        // Call backend LLM API
        window.API.processNavigationPrompt(message, { context: navigationContext })
            .then(llmResponse => {
                console.log('Received response from backend LLM API:', llmResponse);
                
                // Remove typing indicator
                removeTypingIndicator(typingIndicator);
                
                if (llmResponse && llmResponse.response) {
                    // Add assistant message to UI
                    addAssistantMessage(llmResponse.response);
                    
                    // Speak the text if not muted
                    if (!isMuted) {
                        speakText(llmResponse.response);
                    }
                } else if (llmResponse && llmResponse.fallback_response) {
                    // Use fallback response
                    addAssistantMessage(llmResponse.fallback_response);
                    if (!isMuted) speakText(llmResponse.fallback_response);
                } else {
                    // Use simulated response as last resort
                    simulateResponse(message, typingIndicator);
                }
            })
            .catch(error => {
                console.error('Error using backend LLM API:', error);
                // Use simulated response as last resort
                simulateResponse(message, typingIndicator);
            });
    } else {
        console.log('Backend LLM API not available, using simulated response');
        simulateResponse(message, typingIndicator);
    }
}

/**
 * Build navigation context string for enhanced Gemini prompts
 * @returns {string} - Navigation context as formatted string
 */
function buildNavigationContext() {
    let context = '';
    
    // Add current location information
    if (currentPosition) {
        // Handle currentPosition correctly based on its actual structure
        // currentPosition is an array [longitude, latitude]
        const longitude = currentPosition[0];
        const latitude = currentPosition[1];
        
        context += `Current location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}\n`;
        
        if (currentRouteData && currentRouteData.destination) {
            const distanceToDest = calculateDistance(
                latitude, 
                longitude,
                currentRouteData.destination.coordinates[1],
                currentRouteData.destination.coordinates[0]
            );
            context += `Distance to destination: ${formatDistance(distanceToDest)}\n`;
        }
    } else {
        context += "Current location: Unknown\n";
    }
    
    // Add route information if available
    if (currentRouteData) {
        // Destination info
        if (currentRouteData.destination) {
            context += `Destination: ${currentRouteData.destination.name || 'Selected destination'}\n`;
        }
        
        // Origin info
        if (currentRouteData.origin) {
            context += `Starting point: ${currentRouteData.origin.name || 'Starting location'}\n`;
        }
        
        // ETA and duration
        if (currentRouteData.duration) {
            // Calculate new ETA based on current time
            const etaMinutes = Math.round(currentRouteData.duration / 60);
            const arrivalTime = new Date(Date.now() + (currentRouteData.duration * 1000));
            const formattedArrivalTime = arrivalTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            context += `Estimated arrival: ${formattedArrivalTime}\n`;
            context += `Total journey time: ${formatDuration(currentRouteData.duration)}\n`;
        }
        
        // Journey progress
        if (currentRouteData.steps && currentRouteData.steps.length > 0) {
            context += `Total steps in journey: ${currentRouteData.steps.length}\n`;
            context += `Current step: ${currentStep + 1} of ${currentRouteData.steps.length}\n`;
            
            // Current maneuver
            if (currentStep < currentRouteData.steps.length) {
                const currentManeuver = currentRouteData.steps[currentStep];
                const sanitizedInstruction = sanitizeInstruction(currentManeuver.maneuver.instruction);
                context += `Current instruction: ${sanitizedInstruction}\n`;
                context += `Distance to next maneuver: ${formatDistance(currentManeuver.distance)}\n`;
                
                // Next maneuver if available
                if (currentStep + 1 < currentRouteData.steps.length) {
                    const nextManeuver = currentRouteData.steps[currentStep + 1];
                    const nextSanitizedInstruction = sanitizeInstruction(nextManeuver.maneuver.instruction);
                    context += `Next instruction: ${nextSanitizedInstruction}\n`;
                }
            }
        }
        
        // Traffic info if available
        if (currentRouteData.trafficLevel) {
            context += `Traffic conditions: ${currentRouteData.trafficLevel}\n`;
        }
    }
    
    console.log("Generated navigation context:", context);
    return context;
}

/**
 * Helper function to simulate a response with proper delay
 * @param {string} message - User's message
 * @param {HTMLElement} typingIndicator - Typing indicator element
 */
function simulateResponse(message, typingIndicator) {
    // Simulate a response after a short delay
    setTimeout(() => {
        // Get simulated response
        const response = simulateGeminiResponse(message);
        console.log("Simulated response:", response);
        
        // Remove typing indicator
        removeTypingIndicator(typingIndicator);
        
        // Add response to chat
        addAssistantMessage(response);
        
        // Speak the response if not muted
        if (!isMuted) {
            speakText(response);
        }
    }, 1000);
}

/**
 * Add user message to conversation
 * @param {string} message - User message
 */
function addUserMessage(message) {
    const conversationContainer = document.getElementById('conversation-container');
    const messageElement = document.createElement('div');
    messageElement.className = 'message user';
    
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    messageElement.innerHTML = `
        <div class="message-content">${message}</div>
        <div class="message-time">${time}</div>
    `;
    
    conversationContainer.appendChild(messageElement);
    conversationContainer.scrollTop = conversationContainer.scrollHeight;
}

/**
 * Add assistant message to conversation
 * @param {string} message - Assistant message
 */
function addAssistantMessage(message) {
    // Remove typing indicator if present
    removeTypingIndicator();
    
    const conversationContainer = document.getElementById('conversation-container');
    const messageElement = document.createElement('div');
    messageElement.className = 'message assistant';
    
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    messageElement.innerHTML = `
        <div class="message-content">${message}</div>
        <div class="message-time">${time}</div>
    `;
    
    conversationContainer.appendChild(messageElement);
    conversationContainer.scrollTop = conversationContainer.scrollHeight;
    
    // Speak the response
    speakText(message);
}

/**
 * Add typing indicator to conversation
 * @returns {HTMLElement} - The typing indicator element
 */
function addTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant typing';
    
    const typingContent = document.createElement('div');
    typingContent.className = 'message-content';
    typingContent.innerHTML = '<span class="typing-dots"></span>';
    
    typingDiv.appendChild(typingContent);
    
    const conversationContainer = document.getElementById('conversation-container');
    if (conversationContainer) {
        conversationContainer.appendChild(typingDiv);
        conversationContainer.scrollTop = conversationContainer.scrollHeight;
    }
    
    return typingDiv;
}

/**
 * Remove typing indicator
 * @param {HTMLElement} typingIndicator - The typing indicator element to remove
 */
function removeTypingIndicator(typingIndicator) {
    if (typingIndicator && typingIndicator.parentNode) {
        typingIndicator.parentNode.removeChild(typingIndicator);
    }
}

/**
 * Simulate Gemini response for offline development
 * @param {string} message - User's message
 * @returns {string} - Simulated response
 */
function simulateGeminiResponse(message) {
    // Convert message to lowercase for easier matching
    const lowerMessage = message.toLowerCase();
    
    // Prepare context information for the LLM
    let contextInfo = {
        current_location: {
            latitude: currentPosition ? currentPosition[1] : null,
            longitude: currentPosition ? currentPosition[0] : null,
            address: "Near Connaught Place, New Delhi, India", // Would be determined by reverse geocoding
            accuracy: currentPosition ? 100 : null
        },
        start_location: {
            latitude: 28.6139,
            longitude: 77.2090,
            address: "Connaught Place, New Delhi, India"
        },
        destination_location: {
            latitude: currentRouteData?.legs?.[0]?.end_location?.lat || 28.5355,
            longitude: currentRouteData?.legs?.[0]?.end_location?.lng || 77.2601,
            address: currentRouteData?.legs?.[0]?.end_location?.name || "Lotus Temple, New Delhi, India"
        },
        movement: {
            direction: currentPosition ? calculateBearing(currentPosition, currentRouteData.geometry.coordinates[0]) : 45, // degrees, 0 = North, 90 = East
            speed: currentPosition ? 25 : 25, // km/h
            bearing: calculateBearing ? calculateBearing(currentPosition, currentRouteData.geometry.coordinates[0]) : 45 // degrees
        },
        eta: {
            remaining_time: formatDuration(currentRouteData?.duration || 1800),
            arrival_time: "20:30",
            remaining_distance: formatDistance(currentRouteData?.distance || 15000)
        },
        next_directions: {
            current_instruction: currentRouteData?.legs?.[0]?.steps?.[currentStep]?.maneuver?.instruction || "Continue straight for 500 meters",
            upcoming_instruction: currentRouteData?.legs?.[0]?.steps?.[currentStep+1]?.maneuver?.instruction || "Turn right onto Lotus Temple Road",
            distance_to_next_turn: formatDistance(currentRouteData?.legs?.[0]?.steps?.[currentStep]?.distance || 500)
        }
    };
    
    console.log("Context information for LLM:", contextInfo);
    
    // In a real implementation, this context would be sent to Gemini
    // For simulation, we'll respond based on the type of question
    
    // Navigation-related queries
    if (lowerMessage.includes('joke') || lowerMessage.includes('funny')) {
        // If user asks for a joke based on location
        if (lowerMessage.includes('where i am') || lowerMessage.includes('my location')) {
            return `Sure, here's a location-based joke: Why was the navigation app feeling stressed while guiding you through ${contextInfo.current_location.address}? Because it had too many "turn-by-turn" decisions to make!`;
        }
        
        // If user asks for a joke based on destination
        if (lowerMessage.includes('where i am heading') || lowerMessage.includes('destination')) {
            return `Here's a joke about your destination: I told my car I wanted to go to ${contextInfo.destination_location.address}, and it said, "Lotus eat lunch first before the long drive!" Sorry for the dad joke! You'll arrive there in ${contextInfo.eta.remaining_time}.`;
        }
        
        // General navigation joke
        return "Why don't scientists trust atoms? Because they make up everything... just like when I tell you the ETA is only 5 more minutes!";
    }
    
    if (lowerMessage.includes('where should i go')) {
        return `Based on your current location in ${contextInfo.current_location.address}, you could continue heading toward ${contextInfo.destination_location.address}, which is ${contextInfo.eta.remaining_distance} away. You'll arrive in approximately ${contextInfo.eta.remaining_time}.`;
    }
    
    if (lowerMessage.includes('turn right') || lowerMessage.includes('turn left')) {
        const nextTurn = contextInfo.next_directions.upcoming_instruction.toLowerCase().includes('right') 
            ? 'right' : (contextInfo.next_directions.upcoming_instruction.toLowerCase().includes('left') ? 'left' : 'straight');
        
        return `Based on our route, you should turn ${nextTurn} in ${contextInfo.next_directions.distance_to_next_turn}. ${contextInfo.next_directions.upcoming_instruction}`;
    }
    
    if (lowerMessage.includes('how far') || lowerMessage.includes('distance')) {
        return `You're currently ${contextInfo.eta.remaining_distance} away from ${contextInfo.destination_location.address}. You're at coordinates ${contextInfo.current_location.latitude.toFixed(4)}, ${contextInfo.current_location.longitude.toFixed(4)}.`;
    }
    
    if (lowerMessage.includes('how long') || lowerMessage.includes('time') || lowerMessage.includes('eta')) {
        return `You'll arrive at ${contextInfo.destination_location.address} in approximately ${contextInfo.eta.remaining_time}. Your estimated arrival time is ${contextInfo.eta.arrival_time}.`;
    }
    
    if (lowerMessage.includes('next turn') || lowerMessage.includes('next direction')) {
        return `Your next turn will be: ${contextInfo.next_directions.upcoming_instruction} in ${contextInfo.next_directions.distance_to_next_turn}. Currently, you should ${contextInfo.next_directions.current_instruction.toLowerCase()}.`;
    }
    
    // Location-related queries
    if (lowerMessage.includes('where am i') || lowerMessage.includes('current location')) {
        return `You're currently in ${contextInfo.current_location.address}, at coordinates ${contextInfo.current_location.latitude.toFixed(4)}, ${contextInfo.current_location.longitude.toFixed(4)}. You're heading ${getCardinalDirection(contextInfo.movement.bearing)} at ${contextInfo.movement.speed} km/h.`;
    }
    
    // Default responses
    const defaultResponses = [
        `I'm here to help with your navigation to ${contextInfo.destination_location.address}. What else would you like to know?`,
        `You're making good progress toward ${contextInfo.destination_location.address}. You'll arrive in ${contextInfo.eta.remaining_time}.`,
        `You're currently at ${contextInfo.current_location.address}. Your next instruction is to ${contextInfo.next_directions.current_instruction.toLowerCase()}.`,
        `I'm keeping an eye on your journey to ${contextInfo.destination_location.address}. Feel free to ask about directions, nearby places, or ETAs.`
    ];
    
    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

/**
 * Helper function to get cardinal direction from bearing
 * @param {number} bearing - Bearing in degrees 
 * @returns {string} - Cardinal direction
 */
function getCardinalDirection(bearing) {
    const directions = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];
    return directions[Math.round(bearing / 45) % 8];
}

/**
 * Format duration in seconds to a human-readable string
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted duration
 */
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''} and ${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
    
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
}

/**
 * Simulate user movement along the route (for testing)
 */
function simulateMovement() {
    if (!currentRouteData || !currentRouteData.geometry) return;
    
    const coordinates = currentRouteData.geometry.coordinates;
    let currentIndex = 0;
    
    // Move along the route every 1-2 seconds
    const interval = setInterval(() => {
        if (!currentRouteData || currentIndex >= coordinates.length) {
            clearInterval(interval);
            return;
        }
        
        // Simulate GPS position update
        const fakePosition = {
            coords: {
                latitude: coordinates[currentIndex][1],
                longitude: coordinates[currentIndex][0],
                // Simulate heading based on next point if available
                heading: currentIndex < coordinates.length - 1 
                    ? calculateBearing(coordinates[currentIndex], coordinates[currentIndex + 1])
                    : 0
            }
        };
        
        // Update position
        updatePosition(fakePosition);
        
        // Move to next point
        currentIndex++;
        
        // If reached end, stop simulation
        if (currentIndex >= coordinates.length) {
            clearInterval(interval);
            announceArrival();
        }
    }, 1500);
}

/**
 * Calculate bearing between two points
 * @param {Array} start - Start coordinates [lng, lat]
 * @param {Array} end - End coordinates [lng, lat]
 * @returns {number} - Bearing in degrees
 */
function calculateBearing(start, end) {
    const startLat = deg2rad(start[1]);
    const startLng = deg2rad(start[0]);
    const endLat = deg2rad(end[1]);
    const endLng = deg2rad(end[0]);
    
    const y = Math.sin(endLng - startLng) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) -
              Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
    
    let bearing = Math.atan2(y, x);
    bearing = bearing * (180 / Math.PI);
    bearing = (bearing + 360) % 360;
    
    return bearing;
}

/**
 * Toggle between full navigation view and compact view
 */
function toggleCompactMode() {
    const navigationMode = document.getElementById('navigation-mode');
    const compactCard = document.getElementById('compact-nav-card');
    
    if (!navigationMode) return;
    
    if (navigationMode.classList.contains('compact')) {
        // Switch to full view
        navigationMode.classList.remove('compact');
        compactCard.style.display = 'none';
        
        // Show regular UI elements
        document.querySelector('.nav-map-container').style.display = 'block';
        document.querySelector('.nav-header').style.display = 'flex';
        document.querySelector('.route-info').style.display = 'flex';
        document.querySelector('.assistant-container').style.display = 'flex';
        document.querySelector('.nav-controls').style.display = 'flex';
        
        showNotification('Switched to full navigation view', 'info');
    } else {
        // Switch to compact view
        navigationMode.classList.add('compact');
        compactCard.style.display = 'block';
        
        // Hide regular UI elements
        document.querySelector('.nav-map-container').style.display = 'none';
        document.querySelector('.nav-header').style.display = 'none';
        document.querySelector('.route-info').style.display = 'none';
        document.querySelector('.assistant-container').style.display = 'none';
        document.querySelector('.nav-controls').style.display = 'none';
        
        // Initialize voice feedback text
        const voiceFeedbackText = document.getElementById('voice-feedback-text');
        if (voiceFeedbackText) {
            voiceFeedbackText.textContent = "Tap microphone to speak";
        }
        
        // Update compact UI with current route data
        updateCompactUI();
        
        showNotification('Switched to compact view', 'info');
    }
}

/**
 * Update the compact UI with current navigation data
 */
function updateCompactUI() {
    if (!currentRouteData) return;
    
    // Update ETA
    const now = new Date();
    const arrivalTime = new Date(now.getTime() + (currentRouteData.duration * 1000));
    const hours = Math.floor(currentRouteData.duration / 3600);
    const minutes = Math.floor((currentRouteData.duration % 3600) / 60);
    const formattedETA = hours > 0 ? `${hours}h${minutes}` : `${minutes}min`;
    document.getElementById('compact-eta').textContent = formattedETA;
    
    // Get current maneuver
    if (currentRouteData.legs && currentRouteData.legs[0] && currentRouteData.legs[0].steps && currentStep < currentRouteData.legs[0].steps.length) {
        const currentManeuver = currentRouteData.legs[0].steps[currentStep];
        
        // Update direction instruction and distance
        if (currentManeuver) {
            // Set instruction
            const instruction = sanitizeInstruction(currentManeuver.maneuver.instruction || 'Continue straight');
            document.getElementById('compact-instruction').textContent = instruction;
            
            // Set distance
            const distance = formatDistance(currentManeuver.distance);
            document.getElementById('compact-distance').textContent = distance;
            
            // Set icon based on maneuver type
            const icon = document.getElementById('compact-direction-icon');
            if (icon) {
                icon.className = '';
                icon.classList.add('fas');
                
                // Choose icon based on maneuver type
                switch(currentManeuver.maneuver.type) {
                    case 'turn':
                        if (currentManeuver.maneuver.modifier?.includes('right')) {
                            icon.classList.add('fa-arrow-right');
                        } else if (currentManeuver.maneuver.modifier?.includes('left')) {
                            icon.classList.add('fa-arrow-left');
                        } else {
                            icon.classList.add('fa-arrow-up');
                        }
                        break;
                    case 'continue':
                        icon.classList.add('fa-arrow-up');
                        break;
                    case 'arrive':
                        icon.classList.add('fa-flag-checkered');
                        break;
                    default:
                        icon.classList.add('fa-arrow-up');
                }
            }
            
            // Update next steps if available
            updateNextSteps();
        }
    }
}

/**
 * Update the next steps section in compact view
 */
function updateNextSteps() {
    if (!currentRouteData?.legs?.[0]?.steps) return;
    
    const steps = currentRouteData.legs[0].steps;
    const nextStepElements = document.querySelectorAll('.next-steps .step');
    
    // Only proceed if we have steps and elements to update
    if (steps.length <= currentStep + 1 || !nextStepElements.length) return;
    
    // Update first next step
    if (nextStepElements[0] && steps[currentStep + 1]) {
        const nextStep = steps[currentStep + 1];
        const icon = nextStepElements[0].querySelector('i');
        const distance = nextStepElements[0].querySelector('.distance');
        const instruction = nextStepElements[0].querySelector('.instruction');
        
        // Update icon
        if (icon) {
            icon.className = '';
            icon.classList.add('fas');
            
            if (nextStep.maneuver.modifier?.includes('right')) {
                icon.classList.add('fa-arrow-right');
            } else if (nextStep.maneuver.modifier?.includes('left')) {
                icon.classList.add('fa-arrow-left');
            } else {
                icon.classList.add('fa-arrow-up');
            }
        }
        
        // Update distance and instruction
        if (distance) distance.textContent = formatDistance(nextStep.distance);
        if (instruction) {
            let instructionText = 'Continue';
            if (nextStep.maneuver.type === 'turn') {
                instructionText = nextStep.maneuver.modifier?.includes('right') ? 'Take a right' : 'Take a left';
            } else if (nextStep.maneuver.type === 'arrive') {
                instructionText = 'Arrive at destination';
            }
            instruction.textContent = instructionText;
        }
    }
    
    // Update second next step if available
    if (nextStepElements[1] && steps[currentStep + 2]) {
        const nextStep = steps[currentStep + 2];
        const icon = nextStepElements[1].querySelector('i');
        const distance = nextStepElements[1].querySelector('.distance');
        const instruction = nextStepElements[1].querySelector('.instruction');
        
        // Update icon
        if (icon) {
            icon.className = '';
            icon.classList.add('fas');
            
            if (nextStep.maneuver.modifier?.includes('right')) {
                icon.classList.add('fa-arrow-right');
            } else if (nextStep.maneuver.modifier?.includes('left')) {
                icon.classList.add('fa-arrow-left');
            } else {
                icon.classList.add('fa-arrow-up');
            }
        }
        
        // Update distance and instruction
        if (distance) distance.textContent = formatDistance(nextStep.distance);
        if (instruction) {
            let instructionText = 'Continue';
            if (nextStep.maneuver.type === 'turn') {
                instructionText = nextStep.maneuver.modifier?.includes('right') ? 'Take a right' : 'Take a left';
            } else if (nextStep.maneuver.type === 'arrive') {
                instructionText = 'Arrive at destination';
            }
            instruction.textContent = instructionText;
        }
    }
}

/**
 * Get user location with improved error handling and retries
 * @param {boolean} forceUpdate - Force update of location
 * @returns {Promise} Promise that resolves with location or rejects with error
 */
function getUserLocation(forceUpdate = false) {
    return new Promise((resolve, reject) => {
        // Only get location if needed or forced
        if (currentPosition && !forceUpdate) {
            return resolve(currentPosition);
        }
        
        // Check if geolocation is supported
        if (!navigator.geolocation) {
            showNotification('Geolocation is not supported by your browser', 'error');
            return reject(new Error('Geolocation not supported'));
        }
        
        // Show loading indicator
        showNotification('Getting your location...', 'info');
        
        // Set timeout to handle geolocation hanging
        const timeoutId = setTimeout(() => {
            showNotification('Location request timed out. Retrying...', 'warning');
            handleLocationError(reject, 'timeout');
        }, 10000); // 10 second timeout
        
        // Track retry attempts
        let retryCount = 0;
        const maxRetries = 2;
        
        // Function to attempt getting position
        function attemptGetPosition() {
            navigator.geolocation.getCurrentPosition(
                // Success callback
                (position) => {
                    clearTimeout(timeoutId);
                    const coords = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    
                    currentPosition = coords;
                    
                    // Update map center and position marker
                    if (navMap) {
                        navMap.setCenter(coords);
                        updatePositionOnMap(coords);
                    }
                    
                    showNotification('Location successfully updated', 'success');
                    resolve(coords);
                },
                // Error callback
                (error) => {
                    clearTimeout(timeoutId);
                    
                    // Try again if not too many retries
                    if (retryCount < maxRetries) {
                        retryCount++;
                        showNotification(`Location error, retrying (${retryCount}/${maxRetries})...`, 'warning');
                        
                        // Try with high accuracy for first retry, then fall back to low accuracy
                        const options = {
                            enableHighAccuracy: retryCount === 1,
                            timeout: 10000,
                            maximumAge: retryCount === 1 ? 0 : 60000 // Use fresh location first, then allow cached
                        };
                        
                        setTimeout(() => {
                            navigator.geolocation.getCurrentPosition(
                                (position) => {
                                    const coords = {
                                        lat: position.coords.latitude,
                                        lng: position.coords.longitude
                                    };
                                    currentPosition = coords;
                                    
                                    // Update map center and position marker
                                    if (navMap) {
                                        navMap.setCenter(coords);
                                        updatePositionOnMap(coords);
                                    }
                                    
                                    showNotification('Location successfully updated', 'success');
                                    resolve(coords);
                                },
                                (retryError) => handleLocationError(reject, retryError.code),
                                options
                            );
                        }, 1000); // Wait a second before retrying
                    } else {
                        handleLocationError(reject, error.code);
                    }
                },
                // Options
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        }
        
        // Start the first attempt
        attemptGetPosition();
    });
}

/**
 * Handle location errors with user-friendly messages and fallbacks
 * @param {Function} reject - Promise reject function
 * @param {string|number} errorCode - Error code or string
 */
function handleLocationError(reject, errorCode) {
    let errorMessage = 'Unable to retrieve your location';
    let errorType = 'error';
    
    switch (errorCode) {
        case 1:
        case 'PERMISSION_DENIED':
            errorMessage = 'Location access was denied. Please check your browser settings and permissions.';
            break;
        case 2:
        case 'POSITION_UNAVAILABLE':
            errorMessage = 'Your location information is unavailable. Try again later.';
            break;
        case 3:
        case 'TIMEOUT':
        case 'timeout':
            errorMessage = 'Location request timed out. Please check your connection and try again.';
            break;
        default:
            errorMessage = 'An unknown error occurred while getting your location.';
    }
    
    showNotification(errorMessage, errorType);
    
    // Try to use a fallback location
    if (currentRouteData && currentRouteData.legs && currentRouteData.legs[0] && currentRouteData.legs[0].start_location) {
        // Use route starting point as fallback
        currentPosition = currentRouteData.legs[0].start_location;
        showNotification('Using route starting point as your location', 'info');
        
        // Update map
        if (navMap) {
            navMap.setCenter(currentPosition);
            updatePositionOnMap(currentPosition);
        }
        
        reject(new Error('Using fallback location: ' + errorMessage));
    } else if (navMap) {
        // Use map center as extreme fallback
        currentPosition = navMap.getCenter().toJSON();
        showNotification('Using map center as your approximate location', 'info');
        updatePositionOnMap(currentPosition);
        reject(new Error('Using map center as fallback: ' + errorMessage));
    } else {
        // No fallback available
        reject(new Error(errorMessage));
    }
}

/**
 * Handle the compact view back button
 */
function handleCompactBackButton() {
    console.log('Compact back button clicked');
    
    // Exit compact mode to return to full navigation view
    const navigationMode = document.getElementById('navigation-mode');
    if (navigationMode && navigationMode.classList.contains('compact')) {
        toggleCompactMode();
        showNotification('Returned to full navigation view', 'info');
    }
} 