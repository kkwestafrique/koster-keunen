import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

// Real brand color, matching manifest.json's theme_color and the
// splash screen generated from the app's own existing icon -- not a
// separate, invented color.
const BRAND_BLUE = '#0f48aa';

// The exact same build (this file included) runs both as a regular
// website and, wrapped by Capacitor, as the real native Android app.
// Capacitor.isNativePlatform() is the real, correct way to tell those
// two apart at runtime -- every call in here is skipped entirely on
// the web, where these native plugin APIs don't exist and would
// otherwise throw.
export async function initNativeApp() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setBackgroundColor({ color: BRAND_BLUE });
    await StatusBar.setStyle({ style: Style.Dark }); // light icons/text on the dark-blue bar
  } catch {
    // Status bar theming is cosmetic -- never let it block app startup.
  }

  try {
    await SplashScreen.hide();
  } catch {
    // Same here: if this fails, the splash screen's own
    // launchShowDuration timeout (capacitor.config.ts) still hides it.
  }
}
