import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'co.vectorfootball.app',
  appName: 'Vector Football',
  webDir: 'dist',
  server: {
    hostname: 'vectorfootball.co.uk'
  },
  ios: {
    scrollEnabled: true
  }
};

export default config;
