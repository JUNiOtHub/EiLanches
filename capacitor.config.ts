import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ronaldo.eilanches',
  appName: 'EiLanches',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#0F0F0F",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#FF8C00",
      splashFullScreen: true,
      splashImmersive: true,
      layoutName: "launch_screen",
      useDialog: true
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0F0F0F'
    },
    App: {
      appendUserAgent: "EiLanches/1.0"
    },
    Keyboard: {
      resize: 'body'
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    Geolocation: {
      permissionAlwaysDescription: "Precisamos de sua localização para mostrar as lojas mais próximas",
      permissionAlwaysUseWhileAppOpenDescription: "Usar localização enquanto o app está aberto",
      permissionAlwaysUseInAppDescription: "Usar localização dentro do app"
    },
    Camera: {
      permissions: ["camera", "photos"]
    }
  },
  ios: {
    scheme: 'EiLanches'
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true
  }
};

export default config;
