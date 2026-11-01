import { readFileSync, mkdirSync } from 'node:fs';
import { build } from 'esbuild';
import { existsSync } from 'node:fs';

const configPath = existsSync('src/app/core/firebase.ts')
  ? 'src/app/core/firebase.ts'
  : 'src/app/firebase.ts';
const config = readFileSync(configPath, 'utf8').match(
  /const firebaseConfig\s*=\s*({[\s\S]*?});/,
)?.[1];
if (!config) throw new Error('Could not locate Firebase web configuration.');
mkdirSync('public', { recursive: true });
await build({
  stdin: {
    contents: `
      import { initializeApp } from 'firebase/app';
      import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';
      // Install our handler before Firebase installs its default click handler.
      self.addEventListener('notificationclick', event => {
        event.stopImmediatePropagation();
        event.notification.close();
        event.waitUntil((async () => {
          const target = new URL('/messages', self.location.origin).href;
          const windows = await self.clients.matchAll({type:'window', includeUncontrolled:true});
          const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
          if (existing) { await existing.navigate(target); await existing.focus(); }
          else await self.clients.openWindow(target);
        })());
      });
      const messaging = getMessaging(initializeApp(${config}));
      // Notification payloads are displayed by Firebase, avoiding duplicate alerts.
      onBackgroundMessage(messaging, () => {});
    `,
    resolveDir: process.cwd(),
    sourcefile: 'care-worker.ts',
    loader: 'ts',
  },
  bundle: true,
  minify: true,
  platform: 'browser',
  target: ['es2022'],
  outfile: 'public/firebase-messaging-sw.js',
  legalComments: 'eof',
});
