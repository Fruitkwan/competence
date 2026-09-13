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

const _teal = Color(0xFF10B7B5);
const _orange = Color(0xFFF59E0B);

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
          final pending = rows
              .where((a) => a.status != 'Final' && a.status != 'Archived')
              .length;
          final done = rows.length - pending;
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
                    itemCount: rows.length + 1,
                    itemBuilder: (context, i) {
                      if (i == 0) {
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: Row(
                            children: [
                              Expanded(
                                child: _SummaryTile(
                                  icon: Icons.pending_actions_outlined,
                                  label: 'In progress',
                                  value: '$pending',
                                  color: _orange,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: _SummaryTile(
                                  icon: Icons.check_circle_outline,
                                  label: 'Completed',
                                  value: '$done',
                                  color: _teal,
                                ),
                              ),
                            ],
                          ),
                        );
                      }
                      final appraisal = rows[i - 1];
                      return StaggeredEntrance(
                        controller: _entrance,
                        interval: entranceInterval(i, step: 0.04, span: 0.4),
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: _AppraisalTile(
                            appraisal: appraisal,
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
