#!/usr/bin/env python3
"""
LabTrack - Python Backend QR Code Generation Service
Exclusively generates high-resolution QR codes and asset labels for Admin Dashboard.
"""

import sys
import io
import json
import base64

try:
    import qrcode
    from PIL import Image, ImageDraw, ImageFont
except ImportError as e:
    sys.stderr.write(f"Missing dependency: {e}\n")
    sys.exit(1)


def generate_qr_data_url(equipment_id, name="", category="", location=""):
    """
    Generates a high-resolution QR code image and returns it as a base64 data URI.
    """
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=3,
    )
    qr.add_data(equipment_id)
    qr.make(fit=True)

    img = qr.make_image(fill_color="#0f172a", back_color="#ffffff")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64_str = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64_str}"


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Equipment ID required"}))
        sys.exit(1)

    equipment_id = sys.argv[1].strip()
    name = sys.argv[2].strip() if len(sys.argv) > 2 else ""
    category = sys.argv[3].strip() if len(sys.argv) > 3 else ""
    location = sys.argv[4].strip() if len(sys.argv) > 4 else ""

    try:
        data_url = generate_qr_data_url(equipment_id, name, category, location)
        result = {
            "success": True,
            "equipmentId": equipment_id,
            "name": name,
            "category": category,
            "location": location,
            "qrDataUrl": data_url,
            "generator": "Python 3 qrcode service"
        }
        print(json.dumps(result))
    except Exception as err:
        print(json.dumps({"success": False, "error": str(err)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
