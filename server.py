#!/usr/bin/env python3
"""
PGDAV LabTrack Server (Python Edition)
Serves static web files and provides the backend QR generation service for the Admin Dashboard.
"""

import os
import sys
import json
import socket
import urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

from generate_qr import generate_qr_data_url

PORT = int(os.environ.get("PORT", 3000))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

class DualStackServer(ThreadingHTTPServer):
    address_family = socket.AF_INET6

    def server_bind(self):
        try:
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except (AttributeError, OSError):
            pass
        super().server_bind()

class LabTrackHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        clean_path = parsed_url.path

        # Python Backend Service for QR Generation (Admin Dashboard Only)
        if clean_path == "/api/generate-qr":
            query_params = urllib.parse.parse_qs(parsed_url.query)
            equipment_id = query_params.get("id", [""])[0].strip()
            name = query_params.get("name", [""])[0].strip()
            category = query_params.get("category", [""])[0].strip()
            location = query_params.get("location", [""])[0].strip()

            if not equipment_id:
                self.send_response(400)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": "Equipment ID is required"}).encode("utf-8"))
                return

            try:
                data_url = generate_qr_data_url(equipment_id, name, category, location)
                response_data = {
                    "success": True,
                    "equipmentId": equipment_id,
                    "name": name,
                    "category": category,
                    "location": location,
                    "qrDataUrl": data_url,
                    "dataUrl": data_url,
                    "backendService": "Python 3 QR Service"
                }
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Cache-Control", "no-cache")
                self.end_headers()
                self.wfile.write(json.dumps(response_data).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))
            return

        # Default route to index.html
        if clean_path == "/" or clean_path == "":
            self.path = "/index.html"

        return super().do_GET()


def run_server():
    try:
        httpd = DualStackServer(("::", PORT), LabTrackHandler)
    except Exception:
        httpd = ThreadingHTTPServer(("0.0.0.0", PORT), LabTrackHandler)

    print(f"PGDAV LabTrack Python Server is live at http://localhost:{PORT}/")
    print(f"- Login / Home:         http://localhost:{PORT}/index.html")
    print(f"- Student Sign-Up:      http://localhost:{PORT}/signup.html")
    print(f"- Admin Dashboard:      http://localhost:{PORT}/dashboard.html")
    print(f"- Lab Assistant:        http://localhost:{PORT}/lab-assistant.html")
    print(f"- Student Dashboard:    http://localhost:{PORT}/student.html")
    print(f"- Forgot Password:      http://localhost:{PORT}/forgot-password.html")
    print(f"- Python QR Service:    http://localhost:{PORT}/api/generate-qr")
    sys.stdout.flush()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.server_close()


if __name__ == "__main__":
    run_server()
