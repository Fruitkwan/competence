import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/auth_controller.dart';
import '../../core/supabase_client.dart';
import '../../data/repositories/cycle_repository.dart';
import '../../data/repositories/skill_gap_repository.dart';
import '../../shared/widgets/async_value_view.dart';

final _statusCountsProvider = FutureProvider<List<_StatusCount>>((ref) async {
  ref.watch(authStateProvider);
  final supabase = ref.watch(supabaseProvider);
  try {
    final rows = await supabase.rpc('appraisal_status_counts');
    return (rows as List)
        .map((r) => _StatusCount(
              status: (r['status'] ?? '') as String,
              total: ((r['total'] ?? 0) as num).toInt(),
            ))
        .toList();
  } catch (_) {
    // Fallback: client-side roll-up.
    final rows = await supabase.from('performance_appraisals').select('status');
    final counts = <String, int>{};
    for (final r in rows) {
      final s = (r['status'] ?? 'Draft') as String;
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts.entries
        .map((e) => _StatusCount(status: e.key, total: e.value))
        .toList();
  }
});

final _topGapsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) {
  ref.watch(authStateProvider);
  return ref.watch(skillGapRepositoryProvider).topGapsByCompetency(limit: 5);
});

class _StatusCount {
  _StatusCount({required this.status, required this.total});
  final String status;
  final int total;
}

class HrDashboardPage extends ConsumerWidget {
  const HrDashboardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final role = ref.watch(currentRoleProvider);
    if (!role.isHr) {
      return Scaffold(
        appBar: AppBar(title: const Text('HR dashboard')),
        body: const EmptyState(
          icon: Icons.lock_outline,
          message: 'HR access required.',
        ),
      );
    }
    final statuses = ref.watch(_statusCountsProvider);
    final cycles = ref.watch(openCyclesProvider);
    final gaps = ref.watch(_topGapsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('HR dashboard')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref
            ..invalidate(_statusCountsProvider)
            ..invalidate(openCyclesProvider)
            ..invalidate(_topGapsProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('Appraisals by status',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            statuses.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => Card(child: ListTile(title: Text('$e'))),
              data: (rows) {
                final total = rows.fold<int>(0, (s, r) => s + r.total);
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '$total total',
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                        const SizedBox(height: 12),
                        for (final r in rows)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 6),
                            child: Row(
                              children: [
                                Expanded(child: Text(r.status)),
                                Text('${r.total}',
                                    style: Theme.of(context).textTheme.titleMedium),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 24),
            Text('Active cycles',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            cycles.when(
              loading: () => const SizedBox.shrink(),
              error: (e, _) => Card(child: ListTile(title: Text('$e'))),
              data: (rows) => rows.isEmpty
                  ? const Card(
                      child: ListTile(
                        leading: Icon(Icons.event_busy_outlined),
                        title: Text('No active cycles'),
                      ),
                    )
                  : Column(
                      children: [
                        for (final c in rows)
                          Card(
                            child: ListTile(
                              title: Text(c.name),
                              subtitle: Text(
                                '${c.type} · ${DateFormat.yMMMd().format(c.startDate)}'
                                ' → ${DateFormat.yMMMd().format(c.endDate)}',
                              ),
                              trailing: Text(c.status),
                            ),
                          ),
                      ],
                    ),
            ),
            const SizedBox(height: 24),
            Text('Top skill gaps',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            gaps.when(
              loading: () => const SizedBox.shrink(),
              error: (e, _) => Card(child: ListTile(title: Text('$e'))),
              data: (rows) {
                if (rows.isEmpty) {
                  return const Card(
                    child: ListTile(
                      leading: Icon(Icons.celebration_outlined),
                      title: Text('No open skill gaps'),
                    ),
                  );
                }
                return Column(
                  children: [
                    for (final r in rows)
                      Card(
                        child: ListTile(
                          title: Text(
                              (r['competency_name'] ?? '—').toString()),
                          trailing: Text(
                            (r['gap_count'] ?? r['count'] ?? 0).toString(),
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                        ),
                      ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
