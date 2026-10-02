import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { extname } from 'node:path';

import { spaFile } from './spa-file.mjs';

const directory = process.argv[2];
const port = Number(process.argv[3]);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

createServer((request, response) => {
  const { pathname } = new URL(request.url, 'http://127.0.0.1');
  const { status, file } = spaFile(directory, pathname);
  if (!file) {
    response.writeHead(status).end();
    return;
  }
  response.writeHead(status, {
    'Content-Type': MIME_TYPES[extname(file)] ?? 'application/octet-stream',
  });
  createReadStream(file).pipe(response);
}).listen(port, '127.0.0.1');
