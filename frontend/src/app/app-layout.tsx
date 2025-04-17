import { AppShell } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconMicrophone, IconDirections } from '@tabler/icons-react';
import classes from './app-layout.module.scss';
import { MapContainer } from '@/map/map';
import { VoiceModal } from '@/voice/voice-modal';
import { NavigationPanel } from '@/navigation/navigation-panel';
import { NavigationMode } from '@/navigation/navigation-mode';

export function AppLayout() {
  const [opened, { toggle }] = useDisclosure(false);
  const [voiceModalOpened, { open: openVoiceModal, close: closeVoiceModal }] = useDisclosure(false);

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
        <NavigationPanel />
      </AppShell.Navbar>

      <AppShell.Main>
        <div className={classes.container}>
          <div className={classes.mapContainer}>
            <MapContainer />
          </div>
          
          <div className={classes.controls}>
            <button className={classes.controlButton} onClick={openVoiceModal}>
              <IconMicrophone size={20} />
            </button>
            <button className={classes.controlButton} onClick={toggle}>
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