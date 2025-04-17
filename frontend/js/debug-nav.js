console.log('Navigation mode debug script loaded');

// Function to toggle navigation mode
window.toggleNavigationMode = function() {
    const navigationMode = document.getElementById('navigation-mode');
    console.log('Navigation mode element:', navigationMode);
    
    if (navigationMode) {
        if (navigationMode.classList.contains('active')) {
            navigationMode.classList.remove('active');
            console.log('Navigation mode hidden');
        } else {
            navigationMode.classList.add('active');
            console.log('Navigation mode displayed');
            
            // Ensure map is initialized if we're showing navigation mode
            if (typeof initNavMap === 'function' && !window.navMap) {
                setTimeout(() => {
                    try {
                        // Create dummy data if needed
                        if (!window.currentRouteData) {
                            window.currentRouteData = {
                                geometry: {
                                    coordinates: [[77.1025, 28.7041], [77.2090, 28.6139]]
                                },
                                origin: {
                                    coordinates: [77.1025, 28.7041],
                                    name: 'Test Origin'
                                },
                                destination: {
                                    coordinates: [77.2090, 28.6139],
                                    name: 'Test Destination'
                                }
                            };
                        }
                        
                        // Initialize the navigation map
                        if (typeof initNavMap === 'function') {
                            initNavMap();
                        }
                    } catch (e) {
                        console.error('Error initializing navigation map:', e);
                    }
                }, 500);
            }
        }
    } else {
        console.error('Navigation mode element not found');
    }
};

// Expose functions to window for debug console access
window.showNavigationMode = function() {
    const navigationMode = document.getElementById('navigation-mode');
    if (navigationMode) {
        navigationMode.style.display = 'flex';
        navigationMode.style.opacity = '1';
        navigationMode.classList.add('active');
        console.log('Navigation mode shown via direct style');
    }
};

// Fix the getDirections function to proper display navigation mode
window.fixNavigation = function() {
    const startNavigationBtn = document.getElementById('start-navigation-btn');
    if (startNavigationBtn) {
        startNavigationBtn.addEventListener('click', function() {
            const navigationMode = document.getElementById('navigation-mode');
            if (navigationMode) {
                navigationMode.style.display = 'flex';
                navigationMode.style.opacity = '1';
                navigationMode.classList.add('active');
                console.log('Navigation mode activated from fixed button');
            }
        });
        console.log('Fixed navigation button handler installed');
    }
};

// Run fix immediately
window.fixNavigation(); 