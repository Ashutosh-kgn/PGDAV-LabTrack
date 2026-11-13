from http.server import BaseHTTPRequestHandler
import urllib.parse
import json
import sys
import os

# Add root folder to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from generate_qr import generate_qr_data_url

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        eq_id = params.get("id", [""])[0].strip()
        name = params.get("name", [""])[0].strip()
        category = params.get("category", [""])[0].strip()
        location = params.get("location", [""])[0].strip()

        if not eq_id:
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"success": False, "error": "Equipment ID is required"}).encode("utf-8"))
            return

        try:
            data_url = generate_qr_data_url(eq_id, name, category, location)
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "public, max-age=86400")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "equipmentId": eq_id,
                "name": name,
                "category": category,
                "location": location,
                "dataUrl": data_url,
                "qrDataUrl": data_url,
                "backendService": "Vercel Python Serverless"
            }).encode("utf-8"))
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))
