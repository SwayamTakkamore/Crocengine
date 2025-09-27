import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:http/http.dart' as http;
import 'dart:io';
import 'dart:convert';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as path;
import '../theme.dart';
import '../services/kyc_cache_service.dart';

class PanKycScreen extends StatefulWidget {
  const PanKycScreen({super.key});

  @override
  State<PanKycScreen> createState() => _PanKycScreenState();
}

class _PanKycScreenState extends State<PanKycScreen> {
  final KycCacheService _cacheService = KycCacheService();
  String? _fileName;
  File? _selectedFile;
  String _panNumber = '';
  bool _isVerified = false;
  bool _isLoading = false;
  final TextEditingController _panController = TextEditingController();
  CameraController? _cameraController;
  List<CameraDescription>? _cameras;

  @override
  void initState() {
    super.initState();
    _loadCachedData();
  }

  @override
  void dispose() {
    _panController.dispose();
    super.dispose();
  }

  void _loadCachedData() {
    final userData = _cacheService.userData;
    if (userData != null) {
      if (userData.panNumber != null && userData.panNumber!.isNotEmpty) {
        _panController.text = userData.panNumber!;
        _panNumber = userData.panNumber!;
      }
      _isVerified = userData.isPanVerified;
      setState(() {});
    }
  }

  Future<void> _capturePhoto() async {
    try {
      // Get available cameras
      _cameras = await availableCameras();

      if (_cameras == null || _cameras!.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text("⚠️ No camera available")),
          );
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
              (context) => _CameraScreen(cameraController: _cameraController!),
        ),
      );

      if (imagePath != null) {
        setState(() {
          _fileName = path.basename(imagePath);
          _selectedFile = File(imagePath);
          _isVerified = false;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text("⚠️ Camera error: $e")));
      }
    } finally {
      _cameraController?.dispose();
      _cameraController = null;
    }
  }

  Future<void> _verifyPan() async {
    if (_selectedFile == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("⚠️ Please capture PAN card image first"),
          ),
        );
      }
      return;
    }

    if (_panNumber.trim().isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("⚠️ Please enter PAN number")),
        );
      }
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final baseUrl = dotenv.env['API_BASE_URL'] ?? "http://127.0.0.1:8000";
      final url = Uri.parse("$baseUrl/verify/pan_debug");

      print("Making PAN verification request to: $url");
      print("PAN Number: ${_panNumber.trim().toUpperCase()}");

      var request = http.MultipartRequest('POST', url);
      request.files.add(
        await http.MultipartFile.fromPath('pan_image', _selectedFile!.path),
      );
      request.fields['pan_number'] = _panNumber.trim().toUpperCase();

      var response = await request.send();
      var responseData = await http.Response.fromStream(response);

      if (response.statusCode == 200) {
        final data = jsonDecode(responseData.body);
        bool verified = data["verified"] ?? false;

        // Debug logging
        print("PAN Verification Response: $data");
        print("Verified status: $verified");

        setState(() {
          _isVerified = verified;
        });

        if (verified) {
          // Update cache with PAN number and mark as verified
          await _cacheService.updateField(
            'pan',
            _panNumber.trim().toUpperCase(),
          );
          await _cacheService.markDocumentVerified('pan');
          print("PAN cached and marked as verified");
        }

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                verified
                    ? "✅ PAN Card Verified Successfully!"
                    : "❌ PAN Card Verification Failed! Please check image quality and PAN number.",
              ),
              backgroundColor: verified ? Colors.green : Colors.red,
              duration: const Duration(seconds: 4),
            ),
          );
        }
      } else {
        print("PAN API Error - Status: ${response.statusCode}");
        print("Response body: ${responseData.body}");
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                "❌ Server Error (${response.statusCode}). Try again.",
              ),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text("⚠️ Error: $e")));
      }
    }

    if (mounted) {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _submitPan() async {
    if (_selectedFile == null || !_isVerified) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("⚠️ Please verify PAN card first")),
        );
      }
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final baseUrl = dotenv.env['API_BASE_URL'] ?? "http://127.0.0.1:8000";
      final url = Uri.parse("$baseUrl/submit-pan");

      var request = http.MultipartRequest('POST', url);
      request.files.add(
        await http.MultipartFile.fromPath('pan_image', _selectedFile!.path),
      );
      request.fields['pan_number'] = _panNumber.trim().toUpperCase();

      var response = await request.send();
      var responseData = await http.Response.fromStream(response);

      print("PAN Submission Response - Status: ${response.statusCode}");
      print("PAN Submission Response - Body: ${responseData.body}");

      if (response.statusCode == 200) {
        final data = jsonDecode(responseData.body);

        // Store PAN data in cache after successful submission
        await _cacheService.updateField('pan', _panNumber.trim().toUpperCase());
        await _cacheService.markDocumentVerified('pan');
        print("PAN submitted and cached successfully");

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                "✅ ${data['msg'] ?? 'PAN Card Submitted Successfully!'}",
              ),
              backgroundColor: Colors.green,
              duration: const Duration(seconds: 3),
            ),
          );

          Future.delayed(const Duration(seconds: 2), () {
            if (mounted) {
              Navigator.pushReplacementNamed(context, '/kyc-passport');
            }
          });
        }
      } else {
        print("PAN Submission Error - Status: ${response.statusCode}");
        print("Response body: ${responseData.body}");
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text("❌ Submission Failed! (${response.statusCode})"),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text("⚠️ Error: $e")));
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("PAN Card KYC"),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: AppTheme.onPrimary,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Card(
                elevation: 2,
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        "PAN Number",
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _panController,
                        onChanged: (value) {
                          setState(() {
                            _panNumber = value;
                            _isVerified = false;
                          });
                        },
                        decoration: InputDecoration(
                          hintText: "Enter PAN Number (e.g., ABCDE1234F)",
                          prefixIcon: Icon(
                            Icons.credit_card,
                            color: AppTheme.primaryColor,
                          ),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                        textCapitalization: TextCapitalization.characters,
                        maxLength: 10,
                      ),
                      const SizedBox(height: 12),
                      // Temporary testing button
                      if (!_isVerified) ...[
                        ElevatedButton(
                          onPressed:
                              _panNumber.trim().length == 10
                                  ? () {
                                    setState(() {
                                      _isVerified = true;
                                    });
                                    _cacheService.updateField(
                                      'pan',
                                      _panNumber.trim().toUpperCase(),
                                    );
                                    _cacheService.markDocumentVerified('pan');
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text(
                                          "✅ PAN manually verified for testing!",
                                        ),
                                        backgroundColor: Colors.orange,
                                      ),
                                    );
                                  }
                                  : null,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.orange,
                            foregroundColor: Colors.white,
                          ),
                          child: const Text("Manual Verify (Testing)"),
                        ),
                      ],
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 20),

              ElevatedButton.icon(
                onPressed: _isLoading ? null : _capturePhoto,
                icon: const Icon(Icons.camera_alt),
                label: const Text("Capture PAN Card Image"),
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 50),
                ),
              ),

              const SizedBox(height: 20),

              if (_fileName != null)
                Card(
                  elevation: 1,
                  color: AppTheme.surfaceVariant,
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Row(
                      children: [
                        Icon(Icons.image, color: AppTheme.primaryColor),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            "Selected: $_fileName",
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                              color: AppTheme.textPrimary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

              const SizedBox(height: 40),

              ElevatedButton(
                onPressed:
                    _isLoading ? null : (_isVerified ? _submitPan : _verifyPan),
                style: ElevatedButton.styleFrom(
                  backgroundColor:
                      _isVerified ? AppTheme.success : AppTheme.warning,
                  foregroundColor: AppTheme.onPrimary,
                  minimumSize: const Size(double.infinity, 56),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child:
                    _isLoading
                        ? CircularProgressIndicator(color: AppTheme.onPrimary)
                        : Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              _isVerified ? Icons.send : Icons.verified_user,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              _isVerified ? "Submit PAN" : "Verify PAN",
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
              ),

              if (_isVerified) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppTheme.success.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppTheme.success, width: 1),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.check_circle, color: AppTheme.success),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          "PAN Card verified successfully! You can now submit.",
                          style: TextStyle(
                            color: AppTheme.success,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _CameraScreen extends StatefulWidget {
  final CameraController cameraController;

  const _CameraScreen({required this.cameraController});

  @override
  State<_CameraScreen> createState() => _CameraScreenState();
}

class _CameraScreenState extends State<_CameraScreen> {
  bool _isCapturing = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Capture PAN Card"),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: AppTheme.onPrimary,
      ),
      body: Column(
        children: [
          Expanded(child: CameraPreview(widget.cameraController)),
          Container(
            padding: const EdgeInsets.all(20),
            color: Colors.black87,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                // Cancel button
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close, color: Colors.white, size: 30),
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
          'pan_${DateTime.now().millisecondsSinceEpoch}.jpg';
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
            title: const Text("📸 Capture Instructions"),
            content: const Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("For best results:"),
                SizedBox(height: 10),
                Text("• Hold your phone steady"),
                Text("• Ensure good lighting"),
                Text("• Keep PAN card flat and centered"),
                Text("• Make sure all text is clearly visible"),
                Text("• Avoid shadows and glare"),
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
