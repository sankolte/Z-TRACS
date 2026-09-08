# Z-TRACS Edge AI Integration & Local Daemon Guide
**Confidential — For Technical Evaluation & Integration Testing**

---

## 1. Overview & Architecture

Z-TRACS uses a **Cloud-to-Edge Synchronous Pipeline**. When an operator or administrator makes changes in the web dashboard (such as toggling an AI model, updating an RTSP link, drawing a new Region of Interest, registering a suspect with a video clip, or ingesting offline forensic footage), the cloud backend immediately broadcasts the changes to edge nodes.

These standalone Python scripts run locally on any edge machine (Nvidia Jetson, GPU server, or local development workstation) to guarantee:
- **Offline Autonomous Inference**: Even if internet connectivity is intermittent, local inference workers (OpenCV, YOLO, DeepStream, InsightFace) run directly against local disk assets.
- **Zero-Latency State Updates**: Local configuration manifests (`cameras.json`, `faces.json`, `forensics.json`) are updated atomically in `< 0.05 seconds`.
- **Zero Heavy Dependencies**: Standard Python 3.8+ with auto-bootstrapping for lightweight HTTP transport.

---

## 2. Standalone Scripts Overview

| Script | Output Manifest | Local Media Assets | Responsibilities |
|---|---|---|---|
| `update_json.py` | `cameras.json` | None (Direct Network RTSP) | Syncs 35 cameras, RTSP streams, multi-zone ROIs (4 use cases), and 4-element `enable` vectors. |
| `update_frs.py` | `faces.json` | `clips/{slug}/face_reference.jpg`<br>`clips/{slug}/clip.mp4` | Detects new suspects, downloads 1-minute video clips and reference photos, writes local paths. |
| `update_forensics.py` | `forensics.json` | `forensics/{task_id}/{filename}` | Stream-downloads multi-gigabyte CCTV footage in chunks, sets up offline batch GPU pipeline. |
| `start_all_daemons.py` | All 3 Manifests | All Folders | **All-in-one runner**: Launches all three services concurrently in a single terminal. |

---

## 3. How to Run on Any Machine

### Requirements
- **Python 3.8 or higher** installed.
- No manual `pip install` required — each script auto-detects and installs `requests` if not already present.

### Option A: Run All Services Together (Recommended)
Open a terminal in the folder containing the scripts and run:
```bash
python start_all_daemons.py
```
*Press `Ctrl + C` anytime to gracefully stop all services.*

### Option B: Run Individual Daemons in Separate Terminals
```bash
# Terminal 1 — Camera & ANPR Registry
python update_json.py

# Terminal 2 — Face Recognition & 1-Minute Clip Sync
python update_frs.py

# Terminal 3 — Offline CCTV Forensic Video Ingestion
python update_forensics.py
```

---

## 4. Complete Verification & Testing Checklist

### Test 1: ANPR & Camera Configuration (`cameras.json`)
1. Open the Z-TRACS Web Dashboard ➔ Go to **Camera Management** or **Live Surveillance**.
2. **Test RTSP Stream Update**:
   - Change the RTSP URL of any camera or add a new camera.
   - **Verification**: In `cameras.json`, verify the `"rtsp"` field updates immediately. For Zeex streams (`103.250.160.189`), credentials (`admin%40zeexai.com:RCVN-BJ7U-UCA4@`) are pre-injected so `cv2.VideoCapture(rtsp)` works out-of-the-box.
3. **Test Multi-Zone ROI (4 Use Cases)**:
   - In the dashboard, configure or draw ROI polygons for:
     - `rois[0]`: ANPR Lane Polygon
     - `rois[1]`: Face Recognition Entry Zone
     - `rois[2]`: PPE Safety Zone
     - `rois[3]`: Footfall Counting Corridor
   - **Verification**: In `cameras.json`, inspect the `"rois"` array — all 4 coordinate arrays update in real time.
4. **Test Dynamic Enable Vector**:
   - Toggle AI models on/off for a camera.
   - **Verification**: In `cameras.json`, inspect the `"enable"` array:
     ```json
     "enable": [ANPR, FRS, PPE, FOOTFALL]
     // e.g. [1, 0, 0, 0] = Only ANPR active
     // e.g. [1, 1, 0, 0] = ANPR & Face Recognition active
     ```

---

### Test 2: Face Recognition & 1-Minute Suspect Clip Sync (`faces.json` & `clips/`)
1. Open the Web Dashboard ➔ Go to **Face Recognition**.
2. Click **"Add Suspect Target"**.
3. Fill in:
   - **Suspect Name**: e.g., `Vikramaditya Rathore`
   - **FIR / Case ID**: e.g., `FIR-AHM-2026-9041`
   - **Upload Media**: Select a 1-minute video clip (`.mp4`) or suspect photo.
4. Click **"Deploy Target to Edge Ingest Engine"**.
5. **Verification**:
   - The daemon terminal displays:
     ```
     =================================================================
     [LIVE FRS SYNC EVENT DETECTED]
     =================================================================
      -> Event Type       : NEW SUSPECT TARGET ADDED
      -> Person Name      : Vikramaditya Rathore
      -> Local Photo Path : clips/vikramaditya_rathore/face_reference.jpg
      -> Local Clip Path  : clips/vikramaditya_rathore/clip.mp4
      -> Status           : PHOTO & VIDEO CLIP ON DISK -> READY FOR CV INFERENCE
     =================================================================
     ```
   - Open your local file explorer: inside `clips/<slug>/`, both `face_reference.jpg` and `clip.mp4` are saved.
   - Open `faces.json`: the target is registered with `media_path`, `similarity_threshold`, and `target_cameras`.

---

### Test 3: Forensic Offline Video Analysis (`forensics.json` & `forensics/`)
1. Open the Web Dashboard ➔ Go to **Forensic Analysis**.
2. Click **"Ingest Pre-Recorded Footage"**.
3. Select a CCTV video file (e.g. `.mp4`).
   - The duration slider automatically detects video duration from metadata.
4. Click **"Initiate Ingestion & Pipeline"**.
5. **Verification**:
   - The upload progress reaches 100%, and the modal automatically closes.
   - The dashboard video player immediately displays and plays the uploaded footage.
   - The daemon terminal displays:
     ```
     =================================================================
     [LIVE FORENSIC SYNC EVENT DETECTED]
     =================================================================
      -> Event Type       : NEW FORENSIC VIDEO INGEST JOB
      -> Task ID          : TSK-FOR-XXXXX
      -> Local Video File : forensics/TSK-FOR-XXXXX/footage.mp4
      -> Enable Vector    : [1, 0, 0, 0] [ANPR, FRS, PPE, FOOTFALL]
      -> Engine Status    : READY FOR LOCAL GPU INFERENCE
     =================================================================
     ```
   - In your local file explorer: inside `forensics/<task_id>/`, the entire video file is downloaded.
   - In `forensics.json`: the job manifest contains local video path, duration, total frames, and model flags.

---

## 5. Summary of Guarantee
- **Zero manual dependency setup**: Scripts auto-bootstrap on fresh machines.
- **Failover built-in**: Scripts automatically failover between AWS EC2 Direct and Cloud Proxy.
- **Atomic file writes**: JSON manifests are written via temporary `.tmp` files to ensure local OpenCV / DeepStream inference workers never read partial data.
