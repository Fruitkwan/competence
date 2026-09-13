class Course {
  Course({
    required this.id,
    required this.title,
    this.develops,
    this.clusterFit = const <String>[],
    this.link,
    this.active = true,
  });

  final String id;
  final String title;
  final String? develops;
  final List<String> clusterFit;
  final String? link;
  final bool active;

  factory Course.fromJson(Map<String, dynamic> json) {
    return Course(
      id: json['id'] as String,
      title: json['title'] as String,
      develops: json['develops'] as String?,
      clusterFit: (json['cluster_fit'] as List?)?.cast<String>() ?? const [],
      link: json['link'] as String?,
      active: (json['active'] ?? true) as bool,
    );
  }
}

class EmployeeCourse {
  EmployeeCourse({
    required this.id,
    required this.employeeId,
    required this.courseId,
    required this.status,
    required this.enrolledAt,
    this.startedAt,
    this.completedAt,
    this.score,
    this.certificateUrl,
    this.notes,
    this.course,
  });

  final String id;
  final String employeeId;
  final String courseId;
  final String status;
  final DateTime enrolledAt;
  final DateTime? startedAt;
  final DateTime? completedAt;
  final double? score;
  final String? certificateUrl;
  final String? notes;
  final Course? course;

  factory EmployeeCourse.fromJson(Map<String, dynamic> json) {
    final courseJson = json['courses'] ?? json['course'];
    return EmployeeCourse(
      id: json['id'] as String,
      employeeId: json['employee_id'] as String,
      courseId: json['course_id'] as String,
      status: (json['status'] ?? 'Enrolled') as String,
      enrolledAt: DateTime.parse(json['enrolled_at'] as String),
      startedAt: json['started_at'] != null
          ? DateTime.tryParse(json['started_at'] as String)
          : null,
      completedAt: json['completed_at'] != null
          ? DateTime.tryParse(json['completed_at'] as String)
          : null,
      score: (json['score'] as num?)?.toDouble(),
      certificateUrl: json['certificate_url'] as String?,
      notes: json['notes'] as String?,
      course: courseJson is Map
          ? Course.fromJson(Map<String, dynamic>.from(courseJson))
          : null,
    );
  }
}
