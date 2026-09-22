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
import 'placement_report_view.dart';

class AssessmentReportPage extends ConsumerWidget {
  const AssessmentReportPage({super.key, required this.assignmentId});

  final String assignmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final report = ref.watch(assessmentReportProvider(assignmentId));

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/assessments'),
        ),
        title: const Text('Assessment report'),
      ),
      body: report.when(
        loading: () => const Padding(
          padding: EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Column(
            children: [
              SkeletonBlock(height: 120),
              SizedBox(height: 10),
              SkeletonBlock(height: 72),
              SizedBox(height: 10),
              SkeletonBlock(height: 200),
            ],
          ),
        ),
        error: (e, _) => Padding(
          padding: const EdgeInsets.all(16),
          child: describeError(e).toLowerCase().contains('not found') ||
                  describeError(e).toLowerCase().contains('not released')
              ? const EmptyCard(
                  icon: Icons.lock_outline_rounded,
                  title: 'Results not released yet',
                  body:
                      'Your report will appear here once HR releases the results.',
                )
              : ErrorCard(
                  title: 'Could not load report',
                  detail: describeError(e),
                ),
        ),
        data: (r) => RefreshIndicator(
          onRefresh: () async =>
              ref.invalidate(assessmentReportProvider(assignmentId)),
          child: r.placement != null
              ? PlacementReportView(report: r.placement!)
              : _StandardReport(report: r.standard!),
        ),
      ),
    );
  }
}

class _StandardReport extends StatelessWidget {
  const _StandardReport({required this.report});

  final AssessmentReport report;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        _HeaderCard(report: report),
        const SizedBox(height: 12),
        _IndexRow(report: report),
        if (report.grid != null) ...[
          const SizedBox(height: 12),
          _GridCard(grid: report.grid!),
        ],
        if (report.skill != null) ...[
          const SizedBox(height: 12),
          _SectionCard(section: report.skill!, isSelf: report.isSelf),
        ],
        if (report.behaviour != null) ...[
          const SizedBox(height: 12),
          _SectionCard(section: report.behaviour!, isSelf: report.isSelf),
        ],
        const SizedBox(height: 12),
        _SignaturesCard(report: report),
      ],
    );
  }
}

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({required this.report});

  final AssessmentReport report;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final e = report.employee;
    final wave = report.skill?.wave ?? report.behaviour?.wave;
    return SoftCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  e.fullName,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const StatusChip('Confidential', tone: StatusTone.danger),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            [
              e.jobTitle,
              if (e.department != null) e.department,
              if (e.countryCode != null) e.countryCode,
            ].join(' · '),
            style: theme.textTheme.bodySmall
                ?.copyWith(color: scheme.onSurfaceVariant),
          ),
          if (wave != null) ...[
            const SizedBox(height: 8),
            Text(
              'Wave: $wave',
              style: theme.textTheme.bodySmall?.copyWith(
                color: scheme.onSurfaceVariant,
                fontSize: 11,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _IndexRow extends StatelessWidget {
  const _IndexRow({required this.report});

  final AssessmentReport report;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _IndexTile(
            label: 'Skill index',
            value: report.skill?.score.index,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _IndexTile(
            label: 'Will index',
            value: report.behaviour?.score.willIndex,
          ),
        ),
      ],
    );
  }
}

class _IndexTile extends StatelessWidget {
  const _IndexTile({required this.label, required this.value});

  final String label;
  final double? value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return SoftCard(
      padding: const EdgeInsets.all(14),
      borderRadius: 18,
      child: Column(
        children: [
          Text(
            value == null ? '—' : '${value!.round()}',
            style: theme.textTheme.headlineMedium?.copyWith(
              fontWeight: FontWeight.w800,
              color: value == null ? scheme.onSurfaceVariant : scheme.primary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: theme.textTheme.bodySmall
                ?.copyWith(color: scheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}

class _GridCard extends StatelessWidget {
  const _GridCard({required this.grid});

  final ReportGrid grid;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return SoftCard(
      leadingAccent: scheme.tertiary,
      padding: const EdgeInsets.fromLTRB(20, 14, 14, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Skill / will placement',
            style: theme.textTheme.labelLarge?.copyWith(
              color: scheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            grid.group,
            style: theme.textTheme.titleSmall
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(
            grid.action,
            style: theme.textTheme.bodySmall
                ?.copyWith(color: scheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.section, required this.isSelf});

  final AssessmentSection section;
  final bool isSelf;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final score = section.score;
    final submitted = section.raters.where((r) => r.status == 'submitted');

    return SoftCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  section.templateName,
                  style: theme.textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              if (score.provisional)
                const StatusChip('Provisional', tone: StatusTone.warning),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _StatChip(
                label: 'Index',
                value: score.index == null ? '—' : '${score.index!.round()}',
              ),
              if (score.willIndex != null)
                _StatChip(
                  label: 'Will',
                  value: '${score.willIndex!.round()}',
                ),
              if (score.scenariosAnswered > 0)
                _StatChip(
                  label: 'Scenarios',
                  value:
                      '${score.scenariosCorrect}/${score.scenariosAnswered}',
                ),
              _StatChip(
                label: 'Raters',
                value: '${submitted.length}/${section.raters.length}',
              ),
              if (score.belowStandard > 0)
                _StatChip(
                  label: 'Below std',
                  value: '${score.belowStandard}',
                  danger: true,
                ),
            ],
          ),
          for (final g in score.groups.entries)
            if (g.value != null) ...[
              const SizedBox(height: 8),
              _GroupBar(name: g.key, value: g.value!),
            ],
          if (score.warnings.isNotEmpty) ...[
            const SizedBox(height: 14),
            for (final w in score.warnings) _WarningBlock(warning: w),
          ],
          if (score.items.isNotEmpty) ...[
            const SizedBox(height: 14),
            const Divider(height: 1),
            const SizedBox(height: 6),
            for (final item in score.items)
              _ItemRow(item: item, isSelf: isSelf),
          ],
          const SizedBox(height: 4),
          Text(
            'Individual rater responses are confidential.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: scheme.onSurfaceVariant.withOpacity(0.7),
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({
    required this.label,
    required this.value,
    this.danger = false,
  });

  final String label;
  final String value;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: danger
            ? scheme.errorContainer
            : scheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        '$label $value',
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: danger ? scheme.onErrorContainer : scheme.onSurface,
        ),
      ),
    );
  }
}

class _GroupBar extends StatelessWidget {
  const _GroupBar({required this.name, required this.value});

  final String name;
  final double value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Row(
      children: [
        SizedBox(
          width: 76,
          child: Text(
            name,
            style: theme.textTheme.bodySmall
                ?.copyWith(color: scheme.onSurfaceVariant),
          ),
        ),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: (value / 100).clamp(0.0, 1.0),
              minHeight: 6,
              backgroundColor: scheme.surfaceContainerHighest,
              color: scheme.primary,
            ),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 30,
          child: Text(
            '${value.round()}',
            textAlign: TextAlign.right,
            style: theme.textTheme.bodySmall
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
        ),
      ],
    );
  }
}

class _WarningBlock extends StatelessWidget {
  const _WarningBlock({required this.warning});

  final ScoreWarning warning;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: scheme.errorContainer.withOpacity(0.4),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.warning_amber_rounded,
                size: 16,
                color: scheme.error,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  warning.title,
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: scheme.error,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            warning.detail,
            style: theme.textTheme.bodySmall
                ?.copyWith(color: scheme.onSurfaceVariant),
          ),
          if (warning.items.isNotEmpty)
            Text(
              warning.items.join(', '),
              style: theme.textTheme.bodySmall?.copyWith(
                color: scheme.onSurfaceVariant,
                fontStyle: FontStyle.italic,
              ),
            ),
        ],
      ),
    );
  }
}

class _ItemRow extends StatelessWidget {
  const _ItemRow({required this.item, required this.isSelf});

  final ScoreItem item;
  final bool isSelf;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.name,
                      style: theme.textTheme.bodyMedium
                          ?.copyWith(fontWeight: FontWeight.w600),
                    ),
                    if (item.groupName != null)
                      Text(
                        item.groupName!,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: scheme.onSurfaceVariant,
                          fontSize: 11,
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              if (item.scenarioCorrect != null)
                Padding(
                  padding: const EdgeInsets.only(right: 6, top: 2),
                  child: Icon(
                    item.scenarioCorrect!
                        ? Icons.check_circle_outline
                        : Icons.cancel_outlined,
                    size: 16,
                    color: item.scenarioCorrect!
                        ? scheme.tertiary
                        : scheme.error,
                  ),
                ),
              Text(
                item.score == null ? '—' : '${item.score!.round()}',
                style: theme.textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w800),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              if (item.band != null) ...[
                StatusChip(item.band!, tone: _bandTone(item.band!)),
                const SizedBox(width: 8),
              ],
              if (!isSelf && item.self != null)
                _mini(theme, 'Self ${item.self!.toStringAsFixed(0)}'),
              if (!isSelf && item.lineManager != null)
                _mini(theme, 'Mgr ${item.lineManager!.toStringAsFixed(0)}'),
              if (!isSelf && item.othersAvg != null)
                _mini(theme, 'Others ${item.othersAvg!.toStringAsFixed(1)}'),
            ],
          ),
          if (item.flag != null) ...[
            const SizedBox(height: 4),
            Text(
              item.flag!,
              style: theme.textTheme.bodySmall?.copyWith(
                color: scheme.error,
                fontWeight: FontWeight.w600,
                fontSize: 11,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _mini(ThemeData theme, String text) {
    return Padding(
      padding: const EdgeInsets.only(right: 10),
      child: Text(
        text,
        style: theme.textTheme.bodySmall?.copyWith(
          color: theme.colorScheme.onSurfaceVariant,
          fontSize: 11,
        ),
      ),
    );
  }
}

class _SignaturesCard extends StatelessWidget {
  const _SignaturesCard({required this.report});

  final AssessmentReport report;

  static const _slots = [
    ('employee', 'Employee'),
    ('manager', 'Line manager'),
    ('hr', 'HR representative'),
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return SoftCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Signatures',
            style: theme.textTheme.titleSmall
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          for (final (key, label) in _slots)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                children: [
                  Icon(
                    report.signatures.containsKey(key)
                        ? Icons.draw_rounded
                        : Icons.pending_outlined,
                    size: 16,
                    color: report.signatures.containsKey(key)
                        ? scheme.tertiary
                        : scheme.onSurfaceVariant,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      label,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                  Text(
                    report.signatures.containsKey(key)
                        ? '${report.signatures[key]!.name} · ${DateFormat.yMMMd().format(report.signatures[key]!.at)}'
                        : 'Pending',
                    style: theme.textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: report.signatures.containsKey(key)
                          ? scheme.onSurface
                          : scheme.onSurfaceVariant,
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

StatusTone _bandTone(String band) {
  switch (band) {
    case 'Strength':
      return StatusTone.success;
    case 'Meets standard':
      return StatusTone.info;
    case 'Development gap':
      return StatusTone.warning;
    default:
      return StatusTone.danger;
  }
}
