class Profile {
  Profile({
    required this.id,
    required this.email,
    this.fullName,
    required this.role,
    this.employeeId,
    this.managerId,
    this.departmentId,
    this.jobTitle,
    this.countryCode,
    this.cluster,
    this.isActive = true,
  });

  final String id;
  final String email;
  final String? fullName;
  final String role;
  final String? employeeId;
  final String? managerId;
  final String? departmentId;
  final String? jobTitle;
  final String? countryCode;
  final String? cluster;
  final bool isActive;

  factory Profile.fromJson(Map<String, dynamic> json) {
    return Profile(
      id: json['id'] as String,
      email: (json['email'] ?? '') as String,
      fullName: json['full_name'] as String?,
      role: (json['role'] ?? 'employee') as String,
      employeeId: json['employee_id'] as String?,
      managerId: json['manager_id'] as String?,
      departmentId: json['department_id'] as String?,
      jobTitle: json['job_title'] as String?,
      countryCode: json['country_code'] as String?,
      cluster: json['cluster'] as String?,
      isActive: (json['is_active'] ?? true) as bool,
    );
  }
}
