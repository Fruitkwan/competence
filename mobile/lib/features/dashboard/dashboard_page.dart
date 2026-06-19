// ignore_for_file: deprecated_member_use

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/appraisal_routes.dart';
import '../../core/auth_controller.dart';
import '../../core/role.dart';
import '../../data/models/cycle_objective.dart';
import '../../data/repositories/appraisal_repository.dart';
import '../../data/repositories/cycle_repository.dart';
import '../../data/repositories/objective_repository.dart';
import '../../shared/widgets/soft_ui.dart';
import '../../shared/widgets/status_chip.dart';

class DashboardPage extends ConsumerStatefulWidget {
  const DashboardPage({super.key});

  @override
  ConsumerState<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends ConsumerState<DashboardPage>
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
    final profile = ref.watch(currentProfileProvider).valueOrNull;
    final role = ref.watch(currentRoleProvider);
    final cycle = ref.watch(currentObjectiveCycleProvider);
    final myObjectives = ref.watch(myObjectivesProvider(null));
    final myAppraisals = ref.watch(myAppraisalsProvider);
    final pendingApprovals = role.canManage
        ? ref.watch(pendingObjectivesForApprovalProvider)
        : const AsyncValue<List<CycleObjective>>.data([]);

    final openObjectives = myObjectives.valueOrNull
        ?.where((o) => o.status != ObjectiveStatus.approved)
        .length;

    final secondaryMetric = role.canManage
        ? pendingApprovals.valueOrNull?.length
        : myAppraisals.valueOrNull?.length;

    final theme = Theme.of(context);

    final sections = <Widget>[
      _GradientHero(name: profile?.fullName ?? 'there', role: role),
      const SizedBox(height: 20),
      cycle.when(
        data: (c) => c == null
            ? const EmptyCard(
                icon: Icons.event_busy_outlined,
                title: 'No active cycle',
                body:
                    'HR has not opened a cycle yet. You will see goals and appraisals here when one starts.',
              )
            : _CycleCard(
                cycleName: c.name,
                status: c.status,
                endDate: c.endDate,
              ),
        loading: () => const SkeletonBlock(),
        error: (e, _) =>
            ErrorCard(title: 'Could not load cycle', detail: '$e'),
      ),
      const SizedBox(height: 16),
      Row(
        children: [
          Expanded(
            child: _MetricCard(
              label: 'My open objectives',
              value: openObjectives,
              icon: Icons.flag_rounded,
              accent: theme.colorScheme.primary,
              onTap: () => context.go('/objectives'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _MetricCard(
              label: role.canManage ? 'Awaiting my approval' : 'My appraisals',
              value: secondaryMetric,
              icon: role.canManage
                  ? Icons.rule_rounded
                  : Icons.assessment_rounded,
              accent: theme.colorScheme.tertiary,
              onTap: () => context.go(
                role.canManage ? '/objectives/review' : '/appraisals',
              ),
            ),
          ),
        ],
      ),
      const SizedBox(height: 28),
      const SectionHeader(title: 'Recent appraisals'),
      const SizedBox(height: 10),
      myAppraisals.when(
        loading: () => const SkeletonBlock(height: 72),
        error: (e, _) =>
            ErrorCard(title: 'Could not load appraisals', detail: '$e'),
        data: (rows) {
          if (rows.isEmpty) {
            return const EmptyCard(
              icon: Icons.inbox_outlined,
              title: 'No appraisals yet',
              body:
                  'You will see your appraisals here once HR opens a cycle.',
            );
          }
          return Column(
            children: [
              for (final a in rows.take(3))
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: SoftCard(
                    onTap: () => context.go(routeForAppraisal(a, role)),
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                a.appraisalPeriod ?? 'Appraisal',
                                style: theme.textTheme.titleSmall?.copyWith(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Updated ${DateFormat.yMMMd().format(a.updatedAt)}',
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: theme.colorScheme.onSurfaceVariant,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        StatusChip(a.status, tone: _toneForStatus(a.status)),
                      ],
                    ),
                  ),
                ),
            ],
          );
        },
      ),
      if (role.canManage && (pendingApprovals.valueOrNull?.isNotEmpty ?? false)) ...[
        const SizedBox(height: 24),
        const SectionHeader(title: 'Awaiting your approval'),
        const SizedBox(height: 10),
        for (final o in pendingApprovals.value!.take(3))
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: SoftCard(
              onTap: () => context.go('/objectives/review'),
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: theme.colorScheme.secondaryContainer,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      Icons.pending_actions_rounded,
                      size: 18,
                      color: theme.colorScheme.onSecondaryContainer,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          o.title,
                          style: theme.textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          o.employeeName ?? o.employeeId,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.chevron_right_rounded,
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ],
              ),
            ),
          ),
      ],
    ];

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(currentObjectiveCycleProvider);
        ref.invalidate(myObjectivesProvider(null));
        ref.invalidate(myAppraisalsProvider);
        ref.invalidate(pendingObjectivesForApprovalProvider);
      },
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
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

class _GradientHero extends StatelessWidget {
  const _GradientHero({required this.name, required this.role});
  final String name;
  final AppRole role;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final theme = Theme.of(context);
    final hour = DateTime.now().hour;
    final greeting = hour < 12
        ? 'Good morning'
        : hour < 18
            ? 'Good afternoon'
            : 'Good evening';

    final accent =
        Color.lerp(scheme.primary, scheme.tertiary, 0.55) ?? scheme.primary;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [scheme.primary, accent],
        ),
        boxShadow: [
          BoxShadow(
            color: scheme.primary.withOpacity(0.28),
            blurRadius: 22,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Stack(
          children: [
            Positioned(
              right: -36,
              top: -36,
              child: _decorativeCircle(scheme.onPrimary.withOpacity(0.10), 160),
            ),
            Positioned(
              right: 60,
              bottom: -52,
              child: _decorativeCircle(scheme.onPrimary.withOpacity(0.06), 110),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 22, 20, 22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$greeting,',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: scheme.onPrimary.withOpacity(0.85),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    name,
                    style: theme.textTheme.headlineMedium?.copyWith(
                      color: scheme.onPrimary,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.5,
                      height: 1.1,
                    ),
                  ),
                  const SizedBox(height: 14),
                  _HeroRoleChip(label: role.label),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _decorativeCircle(Color color, double size) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(shape: BoxShape.circle, color: color),
    );
  }
}

class _HeroRoleChip extends StatelessWidget {
  const _HeroRoleChip({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: scheme.onPrimary.withOpacity(0.18),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: scheme.onPrimary.withOpacity(0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          PulsingDot(color: scheme.onPrimary),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              color: scheme.onPrimary,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.2,
            ),
          ),
        ],
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
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final daysLeft = endDate.difference(DateTime.now()).inDays;
    return SoftCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: scheme.primaryContainer,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  Icons.calendar_today_rounded,
                  size: 16,
                  color: scheme.onPrimaryContainer,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  cycleName,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              StatusChip(status, tone: StatusTone.info),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            daysLeft > 0
                ? 'Ends ${DateFormat.yMMMd().format(endDate)} · $daysLeft days left'
                : 'Ended ${DateFormat.yMMMd().format(endDate)}',
            style: theme.textTheme.bodySmall?.copyWith(
              color: scheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.accent,
    required this.onTap,
  });

  final String label;
  final int? value;
  final IconData icon;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return SoftCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: accent.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 18, color: accent),
              ),
              const Spacer(),
              Icon(
                Icons.arrow_outward_rounded,
                size: 16,
                color: scheme.onSurfaceVariant.withOpacity(0.5),
              ),
            ],
          ),
          const SizedBox(height: 14),
          AnimatedCount(
            value: value,
            style: theme.textTheme.headlineMedium?.copyWith(
              fontWeight: FontWeight.w800,
              color: accent,
              letterSpacing: -1,
              height: 1,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: theme.textTheme.bodySmall?.copyWith(
              color: scheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}
