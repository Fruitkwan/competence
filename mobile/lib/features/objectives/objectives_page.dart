import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/error_handler.dart';
import '../../data/models/cycle_objective.dart';
import '../../data/repositories/cycle_repository.dart';
import '../../data/repositories/objective_repository.dart';
import '../../shared/widgets/async_value_view.dart';
import '../../shared/widgets/status_chip.dart';

class ObjectivesPage extends ConsumerWidget {
  const ObjectivesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cycle = ref.watch(currentObjectiveCycleProvider);
    final objectives = ref.watch(myObjectivesProvider(null));

    return Scaffold(
      body: AsyncValueView<List<CycleObjective>>(
        value: objectives,
        empty: const EmptyState(
          icon: Icons.flag_outlined,
          message: 'No objectives yet. Tap + to create one.',
        ),
        data: (rows) {
          final totalWeight = rows
              .where((o) =>
                  o.status == ObjectiveStatus.draft ||
                  o.status == ObjectiveStatus.revisionRequested)
              .fold<double>(0, (s, o) => s + o.weight);
          final canSubmit = (totalWeight - 100).abs() < 0.01;

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(myObjectivesProvider(null)),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.percent),
                            const SizedBox(width: 8),
                            Text(
                              'Draft weight: ${totalWeight.toStringAsFixed(0)}%',
                              style:
                                  Theme.of(context).textTheme.titleMedium,
                            ),
                            const Spacer(),
                            FilledButton.tonal(
                              onPressed: canSubmit
                                  ? () => _submit(context, ref, cycle.valueOrNull?.id)
                                  : null,
                              child: const Text('Submit for approval'),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          canSubmit
                              ? 'Ready to submit.'
                              : 'Draft objective weights must total exactly 100%.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                for (final o in rows) _ObjectiveTile(objective: o),
              ],
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

  Future<void> _submit(BuildContext context, WidgetRef ref, String? cycleId) async {
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

class _ObjectiveTile extends ConsumerWidget {
  const _ObjectiveTile({required this.objective});
  final CycleObjective objective;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canEdit = objective.status == ObjectiveStatus.draft ||
        objective.status == ObjectiveStatus.revisionRequested;
    return Card(
      child: ListTile(
        title: Text(objective.title),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (objective.description != null) Text(objective.description!),
            const SizedBox(height: 4),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                StatusChip(
                  objective.status.label,
                  tone: _tone(objective.status),
                ),
                StatusChip(
                  'Weight: ${objective.weight.toStringAsFixed(0)}%',
                  tone: StatusTone.neutral,
                ),
              ],
            ),
          ],
        ),
        trailing: canEdit
            ? PopupMenuButton<String>(
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
                              child: const Text('Cancel')),
                          FilledButton.tonal(
                              onPressed: () => Navigator.pop(context, true),
                              child: const Text('Delete')),
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
            : const Icon(Icons.chevron_right),
        onTap: canEdit
            ? () => context.go('/objectives/${objective.id}/edit')
            : null,
      ),
    );
  }

  StatusTone _tone(ObjectiveStatus status) {
    switch (status) {
      case ObjectiveStatus.draft:
        return StatusTone.warning;
      case ObjectiveStatus.submitted:
        return StatusTone.info;
      case ObjectiveStatus.revisionRequested:
        return StatusTone.warning;
      case ObjectiveStatus.approved:
        return StatusTone.success;
      case ObjectiveStatus.rejected:
        return StatusTone.danger;
    }
  }
}
