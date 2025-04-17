/**
 * Map functionality for Suno Saarthi application
 * Handles map initialization, directions, and related features
 */

class MapService {
    constructor(config) {
        this.config = config;
        this.map = null;
        this.userLocation = null;
        this.directionsControl = null;
        this.originMarker = null;
        this.destinationMarker = null;
        this.currentRoute = null;
        this.activeRouteIndex = 0;
        this.geocoder = null;
    }

    /**
     * Initialize the map and related controls
     */
    initialize() {
        // Set Mapbox access token
        mapboxgl.accessToken = this.config.mapboxToken;

        // Create the map instance
        this.map = new mapboxgl.Map({
            container: 'map',
            style: this.config.map.style,
            center: this.config.map.center,
            zoom: this.config.map.zoom,
            minZoom: this.config.map.minZoom,
            maxZoom: this.config.map.maxZoom,
            pitch: this.config.map.pitch,
            bearing: this.config.map.bearing,
            interactive: this.config.map.interactive
        });

        // Add navigation controls (zoom, rotation)
        this.map.addControl(new mapboxgl.NavigationControl(), 'top-right');

        // Add geocoder (search)
        this.geocoder = new MapboxGeocoder({
            accessToken: mapboxgl.accessToken,
            mapboxgl: mapboxgl,
            marker: false,
            placeholder: 'Search for a location',
            proximity: this.config.map.center // Bias results toward default center
        });

        // Add map event listeners
        this.addEventListeners();
        
        // Initialize user location
        this.initializeUserLocation();
    }

    /**
     * Add event listeners to the map
     */
    addEventListeners() {
        // When map is loaded
        this.map.on('load', () => {
            console.log('Map loaded successfully');
            this.addCustomLayers();
        });

        // When map is clicked
        this.map.on('click', (e) => {
            console.log('Map clicked at', e.lngLat);
        });
    }

    /**
     * Add custom layers to the map
     */
    addCustomLayers() {
        // Add route layer
        this.map.addSource('route', {
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

        this.map.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#1a73e8',
                'line-width': 8,
                'line-opacity': 0.8
            }
        });

        // Add points layer for waypoints
        this.map.addSource('waypoints', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: []
            }
        });

        this.map.addLayer({
            id: 'waypoints',
            type: 'circle',
            source: 'waypoints',
            paint: {
                'circle-radius': 6,
                'circle-color': '#1a73e8',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff'
            }
        });
    }

    /**
     * Initialize user location tracking
     */
    initializeUserLocation() {
        // Add geolocate control
        const geolocateControl = new mapboxgl.GeolocateControl({
            positionOptions: {
                enableHighAccuracy: true
            },
            trackUserLocation: true,
            showUserHeading: true
        });

        this.map.addControl(geolocateControl, 'bottom-right');

        // When user location is found
        geolocateControl.on('geolocate', (e) => {
            this.userLocation = [e.coords.longitude, e.coords.latitude];
            console.log('User location updated', this.userLocation);
        });
    }

    /**
     * Fly to a specific location on the map
     * @param {Array} coordinates - [longitude, latitude] coordinates
     * @param {number} zoom - Zoom level to use
     * @param {number} duration - Animation duration in milliseconds
     */
    flyTo(coordinates, zoom = this.config.map.zoom, duration = 2000) {
        this.map.flyTo({
            center: coordinates,
            zoom: zoom,
            duration: duration,
            essential: true
        });
    }

    /**
     * Add a marker to the map
     * @param {Array} coordinates - [longitude, latitude] coordinates
     * @param {string} color - Marker color
     * @param {boolean} draggable - Whether the marker is draggable
     * @returns {mapboxgl.Marker} - The created marker
     */
    addMarker(coordinates, color = '#1a73e8', draggable = false) {
        const marker = new mapboxgl.Marker({
            color: color,
            draggable: draggable
        })
            .setLngLat(coordinates)
            .addTo(this.map);

        return marker;
    }

    /**
     * Remove a marker from the map
     * @param {mapboxgl.Marker} marker - The marker to remove
     */
    removeMarker(marker) {
        if (marker) {
            marker.remove();
        }
    }

    /**
     * Get directions between two points using Mapbox Directions API
     * @param {Array} origin - [longitude, latitude] coordinates of origin
     * @param {Array} destination - [longitude, latitude] coordinates of destination
     * @param {string} mode - Transportation mode (driving, walking, cycling)
     * @returns {Promise<Object>} - Directions response
     */
    async getDirectionsFromMapbox(origin, destination, mode = 'driving') {
        const url = `https://api.mapbox.com/directions/v5/mapbox/${mode}/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.code !== 'Ok') {
                throw new Error(`Directions API error: ${data.code}`);
            }
            
            return data;
        } catch (error) {
            console.error('Error fetching directions:', error);
            throw error;
        }
    }

    /**
     * Get directions using our backend API and display on map
     * @param {string} origin - Origin place name or coordinates
     * @param {string} destination - Destination place name or coordinates
     * @param {string} mode - Transportation mode
     */
    async getDirections(origin, destination, mode = 'driving') {
        try {
            // Clear previous markers
            if (this.originMarker) this.removeMarker(this.originMarker);
            if (this.destinationMarker) this.removeMarker(this.destinationMarker);

            // Get directions from API
            const directionsResponse = await API.getDirections(origin, destination, mode);
            
            if (directionsResponse.status !== 'success' || !directionsResponse.routes || directionsResponse.routes.length === 0) {
                throw new Error('No routes found');
            }

            this.currentRoute = directionsResponse.routes[0];
            this.activeRouteIndex = 0;

            // Process and display the route
            this.displayRoute(this.currentRoute);

            // Return the route information
            return {
                route: this.currentRoute,
                duration: this.currentRoute.legs[0].duration.text,
                distance: this.currentRoute.legs[0].distance.text,
                steps: this.currentRoute.legs[0].steps
            };
        } catch (error) {
            console.error('Error getting directions:', error);
            
            // Fallback to Mapbox directions if backend fails
            try {
                // Convert text locations to coordinates using geocoding
                const originCoords = await this.geocodeLocation(origin);
                const destinationCoords = await this.geocodeLocation(destination);
                
                // Get directions from Mapbox
                const mapboxDirections = await this.getDirectionsFromMapbox(
                    originCoords,
                    destinationCoords,
                    mode
                );
                
                // Process and display the Mapbox route
                this.displayMapboxRoute(mapboxDirections.routes[0], originCoords, destinationCoords);
                
                return {
                    route: mapboxDirections.routes[0],
                    duration: Math.round(mapboxDirections.routes[0].duration / 60) + ' min',
                    distance: (mapboxDirections.routes[0].distance / 1000).toFixed(1) + ' km',
                    steps: this.processMapboxSteps(mapboxDirections.routes[0])
                };
            } catch (fallbackError) {
                console.error('Fallback directions also failed:', fallbackError);
                throw error;
            }
        }
    }

    /**
     * Geocode a location string to coordinates
     * @param {string} location - Location string to geocode
     * @returns {Promise<Array>} - [longitude, latitude] coordinates
     */
    async geocodeLocation(location) {
        // Check if it's already coordinates
        if (typeof location === 'string' && location.includes(',')) {
            const parts = location.split(',').map(part => parseFloat(part.trim()));
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                return parts;
            }
        }

        // Geocode using Mapbox
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?access_token=${mapboxgl.accessToken}&limit=1`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (!data.features || data.features.length === 0) {
                throw new Error(`Location not found: ${location}`);
            }
            
            return data.features[0].center;
        } catch (error) {
            console.error('Geocoding error:', error);
            throw error;
        }
    }

    /**
     * Display a route from our backend API on the map
     * @param {Object} route - Route object from API
     */
    displayRoute(route) {
        if (!route || !route.legs || route.legs.length === 0) {
            console.error('Invalid route data');
            return;
        }

        const leg = route.legs[0];
        
        // Create LineString from route steps
        const coordinates = [];
        leg.steps.forEach(step => {
            if (step.html_instructions) {
                // Extract coordinates from Google-style directions
                // (simplified - in a real app, would need more processing)
                if (step.start_location && step.end_location) {
                    coordinates.push([step.start_location.lng, step.start_location.lat]);
                    coordinates.push([step.end_location.lng, step.end_location.lat]);
                }
            }
        });

        // Add origin and destination markers
        if (coordinates.length >= 2) {
            this.originMarker = this.addMarker(coordinates[0], '#1a73e8');
            this.destinationMarker = this.addMarker(coordinates[coordinates.length - 1], '#d93025');
            
            // Update the route layer
            this.map.getSource('route').setData({
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: coordinates
                }
            });
            
            // Fit map to the route
            this.fitToRoute(coordinates);
        }
    }

    /**
     * Display a route from Mapbox Directions API on the map
     * @param {Object} route - Route object from Mapbox
     * @param {Array} origin - Origin coordinates
     * @param {Array} destination - Destination coordinates
     */
    displayMapboxRoute(route, origin, destination) {
        if (!route || !route.geometry || !route.geometry.coordinates) {
            console.error('Invalid Mapbox route data');
            return;
        }
        
        const coordinates = route.geometry.coordinates;
        
        // Add origin and destination markers
        this.originMarker = this.addMarker(origin, '#1a73e8');
        this.destinationMarker = this.addMarker(destination, '#d93025');
        
        // Update the route layer
        this.map.getSource('route').setData({
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: coordinates
            }
        });
        
        // Fit map to the route
        this.fitToRoute(coordinates);
    }

    /**
     * Process steps from Mapbox directions to a consistent format
     * @param {Object} route - Mapbox route object
     * @returns {Array} - Processed steps array
     */
    processMapboxSteps(route) {
        if (!route || !route.legs || route.legs.length === 0) {
            return [];
        }
        
        return route.legs[0].steps.map(step => {
            return {
                instruction: step.maneuver.instruction,
                distance: {
                    text: (step.distance / 1000).toFixed(1) + ' km',
                    value: step.distance
                },
                duration: {
                    text: Math.round(step.duration / 60) + ' min',
                    value: step.duration
                }
            };
        });
    }

    /**
     * Fit the map view to display the entire route
     * @param {Array} coordinates - Array of [longitude, latitude] coordinates
     */
    fitToRoute(coordinates) {
        if (!coordinates || coordinates.length === 0) {
            return;
        }
        
        const bounds = coordinates.reduce((bounds, coord) => {
            return bounds.extend(coord);
        }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));
        
        this.map.fitBounds(bounds, {
            padding: 50,
            maxZoom: 15,
            duration: 1000
        });
    }
}

// Create an instance of the map service using the configuration
const MAP = new MapService(CONFIG); 