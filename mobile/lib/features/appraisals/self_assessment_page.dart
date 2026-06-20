import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/error_handler.dart';
import '../../data/models/appraisal_form.dart';
import '../../data/models/performance_appraisal.dart';
import '../../data/repositories/appraisal_repository.dart';
import '../../shared/widgets/async_value_view.dart';
import 'widgets/competency_rating_card.dart';

class SelfAssessmentPage extends ConsumerStatefulWidget {
  const SelfAssessmentPage({super.key, required this.appraisalId});
  final String appraisalId;

  @override
  ConsumerState<SelfAssessmentPage> createState() => _SelfAssessmentPageState();
}

class _SelfAssessmentPageState extends ConsumerState<SelfAssessmentPage> {
  late TextEditingController _topAchievements;
  late TextEditingController _challenges;
  late TextEditingController _supportNeeded;
  late TextEditingController _careerAspirations;
  late TextEditingController _selfRatingRationale;

  Map<String, CompetencyEntry> _core = {};
  Map<String, CompetencyEntry> _leadership = {};
  Map<String, CompetencyEntry> _values = {};
  List<GoalRow> _goals = [];
  bool _saving = false;
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    _topAchievements = TextEditingController();
    _challenges = TextEditingController();
    _supportNeeded = TextEditingController();
    _careerAspirations = TextEditingController();
    _selfRatingRationale = TextEditingController();
  }

  @override
  void dispose() {
    _topAchievements.dispose();
    _challenges.dispose();
    _supportNeeded.dispose();
    _careerAspirations.dispose();
    _selfRatingRationale.dispose();
    super.dispose();
  }

  void _hydrate(PerformanceAppraisal a) {
    if (_initialized) return;
    _initialized = true;
    _core = a.coreCompetencies;
    _leadership = a.leadership;
    _values = a.valuesCulture;
    _goals = a.goals.isEmpty ? [GoalRow(), GoalRow(), GoalRow()] : a.goals;
    _topAchievements.text = (a.feedbackN1['top_achievements'] ?? '') as String;
    _challenges.text = (a.feedbackN1['challenges'] ?? '') as String;
    _supportNeeded.text = (a.feedbackN1['support_needed'] ?? '') as String;
    _careerAspirations.text =
        (a.feedbackN1['career_aspirations'] ?? '') as String;
    _selfRatingRationale.text =
        (a.feedbackN1['self_rating_rationale'] ?? '') as String;
  }

  Map<String, dynamic> _feedback() => {
        'top_achievements': _topAchievements.text,
        'challenges': _challenges.text,
        'support_needed': _supportNeeded.text,
        'career_aspirations': _careerAspirations.text,
        'self_rating_rationale': _selfRatingRationale.text,
      };

  Future<void> _save({required bool markComplete}) async {
    setState(() => _saving = true);
    try {
      await ref.read(appraisalRepositoryProvider).saveSelfAssessment(
            id: widget.appraisalId,
            coreCompetencies: _core,
            leadership: _leadership,
            valuesCulture: _values,
            feedbackN1: _feedback(),
            goals: _goals,
            markComplete: markComplete,
          );
      if (!mounted) return;
      ref.invalidate(appraisalByIdProvider(widget.appraisalId));
      ref.invalidate(myAppraisalsProvider);
      ref.invalidate(allAppraisalsProvider);
      showSuccessSnack(
        context,
        markComplete ? 'Self-assessment submitted.' : 'Saved.',
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
      appBar: AppBar(title: const Text('Self-assessment')),
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
          final readOnly = a.status != 'Draft';
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _SectionHeader(
                title: 'Section A · Goals & objectives',
                subtitle: 'Review assigned goals and add your N1 rating.',
              ),
              if (_goals.where(_hasGoalDetails).isEmpty)
                const Card(
                  child: ListTile(
                    leading: Icon(Icons.flag_outlined),
                    title: Text('No goals assigned yet'),
                    subtitle: Text(
                      'Your goals will appear here once they are added to the appraisal.',
                    ),
                  ),
                )
              else
                for (var i = 0; i < _goals.length; i++)
                  if (_hasGoalDetails(_goals[i]))
                    _GoalCard(
                      goal: _goals[i],
                      index: i,
                      readOnlyDetails: true,
                      readOnlyRating: readOnly,
                      onChanged: () => setState(() {}),
                    ),
              const SizedBox(height: 12),
              Card(
                child: ListTile(
                  leading: const Icon(Icons.lock_outline),
                  title: const Text('Goal details are locked'),
                  subtitle: const Text(
                    'Employees can rate their achievement, but cannot add, delete, or change appraisal goals.',
                  ),
                ),
              ),
              const SizedBox(height: 12),
              _SectionHeader(title: 'Section B · Core competencies'),
              for (final name in kCoreCompetencies)
                CompetencyRatingCard(
                  name: name,
                  entry: _core.putIfAbsent(name, CompetencyEntry.new),
                  field: RatingField.n1,
                  readOnly: readOnly,
                  onChanged: () => setState(() {}),
                ),
              const SizedBox(height: 12),
              _SectionHeader(title: 'Section C · Leadership'),
              for (final name in kLeadershipCompetencies)
                CompetencyRatingCard(
                  name: name,
                  entry: _leadership.putIfAbsent(name, CompetencyEntry.new),
                  field: RatingField.n1,
                  readOnly: readOnly,
                  onChanged: () => setState(() {}),
                ),
              const SizedBox(height: 12),
              _SectionHeader(title: 'Section D · Values & culture'),
              for (final name in kValuesCompetencies)
                CompetencyRatingCard(
                  name: name,
                  entry: _values.putIfAbsent(name, CompetencyEntry.new),
                  field: RatingField.n1,
                  readOnly: readOnly,
                  onChanged: () => setState(() {}),
                ),
              const SizedBox(height: 12),
              _SectionHeader(title: 'Section E · Open feedback'),
              _MultilineField(label: 'Top achievements', controller: _topAchievements, readOnly: readOnly),
              _MultilineField(label: 'Challenges faced', controller: _challenges, readOnly: readOnly),
              _MultilineField(label: 'Support needed', controller: _supportNeeded, readOnly: readOnly),
              _MultilineField(label: 'Career aspirations', controller: _careerAspirations, readOnly: readOnly),
              _MultilineField(
                  label: 'Self-rating rationale',
                  controller: _selfRatingRationale,
                  readOnly: readOnly),
              const SizedBox(height: 24),
              if (!readOnly) ...[
                FilledButton(
                  onPressed: _saving ? null : () => _save(markComplete: false),
                  child: const Text('Save draft'),
                ),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: _saving ? null : () => _save(markComplete: true),
                  child: const Text('Submit to manager'),
                ),
              ] else
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.lock_outline),
                    title: const Text('Self-assessment submitted'),
                    subtitle: Text('Status: ${a.status}'),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, this.subtitle});
  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          if (subtitle != null)
            Text(subtitle!, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}

bool _hasGoalDetails(GoalRow goal) {
  return goal.objective.trim().isNotEmpty ||
      goal.kpi.trim().isNotEmpty ||
      goal.target.trim().isNotEmpty;
}

class _MultilineField extends StatelessWidget {
  const _MultilineField({
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

class _GoalCard extends StatefulWidget {
  const _GoalCard({
    required this.goal,
    required this.index,
    required this.readOnlyDetails,
    required this.readOnlyRating,
    required this.onChanged,
  });
  final GoalRow goal;
  final int index;
  final bool readOnlyDetails;
  final bool readOnlyRating;
  final VoidCallback onChanged;

  @override
  State<_GoalCard> createState() => _GoalCardState();
}

class _GoalCardState extends State<_GoalCard> {
  late final TextEditingController _objective;
  late final TextEditingController _kpi;
  late final TextEditingController _target;
  late final TextEditingController _actual;
  late final TextEditingController _achievement;

  @override
  void initState() {
    super.initState();
    _objective = TextEditingController(text: widget.goal.objective);
    _kpi = TextEditingController(text: widget.goal.kpi);
    _target = TextEditingController(text: widget.goal.target);
    _actual = TextEditingController(text: widget.goal.actual);
    _achievement = TextEditingController(text: widget.goal.achievementPct);
  }

  @override
  void dispose() {
    _objective.dispose();
    _kpi.dispose();
    _target.dispose();
    _actual.dispose();
    _achievement.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Goal ${widget.index + 1}',
                style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 8),
            TextField(
              controller: _objective,
              readOnly: widget.readOnlyDetails,
              decoration: const InputDecoration(labelText: 'Objective'),
              onChanged: (v) {
                widget.goal.objective = v;
                widget.onChanged();
              },
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _kpi,
              readOnly: widget.readOnlyDetails,
              decoration: const InputDecoration(labelText: 'KPI'),
              onChanged: (v) {
                widget.goal.kpi = v;
                widget.onChanged();
              },
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _target,
                    readOnly: widget.readOnlyDetails,
                    decoration: const InputDecoration(labelText: 'Target'),
                    onChanged: (v) {
                      widget.goal.target = v;
                      widget.onChanged();
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: _actual,
                    readOnly: widget.readOnlyDetails,
                    decoration: const InputDecoration(labelText: 'Actual'),
                    onChanged: (v) {
                      widget.goal.actual = v;
                      widget.onChanged();
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _achievement,
              readOnly: widget.readOnlyDetails,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Achievement %'),
              onChanged: (v) {
                widget.goal.achievementPct = v;
                widget.onChanged();
              },
            ),
            const SizedBox(height: 8),
            _SelfRating(
              goal: widget.goal,
              readOnly: widget.readOnlyRating,
              onChanged: widget.onChanged,
            ),
          ],
        ),
      ),
    );
  }
}

class _SelfRating extends StatelessWidget {
  const _SelfRating({required this.goal, required this.readOnly, required this.onChanged});
  final GoalRow goal;
  final bool readOnly;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 4,
      children: [
        for (var i = 1; i <= 5; i++)
          ChoiceChip(
            label: Text('$i'),
            selected: goal.ratingN1 == i,
            onSelected: readOnly
                ? null
                : (s) {
                    goal.ratingN1 = s ? i : null;
                    onChanged();
                  },
          ),
      ],
    );
  }
}
