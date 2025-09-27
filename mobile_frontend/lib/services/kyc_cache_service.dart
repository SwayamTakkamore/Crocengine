import '../models/user_kyc_data.dart';

class KycCacheService {
  static final KycCacheService _instance = KycCacheService._internal();
  factory KycCacheService() => _instance;
  KycCacheService._internal();

  // In-memory storage (will persist during app session)
  UserKycData? _cachedData;
  final List<String> _verificationLog = [];

  // Initialize with empty data
  void initialize() {
    _cachedData ??= UserKycData(
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );
  }

  // Get current user data
  UserKycData? get userData => _cachedData;

  // Update user data
  Future<void> updateUserData(UserKycData newData) async {
    _cachedData = newData.copyWith(updatedAt: DateTime.now());
    _addLog("User data updated");
  }

  // Update specific fields
  Future<void> updateField(String field, String value) async {
    if (_cachedData == null) initialize();

    switch (field.toLowerCase()) {
      case 'name':
        _cachedData = _cachedData!.copyWith(name: value);
        break;
      case 'dateofbirth':
      case 'dob':
        _cachedData = _cachedData!.copyWith(dateOfBirth: value);
        break;
      case 'address':
        _cachedData = _cachedData!.copyWith(address: value);
        break;
      case 'pincode':
        _cachedData = _cachedData!.copyWith(pincode: value);
        break;
      case 'city':
        _cachedData = _cachedData!.copyWith(city: value);
        break;
      case 'state':
        _cachedData = _cachedData!.copyWith(state: value);
        break;
      case 'country':
        _cachedData = _cachedData!.copyWith(country: value);
        break;
      case 'phone':
        _cachedData = _cachedData!.copyWith(phone: value);
        break;
      case 'email':
        _cachedData = _cachedData!.copyWith(email: value);
        break;
      case 'pan':
      case 'pannumber':
        _cachedData = _cachedData!.copyWith(panNumber: value);
        break;
      case 'passport':
      case 'passportnumber':
        _cachedData = _cachedData!.copyWith(passportNumber: value);
        break;
      case 'nationality':
        _cachedData = _cachedData!.copyWith(nationality: value);
        break;
      case 'gender':
        _cachedData = _cachedData!.copyWith(gender: value);
        break;
      case 'father':
      case 'fathername':
        _cachedData = _cachedData!.copyWith(fatherName: value);
        break;
      case 'mother':
      case 'mothername':
        _cachedData = _cachedData!.copyWith(motherName: value);
        break;
    }

    _addLog("Updated $field: $value");
  }

  // Mark document as verified
  Future<void> markDocumentVerified(String documentType) async {
    if (_cachedData == null) initialize();

    switch (documentType.toLowerCase()) {
      case 'pan':
        _cachedData = _cachedData!.copyWith(isPanVerified: true);
        break;
      case 'passport':
        _cachedData = _cachedData!.copyWith(isPassportVerified: true);
        break;
      case 'email':
        _cachedData = _cachedData!.copyWith(isEmailVerified: true);
        break;
    }

    _addLog("$documentType verification completed");
  }

  // Get specific field value
  String? getField(String field) {
    if (_cachedData == null) return null;

    switch (field.toLowerCase()) {
      case 'name':
        return _cachedData!.name;
      case 'dateofbirth':
      case 'dob':
        return _cachedData!.dateOfBirth;
      case 'address':
        return _cachedData!.address;
      case 'pincode':
        return _cachedData!.pincode;
      case 'city':
        return _cachedData!.city;
      case 'state':
        return _cachedData!.state;
      case 'country':
        return _cachedData!.country;
      case 'phone':
        return _cachedData!.phone;
      case 'email':
        return _cachedData!.email;
      case 'pan':
      case 'pannumber':
        return _cachedData!.panNumber;
      case 'passport':
      case 'passportnumber':
        return _cachedData!.passportNumber;
      case 'nationality':
        return _cachedData!.nationality;
      case 'gender':
        return _cachedData!.gender;
      case 'father':
      case 'fathername':
        return _cachedData!.fatherName;
      case 'mother':
      case 'mothername':
        return _cachedData!.motherName;
      default:
        return null;
    }
  }

  // Check if document is verified
  bool isDocumentVerified(String documentType) {
    if (_cachedData == null) return false;

    switch (documentType.toLowerCase()) {
      case 'pan':
        return _cachedData!.isPanVerified;
      case 'passport':
        return _cachedData!.isPassportVerified;
      case 'email':
        return _cachedData!.isEmailVerified;
      default:
        return false;
    }
  }

  // Get completion percentage
  double get completionPercentage {
    return _cachedData?.completionPercentage ?? 0.0;
  }

  // Check if all verifications are complete
  bool get isCompletelyVerified {
    return _cachedData?.isCompletelyVerified ?? false;
  }

  // Get verification summary
  Map<String, dynamic> getVerificationSummary() {
    return {
      'completion_percentage': completionPercentage,
      'is_completely_verified': isCompletelyVerified,
      'pan_verified': isDocumentVerified('pan'),
      'passport_verified': isDocumentVerified('passport'),
      'email_verified': isDocumentVerified('email'),
      'total_fields': _cachedData != null ? 14 : 0,
      'filled_fields': _getFilledFieldsCount(),
      'last_updated': _cachedData?.updatedAt?.toIso8601String(),
    };
  }

  int _getFilledFieldsCount() {
    if (_cachedData == null) return 0;

    int count = 0;
    if (_cachedData!.name?.isNotEmpty == true) count++;
    if (_cachedData!.dateOfBirth?.isNotEmpty == true) count++;
    if (_cachedData!.address?.isNotEmpty == true) count++;
    if (_cachedData!.pincode?.isNotEmpty == true) count++;
    if (_cachedData!.city?.isNotEmpty == true) count++;
    if (_cachedData!.state?.isNotEmpty == true) count++;
    if (_cachedData!.phone?.isNotEmpty == true) count++;
    if (_cachedData!.email?.isNotEmpty == true) count++;
    if (_cachedData!.panNumber?.isNotEmpty == true) count++;
    if (_cachedData!.passportNumber?.isNotEmpty == true) count++;
    if (_cachedData!.nationality?.isNotEmpty == true) count++;
    if (_cachedData!.gender?.isNotEmpty == true) count++;
    if (_cachedData!.fatherName?.isNotEmpty == true) count++;
    if (_cachedData!.motherName?.isNotEmpty == true) count++;

    return count;
  }

  // Add log entry
  void _addLog(String message) {
    _verificationLog.add("${DateTime.now().toIso8601String()}: $message");
    // Keep only last 50 log entries
    if (_verificationLog.length > 50) {
      _verificationLog.removeAt(0);
    }
  }

  // Get verification logs
  List<String> get verificationLogs => List.unmodifiable(_verificationLog);

  // Clear all data (for testing or reset)
  void clearAllData() {
    _cachedData = null;
    _verificationLog.clear();
    _addLog("All data cleared");
  }

  // Export data as JSON (for debugging)
  Map<String, dynamic> exportData() {
    return {
      'user_data': _cachedData?.toJson(),
      'verification_logs': _verificationLog,
      'summary': getVerificationSummary(),
    };
  }

  // Get data summary for display
  String getDataSummary() {
    if (_cachedData == null) return "No data available";

    StringBuffer summary = StringBuffer();
    summary.writeln("=== KYC Data Summary ===");
    summary.writeln("Name: ${_cachedData!.name ?? 'Not provided'}");
    summary.writeln("Email: ${_cachedData!.email ?? 'Not provided'}");
    summary.writeln("Phone: ${_cachedData!.phone ?? 'Not provided'}");
    summary.writeln(
      "PAN: ${_cachedData!.panNumber ?? 'Not provided'} (${_cachedData!.isPanVerified ? 'Verified' : 'Not verified'})",
    );
    summary.writeln(
      "Passport: ${_cachedData!.passportNumber ?? 'Not provided'} (${_cachedData!.isPassportVerified ? 'Verified' : 'Not verified'})",
    );
    summary.writeln(
      "Nationality: ${_cachedData!.nationality ?? 'Not provided'}",
    );
    summary.writeln("Completion: ${completionPercentage.toStringAsFixed(1)}%");
    summary.writeln(
      "Last Updated: ${_cachedData!.updatedAt?.toString() ?? 'Never'}",
    );

    return summary.toString();
  }
}
