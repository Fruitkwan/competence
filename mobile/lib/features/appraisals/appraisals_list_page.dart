// ignore_for_file: deprecated_member_use

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/appraisal_routes.dart';
import '../../core/auth_controller.dart';
import '../../core/error_handler.dart';
import '../../core/role.dart';
import '../../data/models/performance_appraisal.dart';
import '../../data/repositories/appraisal_repository.dart';
import '../../shared/widgets/soft_ui.dart';
import '../../shared/widgets/status_chip.dart';

class AppraisalsListPage extends ConsumerStatefulWidget {
  const AppraisalsListPage({super.key});

  @override
  ConsumerState<AppraisalsListPage> createState() =>
      _AppraisalsListPageState();
}

class _AppraisalsListPageState extends ConsumerState<AppraisalsListPage>
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
    final role = ref.watch(currentRoleProvider);
    final value = role.canManage
        ? ref.watch(allAppraisalsProvider)
        : ref.watch(myAppraisalsProvider);

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
            title: 'Could not load appraisals',
            detail: describeError(e),
          ),
        ),
        data: (rows) {
          return RefreshIndicator(
            onRefresh: () async {
              ref
                ..invalidate(myAppraisalsProvider)
                ..invalidate(allAppraisalsProvider);
            },
            child: rows.isEmpty
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    children: const [
                      EmptyCard(
                        icon: Icons.assessment_outlined,
                        title: 'No appraisals to show',
                        body:
                            'When HR opens a cycle, your appraisals will appear here.',
                      ),
                    ],
                  )
                : ListView.builder(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                    itemCount: rows.length,
                    itemBuilder: (context, i) {
                      return StaggeredEntrance(
                        controller: _entrance,
                        interval: entranceInterval(i, step: 0.04, span: 0.4),
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: _AppraisalTile(
                            appraisal: rows[i],
                            role: role,
                          ),
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

class _AppraisalTile extends StatelessWidget {
  const _AppraisalTile({required this.appraisal, required this.role});

  final PerformanceAppraisal appraisal;
  final AppRole role;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final tone = _toneForStatus(appraisal.status);
    return SoftCard(
      onTap: () => context.go(routeForAppraisal(appraisal, role)),
      leadingAccent: _accentFor(scheme, tone),
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
              Icons.person_rounded,
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
                  appraisal.employeeName ?? appraisal.employeeId,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  '${appraisal.appraisalPeriod ?? 'Appraisal'} · ${DateFormat.yMMMd().format(appraisal.updatedAt)}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          StatusChip(appraisal.status, tone: tone),
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

Color _accentFor(ColorScheme scheme, StatusTone tone) {
  switch (tone) {
    case StatusTone.success:
      return scheme.tertiary;
    case StatusTone.warning:
      return scheme.secondary;
    case StatusTone.danger:
      return scheme.error;
    case StatusTone.info:
      return scheme.primary;
    case StatusTone.neutral:
      return scheme.outline;
  }
}
