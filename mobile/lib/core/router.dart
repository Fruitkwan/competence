import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/appraisals/appraisals_list_page.dart';
import '../features/appraisals/hr_finalize_page.dart';
import '../features/appraisals/manager_review_page.dart';
import '../features/appraisals/self_assessment_page.dart';
import '../features/auth/login_page.dart';
import '../features/auth/splash_page.dart';
import '../features/calibration/calibration_page.dart';
import '../features/dashboard/dashboard_page.dart';
import '../features/employees/employees_directory_page.dart';
import '../features/hr_dashboard/hr_dashboard_page.dart';
import '../features/idp/idp_page.dart';
import '../features/notifications/notifications_page.dart';
import '../features/objectives/manager_objectives_page.dart';
import '../features/objectives/objective_edit_page.dart';
import '../features/objectives/objectives_page.dart';
import '../features/shell/app_shell.dart';
import 'supabase_client.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final notifier = _AuthRouterNotifier(ref);
  return GoRouter(
    refreshListenable: notifier,
    initialLocation: '/splash',
    redirect: (context, state) {
      final user = ref.read(supabaseProvider).auth.currentUser;
      final loggedIn = user != null;
      final loc = state.matchedLocation;

      if (loc == '/splash') return null;

      final inAuth = loc.startsWith('/login');
      if (!loggedIn && !inAuth) return '/login';
      if (loggedIn && inAuth) return '/dashboard';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashPage()),
      GoRoute(path: '/login', builder: (_, __) => const LoginPage()),
      ShellRoute(
        builder: (context, state, child) => AppShell(child: child),
        routes: [
          GoRoute(
            path: '/dashboard',
            builder: (_, __) => const DashboardPage(),
          ),
          GoRoute(
            path: '/objectives',
            builder: (_, __) => const ObjectivesPage(),
            routes: [
              GoRoute(
                path: 'new',
                builder: (_, state) => ObjectiveEditPage(
                  cycleId: state.uri.queryParameters['cycle'],
                ),
              ),
              GoRoute(
                path: ':id/edit',
                builder: (_, state) =>
                    ObjectiveEditPage(objectiveId: state.pathParameters['id']),
              ),
              GoRoute(
                path: 'review',
                builder: (_, __) => const ManagerObjectivesPage(),
              ),
            ],
          ),
          GoRoute(
            path: '/appraisals',
            builder: (_, __) => const AppraisalsListPage(),
            routes: [
              GoRoute(
                path: ':id/self',
                builder: (_, state) =>
                    SelfAssessmentPage(appraisalId: state.pathParameters['id']!),
              ),
              GoRoute(
                path: ':id/review',
                builder: (_, state) =>
                    ManagerReviewPage(appraisalId: state.pathParameters['id']!),
              ),
              GoRoute(
                path: ':id/finalize',
                builder: (_, state) =>
                    HrFinalizePage(appraisalId: state.pathParameters['id']!),
              ),
            ],
          ),
          GoRoute(
            path: '/calibration',
            builder: (_, __) => const CalibrationPage(),
          ),
          GoRoute(
            path: '/employees',
            builder: (_, __) => const EmployeesDirectoryPage(),
          ),
          GoRoute(
            path: '/idp',
            builder: (_, __) => const IdpPage(),
          ),
          GoRoute(
            path: '/notifications',
            builder: (_, __) => const NotificationsPage(),
          ),
          GoRoute(
            path: '/hr-dashboard',
            builder: (_, __) => const HrDashboardPage(),
          ),
        ],
      ),
    ],
  );
});

/// Bridges Supabase auth state changes into go_router's refresh mechanism.
class _AuthRouterNotifier extends ChangeNotifier {
  _AuthRouterNotifier(this._ref) {
    _sub = _ref.read(supabaseProvider).auth.onAuthStateChange.listen((_) {
      notifyListeners();
    });
  }
  final Ref _ref;
  late final StreamSubscription _sub;

  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }
}
