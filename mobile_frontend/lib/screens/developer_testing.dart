import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/kyc_cache_service.dart';
import '../theme.dart';
import 'dart:convert';

class DeveloperTestingScreen extends StatefulWidget {
  const DeveloperTestingScreen({super.key});

  @override
  State<DeveloperTestingScreen> createState() => _DeveloperTestingScreenState();
}

class _DeveloperTestingScreenState extends State<DeveloperTestingScreen> {
  final KycCacheService _cacheService = KycCacheService();
  bool _isExpanded = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.mintGreen,
      appBar: AppBar(
        title: const Text(
          '🔧 Developer Testing',
          style: TextStyle(
            color: Colors.white,
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
        backgroundColor: AppTheme.blackOlive,
        elevation: 0,
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: () => setState(() {}),
            tooltip: 'Refresh Data',
          ),
          IconButton(
            icon: const Icon(Icons.clear_all, color: Colors.white),
            onPressed: _clearCache,
            tooltip: 'Clear Cache',
          ),
        ],
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppTheme.mintGreen, AppTheme.pistachio],
          ),
        ),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Warning Banner
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.orange.withOpacity(0.1),
                  border: Border.all(color: Colors.orange),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(Icons.warning, color: Colors.orange),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'Developer Mode: This page will be removed in production',
                        style: TextStyle(
                          color: Colors.orange,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // Quick Summary Card
              _buildSummaryCard(),

              const SizedBox(height: 16),

              // User Data Card
              _buildUserDataCard(),

              const SizedBox(height: 16),

              // Verification Status Card
              _buildVerificationStatusCard(),

              const SizedBox(height: 16),

              // Logs Card
              _buildLogsCard(),

              const SizedBox(height: 16),

              // Raw JSON Export Card
              _buildRawDataCard(),

              const SizedBox(height: 20),

              // Manual Data Entry Card
              _buildManualEntryCard(),

              const SizedBox(height: 16),

              // Action Buttons
              _buildActionButtons(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSummaryCard() {
    final summary = _cacheService.getVerificationSummary();

    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.dashboard, color: AppTheme.seaGreen),
                const SizedBox(width: 8),
                const Text(
                  'KYC Summary',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Progress bar
            Row(
              children: [
                Expanded(
                  child: LinearProgressIndicator(
                    value: (summary['completion_percentage'] as double) / 100,
                    backgroundColor: Colors.grey[300],
                    valueColor: AlwaysStoppedAnimation<Color>(
                      AppTheme.seaGreen,
                    ),
                    minHeight: 8,
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  '${(summary['completion_percentage'] as double).toStringAsFixed(1)}%',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
              ],
            ),

            const SizedBox(height: 16),

            // Status indicators
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildStatusIndicator(
                  'PAN Card',
                  summary['pan_verified'] as bool,
                  Icons.credit_card,
                ),
                _buildStatusIndicator(
                  'Passport',
                  summary['passport_verified'] as bool,
                  Icons.flight_takeoff,
                ),
                _buildStatusIndicator(
                  'Email',
                  summary['email_verified'] as bool,
                  Icons.email,
                ),
              ],
            ),

            const SizedBox(height: 12),

            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Fields: ${summary['filled_fields']}/${summary['total_fields']}',
                  style: const TextStyle(fontSize: 14, color: Colors.grey),
                ),
                Text(
                  'Complete: ${summary['is_completely_verified'] ? 'Yes' : 'No'}',
                  style: TextStyle(
                    fontSize: 14,
                    color:
                        summary['is_completely_verified'] as bool
                            ? AppTheme.seaGreen
                            : Colors.orange,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusIndicator(String label, bool isVerified, IconData icon) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: isVerified ? AppTheme.seaGreen : Colors.grey,
            shape: BoxShape.circle,
          ),
          child: Icon(
            isVerified ? Icons.check : icon,
            color: Colors.white,
            size: 20,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w500),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildUserDataCard() {
    final userData = _cacheService.userData;

    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.person, color: AppTheme.seaGreen),
                const SizedBox(width: 8),
                const Text(
                  'User Data',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 16),

            if (userData == null)
              const Text(
                'No user data available',
                style: TextStyle(color: Colors.grey),
              )
            else ...[
              _buildDataRow('Name', userData.name),
              _buildDataRow('Date of Birth', userData.dateOfBirth),
              _buildDataRow('Email', userData.email),
              _buildDataRow('Phone', userData.phone),
              _buildDataRow('Address', userData.address),
              _buildDataRow('City', userData.city),
              _buildDataRow('State', userData.state),
              _buildDataRow('Country', userData.country),
              _buildDataRow('Pincode', userData.pincode),
              _buildDataRow('Gender', userData.gender),
              _buildDataRow('Father Name', userData.fatherName),
              _buildDataRow('Mother Name', userData.motherName),
              _buildDataRow('PAN Number', userData.panNumber),
              _buildDataRow('Passport Number', userData.passportNumber),
              _buildDataRow('Nationality', userData.nationality),
              const Divider(),
              _buildDataRow(
                'Created At',
                userData.createdAt?.toIso8601String(),
              ),
              _buildDataRow(
                'Updated At',
                userData.updatedAt?.toIso8601String(),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildDataRow(String label, String? value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              '$label:',
              style: const TextStyle(
                fontWeight: FontWeight.w500,
                color: Colors.grey,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value?.isNotEmpty == true ? value! : 'Not provided',
              style: TextStyle(
                color: value?.isNotEmpty == true ? Colors.black : Colors.grey,
                fontStyle:
                    value?.isNotEmpty == true
                        ? FontStyle.normal
                        : FontStyle.italic,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVerificationStatusCard() {
    final userData = _cacheService.userData;

    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.verified, color: AppTheme.seaGreen),
                const SizedBox(width: 8),
                const Text(
                  'Verification Status',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 16),

            if (userData == null)
              const Text(
                'No verification data available',
                style: TextStyle(color: Colors.grey),
              )
            else ...[
              _buildVerificationRow('PAN Card', userData.isPanVerified),
              _buildVerificationRow('Passport', userData.isPassportVerified),
              _buildVerificationRow('Email', userData.isEmailVerified),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildVerificationRow(String document, bool isVerified) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(
            isVerified ? Icons.check_circle : Icons.cancel,
            color: isVerified ? AppTheme.seaGreen : Colors.red,
            size: 20,
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(document, style: const TextStyle(fontSize: 16))),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: isVerified ? AppTheme.seaGreen : Colors.red,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              isVerified ? 'Verified' : 'Pending',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLogsCard() {
    final logs = _cacheService.verificationLogs;

    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.history, color: AppTheme.seaGreen),
                const SizedBox(width: 8),
                const Text(
                  'Activity Logs',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const Spacer(),
                Text(
                  '${logs.length} entries',
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ],
            ),
            const SizedBox(height: 16),

            if (logs.isEmpty)
              const Text(
                'No activity logs available',
                style: TextStyle(color: Colors.grey),
              )
            else
              Container(
                height: 200,
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.black87,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: ListView.builder(
                  itemCount: logs.length,
                  itemBuilder: (context, index) {
                    final log =
                        logs[logs.length - 1 - index]; // Show latest first
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      child: Text(
                        log,
                        style: const TextStyle(
                          color: Colors.greenAccent,
                          fontSize: 12,
                          fontFamily: 'monospace',
                        ),
                      ),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildRawDataCard() {
    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.code, color: AppTheme.seaGreen),
                const SizedBox(width: 8),
                const Text(
                  'Raw JSON Data',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const Spacer(),
                IconButton(
                  icon: Icon(
                    _isExpanded ? Icons.expand_less : Icons.expand_more,
                  ),
                  onPressed: () => setState(() => _isExpanded = !_isExpanded),
                ),
              ],
            ),

            if (_isExpanded) ...[
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.grey[100],
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.grey[300]!),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        TextButton.icon(
                          onPressed: _copyToClipboard,
                          icon: const Icon(Icons.copy, size: 16),
                          label: const Text('Copy JSON'),
                        ),
                      ],
                    ),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: SelectableText(
                        _getFormattedJson(),
                        style: const TextStyle(
                          fontSize: 12,
                          fontFamily: 'monospace',
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
    );
  }

  Widget _buildManualEntryCard() {
    final fieldController = TextEditingController();
    final valueController = TextEditingController();

    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.edit, color: AppTheme.seaGreen),
                const SizedBox(width: 8),
                const Text(
                  'Manual Data Entry',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 16),

            Row(
              children: [
                Expanded(
                  flex: 2,
                  child: TextField(
                    controller: fieldController,
                    decoration: InputDecoration(
                      labelText: 'Field Name',
                      hintText: 'e.g., name, email, phone',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                      isDense: true,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 3,
                  child: TextField(
                    controller: valueController,
                    decoration: InputDecoration(
                      labelText: 'Value',
                      hintText: 'Enter value',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                      isDense: true,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                ElevatedButton(
                  onPressed: () {
                    if (fieldController.text.isNotEmpty &&
                        valueController.text.isNotEmpty) {
                      _cacheService.updateField(
                        fieldController.text,
                        valueController.text,
                      );
                      fieldController.clear();
                      valueController.clear();
                      setState(() {});
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('Updated ${fieldController.text}'),
                          backgroundColor: AppTheme.seaGreen,
                        ),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.seaGreen,
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('Add'),
                ),
              ],
            ),

            const SizedBox(height: 12),

            Text(
              'Quick Presets:',
              style: TextStyle(
                fontWeight: FontWeight.w500,
                color: Colors.grey[600],
              ),
            ),
            const SizedBox(height: 8),

            Wrap(
              spacing: 8,
              children: [
                _buildPresetButton('Sample User', () {
                  _cacheService.updateField('name', 'John Doe');
                  _cacheService.updateField('email', 'john.doe@example.com');
                  _cacheService.updateField('phone', '+1234567890');
                  _cacheService.updateField('address', '123 Main St, City');
                  _cacheService.updateField('dateofbirth', '1990-01-01');
                  _cacheService.updateField('gender', 'Male');
                  setState(() {});
                }),
                _buildPresetButton('Clear All', () {
                  _cacheService.clearAllData();
                  setState(() {});
                }),
                _buildPresetButton('Mock Verifications', () {
                  _cacheService.markDocumentVerified('pan');
                  _cacheService.markDocumentVerified('passport');
                  setState(() {});
                }),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPresetButton(String label, VoidCallback onPressed) {
    return ElevatedButton(
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: AppTheme.pistachio,
        foregroundColor: Colors.black87,
        textStyle: const TextStyle(fontSize: 12),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      ),
      child: Text(label),
    );
  }

  Widget _buildActionButtons() {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: ElevatedButton.icon(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.arrow_back),
                label: const Text('Back to Dashboard'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.seaGreen,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton.icon(
                onPressed: _exportData,
                icon: const Icon(Icons.download),
                label: const Text('Export Data'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.emerald,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: _clearCache,
            icon: const Icon(Icons.delete_forever),
            label: const Text('Clear All Cache Data'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 12),
            ),
          ),
        ),
      ],
    );
  }

  void _clearCache() {
    showDialog(
      context: context,
      builder:
          (context) => AlertDialog(
            title: const Text('Clear Cache'),
            content: const Text(
              'Are you sure you want to clear all cached KYC data? This action cannot be undone.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: () {
                  _cacheService.clearAllData();
                  Navigator.of(context).pop();
                  setState(() {});
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Cache cleared successfully'),
                      backgroundColor: Colors.green,
                    ),
                  );
                },
                child: const Text('Clear', style: TextStyle(color: Colors.red)),
              ),
            ],
          ),
    );
  }

  void _copyToClipboard() {
    Clipboard.setData(ClipboardData(text: _getFormattedJson()));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('JSON data copied to clipboard'),
        backgroundColor: Colors.green,
      ),
    );
  }

  void _exportData() {
    // For mobile, we'll just copy to clipboard and show a message
    final data = _cacheService.exportData();
    final jsonString = const JsonEncoder.withIndent('  ').convert(data);

    Clipboard.setData(ClipboardData(text: jsonString));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Full data exported to clipboard'),
        backgroundColor: Colors.green,
        duration: Duration(seconds: 3),
      ),
    );
  }

  String _getFormattedJson() {
    try {
      final data = _cacheService.exportData();
      return const JsonEncoder.withIndent('  ').convert(data);
    } catch (e) {
      return 'Error formatting JSON: $e';
    }
  }
}
