import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.miskkwa.app',
  appName: 'Koster Keunen',
  webDir: 'build',
  // Matches the app's real, existing PWA branding (manifest.json) --
  // same blue on launch, not a generic white flash before the app loads.
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0f48aa',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};

export default config;
