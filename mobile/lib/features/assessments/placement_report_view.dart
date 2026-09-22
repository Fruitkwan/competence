import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../data/models/assessment.dart';
import '../../shared/widgets/soft_ui.dart';
import '../../shared/widgets/status_chip.dart';

/// Read-only role-placement report: outcome, part scores, record and raters.
class PlacementReportView extends StatelessWidget {
  const PlacementReportView({super.key, required this.report});

  final PlacementReport report;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final o = report.outcome;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        SoftCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      report.employee.fullName,
                      style: theme.textTheme.titleMedium
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                  ),
                  const StatusChip('Confidential', tone: StatusTone.danger),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                [
                  report.templateName,
                  if (report.wave != null) 'Wave ${report.wave}',
                  if (report.submittedAt != null)
                    'Submitted ${DateFormat.yMMMd().format(report.submittedAt!)}',
                ].join(' · '),
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: scheme.onSurfaceVariant),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        SoftCard(
          leadingAccent:
              o.pendingRecord ? scheme.error : scheme.primary,
          padding: const EdgeInsets.fromLTRB(20, 14, 14, 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Assessment outcome',
                style: theme.textTheme.labelLarge
                    ?.copyWith(color: scheme.onSurfaceVariant),
              ),
              const SizedBox(height: 4),
              Text(
                o.label,
                style: theme.textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              Text(
                o.reason,
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: scheme.onSurfaceVariant),
              ),
              if (o.pendingRecord) ...[
                const SizedBox(height: 8),
                const StatusChip('Awaiting record', tone: StatusTone.warning),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),
        for (final p in report.parts) ...[
          _PartCard(part: p),
          const SizedBox(height: 12),
        ],
        SoftCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Verified performance record',
                style: theme.textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  for (final (label, key) in const [
                    ('Commercial', 'commercial'),
                    ('Account', 'account'),
                    ('Leadership', 'leadership'),
                  ])
                    Expanded(
                      child: Column(
                        children: [
                          Text(
                            report.record[key]?.toString() ?? '—',
                            style: theme.textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: report.record[key] == null
                                  ? scheme.onSurfaceVariant
                                  : scheme.primary,
                            ),
                          ),
                          Text(
                            label,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: scheme.onSurfaceVariant,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        SoftCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Raters',
                style: theme.textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final r in report.raters)
                    StatusChip(
                      '${_raterLabel(r.type)} · ${r.status.replaceAll('_', ' ')}',
                      tone: r.status == 'submitted'
                          ? StatusTone.success
                          : StatusTone.neutral,
                    ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _Signatures(report: report),
      ],
    );
  }

  static String _raterLabel(String type) {
    switch (type) {
      case 'line_manager':
        return 'Line manager';
      case 'cross_dept':
        return 'Cross-dept';
      case 'peer':
        return 'Peer';
      case 'self':
        return 'Self';
      default:
        return type;
    }
  }
}

class _PartCard extends StatelessWidget {
  const _PartCard({required this.part});

  final PlacementPart part;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final hasZero = part.zeroItems.isNotEmpty;

    return SoftCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Part ${part.part} — ${part.name}',
                  style: theme.textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              Text(
                '${part.points}/${part.outOf}',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: hasZero ? scheme.error : scheme.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final a in part.answers)
                _AnswerChip(answer: a),
            ],
          ),
          if (hasZero) ...[
            const SizedBox(height: 8),
            Text(
              '0-point answer: ${part.zeroItems.join('; ')}',
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
}

class _AnswerChip extends StatelessWidget {
  const _AnswerChip({required this.answer});

  final PlacementAnswer answer;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final pts = answer.points;
    final color = pts == null
        ? scheme.onSurfaceVariant
        : pts == 0
            ? scheme.error
            : pts == 4
                ? scheme.tertiary
                : scheme.primary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(8),
        border: pts == 0 ? Border.all(color: scheme.error) : null,
      ),
      child: Text(
        'Q${answer.sortOrder} ${answer.chosen ?? '—'} · ${pts ?? '—'}pt',
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}

class _Signatures extends StatelessWidget {
  const _Signatures({required this.report});

  final PlacementReport report;

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
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: scheme.onSurfaceVariant),
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
