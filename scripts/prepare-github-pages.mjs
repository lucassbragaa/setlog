import { readdir, readFile, writeFile } from 'node:fs/promises';

const basePath = '/setlog';
const distUrl = new URL('../dist/', import.meta.url);
const indexUrl = new URL('index.html', distUrl);
const manifestUrl = new URL('manifest.webmanifest', distUrl);
const workerUrl = new URL('sw.js', distUrl);
const bundleDirectory = new URL('_expo/static/js/web/', distUrl);

let html = await readFile(indexUrl, 'utf8');
html = html
  .replace('href="/manifest.webmanifest"', `href="${basePath}/manifest.webmanifest"`)
  .replace('href="/icons/icon-1024.png"', `href="${basePath}/icons/icon-1024.png"`);
await writeFile(indexUrl, html, 'utf8');

const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
manifest.start_url = `${basePath}/`;
manifest.scope = `${basePath}/`;
manifest.icons = manifest.icons.map(icon => ({
  ...icon,
  src: icon.src.startsWith('/') ? `${basePath}${icon.src}` : icon.src,
}));
await writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

let worker = await readFile(workerUrl, 'utf8');
for (const path of ['/', '/index.html', '/manifest.webmanifest', '/favicon.ico', '/icons/icon-1024.png', '/icons/icon.svg']) {
  worker = worker.replaceAll(`'${path}'`, `'${basePath}${path}'`);
}
await writeFile(workerUrl, worker, 'utf8');

const bundles = (await readdir(bundleDirectory)).filter(file => file.endsWith('.js'));
for (const bundle of bundles) {
  const bundleUrl = new URL(bundle, bundleDirectory);
  const source = await readFile(bundleUrl, 'utf8');
  await writeFile(
    bundleUrl,
    source.replaceAll("register('/sw.js')", `register('${basePath}/sw.js')`),
    'utf8',
  );
}
