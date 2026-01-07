# Sharp Monocular View Synthesis in Less Than a Second

[![Project Page](https://img.shields.io/badge/Project-Page-green)](https://apple.github.io/ml-sharp/)
[![arXiv](https://img.shields.io/badge/arXiv-2512.10685-b31b1b.svg)](https://arxiv.org/abs/arxiv.org/abs/2512.10685)

This software project accompanies the research paper: _Sharp Monocular View Synthesis in Less Than a Second_
by _Lars Mescheder, Wei Dong, Shiwei Li, Xuyang Bai, Marcel Santos, Peiyun Hu, Bruno Lecouat, Mingmin Zhen, Amaël Delaunoy,
Tian Fang, Yanghai Tsin, Stephan Richter and Vladlen Koltun_.

![](data/teaser.jpg)

We present SHARP, an approach to photorealistic view synthesis from a single image. Given a single photograph, SHARP regresses the parameters of a 3D Gaussian representation of the depicted scene. This is done in less than a second on a standard GPU via a single feedforward pass through a neural network. The 3D Gaussian representation produced by SHARP can then be rendered in real time, yielding high-resolution photorealistic images for nearby views. The representation is metric, with absolute scale, supporting metric camera movements. Experimental results demonstrate that SHARP delivers robust zero-shot generalization across datasets. It sets a new state of the art on multiple datasets, reducing LPIPS by 25–34% and DISTS by 21–43% versus the best prior model, while lowering the synthesis time by three orders of magnitude.

## ✨ New Features

This fork extends the original ML-Sharp project with a comprehensive **Web UI and Interactive Artwork Tools Suite**, enabling users to:

- 🎨 **Interactive Depth Effects**: Create stunning depth-of-field effects with AI-powered subject segmentation
- 📱 **2.5D Parallax Viewer**: Experience immersive parallax effects using gyroscope or mouse controls
- 👓 **AR Depth Browsing**: Real-time 3D depth estimation using Depth-Anything model
- ✂️ **3D Layered Inpainting**: Automatically separate subjects and inpaint background content
- 🌌 **Infinite Canvas Outpainting**: Generate immersive 360° panoramic experiences
- 💎 **High-Performance 3DGS Viewer**: Custom WebGL-based viewer for real-time Gaussian Splat rendering

## 🚀 Quick Start

### Installation

We recommend to first create a python environment:

```bash
conda create -n sharp python=3.13
conda activate sharp
```

Afterwards, you can install the project using:

```bash
pip install -r requirements.txt
```

To test the installation, run:

```bash
sharp --help
```

## 📖 Usage

### Command Line Interface

To run prediction:

```bash
sharp predict -i /path/to/input/images -o /path/to/output/gaussians
```

The model checkpoint will be downloaded automatically on first run and cached locally at `~/.cache/torch/hub/checkpoints/`.

Alternatively, you can download the model directly:

```bash
wget https://ml-site.cdn-apple.com/models/sharp/sharp_2572gikvuh.pt
```

To use a manually downloaded checkpoint, specify it with the `-c` flag:

```bash
sharp predict -i /path/to/input/images -o /path/to/output/gaussians -c sharp_2572gikvuh.pt
```

The results will be 3D gaussian splats (3DGS) in the output folder. The 3DGS `.ply` files are compatible to various public 3DGS renderers. We follow the OpenCV coordinate convention (x right, y down, z forward). The 3DGS scene center is roughly at (0, 0, +z). When dealing with 3rdparty renderers, please scale and rotate to re-center the scene accordingly.

### Rendering trajectories (CUDA GPU only)

Additionally you can render videos with a camera trajectory. While the gaussians prediction works for all CPU, CUDA, and MPS, rendering videos via the `--render` option currently requires a CUDA GPU. The gsplat renderer takes a while to initialize at the first launch.

```bash
sharp predict -i /path/to/input/images -o /path/to/output/gaussians --render

# Or from the intermediate gaussians:
sharp render -i /path/to/output/gaussians -o /path/to/output/renderings
```

## 🌐 Web UI & Interactive Tools

### Starting the Web Server

Launch the FastAPI web server:

```bash
python server.py
```

Then open your browser and navigate to:

```
http://localhost:8000
```

### Available Tools

The web interface provides six interactive tools:

1. **📷 Basic Depth Editor** (`/basic.html`)
   - AI-powered subject segmentation using TensorFlow.js BodyPix
   - Adjustable background blur effects
   - Real-time preview

2. **📱 2.5D Parallax Viewer** (`/parallax.html`)
   - Gyroscope and mouse-controlled parallax effects
   - Lightweight 2.5D depth simulation
   - No heavy computation required

3. **👓 AR Depth Browsing** (`/immersive.html`)
   - Real-time depth estimation using Depth-Anything model
   - 3D mesh construction with vertex displacement
   - Gyroscope and touch support

4. **✂️ 3D Layered Inpainting** (`/layers.html`)
   - Hybrid approach: Depth-Anything + BodyPix segmentation
   - Automatic background inpainting with "Pyramid Blur" technique
   - Reveals content behind subjects

5. **🌌 Infinite Canvas Outpainting** (`/outpainting.html`)
   - Simulated outpainting with smart image padding
   - Immersive cylindrical scene viewer
   - 180° panoramic experience

6. **💎 ML-Sharp 3DGS Generator** (`/ml-sharp.html` or `/ml-sharp-new.html`)
   - Upload images to generate 3D Gaussian Splats
   - High-performance custom WebGL viewer
   - Real-time rendering with EWA Splatting
   - Direct `.ply` file upload support
   - Web Worker-based parsing and sorting for optimal performance

### ML-Sharp 3DGS Viewer Features

The custom 3DGS viewer (`ml-sharp-new.html`) includes:

- **High-Fidelity Rendering**: Custom EWA Splatting shader implementation
- **Performance Optimizations**:
  - Web Workers for asynchronous PLY parsing
  - CPU-based depth sorting for correct alpha blending
  - Frustum culling for rendering optimization
- **Interactive Controls**: Mouse and touch support for camera rotation, pan, and zoom
- **Format Support**: Handles ML-Sharp's specific PLY format (Logit Opacity, Log Scale)

## 🚢 Deployment

### Vercel Deployment

This project includes Vercel configuration for easy deployment:

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel login
   vercel --prod
   ```

3. **Or use Vercel Dashboard**:
   - Import your Git repository
   - Vercel will automatically detect the configuration

See [VERCEL_DEPLOY.md](VERCEL_DEPLOY.md) for detailed deployment instructions.

### Vercel Analytics

Vercel Analytics is integrated across all pages. View analytics data in the Vercel Dashboard under the "Analytics" tab.

**Note**: ML-Sharp inference may require longer execution times than Vercel's serverless function limits (10s for Hobby, 60s for Pro). Consider using Vercel Pro plan or deploying the ML inference to a separate API service.

## 📁 Project Structure

```
ml-sharp/
├── src/sharp/              # Core ML-Sharp library
├── artwork-depth-app/      # Web UI and interactive tools
│   ├── index.html          # Main dashboard
│   ├── basic.html          # Basic depth editor
│   ├── parallax.html       # 2.5D parallax viewer
│   ├── immersive.html      # AR depth browsing
│   ├── layers.html         # 3D layered inpainting
│   ├── outpainting.html    # Infinite canvas
│   ├── ml-sharp.html       # 3DGS viewer (legacy)
│   ├── ml-sharp-new.html   # 3DGS viewer (custom high-performance)
│   ├── viewer/             # Custom 3DGS viewer components
│   │   ├── core/           # Renderer, shaders, buffer management
│   │   ├── workers/        # Web Workers for parsing and sorting
│   │   ├── loaders/        # PLY file loader
│   │   ├── controls/       # Camera controls
│   │   └── utils/          # Utilities (frustum culling, etc.)
│   └── js/                 # JavaScript modules
├── api/                    # Vercel serverless functions
│   ├── predict.py          # ML inference API
│   └── health.py           # Health check endpoint
├── server.py               # FastAPI web server
├── web_ui.py               # Gradio web UI (alternative)
├── vercel.json             # Vercel configuration
└── requirements.txt        # Python dependencies
```

## 🔧 Development

### Local Development

1. **Start the server**:
   ```bash
   source .venv/bin/activate  # or conda activate sharp
   python server.py
   ```

2. **Access the web interface**:
   - Main dashboard: `http://localhost:8000`
   - Individual tools: `http://localhost:8000/[tool-name].html`

### API Endpoints

- `POST /api/predict`: Upload an image and generate 3DGS
  - Returns: `{ "success": true, "url": "/output/[filename].ply", "filename": "[filename].ply" }`
- `GET /api/health`: Health check endpoint
- `GET /output/[filename].ply`: Download generated PLY files

## 📊 Evaluation

Please refer to the paper for both quantitative and qualitative evaluations.
Additionally, please check out this [qualitative examples page](https://apple.github.io/ml-sharp/) containing several video comparisons against related work.

## 📝 Citation

If you find our work useful, please cite the following paper:

```bibtex
@inproceedings{Sharp2025:arxiv,
  title      = {Sharp Monocular View Synthesis in Less Than a Second},
  author     = {Lars Mescheder and Wei Dong and Shiwei Li and Xuyang Bai and Marcel Santos and Peiyun Hu and Bruno Lecouat and Mingmin Zhen and Ama\"{e}l Delaunoy and Tian Fang and Yanghai Tsin and Stephan R. Richter and Vladlen Koltun},
  journal    = {arXiv preprint arXiv:2512.10685},
  year       = {2025},
  url        = {https://arxiv.org/abs/2512.10685},
}
```

## 🙏 Acknowledgements

Our codebase is built using multiple opensource contributions, please see [ACKNOWLEDGEMENTS](ACKNOWLEDGEMENTS) for more details.

## 📄 License

Please check out the repository [LICENSE](LICENSE) before using the provided code and
[LICENSE_MODEL](LICENSE_MODEL) for the released models.
