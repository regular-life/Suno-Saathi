// Global variable for map error message
window.mapErrorMessage = null;

// Wait for DOM content to be loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM content loaded, initializing Suno Saarthi app');
    
    // Register service worker for PWA functionality first
    registerServiceWorker();
    
    // Initialize debug tools if in development mode
    initializeDebugTools();
    
    // Add user location marker CSS
    addUserLocationMarkerCSS();
    
    // Load configuration before initializing map
    loadAppConfiguration();
});

// Register service worker
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        console.log('Service Worker supported, attempting registration');
        window.addEventListener('load', () => {
            // Get the correct service worker path
            const swPath = '/js/service-worker.js';
            
            navigator.serviceWorker.register(swPath)
                .then(registration => {
                    console.log('Service Worker registered with scope:', registration.scope);
                    
                    // Check for updates
                    registration.onupdatefound = () => {
                        const installingWorker = registration.installing;
                        if (installingWorker) {
                            installingWorker.onstatechange = () => {
                                if (installingWorker.state === 'installed') {
                                    if (navigator.serviceWorker.controller) {
                                        // New content available, show update notification
                                        showUpdateNotification();
                                    } else {
                                        // No previous service worker, no notification needed
                                        console.log('Content now available offline!');
                                    }
                                }
                            };
                        }
                    };
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                    showNotification('Offline mode not available: ' + error.message, 'error');
                });
                
            // Set up offline detection
            setupOfflineDetection();
        });
    } else {
        console.warn('Service Worker is not supported in this browser');
    }
}

// Show update notification
function showUpdateNotification() {
    showNotification('App updated! Refresh for the latest version.', 'info', true);
    
    // Create refresh button in notification
    const notificationElement = document.querySelector('.notification.info');
    if (notificationElement) {
        const refreshButton = document.createElement('button');
        refreshButton.textContent = 'Refresh Now';
        refreshButton.className = 'notification-action';
        refreshButton.onclick = () => {
            window.location.reload();
        };
        notificationElement.appendChild(refreshButton);
    }
}

// Setup offline detection
function setupOfflineDetection() {
    const offlineNotification = document.getElementById('offline-notification');
    
    // Update offline status initially
    updateOfflineStatus();
    
    // Add online/offline event listeners
    window.addEventListener('online', () => {
        console.log('App is online');
        if (offlineNotification) {
            offlineNotification.style.display = 'none';
        }
        showNotification('You are online again!', 'success');
        updateOfflineStatus();
    });
    
    window.addEventListener('offline', () => {
        console.log('App is offline');
        if (offlineNotification) {
            offlineNotification.style.display = 'block';
        }
        showNotification('You are offline. Some features may be limited.', 'warning');
        updateOfflineStatus();
    });
}

// Update offline status indicator
function updateOfflineStatus() {
    const offlineIndicator = document.getElementById('offline-indicator');
    const isOnline = navigator.onLine;
    
    if (offlineIndicator) {
        offlineIndicator.style.display = isOnline ? 'none' : 'block';
    }
    
    // Update body class for CSS targeting
    document.body.classList.toggle('offline', !isOnline);
}

// Add CSS for the user location marker
function addUserLocationMarkerCSS() {
    const css = `
        .user-location-marker {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background-color: #4285F4;
            border: 3px solid white;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
            position: relative;
            cursor: pointer;
        }
        
        .user-location-marker::after {
            content: "";
            position: absolute;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background-color: rgba(66, 133, 244, 0.3);
            top: -15px;
            left: -15px;
            z-index: -1;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% {
                transform: scale(0.8);
                opacity: 0.8;
            }
            70% {
                transform: scale(1.2);
                opacity: 0;
            }
            100% {
                transform: scale(0.8);
                opacity: 0;
            }
        }
        
        /* Offline indicator styles */
        #offline-indicator {
            position: fixed;
            top: 10px;
            left: 10px;
            background-color: #F44336;
            color: white;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 14px;
            z-index: 9999;
            display: none;
        }
        
        /* Notification action button */
        .notification-action {
            background-color: white;
            color: #4285F4;
            border: none;
            border-radius: 4px;
            padding: 3px 8px;
            margin-left: 10px;
            cursor: pointer;
            font-weight: bold;
        }
    `;
    
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
}

// Initialize debug tools
function initializeDebugTools() {
    // Create additional debug UI elements if needed
    const debugButton = document.createElement('button');
    debugButton.id = 'debug-toggle';
    debugButton.innerHTML = '<i class="fas fa-bug"></i>';
    debugButton.style.position = 'fixed';
    debugButton.style.top = '10px';
    debugButton.style.right = '10px';
    debugButton.style.zIndex = '1000';
    debugButton.style.padding = '5px';
    debugButton.style.display = 'none'; // Hidden by default, will show in development mode
    
    debugButton.addEventListener('click', function() {
        const debugPanel = document.getElementById('debug-panel');
        if (debugPanel) {
            debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
        }
    });
    
    document.body.appendChild(debugButton);
    
    // Check if we should enable developer mode
    const isDevMode = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      window.location.search.includes('debug=true');
    
    if (isDevMode) {
        console.log('Development mode enabled');
        debugButton.style.display = 'block';
        
        // Add version info to debug panel
        updateDebugPanel({
            version: '0.5.0',
            environment: 'development',
            timestamp: new Date().toISOString()
        });
    }
}

// Update debug panel with new information
function updateDebugPanel(info) {
    const debugContent = document.getElementById('debug-content');
    if (!debugContent) return;
    
    let contentHTML = '';
    for (const [key, value] of Object.entries(info)) {
        contentHTML += `<div><strong>${key}:</strong> ${value}</div>`;
    }
    
    // Append rather than replace so we can accumulate debug info
    debugContent.innerHTML = contentHTML + debugContent.innerHTML;
}

// Load app configuration
function loadAppConfiguration() {
    console.log('Loading application configuration');
    
    // Load configuration from secrets.js (should have been included in HTML)
    if (typeof loadConfiguration === 'function') {
        loadConfiguration()
            .then(success => {
                if (success) {
                    console.log('Configuration loaded successfully');
                    checkConfigAndInitializeMap();
                } else {
                    console.error('Failed to load configuration');
                    showNotification('Failed to load application configuration', 'error');
                }
            })
            .catch(error => {
                console.error('Error loading configuration:', error);
                showNotification('Configuration error: ' + error.message, 'error');
            });
    } else {
        console.error('loadConfiguration function not found. Make sure secrets.js is loaded');
        showNotification('Application initialization error', 'error');
    }
}

// Check if configuration is loaded and initialize map
function checkConfigAndInitializeMap() {
    if (window.CONFIG && window.CONFIG.loaded) {
        // Configuration is loaded, initialize map
        console.log('Configuration verified, initializing map');
        initializeMap();
    } else {
        // Configuration not yet loaded, wait and try again
        console.log('Waiting for configuration to load...');
        setTimeout(checkConfigAndInitializeMap, 500);
    }
}

function initializeMap() {
    try {
        console.log('Initializing map...');
        
        // Use token from CONFIG, which was loaded from the backend
        if (window.mapboxgl) {
            // Token should be set by initializeMapbox() in secrets.js after loading configuration
            if (!mapboxgl.accessToken) {
                console.error('Mapbox token not set. Map functionality will be limited.');
                showNotification('Error: Mapbox token not available', 'error');
                return null;
            }
            
            console.log('Creating map with token:', mapboxgl.accessToken.substring(0, 10) + '...');
            
            // Create map with basic style to ensure it loads
            const map = new mapboxgl.Map({
                container: 'map',
                style: 'mapbox://styles/mapbox/streets-v11', // Basic style
                center: [77.1025, 28.7041], // Default center on Delhi
                zoom: 12,
                attributionControl: true
            });
            
            // Debug the map initialization
            console.log('Map object created:', map);
            
            // Add load event listener
            map.on('load', function() {
                console.log('Map loaded successfully');
                showNotification('Map loaded successfully!', 'success');
                
                // Request user's location immediately when map loads
                getUserLocation(map);
            });
            
            // Add style.load event listener
            map.on('style.load', function() {
                console.log('Map style loaded successfully');
            });
            
            // Add error handler
            map.on('error', function(e) {
                console.error('Map error:', e);
                window.mapErrorMessage = e.error ? e.error.message : 'Unknown map error';
                showNotification('Error loading map: ' + window.mapErrorMessage, 'error');
            });
            
            // Add navigation controls
            map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
            
            // Add GeolocateControl but don't trigger it yet (we'll do that manually)
            const geolocateControl = new mapboxgl.GeolocateControl({
                positionOptions: {
                    enableHighAccuracy: true
                },
                trackUserLocation: true
            });
            map.addControl(geolocateControl, 'bottom-right');
            
            // Store map and geolocate control in window for debugging
            window.mapInstance = map;
            window.geolocateControl = geolocateControl;
            
            // Set up event listeners for map controls
            setupMapControls(map);
            
            // Set up search functionality
            setupSearch(map);
            
            return map;
        } else {
            console.error('Mapbox GL JS not loaded');
            showNotification('Error: Mapbox GL JS not loaded', 'error');
            return null;
        }
    } catch (error) {
        console.error('Error initializing map:', error);
        window.mapErrorMessage = error.message;
        showNotification('Failed to initialize map: ' + error.message, 'error');
        return null;
    }
}

// Get user's location and fly to it
function getUserLocation(map) {
    if (!map) return;
    
    console.log('Requesting user location...');
    showNotification('Getting your location...', 'info');
    
    // Try using the GeolocateControl first
    if (window.geolocateControl) {
        try {
            // Trigger the geolocate control to get user location
            window.geolocateControl.trigger();
            return;
        } catch (error) {
            console.error('Error triggering geolocate control:', error);
        }
    }
    
    // Fallback to using navigator.geolocation directly
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const userLocation = [position.coords.longitude, position.coords.latitude];
                console.log('User location obtained:', userLocation);
                
                // Fly to user location
                map.flyTo({
                    center: userLocation,
                    zoom: 15,
                    essential: true
                });
                
                // Add a custom user location marker
                addUserLocationMarker(userLocation[0], userLocation[1], map);
                
                // Store user location in window object for other components
                window.userLocation = {
                    coords: userLocation,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                };
                
                showNotification('Location found!', 'success');
            },
            function(error) {
                console.error('Error getting user location:', error);
                showNotification('Could not get your location: ' + error.message, 'error');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    } else {
        console.error('Geolocation is not supported by this browser');
        showNotification('Geolocation is not supported by your browser', 'error');
    }
}

// Add a custom user location marker that stays consistent size when zooming
function addUserLocationMarker(lng, lat, map) {
    if (!map) return;
    
    // Remove any existing user location markers
    const existingMarkers = document.querySelectorAll('.user-location-marker-container');
    existingMarkers.forEach(marker => marker.remove());
    
    // Create a custom HTML element for the marker
    const markerElement = document.createElement('div');
    markerElement.className = 'user-location-marker';
    
    // Create a container to hold the marker
    const container = document.createElement('div');
    container.className = 'user-location-marker-container';
    container.appendChild(markerElement);
    
    // Add tooltip/popup
    const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false
    }).setHTML('<h3>Your Location</h3>');
    
    // Create the marker with our custom element
    const marker = new mapboxgl.Marker({
        element: container,
        anchor: 'center',
        // This makes sure the marker element stays the same size regardless of zoom level
        scale: 1
    })
    .setLngLat([lng, lat])
    .setPopup(popup)
    .addTo(map);
    
    // Store the marker reference for later updates
    window.userLocationMarker = marker;
    
    return marker;
}

function setupMapControls(map) {
    if (!map) return;
    
    // Add event listeners for custom controls
    document.getElementById('zoom-in')?.addEventListener('click', () => {
        map.zoomIn();
    });

    document.getElementById('zoom-out')?.addEventListener('click', () => {
        map.zoomOut();
    });

    document.getElementById('reset-view')?.addEventListener('click', () => {
        // Get user location instead of resetting to default
        getUserLocation(map);
    });
}

function setupSearch(map) {
    if (!map) return;
    
    // Search functionality
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');

    // Add event listeners for search
    if (searchButton) {
        searchButton.addEventListener('click', () => {
            searchLocation(searchInput.value, map);
        });
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                searchLocation(searchInput.value, map);
            }
        });
    }
}

// Search for a location
function searchLocation(query, map) {
    if (!query || !map) return;
    
    showNotification('Searching for ' + query, 'info');
    console.log('Searching for:', query);
    
    // Show loading state
    const searchButton = document.getElementById('search-button');
    if (searchButton) {
        searchButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }
    
    fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}&limit=1`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Geocoding response:', data);
            
            if (searchButton) {
                searchButton.innerHTML = '<i class="fas fa-search"></i>';
            }
            
            if (data.features && data.features.length > 0) {
                const [lng, lat] = data.features[0].center;
                console.log('Found location:', data.features[0].text, [lng, lat]);
                
                // Add marker at the location
                addMarker(lng, lat, data.features[0].text, map);
                
                // Fly to the location
                map.flyTo({
                    center: [lng, lat],
                    zoom: 14,
                    essential: true
                });
            } else {
                console.warn('Location not found:', query);
                showNotification('Location not found', 'error');
            }
        })
        .catch(error => {
            console.error('Error searching location:', error);
            showNotification('Error searching location: ' + error.message, 'error');
            
            if (searchButton) {
                searchButton.innerHTML = '<i class="fas fa-search"></i>';
            }
        });
}

// Original marker function (keep for other markers)
function addMarker(lng, lat, title, map) {
    if (!map) return;
    
    // Remove existing regular markers (but not user location marker)
    const existingMarkers = document.querySelectorAll('.mapboxgl-marker:not(.user-location-marker-container)');
    existingMarkers.forEach(marker => marker.remove());
    
    // Create new marker
    new mapboxgl.Marker()
        .setLngLat([lng, lat])
        .setPopup(new mapboxgl.Popup().setHTML(`<h3>${title}</h3>`))
        .addTo(map);
}

// Show notification
function showNotification(message, type = 'info', isPersistent = false) {
    console.log('Notification:', message, type);
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Mic button click event
const micButton = document.getElementById('mic-button');
if (micButton) {
    micButton.addEventListener('click', function() {
        // Voice recognition is handled in voice-recognition.js
        // This handler is just a fallback and will be overridden
        const voiceModal = document.getElementById('voiceModal');
        if (voiceModal) {
            voiceModal.style.display = 'flex';
            setTimeout(() => {
                voiceModal.style.opacity = '1';
            }, 10);
        }
    });
}

// Check if Mapbox is loaded
if (!mapboxgl) {
    console.error('Mapbox GL JS is not loaded');
    showNotification('Mapbox GL JS is not loaded. Check your internet connection.', 'error');
} 