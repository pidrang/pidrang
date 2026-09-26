import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const directory = resolve(process.argv[2] ?? 'dist/pages');
const port = Number(process.argv[3] ?? 4300);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

function send(response, status, file) {
  response.writeHead(status, {
    'Content-Type': MIME_TYPES[extname(file)] ?? 'application/octet-stream',
  });
  createReadStream(file).pipe(response);
}

const server = createServer((request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  const requested = normalize(join(directory, decodeURIComponent(pathname)));

  if (!requested.startsWith(directory)) {
    response.writeHead(403).end();
    return;
  }

  if (existsSync(requested) && statSync(requested).isDirectory()) {
    if (!pathname.endsWith('/')) {
      response.writeHead(301, { Location: `${pathname}/` }).end();
      return;
    }
    const index = join(requested, 'index.html');
    if (existsSync(index)) {
      send(response, 200, index);
      return;
    }
  } else if (existsSync(requested)) {
    send(response, 200, requested);
    return;
  }

  const notFound = join(directory, '404.html');
  if (existsSync(notFound)) {
    send(response, 404, notFound);
    return;
  }
  response.writeHead(404).end();
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Serving ${directory} on http://127.0.0.1:${port}`);
});
