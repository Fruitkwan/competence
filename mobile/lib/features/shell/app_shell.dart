// ignore_for_file: deprecated_member_use

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth_controller.dart';
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
    final showShellAvatar = !location.startsWith('/dashboard');

    final avatarName = profile?.fullName ?? profile?.email;

    return Scaffold(
      appBar: AppBar(
        toolbarHeight: showShellAvatar ? kToolbarHeight : 0,
        titleSpacing: 12,
        leadingWidth: showShellAvatar ? 64 : 0,
        leading: showShellAvatar
            ? Padding(
                padding: const EdgeInsets.only(left: 12),
                child: _AvatarButton(
                  initials: initialsFor(avatarName),
                  onTap: () => context.push('/profile'),
                ),
              )
            : null,
        title: const SizedBox.shrink(),
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
    return InkResponse(
      onTap: onTap,
      radius: 26,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: const Color(0xFF0070B8).withOpacity(0.12),
          shape: BoxShape.circle,
        ),
        alignment: Alignment.center,
        child: Text(
          initials,
          style: const TextStyle(
            color: Color(0xFF0070B8),
            fontWeight: FontWeight.w700,
            fontSize: 14,
            letterSpacing: 0.3,
          ),
        ),
      ),
    );
  }
}
