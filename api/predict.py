"""
Vercel Serverless Function for ML-Sharp 3DGS prediction
Note: This function has execution time limits. For production,
consider using a separate API service or Vercel Pro with longer timeouts.
"""
import os
import json
import base64
import tempfile
from pathlib import Path
from http.server import BaseHTTPRequestHandler
import sys

# Add parent directory to path to import web_ui
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from web_ui import SharpWebUI
    from plyfile import PlyData
    import uuid
    import shutil
except ImportError as e:
    print(f"Import error: {e}")
    SharpWebUI = None

# Global model instance (reused across invocations)
sharp_engine = None

def get_engine():
    """Lazy load the model engine"""
    global sharp_engine
    if sharp_engine is None:
        if SharpWebUI is None:
            raise RuntimeError("ML-Sharp dependencies not available")
        sharp_engine = SharpWebUI()
        sharp_engine.load_model()
    return sharp_engine

def clean_ply(path: Path):
    """Clean PLY file for web viewer compatibility"""
    try:
        plydata = PlyData.read(str(path))
        new_elements = [e for e in plydata.elements if e.name == "vertex"]
        new_plydata = PlyData(new_elements, text=False, byte_order='<')
        new_plydata.write(str(path))
        return True
    except Exception as e:
        print(f"Failed to clean PLY: {e}")
        return False

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_POST(self):
        """Handle image upload and 3DGS generation"""
        try:
            # Parse request
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_error(400, "No file uploaded")
                return
            
            # Read multipart form data
            # Note: This is a simplified parser. For production, use a proper library like `multipart`
            post_data = self.rfile.read(content_length)
            
            # Extract file from multipart data
            # This is a basic implementation - in production, use a proper multipart parser
            boundary = self.headers.get('Content-Type', '').split('boundary=')[-1]
            
            # For now, return an error suggesting to use the full server
            # Vercel functions have time limits that may not be suitable for ML inference
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {
                "error": "ML-Sharp inference requires longer execution time than Vercel functions allow. Please use a dedicated API server or Vercel Pro with extended timeouts.",
                "suggestion": "Deploy the FastAPI server (server.py) separately or use Vercel Pro plan"
            }
            
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            error_response = {"error": str(e)}
            self.wfile.write(json.dumps(error_response).encode('utf-8'))
