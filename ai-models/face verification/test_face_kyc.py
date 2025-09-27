import requests
import json
import time
import cv2
import base64

class FaceKYCTestClient:
    def __init__(self, api_url="http://localhost:5000"):
        self.api_url = api_url
        self.session_id = None
    
    def start_verification(self):
        """Start a new verification session"""
        try:
            response = requests.post(f"{self.api_url}/api/start-verification")
            result = response.json()
            
            if result['success']:
                self.session_id = result['session_id']
                print(f"✅ Verification session started: {self.session_id}")
                return True
            else:
                print(f"❌ Failed to start session: {result.get('error', 'Unknown error')}")
                return False
        except Exception as e:
            print(f"❌ Error starting verification: {str(e)}")
            return False
    
    def encode_frame(self, frame):
        """Encode frame to base64"""
        _, buffer = cv2.imencode('.jpg', frame)
        jpg_as_text = base64.b64encode(buffer).decode('utf-8')
        return f"data:image/jpeg;base64,{jpg_as_text}"
    
    def process_frame(self, frame):
        """Process a single frame"""
        if not self.session_id:
            print("❌ No active session. Start verification first.")
            return None
        
        try:
            image_data = self.encode_frame(frame)
            
            response = requests.post(
                f"{self.api_url}/api/process-frame",
                json={
                    'session_id': self.session_id,
                    'image': image_data
                }
            )
            
            result = response.json()
            if result['success']:
                return result['data']
            else:
                print(f"❌ Frame processing error: {result.get('error', 'Unknown error')}")
                return None
        except Exception as e:
            print(f"❌ Error processing frame: {str(e)}")
            return None
    
    def get_session_status(self):
        """Get current session status"""
        if not self.session_id:
            print("❌ No active session")
            return None
        
        try:
            response = requests.get(f"{self.api_url}/api/session-status/{self.session_id}")
            result = response.json()
            
            if result['success']:
                return result['data']
            else:
                print(f"❌ Status error: {result.get('error', 'Unknown error')}")
                return None
        except Exception as e:
            print(f"❌ Error getting status: {str(e)}")
            return None
    
    def run_live_test(self):
        """Run live test with camera feed"""
        print("🎥 Starting live face verification test...")
        print("📋 Instructions:")
        print("   - Look straight at the camera")
        print("   - Slowly turn your head left")
        print("   - Slowly turn your head right")
        print("   - Look up")
        print("   - Press 'q' to quit\n")
        
        if not self.start_verification():
            return
        
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            print("❌ Could not open camera")
            return
        
        frame_count = 0
        last_instruction = ""
        
        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    print("❌ Failed to read frame")
                    break
                
                if frame_count % 5 == 0:
                    result = self.process_frame(frame)
                    
                    if result:
                        self.update_display(frame, result)
                        
                        instruction = self.get_current_instruction(result)
                        if instruction != last_instruction:
                            print(f"📍 {instruction}")
                            last_instruction = instruction
                        
                        if result.get('verification_complete'):
                            if result.get('is_verified'):
                                print("\n🎉 VERIFICATION SUCCESSFUL! ✅")
                                print("You have been verified as a real human.")
                            else:
                                print("\n❌ VERIFICATION FAILED")
                                print("Please try again.")
                            break
                
                cv2.imshow('Face KYC Verification', frame)
                
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
                
                frame_count += 1
                
        except KeyboardInterrupt:
            print("\n🛑 Test interrupted by user")
        finally:
            cap.release()
            cv2.destroyAllWindows()
            print("🎥 Camera released")
    
    def update_display(self, frame, result):
        """Update frame display with verification info"""
        if result.get('face_detected'):
            color = (0, 255, 0)  # Green
            text = "Face Detected ✓"
        else:
            color = (0, 0, 255)  # Red
            text = "No Face Detected"
        
        cv2.putText(frame, text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
        
        movements = result.get('movements_completed', {})
        y_offset = 60
        
        for movement, completed in movements.items():
            if movement in ['center', 'left', 'right', 'up']:
                color = (0, 255, 0) if completed else (0, 0, 255)
                status = "✓" if completed else "✗"
                text = f"{movement.upper()}: {status}"
                cv2.putText(frame, text, (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
                y_offset += 30
        
        progress = result.get('progress', 0)
        cv2.putText(frame, f"Progress: {progress:.0f}%", (10, y_offset + 20), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
    
    def get_current_instruction(self, result):
        """Get current instruction text"""
        if result.get('verification_complete'):
            return "Verification completed! 🎉"
        
        if not result.get('face_detected'):
            return "Please position your face in front of the camera"
        
        movements = result.get('movements_completed', {})
        
        if not movements.get('center'):
            return "Look straight at the camera"
        elif not movements.get('left'):
            return "Slowly turn your head to the left ⬅️"
        elif not movements.get('right'):
            return "Slowly turn your head to the right ➡️"
        elif not movements.get('up'):
            return "Look up ⬆️"
        else:
            return "Great! Almost done..."
    
    def test_api_endpoints(self):
        """Test API endpoints without camera"""
        print("🧪 Testing API endpoints...")
        
        try:
            response = requests.get(f"{self.api_url}/health")
            if response.status_code == 200:
                print("✅ Health check passed")
            else:
                print("❌ Health check failed")
        except:
            print("❌ Could not reach server")
            return False
        
        if self.start_verification():
            print("✅ Start verification endpoint working")
        else:
            print("❌ Start verification endpoint failed")
            return False
        
        status = self.get_session_status()
        if status:
            print("✅ Session status endpoint working")
            print(f"   Session ID: {status.get('session_id')}")
            print(f"   Total frames: {status.get('total_frames')}")
        else:
            print("❌ Session status endpoint failed")
        
        return True

def main():
    """Main test function"""
    client = FaceKYCTestClient()
    
    print("🚀 Face KYC API Test Client")
    print("=" * 40)
    
    while True:
        print("\nSelect test option:")
        print("1. Test API endpoints")
        print("2. Run live camera test")
        print("3. Exit")
        
        choice = input("\nEnter your choice (1-3): ").strip()
        
        if choice == '1':
            client.test_api_endpoints()
        elif choice == '2':
            client.run_live_test()
        elif choice == '3':
            print("👋 Goodbye!")
            break
        else:
            print("❌ Invalid choice. Please enter 1, 2, or 3.")

if __name__ == "__main__":
    main()