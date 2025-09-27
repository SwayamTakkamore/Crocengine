from flask import Flask, request, jsonify, render_template
import cv2
import numpy as np
import base64
import json
from datetime import datetime
import math
from collections import defaultdict, deque
import time

app = Flask(__name__)

class SimpleFaceKYCVerifier:
    def __init__(self):
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        self.eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
        self.sessions = {}
    
    def create_session(self):
        """Create a new verification session"""
        session_id = str(int(time.time() * 1000))
        self.sessions[session_id] = {
            'start_time': time.time(),
            'movements': {
                'left': False,
                'right': False,
                'up': False,
                'down': False,
                'center': False
            },
            'movement_history': deque(maxlen=30),
            'face_positions': deque(maxlen=15),
            'verification_complete': False,
            'is_verified': False,
            'total_frames': 0,
            'face_detected_frames': 0
        }
        return session_id
    
    def detect_face_and_pose(self, frame):
        """Detect face and estimate head pose using OpenCV"""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(gray, 1.1, 4)
        
        if len(faces) == 0:
            return None, None
        
        largest_face = max(faces, key=lambda x: x[2] * x[3])
        x, y, w, h = largest_face
        
        face_center_x = x + w // 2
        face_center_y = y + h // 2
        
        frame_height, frame_width = frame.shape[:2]
        frame_center_x = frame_width // 2
        frame_center_y = frame_height // 2
        
        horizontal_movement = (face_center_x - frame_center_x) / (frame_width // 2)
        vertical_movement = (face_center_y - frame_center_y) / (frame_height // 2)
        
        face_roi_gray = gray[y:y+h, x:x+w]
        eyes = self.eye_cascade.detectMultiScale(face_roi_gray)
        
        pose = {
            'horizontal': horizontal_movement,
            'vertical': vertical_movement,
            'face_x': face_center_x,
            'face_y': face_center_y,
            'face_width': w,
            'face_height': h,
            'eyes_detected': len(eyes) >= 2
        }
        
        return largest_face, pose
    
    def detect_movement(self, pose, session_data):
        """Detect head movements and update session"""
        horizontal = pose['horizontal']
        vertical = pose['vertical']
        
        # Store current position
        session_data['face_positions'].append({
            'horizontal': horizontal,
            'vertical': vertical,
            'timestamp': time.time()
        })
        
        h_threshold = 0.2   # Horizontal movement threshold
        v_threshold = 0.15  # Vertical movement threshold
        center_threshold = 0.1
        
        # Detect movements
        movement_detected = None
        
        if abs(horizontal) < center_threshold and abs(vertical) < center_threshold:
            movement_detected = 'center'
            session_data['movements']['center'] = True
        elif horizontal > h_threshold:
            movement_detected = 'right'
            session_data['movements']['right'] = True
        elif horizontal < -h_threshold:
            movement_detected = 'left'
            session_data['movements']['left'] = True
        elif vertical < -v_threshold:
            movement_detected = 'up'
            session_data['movements']['up'] = True
        elif vertical > v_threshold:
            movement_detected = 'down'
            session_data['movements']['down'] = True
        
        if movement_detected:
            session_data['movement_history'].append({
                'movement': movement_detected,
                'timestamp': time.time(),
                'pose': pose
            })
        
        return movement_detected
    
    def check_verification_complete(self, session_data):
        """Check if all required movements are completed"""
        movements = session_data['movements']
        required_movements = ['left', 'right', 'up', 'center']
        
        completed_movements = sum(1 for move in required_movements if movements[move])
        total_required = len(required_movements)
        
        min_frames = 45  
        min_face_detection_rate = 0.6  
        face_detection_rate = (session_data['face_detected_frames'] / 
                             max(session_data['total_frames'], 1))
        
        if (completed_movements >= 3 and 
            session_data['total_frames'] >= min_frames and
            face_detection_rate >= min_face_detection_rate):
            
            session_data['verification_complete'] = True
            session_data['is_verified'] = True
            
        return session_data['verification_complete']
    
    def process_frame(self, session_id, image_data):
        """Process a single frame for face verification"""
        if session_id not in self.sessions:
            return {'error': 'Invalid session ID'}
        
        session_data = self.sessions[session_id]
        session_data['total_frames'] += 1
        
        try:
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            
            img_bytes = base64.b64decode(image_data)
            nparr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is None:
                return {'error': 'Could not decode image'}
            
            response = {
                'face_detected': False,
                'movement_detected': None,
                'movements_completed': session_data['movements'].copy(),
                'verification_complete': False,
                'is_verified': False,
                'progress': 0
            }
            
            face, pose = self.detect_face_and_pose(frame)
            
            if face is not None and pose is not None:
                session_data['face_detected_frames'] += 1
                response['face_detected'] = True
                
                movement = self.detect_movement(pose, session_data)
                response['movement_detected'] = movement
                
                verification_complete = self.check_verification_complete(session_data)
                response['verification_complete'] = verification_complete
                response['is_verified'] = session_data['is_verified']
                
                completed_movements = sum(1 for move in ['left', 'right', 'up', 'center'] 
                                        if session_data['movements'][move])
                response['progress'] = min(100, (completed_movements / 4) * 100)
            
            return response
            
        except Exception as e:
            return {'error': f'Processing failed: {str(e)}'}
    
    def get_session_status(self, session_id):
        """Get current session status"""
        if session_id not in self.sessions:
            return {'error': 'Invalid session ID'}
        
        session_data = self.sessions[session_id]
        return {
            'session_id': session_id,
            'movements_completed': session_data['movements'],
            'verification_complete': session_data['verification_complete'],
            'is_verified': session_data['is_verified'],
            'total_frames': session_data['total_frames'],
            'face_detected_frames': session_data['face_detected_frames'],
            'elapsed_time': time.time() - session_data['start_time']
        }

verifier = SimpleFaceKYCVerifier()

@app.route('/')
def index():
    """Serve the main page"""
    return render_template('index.html')

@app.route('/api/start-verification', methods=['POST'])
def start_verification():
    """Start a new face verification session"""
    try:
        session_id = verifier.create_session()
        return jsonify({
            'success': True,
            'session_id': session_id,
            'message': 'Verification session started'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/process-frame', methods=['POST'])
def process_frame():
    """Process a frame for face verification"""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        image_data = data.get('image')
        
        if not session_id or not image_data:
            return jsonify({
                'success': False,
                'error': 'Missing session_id or image data'
            }), 400
        
        result = verifier.process_frame(session_id, image_data)
        
        if 'error' in result:
            return jsonify({
                'success': False,
                'error': result['error']
            }), 400
        
        return jsonify({
            'success': True,
            'data': result
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/session-status/<session_id>', methods=['GET'])
def get_session_status(session_id):
    """Get session status"""
    try:
        status = verifier.get_session_status(session_id)
        
        if 'error' in status:
            return jsonify({
                'success': False,
                'error': status['error']
            }), 400
        
        return jsonify({
            'success': True,
            'data': status
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    print("🚀 Starting Face KYC Verification Server...")
    print("📍 Server will be available at: http://localhost:5000")
    print("📋 Instructions:")
    print("   - Open http://localhost:5000 in your browser")
    print("   - Allow camera access when prompted")
    print("   - Follow the head movement instructions")
    print("   - Press Ctrl+C to stop the server")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5000)