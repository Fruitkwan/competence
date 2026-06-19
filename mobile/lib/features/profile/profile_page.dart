// ignore_for_file: deprecated_member_use

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth_controller.dart';
import '../../core/error_handler.dart';
import '../../core/role.dart';
import '../../data/models/profile.dart';
import '../../shared/widgets/soft_ui.dart';

class ProfilePage extends ConsumerStatefulWidget {
  const ProfilePage({super.key});

  @override
  ConsumerState<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends ConsumerState<ProfilePage>
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
    final profileAsync = ref.watch(currentProfileProvider);
    final role = ref.watch(currentRoleProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/dashboard'),
        ),
        title: const Text('Profile'),
      ),
      body: profileAsync.when(
        loading: () => const Padding(
          padding: EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: Column(
            children: [
              SkeletonBlock(height: 168),
              SizedBox(height: 16),
              SkeletonBlock(height: 200),
            ],
          ),
        ),
        error: (e, _) => Padding(
          padding: const EdgeInsets.all(16),
          child: ErrorCard(
            title: 'Could not load profile',
            detail: describeError(e),
          ),
        ),
        data: (profile) {
          final sections = <Widget>[
            _ProfileHero(profile: profile, role: role),
            const SizedBox(height: 16),
            _AboutCard(profile: profile),
            if (role.canManage || role.isHr) ...[
              const SizedBox(height: 24),
              const SectionHeader(title: 'Workspace'),
              const SizedBox(height: 10),
              ..._workspaceActions(context, role),
            ],
            const SizedBox(height: 28),
            _SignOutButton(onPressed: () => _signOut(context)),
            const SizedBox(height: 24),
          ];

          return ListView.builder(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            itemCount: sections.length,
            itemBuilder: (context, index) {
              return StaggeredEntrance(
                controller: _entrance,
                interval: entranceInterval(index),
                child: sections[index],
              );
            },
          );
        },
      ),
    );
  }

  List<Widget> _workspaceActions(BuildContext context, AppRole role) {
    final tiles = <Widget>[];
    if (role.canManage) {
      tiles.add(_ActionTile(
        icon: Icons.rule_rounded,
        title: 'Review objectives',
        subtitle: 'Approve or request revisions',
        onTap: () => context.go('/objectives/review'),
      ));
    }
    if (role.isHr) {
      tiles
        ..add(_ActionTile(
          icon: Icons.people_alt_rounded,
          title: 'Employee directory',
          subtitle: 'Browse and manage employees',
          onTap: () => context.go('/employees'),
        ))
        ..add(_ActionTile(
          icon: Icons.tune_rounded,
          title: 'Calibration',
          subtitle: 'Calibrate appraisal ratings',
          onTap: () => context.go('/calibration'),
        ))
        ..add(_ActionTile(
          icon: Icons.bar_chart_rounded,
          title: 'HR dashboard',
          subtitle: 'Organization-wide metrics',
          onTap: () => context.go('/hr-dashboard'),
        ));
    }
    return tiles
        .map((t) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: t,
            ))
        .toList();
  }

  Future<void> _signOut(BuildContext context) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Sign out?'),
        content: const Text('You will need to sign back in to continue.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    await ref.read(authControllerProvider).signOut();
    if (!context.mounted) return;
    context.go('/login');
  }
}

class _ProfileHero extends StatelessWidget {
  const _ProfileHero({required this.profile, required this.role});
  final Profile? profile;
  final AppRole role;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final theme = Theme.of(context);
    final accent =
        Color.lerp(scheme.primary, scheme.tertiary, 0.55) ?? scheme.primary;
    final name = profile?.fullName ?? profile?.email ?? 'Signed in';
    final email = profile?.email ?? '';

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
                  Row(
                    children: [
                      _Avatar(
                        initials: initialsFor(name),
                        size: 64,
                        bg: scheme.onPrimary.withOpacity(0.18),
                        fg: scheme.onPrimary,
                        border: scheme.onPrimary.withOpacity(0.32),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              name,
                              style: theme.textTheme.titleLarge?.copyWith(
                                color: scheme.onPrimary,
                                fontWeight: FontWeight.w700,
                                letterSpacing: -0.3,
                                height: 1.15,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            if (email.isNotEmpty) ...[
                              const SizedBox(height: 2),
                              Text(
                                email,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: scheme.onPrimary.withOpacity(0.85),
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: scheme.onPrimary.withOpacity(0.18),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                          color: scheme.onPrimary.withOpacity(0.25)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        PulsingDot(color: scheme.onPrimary, size: 10),
                        const SizedBox(width: 8),
                        Text(
                          role.label,
                          style: TextStyle(
                            color: scheme.onPrimary,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.2,
                          ),
                        ),
                      ],
                    ),
                  ),
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

class _Avatar extends StatelessWidget {
  const _Avatar({
    required this.initials,
    required this.size,
    required this.bg,
    required this.fg,
    this.border,
  });

  final String initials;
  final double size;
  final Color bg;
  final Color fg;
  final Color? border;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: bg,
        shape: BoxShape.circle,
        border: border != null ? Border.all(color: border!, width: 1.5) : null,
      ),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: TextStyle(
          color: fg,
          fontWeight: FontWeight.w700,
          fontSize: size * 0.36,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}

String initialsFor(String? name) {
  if (name == null || name.trim().isEmpty) return '?';
  final parts = name.trim().split(RegExp(r'\s+'));
  if (parts.length == 1) {
    final p = parts[0];
    return p.length >= 2
        ? p.substring(0, 2).toUpperCase()
        : p.substring(0, 1).toUpperCase();
  }
  return (parts.first.substring(0, 1) + parts.last.substring(0, 1))
      .toUpperCase();
}

class _AboutCard extends StatelessWidget {
  const _AboutCard({required this.profile});
  final Profile? profile;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final rows = <_AboutRow>[
      _AboutRow(
        icon: Icons.work_outline_rounded,
        label: 'Job title',
        value: profile?.jobTitle,
      ),
      _AboutRow(
        icon: Icons.apartment_rounded,
        label: 'Department',
        value: profile?.departmentId,
      ),
      _AboutRow(
        icon: Icons.badge_outlined,
        label: 'Employee ID',
        value: profile?.employeeId,
      ),
      _AboutRow(
        icon: Icons.supervisor_account_outlined,
        label: 'Manager',
        value: profile?.managerId,
      ),
      _AboutRow(
        icon: Icons.public_rounded,
        label: 'Country',
        value: profile?.countryCode,
      ),
      _AboutRow(
        icon: Icons.workspaces_outline,
        label: 'Cluster',
        value: profile?.cluster,
      ),
    ].where((r) => (r.value ?? '').isNotEmpty).toList();

    return SoftCard(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Text(
              'About',
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w700,
                letterSpacing: -0.2,
              ),
            ),
          ),
          if (rows.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Text(
                'No additional details on file.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
              ),
            )
          else
            for (var i = 0; i < rows.length; i++) ...[
              if (i > 0)
                Divider(
                  height: 1,
                  color: scheme.outlineVariant.withOpacity(0.4),
                ),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Row(
                  children: [
                    Icon(rows[i].icon,
                        size: 18, color: scheme.onSurfaceVariant),
                    const SizedBox(width: 12),
                    Text(
                      rows[i].label,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                    const Spacer(),
                    Flexible(
                      child: Text(
                        rows[i].value!,
                        textAlign: TextAlign.right,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ],
        ],
      ),
    );
  }
}

class _AboutRow {
  const _AboutRow({required this.icon, required this.label, this.value});
  final IconData icon;
  final String label;
  final String? value;
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return SoftCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: scheme.primaryContainer,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: scheme.onPrimaryContainer, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          Icon(Icons.chevron_right_rounded, color: scheme.onSurfaceVariant),
        ],
      ),
    );
  }
}

class _SignOutButton extends StatelessWidget {
  const _SignOutButton({required this.onPressed});
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Pressable(
      onTap: onPressed,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: scheme.errorContainer,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: scheme.error.withOpacity(0.25)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.logout_rounded, color: scheme.onErrorContainer),
            const SizedBox(width: 8),
            Text(
              'Sign out',
              style: TextStyle(
                color: scheme.onErrorContainer,
                fontWeight: FontWeight.w700,
                fontSize: 15,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
