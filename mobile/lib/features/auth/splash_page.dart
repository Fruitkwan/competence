import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth_controller.dart';
import '../../core/biometric_auth.dart';
import '../../core/env.dart';
import '../../core/supabase_client.dart';

class SplashPage extends ConsumerStatefulWidget {
  const SplashPage({super.key});

  @override
  ConsumerState<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends ConsumerState<SplashPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _decide());
  }

  Future<void> _decide() async {
    final supabase = ref.read(supabaseProvider);

    if (Env.devAutoLoginEnabled && supabase.auth.currentUser == null) {
      try {
        await ref.read(authControllerProvider).devAutoSignIn();
      } catch (e, st) {
        debugPrint('Dev auto-login failed: $e\n$st');
      }
    }

    if (!mounted) return;
    final user = ref.read(supabaseProvider).auth.currentUser;
    if (user == null) {
      context.go('/login');
    } else {
      final biometrics = ref.read(biometricAuthProvider);
      if (await biometrics.isEnabled()) {
        final ok = await biometrics.authenticate();
        if (!ok) {
          await supabase.auth.signOut();
          if (mounted) context.go('/login');
          return;
        }
      }
      context.go('/dashboard');
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: CircularProgressIndicator(),
      ),
    );
  }
}
