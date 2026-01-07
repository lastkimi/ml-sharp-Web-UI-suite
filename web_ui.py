import logging
import os
from pathlib import Path
import tempfile
import gradio as gr
import torch
import torch.nn.functional as F
import numpy as np

# Set MPS high watermark ratio to avoid premature OOM on Mac
os.environ["PYTORCH_MPS_HIGH_WATERMARK_RATIO"] = "0.0"

# Sharp imports
from sharp.models import (
    PredictorParams,
    RGBGaussianPredictor,
    create_predictor,
)
from sharp.utils import io
from sharp.utils.gaussians import (
    Gaussians3D,
    save_ply,
    unproject_gaussians,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
LOGGER = logging.getLogger("web_ui")

DEFAULT_MODEL_URL = "https://ml-site.cdn-apple.com/models/sharp/sharp_2572gikvuh.pt"
MODEL_CACHE_DIR = Path.home() / ".cache" / "torch" / "hub" / "checkpoints"

class SharpWebUI:
    def __init__(self):
        self.device = self._get_device()
        self.predictor = None
        LOGGER.info(f"Initialized with device: {self.device}")

    def _get_device(self):
        if torch.cuda.is_available():
            return "cuda"
        elif torch.backends.mps.is_available():
            return "mps"
        return "cpu"

    def load_model(self):
        if self.predictor is not None:
            return

        LOGGER.info("Loading model...")
        # Ensure cache dir exists
        MODEL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        
        # Load state dict
        try:
            state_dict = torch.hub.load_state_dict_from_url(
                DEFAULT_MODEL_URL, 
                model_dir=MODEL_CACHE_DIR,
                progress=True,
                map_location=self.device
            )
        except Exception as e:
            LOGGER.error(f"Failed to load model: {e}")
            raise e

        self.predictor = create_predictor(PredictorParams())
        self.predictor.load_state_dict(state_dict)
        self.predictor.eval()
        self.predictor.to(self.device)
        LOGGER.info("Model loaded successfully.")

    @torch.no_grad()
    def predict_image(
        self,
        image: np.ndarray,
        f_px: float,
    ) -> Gaussians3D:
        """Predict Gaussians from an image (Replicated from sharp.cli.predict)."""
        internal_shape = (1536, 1536)
        device = torch.device(self.device)

        LOGGER.info("Running preprocessing.")
        image_pt = torch.from_numpy(image.copy()).float().to(device).permute(2, 0, 1) / 255.0
        _, height, width = image_pt.shape
        disparity_factor = torch.tensor([f_px / width]).float().to(device)

        image_resized_pt = F.interpolate(
            image_pt[None],
            size=(internal_shape[1], internal_shape[0]),
            mode="bilinear",
            align_corners=True,
        )

        # Predict Gaussians in the NDC space.
        LOGGER.info("Running inference.")
        gaussians_ndc = self.predictor(image_resized_pt, disparity_factor)

        LOGGER.info("Running postprocessing.")
        intrinsics = (
            torch.tensor(
                [
                    [f_px, 0, width / 2, 0],
                    [0, f_px, height / 2, 0],
                    [0, 0, 1, 0],
                    [0, 0, 0, 1],
                ]
            )
            .float()
            .to(device)
        )
        intrinsics_resized = intrinsics.clone()
        intrinsics_resized[0] *= internal_shape[0] / width
        intrinsics_resized[1] *= internal_shape[1] / height

        # Convert Gaussians to metrics space.
        gaussians = unproject_gaussians(
            gaussians_ndc, torch.eye(4).to(device), intrinsics_resized, internal_shape
        )

        return gaussians

    def process(self, input_path_str):
        if not input_path_str:
            return None
            
        self.load_model()
        
        input_path = Path(input_path_str)
        LOGGER.info(f"Processing {input_path}")
        
        # Load image using sharp's io util to get focal length from EXIF if possible
        image, _, f_px = io.load_rgb(input_path)
        height, width = image.shape[:2]
        
        gaussians = self.predict_image(image, f_px)
        
        # Save to temp file
        temp_dir = tempfile.mkdtemp()
        output_filename = input_path.stem + ".ply"
        output_path = Path(temp_dir) / output_filename
        
        LOGGER.info(f"Saving 3DGS to {output_path}")
        save_ply(gaussians, f_px, (height, width), output_path)
        
        return str(output_path)

# Initialize app logic
app_logic = SharpWebUI()

def generate_3dgs(image_path):
    try:
        return app_logic.process(image_path)
    except Exception as e:
        LOGGER.error(f"Error during generation: {e}")
        raise gr.Error(f"Generation failed: {str(e)}")

# Define UI
with gr.Blocks(title="Sharp 3DGS Generator") as demo:
    gr.Markdown("# Sharp: Monocular View Synthesis in Less Than a Second")
    gr.Markdown("Upload an image to generate a 3D Gaussian Splat (.ply) representation.")
    
    with gr.Row():
        with gr.Column():
            input_image = gr.Image(label="Input Image", type="filepath", sources=["upload"])
            generate_btn = gr.Button("Generate 3DGS", variant="primary")
        
        with gr.Column():
            output_file = gr.File(label="Download .ply Model", file_count="single")
    
    gr.Markdown("""
    ### Notes
    - The output is a `.ply` file containing 3D Gaussian Splats.
    - To view the result, use an online viewer like [antimatter15.com/splat](https://antimatter15.com/splat/) or [playcanvas.com/super-splat](https://playcanvas.com/super-splat).
    - Video rendering is currently disabled in this web UI (requires CUDA).
    """)

    generate_btn.click(
        fn=generate_3dgs,
        inputs=[input_image],
        outputs=[output_file]
    )

if __name__ == "__main__":
    # Try a different port if 7860 is busy, and bind to localhost instead of 0.0.0.0 for better Mac compatibility
    try:
        demo.launch(server_name="127.0.0.1", server_port=7861) 
    except Exception as e:
        print(f"Failed to launch on port 7861: {e}")
        # Fallback to letting Gradio pick a port
        demo.launch()
