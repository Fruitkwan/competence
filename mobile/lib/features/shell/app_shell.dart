// ignore_for_file: deprecated_member_use

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth_controller.dart';
import '../../data/repositories/notification_repository.dart';
import '../profile/profile_page.dart';

class _NavTab {
  const _NavTab(this.path, this.icon, this.activeIcon, this.label);
  final String path;
  final IconData icon;
  final IconData activeIcon;
  final String label;
}

const _tabs = <_NavTab>[
  _NavTab('/dashboard', Icons.home_outlined, Icons.home_rounded, 'Home'),
  _NavTab('/objectives', Icons.flag_outlined, Icons.flag_rounded, 'Objectives'),
  _NavTab('/appraisals', Icons.assessment_outlined, Icons.assessment_rounded,
      'Appraisals'),
  _NavTab('/idp', Icons.school_outlined, Icons.school_rounded, 'IDP'),
];

class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.child});
  final Widget child;

  int _indexFor(String location) {
    for (var i = 0; i < _tabs.length; i++) {
      if (location.startsWith(_tabs[i].path)) return i;
    }
    return 0;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location = GoRouterState.of(context).matchedLocation;
    final selected = _indexFor(location);
    final profile = ref.watch(currentProfileProvider).valueOrNull;
    final unread = ref.watch(unreadNotificationsCountProvider).valueOrNull ?? 0;
    final scheme = Theme.of(context).colorScheme;

    final avatarName = profile?.fullName ?? profile?.email;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 12,
        leadingWidth: 64,
        leading: Padding(
          padding: const EdgeInsets.only(left: 12),
          child: _AvatarButton(
            initials: initialsFor(avatarName),
            onTap: () => context.push('/profile'),
          ),
        ),
        title: const SizedBox.shrink(),
        actions: [
          _BellButton(
            unread: unread,
            color: scheme.onSurface,
            onTap: () => context.push('/notifications'),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: selected,
        onDestinationSelected: (i) => context.go(_tabs[i].path),
        destinations: [
          for (var i = 0; i < _tabs.length; i++)
            NavigationDestination(
              icon: Icon(_tabs[i].icon),
              selectedIcon: Icon(_tabs[i].activeIcon),
              label: _tabs[i].label,
            ),
        ],
      ),
    );
  }
}

class _AvatarButton extends StatelessWidget {
  const _AvatarButton({required this.initials, required this.onTap});

  final String initials;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final accent =
        Color.lerp(scheme.primary, scheme.tertiary, 0.55) ?? scheme.primary;
    return InkResponse(
      onTap: onTap,
      radius: 26,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [scheme.primary, accent],
          ),
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: scheme.primary.withOpacity(0.25),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        alignment: Alignment.center,
        child: Text(
          initials,
          style: TextStyle(
            color: scheme.onPrimary,
            fontWeight: FontWeight.w700,
            fontSize: 14,
            letterSpacing: 0.3,
          ),
        ),
      ),
    );
  }
}

class _BellButton extends StatelessWidget {
  const _BellButton({
    required this.unread,
    required this.color,
    required this.onTap,
  });

  final int unread;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onTap,
      tooltip: 'Notifications',
      icon: unread > 0
          ? Badge.count(
              count: unread,
              child: Icon(Icons.notifications_rounded, color: color),
            )
          : Icon(Icons.notifications_none_rounded, color: color),
    );
  }
}
