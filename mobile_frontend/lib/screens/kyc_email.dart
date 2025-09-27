import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import '../theme.dart';
import '../services/kyc_cache_service.dart';

class EmailKycScreen extends StatefulWidget {
  const EmailKycScreen({super.key});

  @override
  State<EmailKycScreen> createState() => _EmailKycScreenState();
}

class _EmailKycScreenState extends State<EmailKycScreen> {
  final KycCacheService _cacheService = KycCacheService();
  String _email = '';
  String _otp = '';
  bool _isOtpSent = false;
  bool _isVerified = false;
  bool _isLoading = false;
  int _resendTimer = 0;

  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _otpController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  bool _isValidEmail(String email) {
    return RegExp(
      r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
    ).hasMatch(email);
  }

  void _startResendTimer() {
    setState(() {
      _resendTimer = 60;
    });

    Future.doWhile(() async {
      await Future.delayed(const Duration(seconds: 1));
      if (mounted) {
        setState(() {
          _resendTimer--;
        });
        return _resendTimer > 0;
      }
      return false;
    });
  }

  Future<void> _sendOtp() async {
    if (!_isValidEmail(_email.trim())) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("⚠️ Please enter a valid email address"),
          ),
        );
      }
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final baseUrl = dotenv.env['API_BASE_URL'] ?? "http://127.0.0.1:8000";
      final url = Uri.parse(
        "$baseUrl/verify/email/send_otp?email=${_email.trim()}",
      );

      var response = await http.post(url);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);

        setState(() {
          _isOtpSent = true;
        });

        _startResendTimer();

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(data["msg"] ?? "OTP sent to your email"),
              backgroundColor: AppTheme.success,
            ),
          );

          // If demo mode, show OTP in debug
          if (data["otp"] != null) {
            print("Demo OTP: ${data["otp"]}");
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text("Demo Mode - OTP: ${data["otp"]}"),
                backgroundColor: AppTheme.info,
                duration: const Duration(seconds: 5),
              ),
            );
          }
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text("❌ Failed to send OTP. Try again.")),
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

  Future<void> _verifyOtp() async {
    if (_otp.trim().length != 6) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("⚠️ Please enter 6-digit OTP")),
        );
      }
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final baseUrl = dotenv.env['API_BASE_URL'] ?? "http://127.0.0.1:8000";
      final url = Uri.parse(
        "$baseUrl/verify/email/verify_otp?email=${_email.trim()}&otp=${_otp.trim()}",
      );

      var response = await http.post(url);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        bool verified = data["verified"] ?? false;

        setState(() {
          _isVerified = verified;
        });

        if (verified) {
          // Update cache with email and mark as verified
          await _cacheService.updateField('email', _emailController.text);
          await _cacheService.markDocumentVerified('email');
        }

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                verified
                    ? "✅ Email Verified Successfully!"
                    : "❌ Email Verification Failed!",
              ),
              backgroundColor: verified ? AppTheme.success : AppTheme.error,
            ),
          );
        }
      } else {
        if (mounted) {
          final errorData = jsonDecode(response.body);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                "❌ ${errorData['detail'] ?? 'Verification failed'}",
              ),
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

  Future<void> _submitEmail() async {
    if (!_isVerified) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("⚠️ Please verify your email first")),
        );
      }
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final baseUrl = dotenv.env['API_BASE_URL'] ?? "http://127.0.0.1:8000";
      final url = Uri.parse("$baseUrl/submit/email?email=${_email.trim()}");

      var response = await http.post(url);

      if (response.statusCode == 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text("🎉 All KYC Verifications Completed Successfully!"),
              backgroundColor: AppTheme.success,
            ),
          );

          Future.delayed(const Duration(seconds: 2), () {
            if (mounted) {
              Navigator.pushNamedAndRemoveUntil(context, '/', (route) => false);
            }
          });
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(const SnackBar(content: Text("❌ Submission Failed!")));
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
        title: const Text("Email Verification"),
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
                        "Email Address",
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _emailController,
                        onChanged: (value) {
                          setState(() {
                            _email = value;
                            _isOtpSent = false;
                            _isVerified = false;
                            _otpController.clear();
                          });
                        },
                        decoration: InputDecoration(
                          hintText: "Enter your email address",
                          prefixIcon: Icon(
                            Icons.email,
                            color: AppTheme.primaryColor,
                          ),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                        keyboardType: TextInputType.emailAddress,
                        enabled: !_isOtpSent,
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 20),

              if (!_isOtpSent) ...[
                ElevatedButton.icon(
                  onPressed: _isLoading ? null : _sendOtp,
                  icon: const Icon(Icons.send),
                  label: const Text("Send OTP"),
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size(double.infinity, 50),
                  ),
                ),
              ] else ...[
                Card(
                  elevation: 2,
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.security, color: AppTheme.primaryColor),
                            const SizedBox(width: 8),
                            Text(
                              "Enter OTP",
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.textPrimary,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _otpController,
                          onChanged: (value) {
                            setState(() {
                              _otp = value;
                              _isVerified = false;
                            });
                          },
                          decoration: InputDecoration(
                            hintText: "Enter 6-digit OTP",
                            prefixIcon: Icon(
                              Icons.lock,
                              color: AppTheme.primaryColor,
                            ),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                          keyboardType: TextInputType.number,
                          maxLength: 6,
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 16),

                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: _isLoading ? null : _verifyOtp,
                        icon: const Icon(Icons.verified_user),
                        label: const Text("Verify OTP"),
                        style: ElevatedButton.styleFrom(
                          backgroundColor:
                              _isVerified ? AppTheme.success : AppTheme.warning,
                          foregroundColor: AppTheme.onPrimary,
                          minimumSize: const Size(0, 50),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    ElevatedButton(
                      onPressed:
                          (_resendTimer > 0 || _isLoading) ? null : _sendOtp,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.secondary,
                        foregroundColor: AppTheme.onPrimary,
                        minimumSize: const Size(100, 50),
                      ),
                      child: Text(
                        _resendTimer > 0 ? "Resend ($_resendTimer)" : "Resend",
                      ),
                    ),
                  ],
                ),
              ],

              if (_isVerified) ...[
                const SizedBox(height: 20),
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
                          "Email verified successfully! You can now complete your KYC.",
                          style: TextStyle(
                            color: AppTheme.success,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 20),

                ElevatedButton.icon(
                  onPressed: _isLoading ? null : _submitEmail,
                  icon: const Icon(Icons.done_all),
                  label: const Text("Complete KYC"),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.success,
                    foregroundColor: AppTheme.onPrimary,
                    minimumSize: const Size(double.infinity, 56),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ],

              if (_isLoading) ...[
                const SizedBox(height: 20),
                Center(
                  child: CircularProgressIndicator(
                    color: AppTheme.primaryColor,
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
