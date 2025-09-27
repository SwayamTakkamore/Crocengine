import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import '../theme.dart';
import '../services/kyc_cache_service.dart';
import 'dart:io';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as path;
import 'package:flutter_dotenv/flutter_dotenv.dart';

class KycPassportScreen extends StatefulWidget {
  const KycPassportScreen({super.key});

  @override
  State<KycPassportScreen> createState() => _KycPassportScreenState();
}

class _KycPassportScreenState extends State<KycPassportScreen> {
  final _formKey = GlobalKey<FormState>();
  final _passportController = TextEditingController();
  final _nationalityController = TextEditingController();
  final KycCacheService _cacheService = KycCacheService();

  File? _selectedFile;
  Uint8List? _fileBytes;
  String? _fileName;
  bool _isVerified = false;
  bool _isLoading = false;
  String? _extractedInfo;
  CameraController? _cameraController;
  List<CameraDescription>? _cameras;

  @override
  void initState() {
    super.initState();

    // Pre-populate from cached data
    final cachedData = _cacheService.userData;
    if (cachedData != null) {
      _passportController.text = cachedData.passportNumber ?? '';
      _nationalityController.text = cachedData.nationality ?? '';
    }
  }

  @override
  void dispose() {
    _passportController.dispose();
    _nationalityController.dispose();
    super.dispose();
  }

  Future<void> _capturePhoto() async {
    try {
      // Get available cameras
      _cameras = await availableCameras();

      if (_cameras == null || _cameras!.isEmpty) {
        if (mounted) {
          _showError('No camera available');
        }
        return;
      }

      // Initialize camera controller
      _cameraController = CameraController(
        _cameras!.first,
        ResolutionPreset.high,
        enableAudio: false,
      );

      await _cameraController!.initialize();

      if (!mounted) return;

      // Navigate to camera screen
      final String? imagePath = await Navigator.push<String>(
        context,
        MaterialPageRoute(
          builder:
              (context) =>
                  _PassportCameraScreen(cameraController: _cameraController!),
        ),
      );

      if (imagePath != null) {
        setState(() {
          _fileName = path.basename(imagePath);
          _selectedFile = File(imagePath);
          _fileBytes = null; // We'll use the file path instead
          _isVerified = false;
          _extractedInfo = null;
        });
      }
    } catch (e) {
      if (mounted) {
        _showError('Camera error: $e');
      }
    } finally {
      _cameraController?.dispose();
      _cameraController = null;
    }
  }

  Future<void> _verifyPassport() async {
    if (_fileBytes == null && _selectedFile == null) {
      _showError('Please capture a passport image first');
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final baseUrl = dotenv.env['API_BASE_URL'] ?? "http://127.0.0.1:8000";
      var request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/verify/passport'),
      );

      if (_fileBytes != null) {
        request.files.add(
          http.MultipartFile.fromBytes(
            'passport_image',
            _fileBytes!,
            filename: _fileName ?? 'passport.jpg',
          ),
        );
      } else if (_selectedFile != null) {
        request.files.add(
          await http.MultipartFile.fromPath(
            'passport_image',
            _selectedFile!.path,
          ),
        );
      }

      var response = await request.send();
      var responseData = await response.stream.bytesToString();
      var jsonData = json.decode(responseData);

      if (response.statusCode == 200) {
        setState(() {
          _isVerified = jsonData['verified'] ?? false;

          if (jsonData['extracted_info'] != null) {
            var info = jsonData['extracted_info'];
            _extractedInfo = '''
              Extracted Information:
              • Full Name: ${info['full_name'] ?? 'N/A'}
              • Country: ${info['country'] ?? 'N/A'}
              • Nationality: ${info['nationality'] ?? 'N/A'}
              • Date of Birth: ${info['date_of_birth'] ?? 'N/A'}
              • Expiry Date: ${info['expiry_date'] ?? 'N/A'}
              • Sex: ${info['sex'] ?? 'N/A'}
            ''';

            // Auto-fill fields from extracted data
            _passportController.text =
                info['passport_number'] ?? _passportController.text;
            _nationalityController.text =
                info['nationality'] ?? _nationalityController.text;

            // Update cache with extracted name if available
            if (info['full_name'] != null &&
                info['full_name'].toString().isNotEmpty) {
              _cacheService.updateField('name', info['full_name']);
            }
            if (info['date_of_birth'] != null &&
                info['date_of_birth'].toString().isNotEmpty) {
              _cacheService.updateField('dateofbirth', info['date_of_birth']);
            }
            if (info['nationality'] != null &&
                info['nationality'].toString().isNotEmpty) {
              _cacheService.updateField('nationality', info['nationality']);
            }
            if (info['country'] != null &&
                info['country'].toString().isNotEmpty) {
              _cacheService.updateField('country', info['country']);
            }
          }
        });

        if (_isVerified) {
          _showSuccess('Passport verified successfully!');
          // Mark as verified in cache
          await _cacheService.markDocumentVerified('passport');
        } else {
          _showError(
            'Passport verification failed. Please try with a clearer image.',
          );
        }
      } else {
        _showError(
          'Verification failed: ${jsonData['detail'] ?? 'Unknown error'}',
        );
      }
    } catch (e) {
      _showError('Network error: $e');
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _submitPassport() async {
    if (!_formKey.currentState!.validate()) return;
    if (!_isVerified) {
      _showError('Please verify the passport first');
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      // Update cache with form data
      await _cacheService.updateField('passport', _passportController.text);
      await _cacheService.updateField(
        'nationality',
        _nationalityController.text,
      );

      // Submit to backend
      final baseUrl = dotenv.env['API_BASE_URL'] ?? "http://127.0.0.1:8000";
      var response = await http.post(
        Uri.parse('$baseUrl/submit/passport'),
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: {'passport_number': _passportController.text},
      );

      print("Passport Submission Response - Status: ${response.statusCode}");
      print("Passport Submission Response - Body: ${response.body}");

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        _showSuccess(data['msg'] ?? 'Passport information submitted successfully!');

        // Cache the successful submission
        await _cacheService.markDocumentVerified('passport');

        // Navigate to next screen (Email verification)
        if (mounted) {
          Navigator.of(context).pushReplacementNamed('/kyc-email');
        }
      } else {
        print("Passport Submission Error - Status: ${response.statusCode}");
        print("Response body: ${response.body}");
        _showError('Failed to submit passport information (${response.statusCode})');
      }
    } catch (e) {
      _showError('Network error: $e');
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
        duration: const Duration(seconds: 3),
      ),
    );
  }

  void _showSuccess(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppTheme.seaGreen,
        duration: const Duration(seconds: 3),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.mintGreen,
      appBar: AppBar(
        title: const Text(
          'Passport Verification',
          style: TextStyle(
            color: Colors.white,
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
        backgroundColor: AppTheme.blackOlive,
        elevation: 0,
        centerTitle: true,
      ),
      body: Stack(
        children: [
          // Background gradient
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [AppTheme.mintGreen, AppTheme.pistachio],
              ),
            ),
          ),

          // Main content
          SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Progress indicator
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.1),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.flight_takeoff, color: AppTheme.seaGreen),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Text(
                            'Step 2 of 3: Passport Verification',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Instructions
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppTheme.seaGreen.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: AppTheme.seaGreen.withOpacity(0.3),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text(
                          'Instructions:',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        SizedBox(height: 8),
                        Text(
                          '• Upload a clear image of your passport\'s data page\n'
                          '• Ensure the MRZ (Machine Readable Zone) is visible\n'
                          '• Make sure the image is well-lit and not blurry\n'
                          '• Supported formats: JPG, PNG, PDF',
                          style: TextStyle(fontSize: 14),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // File upload section
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.1),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Upload Passport Image',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Camera capture button
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: _isLoading ? null : _capturePhoto,
                            icon: const Icon(Icons.camera_alt),
                            label: Text(_fileName ?? 'Capture Passport Image'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.seaGreen,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                          ),
                        ),

                        if (_fileName != null) ...[
                          const SizedBox(height: 12),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppTheme.pistachio.withOpacity(0.3),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.check_circle,
                                  color: AppTheme.seaGreen,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'Selected: $_fileName',
                                    style: const TextStyle(fontSize: 14),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],

                        if (_fileName != null) ...[
                          const SizedBox(height: 16),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: _isLoading ? null : _verifyPassport,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppTheme.blackOlive,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 16,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(8),
                                ),
                              ),
                              child:
                                  _isLoading
                                      ? const SizedBox(
                                        height: 20,
                                        width: 20,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          valueColor:
                                              AlwaysStoppedAnimation<Color>(
                                                Colors.white,
                                              ),
                                        ),
                                      )
                                      : const Text(
                                        'Verify Passport',
                                        style: TextStyle(fontSize: 16),
                                      ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),

                  if (_extractedInfo != null) ...[
                    const SizedBox(height: 20),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color:
                            _isVerified
                                ? AppTheme.seaGreen.withOpacity(0.1)
                                : Colors.red.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: _isVerified ? AppTheme.seaGreen : Colors.red,
                          width: 2,
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(
                                _isVerified ? Icons.check_circle : Icons.error,
                                color:
                                    _isVerified
                                        ? AppTheme.seaGreen
                                        : Colors.red,
                              ),
                              const SizedBox(width: 8),
                              Text(
                                _isVerified
                                    ? 'Verification Successful'
                                    : 'Verification Failed',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color:
                                      _isVerified
                                          ? AppTheme.seaGreen
                                          : Colors.red,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Text(
                            _extractedInfo!,
                            style: const TextStyle(
                              fontSize: 14,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  if (_isVerified) ...[
                    const SizedBox(height: 24),

                    // Form fields
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.1),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Passport Details',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 16),

                          TextFormField(
                            controller: _passportController,
                            decoration: InputDecoration(
                              labelText: 'Passport Number',
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide: BorderSide(
                                  color: AppTheme.seaGreen,
                                  width: 2,
                                ),
                              ),
                              prefixIcon: Icon(
                                Icons.credit_card,
                                color: AppTheme.seaGreen,
                              ),
                            ),
                            validator: (value) {
                              if (value == null || value.isEmpty) {
                                return 'Please enter passport number';
                              }
                              return null;
                            },
                          ),

                          const SizedBox(height: 16),

                          TextFormField(
                            controller: _nationalityController,
                            decoration: InputDecoration(
                              labelText: 'Nationality',
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide: BorderSide(
                                  color: AppTheme.seaGreen,
                                  width: 2,
                                ),
                              ),
                              prefixIcon: Icon(
                                Icons.flag,
                                color: AppTheme.seaGreen,
                              ),
                            ),
                            validator: (value) {
                              if (value == null || value.isEmpty) {
                                return 'Please enter nationality';
                              }
                              return null;
                            },
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 24),

                    // Submit button
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _submitPassport,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.emerald,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 18),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          elevation: 2,
                        ),
                        child:
                            _isLoading
                                ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor: AlwaysStoppedAnimation<Color>(
                                      Colors.white,
                                    ),
                                  ),
                                )
                                : const Text(
                                  'Continue to Email Verification →',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),

          // Loading overlay
          if (_isLoading)
            Container(
              color: Colors.black.withOpacity(0.3),
              child: Center(
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircularProgressIndicator(
                        valueColor: AlwaysStoppedAnimation<Color>(
                          AppTheme.seaGreen,
                        ),
                        strokeWidth: 3,
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Processing passport...',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _PassportCameraScreen extends StatefulWidget {
  final CameraController cameraController;

  const _PassportCameraScreen({required this.cameraController});

  @override
  State<_PassportCameraScreen> createState() => _PassportCameraScreenState();
}

class _PassportCameraScreenState extends State<_PassportCameraScreen> {
  bool _isCapturing = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Capture Passport"),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: AppTheme.onPrimary,
      ),
      body: Column(
        children: [
          Expanded(child: CameraPreview(widget.cameraController)),
          Container(
            padding: const EdgeInsets.all(20),
            color: Colors.black87,
            child: Column(
              children: [
                // Instructions
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    "📖 Position passport flat with MRZ (machine readable zone) clearly visible",
                    style: TextStyle(color: Colors.white, fontSize: 12),
                    textAlign: TextAlign.center,
                  ),
                ),
                // Camera controls
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    // Cancel button
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(
                        Icons.close,
                        color: Colors.white,
                        size: 30,
                      ),
                    ),
                    // Capture button
                    GestureDetector(
                      onTap: _isCapturing ? null : _captureImage,
                      child: Container(
                        width: 70,
                        height: 70,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 3),
                          color: _isCapturing ? Colors.grey : Colors.white,
                        ),
                        child:
                            _isCapturing
                                ? const CircularProgressIndicator(
                                  color: Colors.black,
                                )
                                : const Icon(
                                  Icons.camera_alt,
                                  color: Colors.black,
                                  size: 30,
                                ),
                      ),
                    ),
                    // Info button
                    IconButton(
                      onPressed: _showCaptureInstructions,
                      icon: const Icon(
                        Icons.info_outline,
                        color: Colors.white,
                        size: 30,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _captureImage() async {
    if (_isCapturing) return;

    setState(() {
      _isCapturing = true;
    });

    try {
      final XFile image = await widget.cameraController.takePicture();

      // Move image to permanent location
      final Directory appDir = await getApplicationDocumentsDirectory();
      final String fileName =
          'passport_${DateTime.now().millisecondsSinceEpoch}.jpg';
      final String permanentPath = path.join(appDir.path, fileName);

      await File(image.path).copy(permanentPath);

      if (mounted) {
        Navigator.pop(context, permanentPath);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text("⚠️ Error capturing image: $e")));
      }
    } finally {
      if (mounted) {
        setState(() {
          _isCapturing = false;
        });
      }
    }
  }

  void _showCaptureInstructions() {
    showDialog(
      context: context,
      builder:
          (context) => AlertDialog(
            title: const Text("📖 Passport Capture Guide"),
            content: const Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("For best MRZ extraction:"),
                SizedBox(height: 10),
                Text("• Place passport on flat surface"),
                Text("• Ensure good lighting, avoid shadows"),
                Text("• Keep passport completely flat"),
                Text("• Make sure MRZ lines at bottom are clear"),
                Text("• Avoid glare on the passport"),
                Text("• Fill the frame with the passport"),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text("Got it!"),
              ),
            ],
          ),
    );
  }
}
