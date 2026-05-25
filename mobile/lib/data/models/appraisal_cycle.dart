class AppraisalCycle {
  AppraisalCycle({
    required this.id,
    required this.name,
    required this.type,
    required this.startDate,
    required this.endDate,
    required this.status,
    this.objectiveDeadline,
    this.selfAssessmentDeadline,
    this.managerAssessmentDeadline,
    this.calibrationDeadline,
  });

  final String id;
  final String name;
  final String type;
  final DateTime startDate;
  final DateTime endDate;
  final String status;
  final DateTime? objectiveDeadline;
  final DateTime? selfAssessmentDeadline;
  final DateTime? managerAssessmentDeadline;
  final DateTime? calibrationDeadline;

  bool get isOpen => status != 'closed' && status != 'draft';

  factory AppraisalCycle.fromJson(Map<String, dynamic> json) {
    DateTime? d(String key) =>
        json[key] == null ? null : DateTime.tryParse(json[key] as String);
    return AppraisalCycle(
      id: json['id'] as String,
      name: json['name'] as String,
      type: (json['type'] ?? 'annual') as String,
      startDate: DateTime.parse(json['start_date'] as String),
      endDate: DateTime.parse(json['end_date'] as String),
      status: (json['status'] ?? 'draft') as String,
      objectiveDeadline: d('objective_deadline'),
      selfAssessmentDeadline: d('self_assessment_deadline'),
      managerAssessmentDeadline: d('manager_assessment_deadline'),
      calibrationDeadline: d('calibration_deadline'),
    );
  }
}
