"""
Health check endpoint for Vercel
"""
from http.server import BaseHTTPRequestHandler
import json

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        response = {
            "status": "ok",
            "service": "ML-Sharp API",
            "note": "For full ML inference, use the dedicated FastAPI server"
        }
        
        self.wfile.write(json.dumps(response).encode('utf-8'))
