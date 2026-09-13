import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/error_handler.dart';
import '../../data/models/cycle_objective.dart';
import '../../data/repositories/objective_repository.dart';
import '../../shared/widgets/async_value_view.dart';
import '../../shared/widgets/status_chip.dart';

class ManagerObjectivesPage extends ConsumerWidget {
  const ManagerObjectivesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pending = ref.watch(pendingObjectivesForApprovalProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Review objectives')),
      body: AsyncValueView<List<CycleObjective>>(
        value: pending,
        empty: const EmptyState(
          icon: Icons.check_circle_outline,
          message: 'Nothing waiting for your approval.',
        ),
        data: (rows) => RefreshIndicator(
          onRefresh: () async =>
              ref.invalidate(pendingObjectivesForApprovalProvider),
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: rows.length,
            itemBuilder: (context, i) {
              final o = rows[i];
              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(o.employeeName ?? o.employeeId,
                          style: Theme.of(context).textTheme.bodySmall),
                      const SizedBox(height: 4),
                      Text(o.title,
                          style: Theme.of(context).textTheme.titleMedium),
                      if (o.description != null) ...[
                        const SizedBox(height: 8),
                        Text(o.description!),
                      ],
                      if (o.successCriteria != null) ...[
                        const SizedBox(height: 8),
                        Text('Success criteria:',
                            style: Theme.of(context).textTheme.bodySmall),
                        Text(o.successCriteria!),
                      ],
                      const SizedBox(height: 8),
                      StatusChip('Weight: ${o.weight.toStringAsFixed(0)}%'),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: FilledButton(
                              onPressed: () => _approve(context, ref, o.id),
                              child: const Text('Approve'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () =>
                                  _commentAction(context, ref, o.id, 'revision'),
                              child: const Text('Request revision'),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton(
                        onPressed: () =>
                            _commentAction(context, ref, o.id, 'reject'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor:
                              Theme.of(context).colorScheme.error,
                        ),
                        child: const Text('Reject'),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  Future<void> _approve(BuildContext context, WidgetRef ref, String id) async {
    try {
      await ref.read(objectiveRepositoryProvider).approve(id);
      ref.invalidate(pendingObjectivesForApprovalProvider);
      if (context.mounted) showSuccessSnack(context, 'Approved.');
    } catch (e) {
      if (context.mounted) showErrorSnack(context, e);
    }
  }

  Future<void> _commentAction(
    BuildContext context,
    WidgetRef ref,
    String id,
    String mode,
  ) async {
    final controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(mode == 'revision' ? 'Request revision' : 'Reject objective'),
        content: TextField(
          controller: controller,
          minLines: 3,
          maxLines: 6,
          autofocus: true,
          decoration: InputDecoration(
            labelText: mode == 'revision'
                ? 'Comment to employee *'
                : 'Reason (optional)',
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              if (mode == 'revision' && controller.text.trim().isEmpty) return;
              Navigator.pop(context, controller.text.trim());
            },
            child: Text(mode == 'revision' ? 'Send' : 'Reject'),
          ),
        ],
      ),
    );
    if (result == null) return;
    try {
      final repo = ref.read(objectiveRepositoryProvider);
      if (mode == 'revision') {
        await repo.requestRevision(id, result);
      } else {
        await repo.reject(id, result);
      }
      ref.invalidate(pendingObjectivesForApprovalProvider);
      if (context.mounted) {
        showSuccessSnack(
          context,
          mode == 'revision' ? 'Revision requested.' : 'Rejected.',
        );
      }
    } catch (e) {
      if (context.mounted) showErrorSnack(context, e);
    }
  }
}
