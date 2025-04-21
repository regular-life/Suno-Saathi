import { AppShell } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconMicrophone, IconDirections, IconMapPin } from '@tabler/icons-react';
import classes from './app-layout.module.scss';
import { MapContainer } from '@/map/map';
import { VoiceModal } from '@/voice/voice-modal';
import { NavigationPanel } from '@/navigation/navigation-panel';
import { NavigationMode } from '@/navigation/navigation-mode';
import { useNavigationStore } from '@/navigation/navigation-store';
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '@/utils/constants';
import { useEffect, useRef } from 'react';

export function AppLayout() {
  const [opened, { toggle, close, open }] = useDisclosure(false);
  const [voiceModalOpened, { open: openVoiceModal, close: closeVoiceModal }] = useDisclosure(false);
  const isUpdatingRef = useRef(false);
  
  const { 
    mapInstance, 
    endNavigation,
    isSidebarOpen,
    setIsSidebarOpen
  } = useNavigationStore();

  // Handle opening/closing sidebar from the navigation store
  useEffect(() => {
    if (isUpdatingRef.current) return;
    
    isUpdatingRef.current = true;
    
    // Only update if there's an actual change needed
    if (isSidebarOpen !== opened) {
      if (isSidebarOpen) {
        open();
      } else {
        close();
      }
    }
    
    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 0);
  }, [isSidebarOpen, opened, close, open]);

  // Handle sidebar toggle button clicks
  const handleToggleSidebar = () => {
    isUpdatingRef.current = true;
    toggle();
    // Update the store after toggling the UI
    setTimeout(() => {
      setIsSidebarOpen(!opened);
      isUpdatingRef.current = false;
    }, 0);
  };

  const resetMap = () => {
    if (mapInstance) {
      mapInstance.setCenter(DEFAULT_CENTER);
      mapInstance.setZoom(DEFAULT_ZOOM);
      endNavigation();
    }
  };

  return (
    <AppShell
      navbar={{ width: 300, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding={0}
      styles={{
        main: {
          padding: 0,
          overflow: 'hidden',
          height: '100vh',
        },
      }}
    >
      <AppShell.Navbar>
        <NavigationPanel onClose={() => {
          isUpdatingRef.current = true;
          close();
          // Update the store after closing the UI
          setTimeout(() => {
            setIsSidebarOpen(false);
            isUpdatingRef.current = false;
          }, 0);
        }} />
      </AppShell.Navbar>

      <AppShell.Main>
        <div className={classes.container}>
          <div className={classes.mapContainer}>
            <MapContainer />
          </div>
          
          <div className={classes.controls}>
            <button className={classes.controlButton} onClick={handleToggleSidebar}>
              <IconDirections size={20} />
            </button>
          </div>
          
          <NavigationMode />
        </div>

        <VoiceModal opened={voiceModalOpened} onClose={closeVoiceModal} />
      </AppShell.Main>
    </AppShell>
  );
} 