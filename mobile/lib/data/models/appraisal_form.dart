/// Mirrors `src/lib/supabase/performance-appraisal-types.ts`.
/// Kept intentionally simple: each section is stored as JSONB on the row.

const List<String> kCoreCompetencies = [
  'Communication & Interpersonal Skills',
  'Quality & Accuracy of Work',
  'Planning, Organization & Time Management',
  'Customer Focus (Internal / External)',
  'Problem-Solving & Decision Making',
  'Teamwork & Collaboration',
  'Adaptability & Resilience',
  'Initiative & Ownership',
];

const List<String> kLeadershipCompetencies = [
  'People Development & Coaching',
  'Strategic Thinking & Vision',
  'Delegation & Empowerment',
  'Performance Management of Team',
  'Stakeholder Management & Influence',
  'Change Management & Innovation',
];

const List<String> kValuesCompetencies = [
  'Integrity & Ethics',
  'Respect & Inclusion',
  'Commitment to Excellence',
  'Accountability & Responsibility',
];

const Map<int, String> kRatingLabels = {
  5: 'Outstanding',
  4: 'Exceeds Expectations',
  3: 'Meets Expectations',
  2: 'Needs Improvement',
  1: 'Unsatisfactory',
};

class CompetencyEntry {
  CompetencyEntry({
    this.ratingN1,
    this.ratingN2,
    this.commentsN1 = '',
    this.commentsN2 = '',
    this.evidence = '',
  });

  int? ratingN1;
  int? ratingN2;
  String commentsN1;
  String commentsN2;
  String evidence;

  Map<String, dynamic> toJson() => {
        'rating_n1': ratingN1,
        'rating_n2': ratingN2,
        'comments_n1': commentsN1,
        'comments_n2': commentsN2,
        'evidence': evidence,
      };

  factory CompetencyEntry.fromJson(Map<String, dynamic> json) {
    return CompetencyEntry(
      ratingN1: (json['rating_n1'] as num?)?.toInt(),
      ratingN2: (json['rating_n2'] as num?)?.toInt(),
      commentsN1: (json['comments_n1'] ?? '') as String,
      commentsN2: (json['comments_n2'] ?? '') as String,
      evidence: (json['evidence'] ?? '') as String,
    );
  }
}

Map<String, CompetencyEntry> parseCompetencyMap(dynamic raw, List<String> defaults) {
  final result = <String, CompetencyEntry>{};
  if (raw is Map) {
    raw.forEach((key, value) {
      if (value is Map<String, dynamic>) {
        result[key as String] = CompetencyEntry.fromJson(value);
      } else if (value is Map) {
        result[key as String] =
            CompetencyEntry.fromJson(Map<String, dynamic>.from(value));
      }
    });
  }
  for (final name in defaults) {
    result.putIfAbsent(name, CompetencyEntry.new);
  }
  return result;
}

Map<String, dynamic> dumpCompetencyMap(Map<String, CompetencyEntry> entries) {
  return entries.map((k, v) => MapEntry(k, v.toJson()));
}

class GoalRow {
  GoalRow({
    this.objective = '',
    this.kpi = '',
    this.target = '',
    this.actual = '',
    this.ratingN1,
    this.ratingN2,
    this.achievementPct = '',
  });

  String objective;
  String kpi;
  String target;
  String actual;
  int? ratingN1;
  int? ratingN2;
  String achievementPct;

  Map<String, dynamic> toJson() => {
        'objective': objective,
        'kpi': kpi,
        'target': target,
        'actual': actual,
        'rating_n1': ratingN1,
        'rating_n2': ratingN2,
        'achievement_pct': achievementPct,
      };

  factory GoalRow.fromJson(Map<String, dynamic> json) {
    return GoalRow(
      objective: (json['objective'] ?? '') as String,
      kpi: (json['kpi'] ?? '') as String,
      target: (json['target'] ?? '') as String,
      actual: (json['actual'] ?? '') as String,
      ratingN1: (json['rating_n1'] as num?)?.toInt(),
      ratingN2: (json['rating_n2'] as num?)?.toInt(),
      achievementPct: (json['achievement_pct'] ?? '') as String,
    );
  }
}

List<GoalRow> parseGoals(dynamic raw) {
  if (raw is List) {
    return raw
        .whereType<Map>()
        .map((m) => GoalRow.fromJson(Map<String, dynamic>.from(m)))
        .toList();
  }
  return [GoalRow(), GoalRow(), GoalRow()];
}
