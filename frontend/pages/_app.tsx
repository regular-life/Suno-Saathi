// Import styles of packages that you've installed.
// All packages except `@mantine/hooks` require styles imports
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import type { AppProps } from "next/app";
import Head from "next/head";
import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import '../src/styles/globals.css';
import dynamic from 'next/dynamic';

const queryClient = new QueryClient();

// Dynamically import the debug panel, only loaded in development
const DebugPanel = dynamic(() => 
  process.env.NODE_ENV === 'development' 
    ? import('../src/utils/debug-panel')
    : Promise.resolve(() => null),
  { ssr: false }
);

function App({ Component, pageProps }: AppProps) {
    const [queryClient] = useState(() => new QueryClient());

    useEffect(() => {
        // Register service worker
        if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').then(
                    (registration) => {
                        console.log('Service Worker registration successful');
                    },
                    (err) => {
                        console.error('Service Worker registration failed', err);
                    }
                );
            });
        }
    }, []);

    return (
        <MantineProvider withGlobalStyles withNormalizeCSS>
            <Notifications />
            <Head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap"
                    rel="stylesheet"
                />
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                <title>Saarthi</title>
            </Head>
            <QueryClientProvider client={queryClient}>
                <Component {...pageProps} />
                {process.env.NODE_ENV === 'development' && <DebugPanel />}
            </QueryClientProvider>
        </MantineProvider>
    );
};

export default App;