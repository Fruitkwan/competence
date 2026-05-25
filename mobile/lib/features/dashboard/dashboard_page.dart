import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/auth_controller.dart';
import '../../core/role.dart';
import '../../data/models/cycle_objective.dart';
import '../../data/repositories/appraisal_repository.dart';
import '../../data/repositories/cycle_repository.dart';
import '../../data/repositories/objective_repository.dart';
import '../../shared/widgets/status_chip.dart';

class DashboardPage extends ConsumerWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(currentProfileProvider).valueOrNull;
    final role = ref.watch(currentRoleProvider);
    final cycle = ref.watch(currentObjectiveCycleProvider);
    final myObjectives = ref.watch(myObjectivesProvider(null));
    final myAppraisals = ref.watch(myAppraisalsProvider);
    final pendingApprovals = role.canManage
        ? ref.watch(pendingObjectivesForApprovalProvider)
        : const AsyncValue<List<CycleObjective>>.data([]);

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(currentObjectiveCycleProvider);
        ref.invalidate(myObjectivesProvider(null));
        ref.invalidate(myAppraisalsProvider);
        ref.invalidate(pendingObjectivesForApprovalProvider);
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _Greeting(name: profile?.fullName ?? 'there', role: role),
          const SizedBox(height: 16),
          cycle.when(
            data: (c) => c == null
                ? const _NoCycleCard()
                : _CycleCard(cycleName: c.name, status: c.status, endDate: c.endDate),
            loading: () => const _SkeletonCard(),
            error: (e, _) => Card(
              child: ListTile(
                title: const Text('Could not load cycle'),
                subtitle: Text('$e'),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _MetricCard(
                  label: 'My open objectives',
                  value: myObjectives.valueOrNull
                          ?.where((o) => o.status != ObjectiveStatus.approved)
                          .length
                          .toString() ??
                      '—',
                  icon: Icons.flag_outlined,
                  onTap: () => context.go('/objectives'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _MetricCard(
                  label: role.canManage ? 'Awaiting my approval' : 'My appraisals',
                  value: role.canManage
                      ? (pendingApprovals.valueOrNull?.length.toString() ?? '—')
                      : (myAppraisals.valueOrNull?.length.toString() ?? '—'),
                  icon: role.canManage ? Icons.rule_outlined : Icons.assessment_outlined,
                  onTap: () => context
                      .go(role.canManage ? '/objectives/review' : '/appraisals'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Text(
            'Recent appraisals',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          myAppraisals.when(
            loading: () => const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (e, _) => Card(child: ListTile(title: Text('$e'))),
            data: (rows) {
              if (rows.isEmpty) {
                return Card(
                  child: ListTile(
                    leading: const Icon(Icons.inbox_outlined),
                    title: const Text('No appraisals yet'),
                    subtitle: const Text(
                      'You will see your appraisals here once HR opens a cycle.',
                    ),
                  ),
                );
              }
              return Column(
                children: [
                  for (final a in rows.take(3))
                    Card(
                      child: ListTile(
                        title: Text(
                          a.appraisalPeriod ?? 'Appraisal',
                        ),
                        subtitle: Text(
                          'Updated ${DateFormat.yMMMd().format(a.updatedAt)}',
                        ),
                        trailing: StatusChip(
                          a.status,
                          tone: _toneForStatus(a.status),
                        ),
                        onTap: () => context.go('/appraisals/${a.id}/self'),
                      ),
                    ),
                ],
              );
            },
          ),
          if (role.canManage && (pendingApprovals.valueOrNull?.isNotEmpty ?? false)) ...[
            const SizedBox(height: 24),
            Text('Awaiting your approval',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            for (final o in pendingApprovals.value!.take(3))
              Card(
                child: ListTile(
                  title: Text(o.title),
                  subtitle: Text(o.employeeName ?? o.employeeId),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.go('/objectives/review'),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

StatusTone _toneForStatus(String status) {
  switch (status) {
    case 'Final':
      return StatusTone.success;
    case 'Archived':
      return StatusTone.neutral;
    case 'N1 Complete':
    case 'N2 Complete':
      return StatusTone.info;
    case 'Draft':
    default:
      return StatusTone.warning;
  }
}

class _Greeting extends StatelessWidget {
  const _Greeting({required this.name, required this.role});
  final String name;
  final AppRole role;

  @override
  Widget build(BuildContext context) {
    final hour = DateTime.now().hour;
    final greeting = hour < 12
        ? 'Good morning'
        : hour < 18
            ? 'Good afternoon'
            : 'Good evening';
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '$greeting,',
          style: theme.textTheme.bodyMedium,
        ),
        Text(
          name,
          style: theme.textTheme.headlineSmall
              ?.copyWith(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 4),
        StatusChip(role.label, tone: StatusTone.info),
      ],
    );
  }
}

class _NoCycleCard extends StatelessWidget {
  const _NoCycleCard();
  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: const Icon(Icons.event_busy_outlined),
        title: const Text('No active cycle'),
        subtitle: const Text(
          'HR has not opened a cycle yet. You will see goals and appraisals here when one starts.',
        ),
      ),
    );
  }
}

class _CycleCard extends StatelessWidget {
  const _CycleCard({
    required this.cycleName,
    required this.status,
    required this.endDate,
  });
  final String cycleName;
  final String status;
  final DateTime endDate;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    cycleName,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                StatusChip(status, tone: StatusTone.info),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Ends ${DateFormat.yMMMd().format(endDate)}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final String value;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon),
              const SizedBox(height: 8),
              Text(value, style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 4),
              Text(label, style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        ),
      ),
    );
  }
}

class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard();
  @override
  Widget build(BuildContext context) {
    return const Card(
      child: SizedBox(
        height: 88,
        child: Center(child: CircularProgressIndicator()),
      ),
    );
  }
}
