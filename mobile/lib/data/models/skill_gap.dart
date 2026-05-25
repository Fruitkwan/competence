class SkillGap {
  SkillGap({
    required this.id,
    this.appraisalId,
    required this.employeeId,
    this.roleTitle,
    required this.competencyName,
    required this.section,
    required this.requiredRating,
    this.actualRating,
    this.gap,
    this.severity,
    this.recommendedAction,
    required this.createdAt,
  });

  final String id;
  final String? appraisalId;
  final String employeeId;
  final String? roleTitle;
  final String competencyName;
  final String section;
  final num requiredRating;
  final num? actualRating;
  final num? gap;
  final String? severity;
  final String? recommendedAction;
  final DateTime createdAt;

  factory SkillGap.fromJson(Map<String, dynamic> json) {
    return SkillGap(
      id: json['id'] as String,
      appraisalId: json['appraisal_id'] as String?,
      employeeId: json['employee_id'] as String,
      roleTitle: json['role_title'] as String?,
      competencyName: json['competency_name'] as String,
      section: json['section'] as String,
      requiredRating: (json['required_rating'] as num?) ?? 3,
      actualRating: json['actual_rating'] as num?,
      gap: json['gap'] as num?,
      severity: json['severity'] as String?,
      recommendedAction: json['recommended_action'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }
}
