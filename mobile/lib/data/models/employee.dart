class Employee {
  Employee({
    required this.employeeId,
    required this.fullName,
    required this.jobTitle,
    this.countryCode,
    this.managerName,
    this.email,
    this.userId,
    this.active = true,
    this.grade,
    this.gradeBand,
    this.joiningDate,
  });

  final String employeeId;
  final String fullName;
  final String jobTitle;
  final String? countryCode;
  final String? managerName;
  final String? email;
  final String? userId;
  final bool active;
  final String? grade;
  final String? gradeBand;
  final DateTime? joiningDate;

  factory Employee.fromJson(Map<String, dynamic> json) {
    return Employee(
      employeeId: json['employee_id'] as String,
      fullName: json['full_name'] as String,
      jobTitle: json['job_title'] as String,
      countryCode: json['country_code'] as String?,
      managerName: json['manager_name'] as String?,
      email: json['email'] as String?,
      userId: json['user_id'] as String?,
      active: (json['active'] ?? true) as bool,
      grade: json['grade'] as String?,
      gradeBand: json['grade_band'] as String?,
      joiningDate: json['joining_date'] != null
          ? DateTime.tryParse(json['joining_date'] as String)
          : null,
    );
  }
}
