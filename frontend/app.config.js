const IS_COACH = process.env.APP_VARIANT === 'coach';

export default {
  expo: {
    // --- 1. SETĂRI DINAMICE (Diferă între versiuni) ---
    name: IS_COACH ? "CLaiMB Coach" : "CLaiMB Community",
    slug: "claimb-app",
    version: "1.0.0",
    scheme: IS_COACH ? "claimbcoach" : "claimbcommunity",
    
    // Transmitem varianta curentă către codul React Native (ex: _layout.tsx)
    extra: {
      variant: process.env.APP_VARIANT || 'coach',
    },

    // --- 2. SETĂRI COMUNE (Din vechiul tău app.json) ---
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    
    ios: {
      supportsTablet: true,
      // Bundle ID unic pentru fiecare aplicație pe App Store
      bundleIdentifier: IS_COACH ? "com.valentin.claimb.coach" : "com.valentin.claimb.community",
      infoPlist: {
        NSCameraUsageDescription: "Scan climbing walls to analyze routes",
        NSPhotoLibraryUsageDescription: "Select climbing wall photos for analysis"
      }
    },
    
    android: {
      // Package Name unic pentru fiecare aplicație pe Google Play
      package: IS_COACH ? "com.valentin.claimb.coach" : "com.valentin.claimb.community",
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#000"
      },
      edgeToEdgeEnabled: true,
      permissions: [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "READ_MEDIA_IMAGES"
      ]
    },
    
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-image.png", // Observație: în proiectul tău real imaginea se numește splash-image.png, nu splash-icon.png
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#000"
        }
      ]
    ],
    
    experiments: {
      typedRoutes: true
    }
  }
};