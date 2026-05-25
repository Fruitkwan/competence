import 'appraisal_form.dart';

class PerformanceAppraisal {
  PerformanceAppraisal({
    required this.id,
    required this.employeeId,
    this.managerId,
    this.cycleId,
    this.department,
    this.appraisalPeriod,
    this.appraisalType,
    required this.status,
    required this.goals,
    required this.coreCompetencies,
    required this.leadership,
    this.leadershipApplicable = true,
    required this.valuesCulture,
    this.feedbackN1 = const <String, dynamic>{},
    this.feedbackN2 = const <String, dynamic>{},
    this.developmentPlan = const <Map<String, dynamic>>[],
    this.nextPeriodGoals = const <Map<String, dynamic>>[],
    this.finalRating,
    this.calibratedRating,
    this.calibrationRationale,
    this.overallLabel,
    this.recommendedAction,
    this.employeeComments,
    this.employeeSignedAt,
    this.managerSignedAt,
    this.hrSignedAt,
    this.hrRepresentative,
    required this.createdAt,
    required this.updatedAt,
    this.employeeName,
  });

  final String id;
  final String employeeId;
  final String? managerId;
  final String? cycleId;
  final String? department;
  final String? appraisalPeriod;
  final String? appraisalType;
  final String status;

  final List<GoalRow> goals;
  final Map<String, CompetencyEntry> coreCompetencies;
  final Map<String, CompetencyEntry> leadership;
  final bool leadershipApplicable;
  final Map<String, CompetencyEntry> valuesCulture;

  final Map<String, dynamic> feedbackN1;
  final Map<String, dynamic> feedbackN2;
  final List<Map<String, dynamic>> developmentPlan;
  final List<Map<String, dynamic>> nextPeriodGoals;

  final int? finalRating;
  final int? calibratedRating;
  final String? calibrationRationale;
  final String? overallLabel;
  final String? recommendedAction;

  final String? employeeComments;
  final DateTime? employeeSignedAt;
  final DateTime? managerSignedAt;
  final DateTime? hrSignedAt;
  final String? hrRepresentative;

  final DateTime createdAt;
  final DateTime updatedAt;
  final String? employeeName;

  factory PerformanceAppraisal.fromJson(Map<String, dynamic> json) {
    Map<String, dynamic> asMap(dynamic v) =>
        v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
    List<Map<String, dynamic>> asListOfMaps(dynamic v) {
      if (v is List) {
        return v
            .whereType<Map>()
            .map((m) => Map<String, dynamic>.from(m))
            .toList();
      }
      return const <Map<String, dynamic>>[];
    }

    return PerformanceAppraisal(
      id: json['id'] as String,
      employeeId: json['employee_id'] as String,
      managerId: json['manager_id'] as String?,
      cycleId: json['cycle_id'] as String?,
      department: json['department'] as String?,
      appraisalPeriod: json['appraisal_period'] as String?,
      appraisalType: json['appraisal_type'] as String?,
      status: (json['status'] ?? 'Draft') as String,
      goals: parseGoals(json['goals']),
      coreCompetencies:
          parseCompetencyMap(json['core_competencies'], kCoreCompetencies),
      leadership:
          parseCompetencyMap(json['leadership'], kLeadershipCompetencies),
      leadershipApplicable: (json['leadership_applicable'] ?? true) as bool,
      valuesCulture:
          parseCompetencyMap(json['values_culture'], kValuesCompetencies),
      feedbackN1: asMap(json['feedback_n1']),
      feedbackN2: asMap(json['feedback_n2']),
      developmentPlan: asListOfMaps(json['development_plan']),
      nextPeriodGoals: asListOfMaps(json['next_period_goals']),
      finalRating: (json['final_rating'] as num?)?.toInt(),
      calibratedRating: (json['calibrated_rating'] as num?)?.toInt(),
      calibrationRationale: json['calibration_rationale'] as String?,
      overallLabel: json['overall_label'] as String?,
      recommendedAction: json['recommended_action'] as String?,
      employeeComments: json['employee_comments'] as String?,
      employeeSignedAt: json['employee_signed_at'] != null
          ? DateTime.tryParse(json['employee_signed_at'] as String)
          : null,
      managerSignedAt: json['manager_signed_at'] != null
          ? DateTime.tryParse(json['manager_signed_at'] as String)
          : null,
      hrSignedAt: json['hr_signed_at'] != null
          ? DateTime.tryParse(json['hr_signed_at'] as String)
          : null,
      hrRepresentative: json['hr_representative'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
      employeeName: json['employee_name'] as String?,
    );
  }
}
