// ignore_for_file: deprecated_member_use

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/error_handler.dart';
import '../../data/models/cycle_objective.dart';
import '../../data/repositories/cycle_repository.dart';
import '../../data/repositories/objective_repository.dart';
import '../../shared/widgets/soft_ui.dart';
import '../../shared/widgets/status_chip.dart';

const _teal = Color(0xFF10B7B5);
const _blue = Color(0xFF0070B8);
const _orange = Color(0xFFF59E0B);

class ObjectivesPage extends ConsumerStatefulWidget {
  const ObjectivesPage({super.key});

  @override
  ConsumerState<ObjectivesPage> createState() => _ObjectivesPageState();
}

class _ObjectivesPageState extends ConsumerState<ObjectivesPage>
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
    final cycle = ref.watch(currentObjectiveCycleProvider);
    final objectives = ref.watch(myObjectivesProvider(null));

    return Scaffold(
      body: objectives.when(
        loading: () => const Padding(
          padding: EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Column(
            children: [
              SkeletonBlock(height: 96),
              SizedBox(height: 16),
              SkeletonBlock(height: 88),
              SizedBox(height: 12),
              SkeletonBlock(height: 88),
            ],
          ),
        ),
        error: (e, _) => Padding(
          padding: const EdgeInsets.all(16),
          child: ErrorCard(
            title: 'Could not load objectives',
            detail: '$e',
          ),
        ),
        data: (rows) {
          final draftRows = rows.where((o) =>
              o.status == ObjectiveStatus.draft ||
              o.status == ObjectiveStatus.revisionRequested);
          final totalWeight = draftRows.fold<double>(0, (s, o) => s + o.weight);
          final canSubmit = (totalWeight - 100).abs() < 0.01;

          final sections = <Widget>[
            _WeightProgressBanner(
              totalWeight: totalWeight,
              canSubmit: canSubmit,
              onSubmit: () => _submit(context, ref, cycle.valueOrNull?.id),
            ),
            const SizedBox(height: 16),
            if (rows.isEmpty)
              const _ObjectiveEmptyCard()
            else
              for (final o in rows)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _ObjectiveTile(objective: o),
                ),
          ];

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(myObjectivesProvider(null)),
            child: ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
              itemCount: sections.length,
              itemBuilder: (context, index) {
                return StaggeredEntrance(
                  controller: _entrance,
                  interval: entranceInterval(index),
                  child: sections[index],
                );
              },
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          final cycleId = cycle.valueOrNull?.id;
          context.go(cycleId == null
              ? '/objectives/new'
              : '/objectives/new?cycle=$cycleId');
        },
        icon: const Icon(Icons.add),
        label: const Text('New objective'),
      ),
    );
  }

  Future<void> _submit(
      BuildContext context, WidgetRef ref, String? cycleId) async {
    if (cycleId == null) {
      showErrorSnack(context, 'No active cycle for objectives.');
      return;
    }
    try {
      await ref.read(objectiveRepositoryProvider).submitDraft(cycleId);
      if (!context.mounted) return;
      ref.invalidate(myObjectivesProvider(null));
      showSuccessSnack(context, 'Objectives submitted for approval.');
    } catch (e) {
      if (context.mounted) showErrorSnack(context, e);
    }
  }
}

class _WeightProgressBanner extends StatelessWidget {
  const _WeightProgressBanner({
    required this.totalWeight,
    required this.canSubmit,
    required this.onSubmit,
  });

  final double totalWeight;
  final bool canSubmit;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    final start = canSubmit ? _blue : theme.colorScheme.surface;
    final end = canSubmit ? _teal : _blue.withOpacity(0.06);
    final fg = canSubmit ? Colors.white : scheme.onSurface;
    final accent = canSubmit ? Colors.white : _blue;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [start, end],
        ),
        border: Border.all(
          color: canSubmit ? Colors.transparent : _blue.withOpacity(0.14),
        ),
        boxShadow: [
          BoxShadow(
            color: (canSubmit ? _blue : scheme.shadow).withOpacity(0.08),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.percent_rounded,
                  size: 18,
                  color: fg.withOpacity(0.85),
                ),
                const SizedBox(width: 8),
                Text(
                  'Draft weight',
                  style: theme.textTheme.titleSmall?.copyWith(
                    color: fg,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Spacer(),
                AnimatedCount(
                  value: totalWeight.round(),
                  suffix: '%',
                  style: theme.textTheme.titleLarge?.copyWith(
                    color: fg,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.5,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _AnimatedProgressBar(
              progress: (totalWeight / 100).clamp(0.0, 1.0),
              track: canSubmit ? fg.withOpacity(0.22) : _blue.withOpacity(0.12),
              fill: accent,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Text(
                    canSubmit
                        ? 'Ready to submit.'
                        : 'Draft weights must total exactly 100%.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: fg.withOpacity(0.85),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Pressable(
                  onTap: canSubmit ? onSubmit : () {},
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 9),
                    decoration: BoxDecoration(
                      color: canSubmit ? fg : _orange.withOpacity(0.10),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      'Submit',
                      style: TextStyle(
                        color: canSubmit ? _blue : _orange,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _AnimatedProgressBar extends StatelessWidget {
  const _AnimatedProgressBar({
    required this.progress,
    required this.track,
    required this.fill,
  });

  final double progress;
  final Color track;
  final Color fill;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: SizedBox(
        height: 8,
        child: Stack(
          children: [
            Container(color: track),
            TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: progress),
              duration: const Duration(milliseconds: 900),
              curve: Curves.easeOutCubic,
              builder: (context, v, _) => FractionallySizedBox(
                widthFactor: v,
                alignment: Alignment.centerLeft,
                child: Container(color: fill),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ObjectiveEmptyCard extends StatelessWidget {
  const _ObjectiveEmptyCard();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SoftCard(
      leadingAccent: _orange,
      padding: const EdgeInsets.fromLTRB(20, 16, 16, 16),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: _orange.withOpacity(0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(Icons.flag_outlined, color: _orange),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'No objectives yet',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  'Tap + below to draft your first objective.',
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

class _ObjectiveTile extends ConsumerWidget {
  const _ObjectiveTile({required this.objective});
  final CycleObjective objective;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final canEdit = objective.status == ObjectiveStatus.draft ||
        objective.status == ObjectiveStatus.revisionRequested;
    final tone = _tone(objective.status);
    final accent = _accentFor(scheme, tone);

    return SoftCard(
      onTap: canEdit
          ? () => context.go('/objectives/${objective.id}/edit')
          : null,
      leadingAccent: accent,
      padding: const EdgeInsets.fromLTRB(20, 14, 12, 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: accent.withOpacity(0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(_iconFor(objective.status), color: accent, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  objective.title,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (objective.description != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    objective.description!,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                const SizedBox(height: 10),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    StatusChip(objective.status.label, tone: tone),
                    StatusChip(
                      '${objective.weight.toStringAsFixed(0)}%',
                      tone: StatusTone.neutral,
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (canEdit)
            PopupMenuButton<String>(
              icon: Icon(Icons.more_vert_rounded,
                  color: scheme.onSurfaceVariant),
              onSelected: (v) async {
                if (v == 'edit') {
                  context.go('/objectives/${objective.id}/edit');
                } else if (v == 'delete') {
                  final ok = await showDialog<bool>(
                    context: context,
                    builder: (_) => AlertDialog(
                      title: const Text('Delete objective?'),
                      content: const Text('This cannot be undone.'),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(context, false),
                          child: const Text('Cancel'),
                        ),
                        FilledButton.tonal(
                          onPressed: () => Navigator.pop(context, true),
                          child: const Text('Delete'),
                        ),
                      ],
                    ),
                  );
                  if (ok ?? false) {
                    try {
                      await ref
                          .read(objectiveRepositoryProvider)
                          .delete(objective.id);
                      ref.invalidate(myObjectivesProvider(null));
                    } catch (e) {
                      if (context.mounted) showErrorSnack(context, e);
                    }
                  }
                }
              },
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'edit', child: Text('Edit')),
                PopupMenuItem(value: 'delete', child: Text('Delete')),
              ],
            )
          else
            Padding(
              padding: const EdgeInsets.only(top: 2, right: 4),
              child: Icon(Icons.chevron_right_rounded,
                  color: scheme.onSurfaceVariant),
            ),
        ],
      ),
    );
  }

  StatusTone _tone(ObjectiveStatus status) {
    switch (status) {
      case ObjectiveStatus.draft:
      case ObjectiveStatus.revisionRequested:
        return StatusTone.warning;
      case ObjectiveStatus.submitted:
        return StatusTone.info;
      case ObjectiveStatus.approved:
        return StatusTone.success;
      case ObjectiveStatus.rejected:
        return StatusTone.danger;
    }
  }

  Color _accentFor(ColorScheme scheme, StatusTone tone) {
    switch (tone) {
      case StatusTone.success:
        return _teal;
      case StatusTone.warning:
        return _orange;
      case StatusTone.danger:
        return scheme.error;
      case StatusTone.info:
        return _blue;
      case StatusTone.neutral:
        return scheme.outline;
    }
  }

  IconData _iconFor(ObjectiveStatus status) {
    switch (status) {
      case ObjectiveStatus.approved:
        return Icons.check_circle_outline;
      case ObjectiveStatus.submitted:
        return Icons.upload_file_outlined;
      case ObjectiveStatus.rejected:
        return Icons.error_outline;
      case ObjectiveStatus.draft:
      case ObjectiveStatus.revisionRequested:
        return Icons.edit_note_outlined;
    }
  }
}
