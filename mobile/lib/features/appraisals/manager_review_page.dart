import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/error_handler.dart';
import '../../data/models/appraisal_form.dart';
import '../../data/models/performance_appraisal.dart';
import '../../data/repositories/appraisal_repository.dart';
import '../../shared/widgets/async_value_view.dart';
import 'widgets/competency_rating_card.dart';

const _kRecommendedActions = [
  'Outstanding Bonus',
  'Merit Increase',
  'Promotion Review',
  'Development Plan',
  'PIP',
];

class ManagerReviewPage extends ConsumerStatefulWidget {
  const ManagerReviewPage({super.key, required this.appraisalId});
  final String appraisalId;

  @override
  ConsumerState<ManagerReviewPage> createState() => _ManagerReviewPageState();
}

class _ManagerReviewPageState extends ConsumerState<ManagerReviewPage> {
  late final TextEditingController _topAchievements;
  late final TextEditingController _challenges;
  late final TextEditingController _supportProvided;
  late final TextEditingController _careerRecommendation;
  late final TextEditingController _overall;
  late final TextEditingController _overallLabel;

  Map<String, CompetencyEntry> _core = {};
  Map<String, CompetencyEntry> _leadership = {};
  Map<String, CompetencyEntry> _values = {};
  List<GoalRow> _goals = [];
  int? _finalRating;
  String? _recommendedAction;
  bool _saving = false;
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    _topAchievements = TextEditingController();
    _challenges = TextEditingController();
    _supportProvided = TextEditingController();
    _careerRecommendation = TextEditingController();
    _overall = TextEditingController();
    _overallLabel = TextEditingController();
  }

  @override
  void dispose() {
    _topAchievements.dispose();
    _challenges.dispose();
    _supportProvided.dispose();
    _careerRecommendation.dispose();
    _overall.dispose();
    _overallLabel.dispose();
    super.dispose();
  }

  void _hydrate(PerformanceAppraisal a) {
    if (_initialized) return;
    _initialized = true;
    _core = a.coreCompetencies;
    _leadership = a.leadership;
    _values = a.valuesCulture;
    _goals = a.goals;
    _finalRating = a.finalRating;
    _recommendedAction = a.recommendedAction;
    _overallLabel.text = a.overallLabel ?? '';
    _topAchievements.text = (a.feedbackN2['top_achievements'] ?? '') as String;
    _challenges.text = (a.feedbackN2['challenges'] ?? '') as String;
    _supportProvided.text = (a.feedbackN2['support_provided'] ?? '') as String;
    _careerRecommendation.text =
        (a.feedbackN2['career_recommendation'] ?? '') as String;
    _overall.text = (a.feedbackN2['overall_assessment'] ?? '') as String;
  }

  Map<String, dynamic> _feedback() => {
        'top_achievements': _topAchievements.text,
        'challenges': _challenges.text,
        'support_provided': _supportProvided.text,
        'career_recommendation': _careerRecommendation.text,
        'overall_assessment': _overall.text,
      };

  Future<void> _save({required bool markComplete}) async {
    setState(() => _saving = true);
    try {
      await ref.read(appraisalRepositoryProvider).saveManagerReview(
            id: widget.appraisalId,
            coreCompetencies: _core,
            leadership: _leadership,
            valuesCulture: _values,
            feedbackN2: _feedback(),
            goals: _goals,
            finalRating: _finalRating,
            overallLabel: _overallLabel.text.trim().isEmpty
                ? null
                : _overallLabel.text.trim(),
            recommendedAction: _recommendedAction,
            markComplete: markComplete,
          );
      if (!mounted) return;
      ref.invalidate(appraisalByIdProvider(widget.appraisalId));
      ref.invalidate(allAppraisalsProvider);
      showSuccessSnack(
        context,
        markComplete ? 'Review submitted to HR.' : 'Saved.',
      );
      if (markComplete && mounted) context.pop();
    } catch (e) {
      if (mounted) showErrorSnack(context, e);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(appraisalByIdProvider(widget.appraisalId));
    return Scaffold(
      appBar: AppBar(title: const Text('Manager review')),
      body: AsyncValueView<PerformanceAppraisal?>(
        value: async,
        data: (a) {
          if (a == null) {
            return const EmptyState(
              icon: Icons.error_outline,
              message: 'Appraisal not found.',
            );
          }
          _hydrate(a);
          final readOnly = a.status == 'Final' || a.status == 'Archived';

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: ListTile(
                  title: Text(a.employeeName ?? a.employeeId),
                  subtitle: Text(a.appraisalPeriod ?? ''),
                  trailing: Text(a.status),
                ),
              ),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text('Core competencies',
                    style: Theme.of(context).textTheme.titleMedium),
              ),
              for (final name in kCoreCompetencies)
                CompetencyRatingCard(
                  name: name,
                  entry: _core.putIfAbsent(name, CompetencyEntry.new),
                  field: RatingField.n2,
                  readOnly: readOnly,
                  onChanged: () => setState(() {}),
                ),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text('Leadership',
                    style: Theme.of(context).textTheme.titleMedium),
              ),
              for (final name in kLeadershipCompetencies)
                CompetencyRatingCard(
                  name: name,
                  entry: _leadership.putIfAbsent(name, CompetencyEntry.new),
                  field: RatingField.n2,
                  readOnly: readOnly,
                  onChanged: () => setState(() {}),
                ),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text('Values & culture',
                    style: Theme.of(context).textTheme.titleMedium),
              ),
              for (final name in kValuesCompetencies)
                CompetencyRatingCard(
                  name: name,
                  entry: _values.putIfAbsent(name, CompetencyEntry.new),
                  field: RatingField.n2,
                  readOnly: readOnly,
                  onChanged: () => setState(() {}),
                ),
              const SizedBox(height: 16),
              Text('Manager feedback',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              _Field(label: 'Top achievements', controller: _topAchievements, readOnly: readOnly),
              _Field(label: 'Challenges observed', controller: _challenges, readOnly: readOnly),
              _Field(label: 'Support provided', controller: _supportProvided, readOnly: readOnly),
              _Field(label: 'Career recommendation', controller: _careerRecommendation, readOnly: readOnly),
              _Field(label: 'Overall assessment', controller: _overall, readOnly: readOnly),
              const SizedBox(height: 16),
              Text('Outcome', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              Wrap(
                spacing: 4,
                children: [
                  for (var i = 1; i <= 5; i++)
                    ChoiceChip(
                      label: Text('Rating $i'),
                      selected: _finalRating == i,
                      onSelected: readOnly
                          ? null
                          : (s) =>
                              setState(() => _finalRating = s ? i : null),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              _Field(label: 'Overall label', controller: _overallLabel, readOnly: readOnly),
              const SizedBox(height: 8),
              DropdownButtonFormField<String?>(
                value: _recommendedAction,
                decoration:
                    const InputDecoration(labelText: 'Recommended action'),
                items: [
                  const DropdownMenuItem(value: null, child: Text('—')),
                  for (final a in _kRecommendedActions)
                    DropdownMenuItem(value: a, child: Text(a)),
                ],
                onChanged: readOnly
                    ? null
                    : (v) => setState(() => _recommendedAction = v),
              ),
              const SizedBox(height: 24),
              if (!readOnly) ...[
                FilledButton(
                  onPressed: _saving ? null : () => _save(markComplete: false),
                  child: const Text('Save draft'),
                ),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: _saving ? null : () => _save(markComplete: true),
                  child: const Text('Submit to HR'),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.label,
    required this.controller,
    this.readOnly = false,
  });
  final String label;
  final TextEditingController controller;
  final bool readOnly;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: TextField(
        controller: controller,
        readOnly: readOnly,
        minLines: 2,
        maxLines: 5,
        decoration: InputDecoration(labelText: label),
      ),
    );
  }
}
