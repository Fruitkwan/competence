// Assessment models matching the JSON returned by the web app's
// /api/mobile/assessments endpoints (scores are computed server-side;
// RLS hides other raters' responses and answer keys from the client).

class AssessmentSummary {
  const AssessmentSummary({
    required this.id,
    required this.status,
    required this.resultsReleased,
    required this.createdAt,
    this.templateName,
    this.kind,
    this.roleFamily,
    this.wave,
    this.dueDate,
    this.submittedAt,
  });

  final String id;
  final String status; // assigned | in_progress | submitted | closed
  final bool resultsReleased;
  final DateTime createdAt;
  final String? templateName;
  final String? kind; // skill | behaviour
  final String? roleFamily;
  final String? wave;
  final DateTime? dueDate;
  final DateTime? submittedAt;

  factory AssessmentSummary.fromJson(Map<String, dynamic> j) {
    final template = j['template'] as Map<String, dynamic>?;
    return AssessmentSummary(
      id: j['id'] as String,
      status: j['status'] as String? ?? 'assigned',
      resultsReleased: j['results_released'] as bool? ?? false,
      createdAt: DateTime.tryParse(j['created_at'] as String? ?? '') ??
          DateTime.now(),
      templateName: template?['name'] as String?,
      kind: template?['kind'] as String?,
      roleFamily: template?['role_family'] as String?,
      wave: j['wave'] as String?,
      dueDate: DateTime.tryParse(j['due_date'] as String? ?? ''),
      submittedAt: DateTime.tryParse(j['submitted_at'] as String? ?? ''),
    );
  }
}

class ReportEmployee {
  const ReportEmployee({
    required this.employeeId,
    required this.fullName,
    required this.jobTitle,
    this.department,
    this.countryCode,
    this.managerName,
  });

  final String employeeId;
  final String fullName;
  final String jobTitle;
  final String? department;
  final String? countryCode;
  final String? managerName;

  factory ReportEmployee.fromJson(Map<String, dynamic> j) => ReportEmployee(
        employeeId: j['employee_id'] as String? ?? '',
        fullName: j['full_name'] as String? ?? '',
        jobTitle: j['job_title'] as String? ?? '',
        department: j['department'] as String?,
        countryCode: j['country_code'] as String?,
        managerName: j['manager_name'] as String?,
      );
}

class ScoreItem {
  const ScoreItem({
    required this.name,
    this.groupName,
    this.score,
    this.band,
    this.self,
    this.lineManager,
    this.othersAvg,
    this.scenarioCorrect,
    this.flag,
  });

  final String name;
  final String? groupName;
  final double? score;
  final String? band;
  final double? self;
  final double? lineManager;
  final double? othersAvg;
  final bool? scenarioCorrect;
  final String? flag;

  factory ScoreItem.fromJson(Map<String, dynamic> j) => ScoreItem(
        name: j['name'] as String? ?? '',
        groupName: j['group_name'] as String?,
        score: (j['score'] as num?)?.toDouble(),
        band: j['band'] as String?,
        self: (j['self'] as num?)?.toDouble(),
        lineManager: (j['line_manager'] as num?)?.toDouble(),
        othersAvg: (j['others_avg'] as num?)?.toDouble(),
        scenarioCorrect: j['scenario_correct'] as bool?,
        flag: j['flag'] as String?,
      );
}

class ScoreWarning {
  const ScoreWarning({
    required this.title,
    required this.detail,
    required this.items,
  });

  final String title;
  final String detail;
  final List<String> items;

  factory ScoreWarning.fromJson(Map<String, dynamic> j) => ScoreWarning(
        title: j['title'] as String? ?? '',
        detail: j['detail'] as String? ?? '',
        items: [
          for (final i in (j['items'] as List?) ?? const []) i.toString(),
        ],
      );
}

class AssessmentScore {
  const AssessmentScore({
    required this.items,
    required this.groups,
    required this.scenariosCorrect,
    required this.scenariosAnswered,
    required this.belowStandard,
    required this.materialGaps,
    required this.avgRaters,
    required this.provisional,
    required this.warnings,
    this.index,
    this.willIndex,
  });

  final List<ScoreItem> items;
  final Map<String, double?> groups;
  final int scenariosCorrect;
  final int scenariosAnswered;
  final int belowStandard;
  final int materialGaps;
  final double avgRaters;
  final bool provisional;
  final List<ScoreWarning> warnings;
  final double? index;
  final double? willIndex;

  factory AssessmentScore.fromJson(Map<String, dynamic> j) => AssessmentScore(
        items: [
          for (final i in (j['items'] as List?) ?? const [])
            ScoreItem.fromJson(i as Map<String, dynamic>),
        ],
        groups: {
          for (final e in (j['groups'] as Map?)?.entries ??
              const Iterable<MapEntry<String, dynamic>>.empty())
            e.key.toString(): (e.value as num?)?.toDouble(),
        },
        scenariosCorrect: (j['scenarios_correct'] as num?)?.toInt() ?? 0,
        scenariosAnswered: (j['scenarios_answered'] as num?)?.toInt() ?? 0,
        belowStandard: (j['below_standard'] as num?)?.toInt() ?? 0,
        materialGaps: (j['material_gaps'] as num?)?.toInt() ?? 0,
        avgRaters: (j['avg_raters'] as num?)?.toDouble() ?? 0,
        provisional: j['provisional'] as bool? ?? false,
        warnings: [
          for (final w in (j['warnings'] as List?) ?? const [])
            ScoreWarning.fromJson(w as Map<String, dynamic>),
        ],
        index: (j['index'] as num?)?.toDouble(),
        willIndex: (j['will_index'] as num?)?.toDouble(),
      );
}

class RaterStatus {
  const RaterStatus({required this.type, required this.status});

  final String type;
  final String status;

  factory RaterStatus.fromJson(Map<String, dynamic> j) => RaterStatus(
        type: j['type'] as String? ?? '',
        status: j['status'] as String? ?? '',
      );
}

/// One scored assignment inside the report (skill or behaviour kind).
class AssessmentSection {
  const AssessmentSection({
    required this.kind,
    required this.templateName,
    required this.status,
    required this.resultsReleased,
    required this.score,
    required this.raters,
    this.wave,
    this.dueDate,
  });

  final String kind;
  final String templateName;
  final String status;
  final bool resultsReleased;
  final AssessmentScore score;
  final List<RaterStatus> raters;
  final String? wave;
  final DateTime? dueDate;

  factory AssessmentSection.fromJson(Map<String, dynamic> j) {
    final template = j['template'] as Map<String, dynamic>?;
    final assignment = j['assignment'] as Map<String, dynamic>?;
    return AssessmentSection(
      kind: template?['kind'] as String? ?? '',
      templateName: template?['name'] as String? ?? 'Assessment',
      status: assignment?['status'] as String? ?? '',
      resultsReleased: assignment?['results_released'] as bool? ?? false,
      wave: assignment?['wave'] as String?,
      dueDate:
          DateTime.tryParse(assignment?['due_date'] as String? ?? ''),
      score: AssessmentScore.fromJson(
        (j['score'] as Map<String, dynamic>?) ?? const {},
      ),
      raters: [
        for (final r in (j['raters'] as List?) ?? const [])
          RaterStatus.fromJson(r as Map<String, dynamic>),
      ],
    );
  }
}

class ReportSignature {
  const ReportSignature({required this.name, required this.at});

  final String name;
  final DateTime at;

  factory ReportSignature.fromJson(Map<String, dynamic> j) => ReportSignature(
        name: j['name'] as String? ?? '',
        at: DateTime.tryParse(j['at'] as String? ?? '') ?? DateTime.now(),
      );
}

class ReportGrid {
  const ReportGrid({required this.group, required this.action});

  final String group;
  final String action;

  factory ReportGrid.fromJson(Map<String, dynamic> j) => ReportGrid(
        group: j['group'] as String? ?? '',
        action: j['action'] as String? ?? '',
      );
}

class AssessmentReport {
  const AssessmentReport({
    required this.employee,
    required this.isSelf,
    required this.assignmentId,
    required this.signatures,
    this.skill,
    this.behaviour,
    this.grid,
  });

  final ReportEmployee employee;
  final bool isSelf;
  final String assignmentId;
  final Map<String, ReportSignature> signatures;
  final AssessmentSection? skill;
  final AssessmentSection? behaviour;
  final ReportGrid? grid;

  factory AssessmentReport.fromJson(Map<String, dynamic> j) => AssessmentReport(
        employee: ReportEmployee.fromJson(
          (j['employee'] as Map<String, dynamic>?) ?? const {},
        ),
        isSelf: j['isSelf'] as bool? ?? false,
        assignmentId: j['assignmentId'] as String? ?? '',
        signatures: {
          for (final e in (j['signatures'] as Map?)?.entries ??
              const Iterable<MapEntry<String, dynamic>>.empty())
            e.key.toString():
                ReportSignature.fromJson(e.value as Map<String, dynamic>),
        },
        skill: j['skill'] == null
            ? null
            : AssessmentSection.fromJson(j['skill'] as Map<String, dynamic>),
        behaviour: j['behaviour'] == null
            ? null
            : AssessmentSection.fromJson(
                j['behaviour'] as Map<String, dynamic>,
              ),
        grid: j['grid'] == null
            ? null
            : ReportGrid.fromJson(j['grid'] as Map<String, dynamic>),

      );
}

/// A placement answer: the option the candidate chose and its point value.
class PlacementAnswer {
  const PlacementAnswer({
    required this.sortOrder,
    required this.name,
    this.chosen,
    this.points,
  });

  final int sortOrder;
  final String name;
  final String? chosen;
  final int? points;

  factory PlacementAnswer.fromJson(Map<String, dynamic> j) => PlacementAnswer(
        sortOrder: (j['sortOrder'] as num?)?.toInt() ?? 0,
        name: j['name'] as String? ?? '',
        chosen: j['chosen'] as String?,
        points: (j['points'] as num?)?.toInt(),
      );
}

class PlacementPart {
  const PlacementPart({
    required this.part,
    required this.name,
    required this.outOf,
    required this.points,
    required this.answered,
    required this.zeroItems,
    required this.answers,
  });

  final int part;
  final String name;
  final int outOf;
  final int points;
  final int answered;
  final List<String> zeroItems;
  final List<PlacementAnswer> answers;

  factory PlacementPart.fromJson(Map<String, dynamic> j) => PlacementPart(
        part: (j['part'] as num?)?.toInt() ?? 0,
        name: j['name'] as String? ?? '',
        outOf: (j['outOf'] as num?)?.toInt() ?? 0,
        points: (j['points'] as num?)?.toInt() ?? 0,
        answered: (j['answered'] as num?)?.toInt() ?? 0,
        zeroItems: [
          for (final z in (j['zeroItems'] as List?) ?? const []) z.toString(),
        ],
        answers: [
          for (final a in (j['answers'] as List?) ?? const [])
            PlacementAnswer.fromJson(a as Map<String, dynamic>),
        ],
      );
}

class PlacementOutcome {
  const PlacementOutcome({
    required this.step,
    required this.label,
    required this.reason,
    required this.pendingRecord,
  });

  final int step;
  final String label;
  final String reason;
  final bool pendingRecord;

  factory PlacementOutcome.fromJson(Map<String, dynamic> j) => PlacementOutcome(
        step: (j['step'] as num?)?.toInt() ?? 0,
        label: j['label'] as String? ?? '',
        reason: j['reason'] as String? ?? '',
        pendingRecord: j['pendingRecord'] as bool? ?? false,
      );
}

/// Report for a `placement` assignment — the /report endpoint wraps it as
/// `{placement: true, report: {...}}` so clients can tell it apart.
class PlacementReport {
  const PlacementReport({
    required this.employee,
    required this.templateName,
    required this.status,
    required this.parts,
    required this.outcome,
    required this.record,
    required this.raters,
    required this.signatures,
    required this.isSelf,
    this.wave,
    this.submittedAt,
  });

  final ReportEmployee employee;
  final String templateName;
  final String status;
  final List<PlacementPart> parts;
  final PlacementOutcome outcome;
  final Map<String, int?> record;
  final List<RaterStatus> raters;
  final Map<String, ReportSignature> signatures;
  final bool isSelf;
  final String? wave;
  final DateTime? submittedAt;

  factory PlacementReport.fromJson(Map<String, dynamic> j) {
    final template = j['template'] as Map<String, dynamic>?;
    final assignment = j['assignment'] as Map<String, dynamic>?;
    final record = j['record'] as Map<String, dynamic>?;
    return PlacementReport(
      employee: ReportEmployee.fromJson(
        (j['employee'] as Map<String, dynamic>?) ?? const {},
      ),
      templateName: template?['name'] as String? ?? 'Role placement',
      status: assignment?['status'] as String? ?? '',
      parts: [
        for (final p in (j['parts'] as List?) ?? const [])
          PlacementPart.fromJson(p as Map<String, dynamic>),
      ],
      outcome: PlacementOutcome.fromJson(
        (j['outcome'] as Map<String, dynamic>?) ?? const {},
      ),
      record: {
        'commercial': (record?['commercial'] as num?)?.toInt(),
        'account': (record?['account'] as num?)?.toInt(),
        'leadership': (record?['leadership'] as num?)?.toInt(),
      },
      raters: [
        for (final r in (j['raters'] as List?) ?? const [])
          RaterStatus.fromJson(r as Map<String, dynamic>),
      ],
      signatures: {
        for (final e in (j['signatures'] as Map?)?.entries ??
            const Iterable<MapEntry<String, dynamic>>.empty())
          e.key.toString():
              ReportSignature.fromJson(e.value as Map<String, dynamic>),
      },
      isSelf: j['isSelf'] as bool? ?? false,
      wave: assignment?['wave'] as String?,
      submittedAt:
          DateTime.tryParse(assignment?['submitted_at'] as String? ?? ''),
    );
  }
}

/// The report endpoint returns either a standard report or a placement report.
class ReportResult {
  const ReportResult({this.standard, this.placement});

  final AssessmentReport? standard;
  final PlacementReport? placement;
}
