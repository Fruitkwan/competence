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
import '../../data/repositories/notification_repository.dart';
import '../../data/repositories/objective_repository.dart';
import '../../shared/widgets/soft_ui.dart';
import '../../shared/widgets/status_chip.dart';

const _teal = Color(0xFF10B7B5);
const _blue = Color(0xFF0070B8);
const _orange = Color(0xFFF59E0B);

class DashboardPage extends ConsumerWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(currentProfileProvider).valueOrNull;
    final role = ref.watch(currentRoleProvider);
    final cycle = ref.watch(currentObjectiveCycleProvider);
    final myObjectives = ref.watch(myObjectivesProvider(null));
    final myAppraisals = ref.watch(myAppraisalsProvider);
    final unread = ref.watch(unreadNotificationsCountProvider).valueOrNull;
    final pendingApprovals = role.canManage
        ? ref.watch(pendingObjectivesForApprovalProvider)
        : const AsyncValue<List<CycleObjective>>.data([]);

    final openObjectives = myObjectives.valueOrNull
        ?.where((o) => o.status != ObjectiveStatus.approved)
        .length;
    final appraisalCount = role.canManage
        ? pendingApprovals.valueOrNull?.length
        : myAppraisals.valueOrNull?.length;
    final daysLeft = cycle.valueOrNull?.endDate.difference(DateTime.now()).inDays;

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(currentObjectiveCycleProvider);
        ref.invalidate(myObjectivesProvider(null));
        ref.invalidate(myAppraisalsProvider);
        ref.invalidate(pendingObjectivesForApprovalProvider);
        ref.invalidate(unreadNotificationsCountProvider);
      },
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
        children: [
          _Header(name: profile?.fullName ?? 'there', role: role),
          const SizedBox(height: 18),
          GridView.count(
            crossAxisCount: 2,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.55,
            physics: const NeverScrollableScrollPhysics(),
            shrinkWrap: true,
            children: [
              _StatTile(
                icon: Icons.flag_outlined,
                label: 'Open objectives',
                value: _num(openObjectives),
                color: _blue,
                onTap: () => context.go('/objectives'),
              ),
              _StatTile(
                icon: role.canManage
                    ? Icons.fact_check_outlined
                    : Icons.assessment_outlined,
                label: role.canManage ? 'For approval' : 'Appraisals',
                value: _num(appraisalCount),
                color: _teal,
                onTap: () => context.go(
                  role.canManage ? '/objectives/review' : '/appraisals',
                ),
              ),
              _StatTile(
                icon: Icons.calendar_month_outlined,
                label: 'Cycle days left',
                value: daysLeft == null ? '-' : daysLeft.clamp(0, 999).toString(),
                color: _orange,
              ),
              _StatTile(
                icon: Icons.notifications_none_outlined,
                label: 'Unread',
                value: _num(unread),
                color: _teal,
                onTap: () => context.go('/notifications'),
              ),
            ],
          ),
          const SizedBox(height: 24),
          SectionHeader(
            title: "Today's focus",
            trailing: TextButton(
              onPressed: () => context.go('/objectives'),
              child: const Text('See more'),
            ),
          ),
          const SizedBox(height: 10),
          cycle.when(
            data: (c) => c == null
                ? const EmptyCard(
                    icon: Icons.event_busy_outlined,
                    title: 'No active cycle',
                    body: 'HR has not opened a cycle yet.',
                  )
                : _FocusCard(
                    title: c.name,
                    subtitle: 'Ends ${DateFormat.yMMMd().format(c.endDate)}',
                    status: c.status,
                    color: _blue,
                  ),
            loading: () => const SkeletonBlock(height: 86),
            error: (e, _) =>
                ErrorCard(title: 'Could not load cycle', detail: '$e'),
          ),
          if (role.canManage && (pendingApprovals.valueOrNull?.isNotEmpty ?? false)) ...[
            const SizedBox(height: 10),
            _FocusCard(
              title: '${pendingApprovals.value!.length} objectives need review',
              subtitle: 'Approve or request revisions',
              status: 'Pending',
              color: _orange,
              onTap: () => context.go('/objectives/review'),
            ),
          ],
          const SizedBox(height: 24),
          SectionHeader(
            title: 'Recent activity',
            trailing: TextButton(
              onPressed: () => context.go('/appraisals'),
              child: const Text('View all'),
            ),
          ),
          const SizedBox(height: 10),
          myAppraisals.when(
            loading: () => const SkeletonBlock(height: 92),
            error: (e, _) =>
                ErrorCard(title: 'Could not load appraisals', detail: '$e'),
            data: (rows) {
              if (rows.isEmpty) {
                return const EmptyCard(
                  icon: Icons.inbox_outlined,
                  title: 'No appraisals yet',
                  body: 'You will see appraisal activity here.',
                );
              }
              return Column(
                children: [
                  for (final a in rows.take(4))
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _ActivityRow(
                        icon: Icons.assignment_turned_in_outlined,
                        title: a.appraisalPeriod ?? 'Appraisal',
                        subtitle:
                            'Updated ${DateFormat.yMMMd().format(a.updatedAt)}',
                        status: a.status,
                        color: _teal,
                        onTap: () => context.go(routeForAppraisal(a, role)),
                      ),
                    ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

String _num(int? value) => value?.toString() ?? '-';

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

class _Header extends StatelessWidget {
  const _Header({required this.name, required this.role});
  final String name;
  final AppRole role;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final initials = name
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .take(2)
        .map((p) => p[0].toUpperCase())
        .join();
    return Row(
      children: [
        InkResponse(
          onTap: () => context.push('/profile'),
          radius: 28,
          child: CircleAvatar(
            radius: 24,
            backgroundColor: _blue.withOpacity(0.12),
            foregroundColor: _blue,
            child: Text(initials.isEmpty ? 'DG' : initials),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Welcome back!',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              Text(
                role.label,
                style: theme.textTheme.bodySmall?.copyWith(color: _teal),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SoftCard(
      onTap: onTap,
      padding: const EdgeInsets.all(14),
      borderRadius: 18,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Text(
                value,
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const Spacer(),
              _IconBubble(icon: icon, color: color),
            ],
          ),
          Text(
            label,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

class _FocusCard extends StatelessWidget {
  const _FocusCard({
    required this.title,
    required this.subtitle,
    required this.status,
    required this.color,
    this.onTap,
  });

  final String title;
  final String subtitle;
  final String status;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SoftCard(
      onTap: onTap,
      leadingAccent: color,
      padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          StatusChip(status, tone: _toneForStatus(status)),
        ],
      ),
    );
  }
}

class _ActivityRow extends StatelessWidget {
  const _ActivityRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.status,
    required this.color,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String status;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SoftCard(
      onTap: onTap,
      padding: const EdgeInsets.all(12),
      borderRadius: 18,
      child: Row(
        children: [
          _IconBubble(icon: icon, color: color),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          StatusChip(status, tone: _toneForStatus(status)),
        ],
      ),
    );
  }
}

class _IconBubble extends StatelessWidget {
  const _IconBubble({required this.icon, required this.color});
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 34,
      height: 34,
      decoration: BoxDecoration(
        color: color.withOpacity(0.10),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Icon(icon, size: 18, color: color),
    );
  }
}
