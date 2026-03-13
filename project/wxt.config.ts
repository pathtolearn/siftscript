import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'YouTube Transcript Manager',
    description: 'Save and manage YouTube transcripts locally',
    version: '1.0.0',
    permissions: [
      'storage',
      'tabs'
    ],
    host_permissions: [
      'https://www.youtube.com/*'
    ],
    action: {
      default_popup: 'popup.html',
      default_title: 'YouTube Transcript Manager'
    },
    icons: {
      '16': 'icon/16.png',
      '32': 'icon/32.png',
      '48': 'icon/48.png',
      '128': 'icon/128.png'
    }
  },
  runner: {
    startUrls: ['https://www.youtube.com']
  }
});
