import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../data/models/profile.dart';
import '../data/repositories/profile_repository.dart';
import 'env.dart';
import 'role.dart';
import 'supabase_client.dart';

/// Current profile row for the signed-in user, or null.
final currentProfileProvider = FutureProvider<Profile?>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return null;
  final repo = ref.watch(profileRepositoryProvider);
  return repo.getById(user.id);
});

/// Convenience: current role (defaults to employee if profile not loaded yet).
final currentRoleProvider = Provider<AppRole>((ref) {
  final profile = ref.watch(currentProfileProvider).valueOrNull;
  return roleFromString(profile?.role);
});

class AuthController {
  AuthController(this._supabase);
  final SupabaseClient _supabase;

  Future<void> sendOtp(String email) async {
    // Supabase sends OTP when the email template uses {{ .Token }}.
    await _supabase.auth.signInWithOtp(
      email: email,
      shouldCreateUser: false,
    );
  }

  Future<AuthResponse> verifyOtp({
    required String email,
    required String token,
  }) {
    return _supabase.auth.verifyOTP(
      email: email,
      token: token,
      type: OtpType.email,
    );
  }

  Future<void> signOut() => _supabase.auth.signOut();

  /// Debug-only password sign-in to skip the OTP flow during local development.
  Future<void> devAutoSignIn() async {
    assert(kDebugMode);
    if (!Env.devAutoLoginEnabled) return;
    await _supabase.auth.signInWithPassword(
      email: Env.devAutoLoginEmail,
      password: Env.devAutoLoginPassword,
    );
  }
}

final authControllerProvider = Provider<AuthController>((ref) {
  return AuthController(ref.watch(supabaseProvider));
});
