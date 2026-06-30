import { copyFile, readFile, writeFile } from 'node:fs/promises';

const indexPath = new URL('../dist/index.html', import.meta.url);
let html = await readFile(indexPath, 'utf8');

const pwaHead = `
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/icons/icon-1024.png" />
    <meta name="theme-color" content="#05070A" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Setlog" />`;

html = html
  .replace('<html lang="en">', '<html lang="pt-BR">')
  .replace('</head>', `${pwaHead}\n  </head>`);

await writeFile(indexPath, html, 'utf8');
await copyFile(
  new URL('../assets/icon.png', import.meta.url),
  new URL('../dist/icons/icon-1024.png', import.meta.url),
);
