from flask import Flask, request, jsonify, render_template
import cv2
import numpy as np
import base64
import json
from datetime import datetime
import mediapipe as mp
import math
from collections import defaultdict, deque
import time

app = Flask(__name__)

mp_face_detection = mp.solutions.face_detection
mp_face_mesh = mp.solutions.face_mesh
mp_drawing = mp.solutions.drawing_utils

class FaceKYCVerifier:
    def __init__(self):
        self.face_detection = mp_face_detection.FaceDetection(
            model_selection=1, min_detection_confidence=0.5
        )
        self.face_mesh = mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
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
            'face_positions': deque(maxlen=10),    
            'verification_complete': False,
            'is_verified': False,
            'total_frames': 0,
            'face_detected_frames': 0
        }
        return session_id
    
    def get_head_pose(self, landmarks, img_width, img_height):
        """Calculate head pose from face landmarks"""
       
        nose_tip = landmarks[1]
        chin = landmarks[152]
        left_eye_corner = landmarks[33]
        right_eye_corner = landmarks[263]
        left_ear = landmarks[234]
        right_ear = landmarks[454]
        
        nose_x = nose_tip.x * img_width
        nose_y = nose_tip.y * img_height
        chin_x = chin.x * img_width
        chin_y = chin.y * img_height
        left_eye_x = left_eye_corner.x * img_width
        right_eye_x = right_eye_corner.x * img_width
        
        eye_center_x = (left_eye_x + right_eye_x) / 2
        
        horizontal_movement = (nose_x - img_width/2) / (img_width/2)
        
        vertical_movement = (nose_y - img_height/2) / (img_height/2)
        
        return {
            'horizontal': horizontal_movement,
            'vertical': vertical_movement,
            'nose_x': nose_x,
            'nose_y': nose_y
        }
    
    def detect_movement(self, pose, session_data):
        """Detect head movements and update session"""
        horizontal = pose['horizontal']
        vertical = pose['vertical']
        
        session_data['face_positions'].append({
            'horizontal': horizontal,
            'vertical': vertical,
            'timestamp': time.time()
        })
        
        h_threshold = 0.15  # Horizontal movement threshold
        v_threshold = 0.12  # Vertical movement threshold
        center_threshold = 0.08
        
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
        
        min_frames = 60  
        min_face_detection_rate = 0.7  
        
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
            
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            h, w, _ = frame.shape
            
            results = self.face_mesh.process(rgb_frame)
            
            response = {
                'face_detected': False,
                'movement_detected': None,
                'movements_completed': session_data['movements'].copy(),
                'verification_complete': False,
                'is_verified': False,
                'progress': 0
            }
            
            if results.multi_face_landmarks:
                session_data['face_detected_frames'] += 1
                response['face_detected'] = True
                
                face_landmarks = results.multi_face_landmarks[0]
                
                pose = self.get_head_pose(face_landmarks.landmark, w, h)
                
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

verifier = FaceKYCVerifier()

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
    app.run(debug=True, host='0.0.0.0', port=5000)