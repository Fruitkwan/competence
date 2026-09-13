enum ObjectiveStatus {
  draft,
  submitted,
  revisionRequested,
  approved,
  rejected;

  static ObjectiveStatus fromString(String value) {
    switch (value) {
      case 'submitted':
        return ObjectiveStatus.submitted;
      case 'revision_requested':
        return ObjectiveStatus.revisionRequested;
      case 'approved':
        return ObjectiveStatus.approved;
      case 'rejected':
        return ObjectiveStatus.rejected;
      case 'draft':
      default:
        return ObjectiveStatus.draft;
    }
  }

  String get wireValue {
    switch (this) {
      case ObjectiveStatus.draft:
        return 'draft';
      case ObjectiveStatus.submitted:
        return 'submitted';
      case ObjectiveStatus.revisionRequested:
        return 'revision_requested';
      case ObjectiveStatus.approved:
        return 'approved';
      case ObjectiveStatus.rejected:
        return 'rejected';
    }
  }

  String get label {
    switch (this) {
      case ObjectiveStatus.draft:
        return 'Draft';
      case ObjectiveStatus.submitted:
        return 'Submitted';
      case ObjectiveStatus.revisionRequested:
        return 'Revision requested';
      case ObjectiveStatus.approved:
        return 'Approved';
      case ObjectiveStatus.rejected:
        return 'Rejected';
    }
  }
}

class CycleObjective {
  CycleObjective({
    required this.id,
    required this.cycleId,
    required this.employeeId,
    required this.title,
    this.description,
    this.successCriteria,
    required this.weight,
    required this.status,
    this.kpiId,
    this.approvedBy,
    this.approvedAt,
    this.employeeName,
  });

  final String id;
  final String cycleId;
  final String employeeId;
  final String title;
  final String? description;
  final String? successCriteria;
  final double weight;
  final ObjectiveStatus status;
  final String? kpiId;
  final String? approvedBy;
  final DateTime? approvedAt;
  final String? employeeName;

  factory CycleObjective.fromJson(Map<String, dynamic> json) {
    return CycleObjective(
      id: json['id'] as String,
      cycleId: json['cycle_id'] as String,
      employeeId: json['employee_id'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      successCriteria: json['success_criteria'] as String?,
      weight: (json['weight'] as num?)?.toDouble() ?? 0,
      status: ObjectiveStatus.fromString(json['status'] as String? ?? 'draft'),
      kpiId: json['kpi_id'] as String?,
      approvedBy: json['approved_by'] as String?,
      approvedAt: json['approved_at'] != null
          ? DateTime.tryParse(json['approved_at'] as String)
          : null,
      employeeName: json['employee_name'] as String?,
    );
  }
}
