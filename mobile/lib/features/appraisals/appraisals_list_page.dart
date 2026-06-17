import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/auth_controller.dart';
import '../../core/role.dart';
import '../../data/models/performance_appraisal.dart';
import '../../data/repositories/appraisal_repository.dart';
import '../../shared/widgets/async_value_view.dart';
import '../../shared/widgets/status_chip.dart';

class AppraisalsListPage extends ConsumerWidget {
  const AppraisalsListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final role = ref.watch(currentRoleProvider);
    final value =
        role.canManage ? ref.watch(allAppraisalsProvider) : ref.watch(myAppraisalsProvider);

    return Scaffold(
      body: AsyncValueView<List<PerformanceAppraisal>>(
        value: value,
        empty: const EmptyState(
          icon: Icons.assessment_outlined,
          message: 'No appraisals to show.',
        ),
        data: (rows) => RefreshIndicator(
          onRefresh: () async {
            ref
              ..invalidate(myAppraisalsProvider)
              ..invalidate(allAppraisalsProvider);
          },
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: rows.length,
            itemBuilder: (context, i) {
              final a = rows[i];
              return Card(
                child: ListTile(
                  title: Text(a.employeeName ?? a.employeeId),
                  subtitle: Text(
                    '${a.appraisalPeriod ?? 'Appraisal'} · ${DateFormat.yMMMd().format(a.updatedAt)}',
                  ),
                  trailing: StatusChip(
                    a.status,
                    tone: _toneForStatus(a.status),
                  ),
                  onTap: () {
                    final path = role.canManage
                        ? (a.status == 'N1 Complete'
                            ? '/appraisals/${a.id}/review'
                            : (role.isHr && a.status == 'N2 Complete'
                                ? '/appraisals/${a.id}/finalize'
                                : '/appraisals/${a.id}/self'))
                        : '/appraisals/${a.id}/self';
                    context.go(path);
                  },
                ),
              );
            },
          ),
        ),
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
