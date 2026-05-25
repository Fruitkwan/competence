import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth_controller.dart';
import '../../core/role.dart';
import '../../data/repositories/notification_repository.dart';

class _NavTab {
  const _NavTab(this.path, this.icon, this.label);
  final String path;
  final IconData icon;
  final String label;
}

const _tabs = <_NavTab>[
  _NavTab('/dashboard', Icons.home_outlined, 'Home'),
  _NavTab('/objectives', Icons.flag_outlined, 'Objectives'),
  _NavTab('/appraisals', Icons.assessment_outlined, 'Appraisals'),
  _NavTab('/idp', Icons.school_outlined, 'IDP'),
  _NavTab('/notifications', Icons.notifications_outlined, 'Inbox'),
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
    final role = ref.watch(currentRoleProvider);
    final profile = ref.watch(currentProfileProvider).valueOrNull;
    final unread = ref.watch(unreadNotificationsCountProvider).valueOrNull ?? 0;

    return Scaffold(
      appBar: AppBar(
        title: Text(_tabs[selected].label),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.account_circle_outlined),
            onSelected: (value) async {
              if (value == 'logout') {
                await ref.read(authControllerProvider).signOut();
                if (context.mounted) context.go('/login');
              } else if (value == 'employees') {
                context.go('/employees');
              } else if (value == 'calibration') {
                context.go('/calibration');
              } else if (value == 'hr_dashboard') {
                context.go('/hr-dashboard');
              } else if (value == 'review') {
                context.go('/objectives/review');
              }
            },
            itemBuilder: (context) {
              return [
                PopupMenuItem<String>(
                  enabled: false,
                  child: Text(
                    profile?.fullName ?? profile?.email ?? 'Signed in',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
                PopupMenuItem<String>(
                  enabled: false,
                  child: Text(
                    role.label,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
                const PopupMenuDivider(),
                if (role.canManage)
                  const PopupMenuItem(
                    value: 'review',
                    child: ListTile(
                      leading: Icon(Icons.rule_outlined),
                      title: Text('Review objectives'),
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                if (role.isHr) ...[
                  const PopupMenuItem(
                    value: 'employees',
                    child: ListTile(
                      leading: Icon(Icons.people_outline),
                      title: Text('Employee directory'),
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                  const PopupMenuItem(
                    value: 'calibration',
                    child: ListTile(
                      leading: Icon(Icons.tune),
                      title: Text('Calibration'),
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                  const PopupMenuItem(
                    value: 'hr_dashboard',
                    child: ListTile(
                      leading: Icon(Icons.bar_chart_outlined),
                      title: Text('HR dashboard'),
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                ],
                const PopupMenuDivider(),
                const PopupMenuItem(
                  value: 'logout',
                  child: ListTile(
                    leading: Icon(Icons.logout),
                    title: Text('Sign out'),
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              ];
            },
          ),
        ],
      ),
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: selected,
        onDestinationSelected: (i) => context.go(_tabs[i].path),
        destinations: [
          for (var i = 0; i < _tabs.length; i++)
            NavigationDestination(
              icon: _tabs[i].path == '/notifications' && unread > 0
                  ? Badge.count(count: unread, child: Icon(_tabs[i].icon))
                  : Icon(_tabs[i].icon),
              label: _tabs[i].label,
            ),
        ],
      ),
    );
  }
}
