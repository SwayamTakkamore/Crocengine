# 🔒 Face KYC Verification System

A real-time face verification system that uses computer vision to verify human liveness through head movements. Users need to perform specific head movements (look left, right, up, and center) to prove they are real humans and not photos or videos.

## 🌟 Features

- **Real-time Face Detection**: Uses MediaPipe for accurate face detection and tracking
- **Liveness Detection**: Requires users to perform head movements to verify they are real humans
- **Movement Tracking**: Tracks left, right, up, and center head positions
- **Progressive Verification**: Step-by-step verification process with visual feedback
- **Web Interface**: Clean, responsive web interface for easy interaction
- **API Endpoints**: RESTful API for integration with other systems
- **Session Management**: Secure session-based verification tracking

## 🛠️ Technology Stack

- **Backend**: Flask (Python)
- **Computer Vision**: OpenCV, MediaPipe
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Camera Access**: WebRTC getUserMedia API

## 📋 Requirements

- Python 3.7+
- Webcam/Camera access
- Modern web browser with camera support

## ⚡ Quick Start

### 1. Manual Installation

#### Step 1: Create Virtual Environment
```bash
cd "face verification"

python -m venv venv
```

#### Step 2: Activate Virtual Environment
```bash
# On Windows:
venv\Scripts\activate

# On Linux/Mac:
source venv/bin/activate
```

#### Step 3: Install Dependencies
```bash
# Install all required packages
pip install -r requirements.txt
```

#### Step 4: Run the Application
```bash
# Start the Flask server
python face_kyc_api.py
```

### 2. Access the Application

Open your web browser and navigate to:
```
http://localhost:5000
```

### 3. Using the Face KYC System

1. **Allow Camera Access**: Grant camera permissions when prompted
2. **Position Your Face**: Align your face within the circle outline
3. **Follow Instructions**: Complete the required head movements:
   - Look straight at the camera
   - Turn head left ⬅️
   - Turn head right ➡️
   - Look up ⬆️
