import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'VidSage',
    description: 'Your YouTube research library. Save transcripts, search across all your videos, and discover how ideas connect.',
    version: '1.0.0',
    permissions: [
      'storage',
      'tabs'
    ],
    host_permissions: [
      'https://www.youtube.com/*',
      'https://api.openai.com/*',
      'https://api.anthropic.com/*'
    ],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'"
    },
    action: {
      default_popup: 'popup.html',
      default_title: 'VidSage'
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
