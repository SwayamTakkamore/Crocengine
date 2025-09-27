class UserKycData {
  String? name;
  String? dateOfBirth;
  String? address;
  String? pincode;
  String? city;
  String? state;
  String? country;
  String? phone;
  String? email;
  String? panNumber;
  String? passportNumber;
  String? nationality;
  String? gender;
  String? fatherName;
  String? motherName;
  DateTime? createdAt;
  DateTime? updatedAt;

  // Document verification status
  bool isPanVerified;
  bool isPassportVerified;
  bool isEmailVerified;

  UserKycData({
    this.name,
    this.dateOfBirth,
    this.address,
    this.pincode,
    this.city,
    this.state,
    this.country,
    this.phone,
    this.email,
    this.panNumber,
    this.passportNumber,
    this.nationality,
    this.gender,
    this.fatherName,
    this.motherName,
    this.createdAt,
    this.updatedAt,
    this.isPanVerified = false,
    this.isPassportVerified = false,
    this.isEmailVerified = false,
  });

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'dateOfBirth': dateOfBirth,
      'address': address,
      'pincode': pincode,
      'city': city,
      'state': state,
      'country': country,
      'phone': phone,
      'email': email,
      'panNumber': panNumber,
      'passportNumber': passportNumber,
      'nationality': nationality,
      'gender': gender,
      'fatherName': fatherName,
      'motherName': motherName,
      'createdAt': createdAt?.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
      'isPanVerified': isPanVerified,
      'isPassportVerified': isPassportVerified,
      'isEmailVerified': isEmailVerified,
    };
  }

  factory UserKycData.fromJson(Map<String, dynamic> json) {
    return UserKycData(
      name: json['name'],
      dateOfBirth: json['dateOfBirth'],
      address: json['address'],
      pincode: json['pincode'],
      city: json['city'],
      state: json['state'],
      country: json['country'],
      phone: json['phone'],
      email: json['email'],
      panNumber: json['panNumber'],
      passportNumber: json['passportNumber'],
      nationality: json['nationality'],
      gender: json['gender'],
      fatherName: json['fatherName'],
      motherName: json['motherName'],
      createdAt:
          json['createdAt'] != null ? DateTime.parse(json['createdAt']) : null,
      updatedAt:
          json['updatedAt'] != null ? DateTime.parse(json['updatedAt']) : null,
      isPanVerified: json['isPanVerified'] ?? false,
      isPassportVerified: json['isPassportVerified'] ?? false,
      isEmailVerified: json['isEmailVerified'] ?? false,
    );
  }

  UserKycData copyWith({
    String? name,
    String? dateOfBirth,
    String? address,
    String? pincode,
    String? city,
    String? state,
    String? country,
    String? phone,
    String? email,
    String? panNumber,
    String? passportNumber,
    String? nationality,
    String? gender,
    String? fatherName,
    String? motherName,
    DateTime? createdAt,
    DateTime? updatedAt,
    bool? isPanVerified,
    bool? isPassportVerified,
    bool? isEmailVerified,
  }) {
    return UserKycData(
      name: name ?? this.name,
      dateOfBirth: dateOfBirth ?? this.dateOfBirth,
      address: address ?? this.address,
      pincode: pincode ?? this.pincode,
      city: city ?? this.city,
      state: state ?? this.state,
      country: country ?? this.country,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      panNumber: panNumber ?? this.panNumber,
      passportNumber: passportNumber ?? this.passportNumber,
      nationality: nationality ?? this.nationality,
      gender: gender ?? this.gender,
      fatherName: fatherName ?? this.fatherName,
      motherName: motherName ?? this.motherName,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? DateTime.now(),
      isPanVerified: isPanVerified ?? this.isPanVerified,
      isPassportVerified: isPassportVerified ?? this.isPassportVerified,
      isEmailVerified: isEmailVerified ?? this.isEmailVerified,
    );
  }

  double get completionPercentage {
    int totalFields = 14; // Total important fields (removed driving license)
    int filledFields = 0;

    if (name?.isNotEmpty == true) filledFields++;
    if (dateOfBirth?.isNotEmpty == true) filledFields++;
    if (address?.isNotEmpty == true) filledFields++;
    if (pincode?.isNotEmpty == true) filledFields++;
    if (city?.isNotEmpty == true) filledFields++;
    if (state?.isNotEmpty == true) filledFields++;
    if (phone?.isNotEmpty == true) filledFields++;
    if (email?.isNotEmpty == true) filledFields++;
    if (panNumber?.isNotEmpty == true) filledFields++;
    if (passportNumber?.isNotEmpty == true) filledFields++;
    if (nationality?.isNotEmpty == true) filledFields++;
    if (gender?.isNotEmpty == true) filledFields++;
    if (fatherName?.isNotEmpty == true) filledFields++;
    if (motherName?.isNotEmpty == true) filledFields++;

    return (filledFields / totalFields) * 100;
  }

  bool get isCompletelyVerified {
    return isPanVerified && isPassportVerified && isEmailVerified;
  }
}
