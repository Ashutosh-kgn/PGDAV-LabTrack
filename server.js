const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

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
    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
    const cleanUrl = parsedUrl.pathname;

    // Python Backend Service Endpoint for Admin QR Generation
    if (cleanUrl === '/api/generate-qr') {
        const id = parsedUrl.searchParams.get('id') || '';
        const name = parsedUrl.searchParams.get('name') || '';
        const category = parsedUrl.searchParams.get('category') || '';
        const location = parsedUrl.searchParams.get('location') || '';

        if (!id) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Equipment ID is required' }));
            return;
        }

        const scriptPath = path.join(BASE_DIR, 'generate_qr.py');
        execFile('python', [scriptPath, id, name, category, location], (err, stdout, stderr) => {
            if (err) {
                console.error('Python QR generation error:', stderr || err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Python QR generation service failed' }));
                return;
            }

            try {
                const parsed = JSON.parse(stdout);
                res.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Cache-Control': 'no-cache'
                });
                res.end(JSON.stringify(parsed));
            } catch (jsonErr) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid response from Python QR service' }));
            }
        });
        return;
    }

    let filePathUrl = cleanUrl;
    if (filePathUrl === '/' || filePathUrl === '') {
        filePathUrl = '/index.html';
    }

    const filePath = path.join(BASE_DIR, filePathUrl);

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
    console.log(`- Login / Home:         http://localhost:${PORT}/index.html`);
    console.log(`- Admin Dashboard:      http://localhost:${PORT}/dashboard.html`);
    console.log(`- Lab Assistant:        http://localhost:${PORT}/lab-assistant.html`);
    console.log(`- Student Dashboard:    http://localhost:${PORT}/student.html`);
});

