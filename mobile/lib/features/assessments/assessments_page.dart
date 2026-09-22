// ignore_for_file: deprecated_member_use

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/error_handler.dart';
import '../../data/models/assessment.dart';
import '../../data/repositories/assessment_repository.dart';
import '../../shared/widgets/soft_ui.dart';
import '../../shared/widgets/status_chip.dart';

const _teal = Color(0xFF10B7B5);
const _orange = Color(0xFFF59E0B);

class AssessmentsPage extends ConsumerStatefulWidget {
  const AssessmentsPage({super.key});

  @override
  ConsumerState<AssessmentsPage> createState() => _AssessmentsPageState();
}

class _AssessmentsPageState extends ConsumerState<AssessmentsPage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _entrance;

  @override
  void initState() {
    super.initState();
    _entrance = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..forward();
  }

  @override
  void dispose() {
    _entrance.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final value = ref.watch(myAssessmentsProvider);

    return Scaffold(
      body: value.when(
        loading: () => const Padding(
          padding: EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Column(
            children: [
              SkeletonBlock(height: 72),
              SizedBox(height: 10),
              SkeletonBlock(height: 72),
              SizedBox(height: 10),
              SkeletonBlock(height: 72),
            ],
          ),
        ),
        error: (e, _) => Padding(
          padding: const EdgeInsets.all(16),
          child: ErrorCard(
            title: 'Could not load assessments',
            detail: describeError(e),
          ),
        ),
        data: (rows) {
          final pending = rows
              .where((a) => a.status == 'assigned' || a.status == 'in_progress')
              .length;
          final released = rows.where((a) => a.resultsReleased).length;
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(myAssessmentsProvider),
            child: ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              itemCount: rows.isEmpty ? 2 : rows.length + 1,
              itemBuilder: (context, i) {
                if (i == 0) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Row(
                      children: [
                        Expanded(
                          child: _SummaryTile(
                            icon: Icons.pending_actions_outlined,
                            label: 'To complete',
                            value: '$pending',
                            color: _orange,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _SummaryTile(
                            icon: Icons.fact_check_outlined,
                            label: 'Results ready',
                            value: '$released',
                            color: _teal,
                          ),
                        ),
                      ],
                    ),
                  );
                }
                if (rows.isEmpty) {
                  return const EmptyCard(
                    icon: Icons.fact_check_outlined,
                    title: 'No assessments yet',
                    body:
                        'When HR assigns you an assessment it will appear here.',
                  );
                }
                final a = rows[i - 1];
                return StaggeredEntrance(
                  controller: _entrance,
                  interval: entranceInterval(i, step: 0.04, span: 0.4),
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _AssessmentTile(assessment: a),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class _SummaryTile extends StatelessWidget {
  const _SummaryTile({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SoftCard(
      padding: const EdgeInsets.all(14),
      borderRadius: 18,
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: color.withOpacity(0.10),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 18, color: color),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AssessmentTile extends StatelessWidget {
  const _AssessmentTile({required this.assessment});

  final AssessmentSummary assessment;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final subtitle = <String>[
      if (assessment.wave != null) assessment.wave!,
      if (assessment.dueDate != null)
        'Due ${DateFormat.yMMMd().format(assessment.dueDate!)}',
    ].join(' · ');

    return SoftCard(
      onTap: () => context.go('/assessments/${assessment.id}/report'),
      leadingAccent: assessment.resultsReleased ? scheme.tertiary : null,
      padding: const EdgeInsets.fromLTRB(20, 14, 14, 14),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: scheme.primaryContainer,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              assessment.kind == 'behaviour'
                  ? Icons.groups_outlined
                  : Icons.psychology_outlined,
              color: scheme.onPrimaryContainer,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  assessment.templateName ?? 'Assessment',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle.isEmpty ? 'Assessment' : subtitle,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (assessment.resultsReleased) ...[
                  const SizedBox(height: 6),
                  Text(
                    'Results released — tap to view report',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: scheme.tertiary,
                      fontWeight: FontWeight.w600,
                      fontSize: 11,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          StatusChip(_statusLabel(assessment), tone: _toneFor(assessment)),
        ],
      ),
    );
  }
}

String _statusLabel(AssessmentSummary a) {
  switch (a.status) {
    case 'in_progress':
      return 'In progress';
    case 'submitted':
      return 'Submitted';
    case 'closed':
      return 'Closed';
    default:
      return 'Assigned';
  }
}

StatusTone _toneFor(AssessmentSummary a) {
  if (a.resultsReleased) return StatusTone.success;
  switch (a.status) {
    case 'submitted':
      return StatusTone.info;
    case 'closed':
      return StatusTone.neutral;
    case 'in_progress':
      return StatusTone.warning;
    default:
      return StatusTone.info;
  }
}
