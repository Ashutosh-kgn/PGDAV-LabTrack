const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    let cleanUrl = req.url.split('?')[0];
    if (cleanUrl === '/' || cleanUrl === '') {
        cleanUrl = '/index.html';
    }

    const filePath = path.join(BASE_DIR, cleanUrl);

    // Prevent directory traversal
    if (!filePath.startsWith(BASE_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            const notFoundPath = path.join(BASE_DIR, '404.html');
            fs.readFile(notFoundPath, (err404, data404) => {
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(data404 || '404 Not Found');
            });
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache'
        });

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
    });
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`LabTrack server is live at http://localhost:${PORT}/`);
    console.log(`- Login / Home:       http://localhost:${PORT}/index.html`);
    console.log(`- Admin Dashboard:    http://localhost:${PORT}/dashboard.html`);
    console.log(`- Student Dashboard:  http://localhost:${PORT}/student.html`);
});

