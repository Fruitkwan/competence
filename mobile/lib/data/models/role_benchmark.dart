class JobProfile {
  JobProfile({
    required this.title,
    required this.department,
    this.rolePurpose,
    this.responsibilities = const <String>[],
    this.gradeBand,
  });

  final String title;
  final String department;
  final String? rolePurpose;
  final List<String> responsibilities;
  final String? gradeBand;

  factory JobProfile.fromJson(Map<String, dynamic> json) {
    return JobProfile(
      title: json['title'] as String,
      department: json['department'] as String,
      rolePurpose: json['role_purpose'] as String?,
      responsibilities: (json['responsibilities'] as List?)?.cast<String>() ??
          const <String>[],
      gradeBand: json['grade_band'] as String?,
    );
  }
}

class RoleCompetency {
  RoleCompetency({
    required this.roleTitle,
    required this.competencyId,
    required this.category,
    this.requiredLevel,
    required this.weight,
    this.competencyName,
  });

  final String roleTitle;
  final String competencyId;
  final String category;
  final String? requiredLevel;
  final double weight;
  final String? competencyName;

  factory RoleCompetency.fromJson(Map<String, dynamic> json) {
    final comp = json['competencies'];
    return RoleCompetency(
      roleTitle: json['role_title'] as String,
      competencyId: json['competency_id'] as String,
      category: (json['category'] ?? 'core') as String,
      requiredLevel: json['required_level'] as String?,
      weight: (json['weight'] as num?)?.toDouble() ?? 0,
      competencyName:
          comp is Map ? comp['name'] as String? : json['competency_name'] as String?,
    );
  }
}

class RoleKpiTemplate {
  RoleKpiTemplate({
    required this.id,
    required this.roleTitle,
    required this.department,
    required this.title,
    this.measure,
    this.target,
    this.reviewFrequency,
    required this.defaultWeight,
  });

  final String id;
  final String roleTitle;
  final String department;
  final String title;
  final String? measure;
  final String? target;
  final String? reviewFrequency;
  final double defaultWeight;

  factory RoleKpiTemplate.fromJson(Map<String, dynamic> json) {
    return RoleKpiTemplate(
      id: json['id'] as String,
      roleTitle: json['role_title'] as String,
      department: json['department'] as String,
      title: json['title'] as String,
      measure: json['measure'] as String?,
      target: json['target'] as String?,
      reviewFrequency: json['review_frequency'] as String?,
      defaultWeight: (json['default_weight'] as num?)?.toDouble() ?? 0,
    );
  }
}
