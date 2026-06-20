import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const port = Number(process.argv[2] ?? 8085);
const distRoot = new URL('../dist/', import.meta.url);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const safePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '');
    let fileUrl = new URL(safePath, distRoot);

    try {
      const fileStat = await stat(fileUrl);
      if (fileStat.isDirectory()) fileUrl = new URL('index.html', fileUrl);
    } catch {
      fileUrl = new URL('index.html', distRoot);
    }

    const body = await readFile(fileUrl);
    const extension = extname(fileUrl.pathname);
    response.writeHead(200, {
      'Content-Type': mimeTypes[extension] ?? 'application/octet-stream',
      'Cache-Control': extension === '.js' && fileUrl.pathname.endsWith('/sw.js') ? 'no-cache' : 'public, max-age=0',
    });
    response.end(body);
  } catch {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Unable to serve Setlog.');
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`Setlog preview: http://localhost:${port}`);
});
