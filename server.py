import os
import uvicorn
from fastapi import FastAPI, UploadFile, File, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import shutil
import uuid
import logging
import torch
import numpy as np
from plyfile import PlyData

# Reuse the Sharp logic we wrote for web_ui.py
from web_ui import SharpWebUI, io

# Helper to clean PLY for web viewer
def clean_ply(path: Path):
    try:
        plydata = PlyData.read(str(path))
        # Keep only vertex element to avoid alignment issues in JS viewers
        new_elements = [e for e in plydata.elements if e.name == "vertex"]
        new_plydata = PlyData(new_elements, text=False, byte_order='<')
        new_plydata.write(str(path))
        print(f"Cleaned PLY at {path}")
    except Exception as e:
        print(f"Failed to clean PLY: {e}")

# Initialize App
app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths
UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("output")
FRONTEND_DIR = Path("artwork-depth-app")

UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

# Initialize Model (Lazy load to avoid startup delay, or load now)
# We use the class from web_ui.py to reuse logic
sharp_engine = SharpWebUI()

@app.on_event("startup")
async def startup_event():
    # Pre-load model on startup
    sharp_engine.load_model()

@app.post("/api/predict")
async def predict(file: UploadFile = File(...)):
    try:
        # Save uploaded file
        file_ext = Path(file.filename).suffix
        file_id = str(uuid.uuid4())
        input_path = UPLOAD_DIR / f"{file_id}{file_ext}"
        
        with input_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Process (Synchronous for now, can be backgrounded)
        print(f"Processing {input_path}")
        
        # Call the engine
        # We need to adapt the engine slightly or just use its logic
        # SharpWebUI.process returns the output path string
        output_ply_path_str = sharp_engine.process(str(input_path))
        
        if not output_ply_path_str:
            return {"error": "Processing failed"}
            
        # Move result to public output dir with a web-accessible name
        source_ply = Path(output_ply_path_str)
        dest_ply_name = f"{file_id}.ply"
        dest_ply = OUTPUT_DIR / dest_ply_name
        shutil.move(source_ply, dest_ply)
        
        # Clean the PLY for web viewer compatibility
        clean_ply(dest_ply)
        
        return {
            "success": True, 
            "url": f"/output/{dest_ply_name}",
            "filename": dest_ply_name
        }
        
    except Exception as e:
        logging.error(e)
        return {"error": str(e)}

# Serve Static Files
# Mount output first so it doesn't get caught by root
app.mount("/output", StaticFiles(directory=OUTPUT_DIR), name="output")
# Mount frontend
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")

if __name__ == "__main__":
    # Use port 8000 to match previous workflow
    uvicorn.run(app, host="0.0.0.0", port=8000)
