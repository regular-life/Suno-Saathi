import { create } from 'zustand';
import { useNavigationDirections, useNavigationPlaces, useNavigationGeocode, useNavigationTraffic, useNavigationQuery } from './navigation.query';

import { components } from '@/api/schemas'

export type TravelMode = 'driving' | 'walking' | 'bicycling';

export type Location = components['schemas']['Location']

export interface Marker {
  id: string;
  position: Location;
  title: string;
  color?: string;
  label?: string;
}

export type RouteStep = components['schemas']['Step']

export type RouteLeg = components['schemas']['Leg']

export type Route = components['schemas']['Route']

// Define navigation state
export interface NavigationState {
  // Map Instance
  mapInstance: google.maps.Map | null;
  setMapInstance: (map: google.maps.Map | null) => void;
  
  // Markers
  markers: Marker[];
  setMarkers: (markers: Marker[]) => void;
  clearMarkers: () => void;
  
  // Navigation Mode
  isNavigating: boolean;
  setIsNavigating: (isNavigating: boolean) => void;
  
  // Travel Mode
  travelMode: TravelMode;
  setTravelMode: (mode: TravelMode) => void;
  
  // Origin and Destination
  origin: string;
  destination: string;
  setOrigin: (origin: string) => void;
  setDestination: (destination: string) => void;
  
  // Route
  currentRoute: Route | null;
  setCurrentRoute: (route: Route | null) => void;
  
  // Current Step in Navigation
  currentStep: number;
  setCurrentStep: (step: number) => void;
  incrementStep: () => void;
  
  // Directions
  getDirections: (params?: { origin: string; destination: string }) => Promise<Route | null>;
  startNavigation: (route: Route) => void;
  endNavigation: () => void;
  
  // Distance and Time Remaining
  distanceRemaining: string;
  timeRemaining: string;
  
  // UI State
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setIsSidebarOpen: (isOpen: boolean) => void;
  
  // Navigation UI State
  showDirectionsPanel: boolean;
  toggleDirectionsPanel: () => void;
}

// Create the store
export const useNavigationStore = create<NavigationState>((set, get) => ({
  // Map Instance
  mapInstance: null,
  setMapInstance: (map) => set({ mapInstance: map }),
  
  // Markers
  markers: [],
  setMarkers: (markers) => set({ markers }),
  clearMarkers: () => set({ markers: [] }),
  
  // Navigation Mode
  isNavigating: false,
  setIsNavigating: (isNavigating) => set({ isNavigating }),
  
  // Travel Mode
  travelMode: 'driving',
  setTravelMode: (mode) => set({ travelMode: mode }),
  
  // Origin and Destination
  origin: '',
  destination: '',
  setOrigin: (origin) => set({ origin }),
  setDestination: (destination) => set({ destination }),
  
  // Route
  currentRoute: null,
  setCurrentRoute: (route) => set({ currentRoute: route }),
  
  // Current Step in Navigation
  currentStep: 0,
  setCurrentStep: (step) => set({ currentStep: step }),
  incrementStep: () => set((state) => {
    if (!state.currentRoute) return state;
    
    const nextStep = state.currentStep + 1;
    const totalSteps = state.currentRoute.legs[0].steps.length;
    
    if (nextStep >= totalSteps) {
      return state;
    }
    
    const step = state.currentRoute.legs[0].steps[nextStep];
    return { 
      currentStep: nextStep,
      distanceRemaining: step.distance.text,
      timeRemaining: step.duration.text
    };
  }),
  
  // UI State
  isSidebarOpen: true,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setIsSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
  
  // Navigation UI State
  showDirectionsPanel: true,
  toggleDirectionsPanel: () => set((state) => ({ showDirectionsPanel: !state.showDirectionsPanel })),
  
  // Directions
  getDirections: async (params?: { origin: string; destination: string }) => {
    const { origin: storeOrigin, destination: storeDestination, travelMode, setCurrentRoute } = get();
    
    const origin = params?.origin || storeOrigin;
    const destination = params?.destination || storeDestination;
    
    if (!origin || !destination) {
      console.error('Origin and destination are required');
      return null;
    }
    
    console.log(`Getting directions: origin=${origin}, destination=${destination}, mode=${travelMode}`);
    
    try {
      // Create the API URL with query parameters
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const apiUrl = new URL(
        apiBase.endsWith('/') 
          ? `${apiBase}api/navigation/directions` 
          : `${apiBase}/api/navigation/directions`
      );
      
      // Add query parameters
      apiUrl.searchParams.append('origin', origin);
      apiUrl.searchParams.append('destination', destination);
      apiUrl.searchParams.append('mode', travelMode);
      
      // Log the full URL for debugging
      console.log('Directions API URL:', apiUrl.toString());
      
      // Make the fetch request
      const response = await fetch(apiUrl.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        // Try to get more detailed error information
        let errorText = '';
        try {
          const errorData = await response.text();
          errorText = errorData;
          console.error('API Error Response:', errorData);
        } catch (e) {
          console.error('Could not parse error response');
        }
        
        throw new Error(`API request failed with status ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Directions API response:', data);
      
      if (data && data.routes && data.routes.length > 0) {
        const routeData = data.routes[0];
        
        // Transform the response data to match our Route interface
        const route: Route = {
          summary: routeData.summary,
          legs: [{
            distance: routeData.legs[0].distance,
            duration: routeData.legs[0].duration,
            start_address: routeData.legs[0].start_address,
            end_address: routeData.legs[0].end_address,
            start_location: routeData.legs[0].start_location,
            end_location: routeData.legs[0].end_location,
            steps: routeData.legs[0].steps.map((step: any) => ({
              distance: step.distance,
              duration: step.duration,
              html_instructions: step.html_instructions,
              start_location: step.start_location,
              end_location: step.end_location,
              maneuver: step.maneuver,
              travel_mode: step.travel_mode,
              polyline: step.polyline
            })),
            traffic_speed_entry: routeData.legs[0].traffic_speed_entry || [],
            via_waypoint: routeData.legs[0].via_waypoint || []
          }],
          bounds: routeData.bounds,
          copyrights: routeData.copyrights || '',
          warnings: routeData.warnings || [],
          waypoint_order: routeData.waypoint_order || [],
          overview_polyline: routeData.overview_polyline
        };
        
        // Update state
        setCurrentRoute(route);
        
        // Reset current step
        set({ currentStep: 0 });
        
        return route;
      }
      
      console.warn('No routes found in the response');
      return null;
    } catch (error) {
      console.error('Error getting directions:', error);
      return null;
    }
  },
  
  startNavigation: (route) => set({ 
    isNavigating: true, 
    currentRoute: route,
    currentStep: 0,
    distanceRemaining: route.legs[0].distance.text,
    timeRemaining: route.legs[0].duration.text,
    showDirectionsPanel: true   // Show the directions panel when navigation starts
  }),
  
  endNavigation: () => set({ 
    isNavigating: false, 
    currentRoute: null,
    currentStep: 0,
    distanceRemaining: '0 km',
    timeRemaining: '0 min',
    showDirectionsPanel: false  // Hide the directions panel when navigation ends
  }),
  
  // Distance and Time Remaining
  distanceRemaining: '0 km',
  timeRemaining: '0 min'
})); 