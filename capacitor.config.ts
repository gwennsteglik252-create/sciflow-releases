import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sciflow.pro',
  appName: 'SciFlow Pro',
  webDir: 'dist',
  android: {
    backgroundColor: '#0f172a',
    allowMixedContent: true, // 允许 HTTPS 页面加载 HTTP 资源（AI API 等）
  },
  ios: {
    backgroundColor: '#0f172a',
    contentInset: 'always',
    allowsLinkPreview: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#0f172a',
      showSpinner: true,
      spinnerColor: '#6366f1',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a',
    },
    Camera: {
      // iOS 权限提示文本
      promptLabelHeader: 'SciFlow Pro 需要访问相机',
      promptLabelPhoto: '拍摄实验现场照片并同步到实验日志',
      promptLabelPicture: '从相册选取图片',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
