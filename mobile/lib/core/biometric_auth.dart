import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'supabase_client.dart';

const _biometricEnabledKey = 'biometric_login_enabled';

class BiometricAuthService {
  BiometricAuthService(this._auth, this._supabase);

  final LocalAuthentication _auth;
  final SupabaseClient _supabase;

  Future<bool> get canUse async {
    try {
      return await _auth.isDeviceSupported() && await _auth.canCheckBiometrics;
    } on PlatformException {
      return false;
    }
  }

  Future<bool> authenticate() async {
    try {
      return await _auth.authenticate(
        localizedReason: 'Unlock Dhofar Global',
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth: true,
        ),
      );
    } on PlatformException {
      return false;
    }
  }

  Future<bool> isEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_biometricEnabledKey) ?? false;
  }

  Future<void> enable() async {
    if (_supabase.auth.currentUser == null) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_biometricEnabledKey, true);
  }
}

final biometricAuthProvider = Provider<BiometricAuthService>((ref) {
  return BiometricAuthService(
    LocalAuthentication(),
    ref.watch(supabaseProvider),
  );
});
