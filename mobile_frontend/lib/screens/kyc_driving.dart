import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:http/http.dart' as http;
import 'dart:io';
import 'dart:convert';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import '../theme.dart';

class DrivingLicenseKycScreen extends StatefulWidget {
  const DrivingLicenseKycScreen({super.key});

  @override
  State<DrivingLicenseKycScreen> createState() =>
      _DrivingLicenseKycScreenState();
}

class _DrivingLicenseKycScreenState extends State<DrivingLicenseKycScreen> {
  String? _fileName;
  File? _selectedFile;
  bool _isVerified = false;
  bool _isLoading = false;

  Future<void> _pickFile() async {
    FilePickerResult? result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf'],
    );

    if (result != null && result.files.single.path != null) {
      setState(() {
        _fileName = result.files.single.name;
        _selectedFile = File(result.files.single.path!);
        _isVerified = false;
      });
    }
  }

  Future<void> _verifyFile() async {
    if (_selectedFile == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Please upload Driving License PDF first"),
        ),
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final baseUrl = dotenv.env['API_BASE_URL'] ?? "";
      final url = Uri.parse("$baseUrl/verify-license");

      var request = http.MultipartRequest('POST', url);
      request.files.add(
        await http.MultipartFile.fromPath('license_pdf', _selectedFile!.path),
      );

      var response = await request.send();
      var responseData = await http.Response.fromStream(response);

      if (response.statusCode == 200) {
        final data = jsonDecode(responseData.body);
        bool verified = data["verified"] ?? false;

        setState(() {
          _isVerified = verified;
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              verified
                  ? "Driving License PDF Verified Successfully!"
                  : "Driving License Verification Failed!",
            ),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Server Error. Try again.")),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text("Error: $e")));
    }

    setState(() {
      _isLoading = false;
    });
  }

  Future<void> _submitFile() async {
    if (_selectedFile == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Please upload Driving License PDF first"),
        ),
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final baseUrl = dotenv.env['API_BASE_URL'] ?? "";
      final url = Uri.parse("$baseUrl/submit-license");

      var request = http.MultipartRequest('POST', url);
      request.files.add(
        await http.MultipartFile.fromPath('license_pdf', _selectedFile!.path),
      );

      var response = await request.send();

      if (response.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("🎉 All KYC Verifications Completed Successfully!"),
          ),
        );

        Future.delayed(const Duration(seconds: 2), () {
          Navigator.pushNamedAndRemoveUntil(context, '/', (route) => false);
        });
      } else {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text("Submission Failed!")));
      }
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text("Error: $e")));
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Driving License KYC"),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: AppTheme.onPrimary,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ElevatedButton.icon(
                onPressed: _isLoading ? null : _pickFile,
                icon: const Icon(Icons.upload_file),
                label: const Text("Upload Driving License PDF"),
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 50),
                ),
              ),
              const SizedBox(height: 20),

              if (_fileName != null)
                Text(
                  "📄 Selected File: $_fileName",
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                  ),
                  textAlign: TextAlign.center,
                ),

              const SizedBox(height: 40),

              ElevatedButton(
                onPressed:
                    _isLoading
                        ? null
                        : (_isVerified ? _submitFile : _verifyFile),
                style: ElevatedButton.styleFrom(
                  backgroundColor:
                      _isVerified ? AppTheme.success : AppTheme.warning,
                  foregroundColor: AppTheme.onPrimary,
                  minimumSize: const Size(double.infinity, 50),
                ),
                child:
                    _isLoading
                        ? CircularProgressIndicator(color: AppTheme.onPrimary)
                        : Text(_isVerified ? "Submit" : "Verify"),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
