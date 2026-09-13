import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/supabase_client.dart';

class DeviceTokenRepository {
  DeviceTokenRepository(this._supabase);
  final SupabaseClient _supabase;

  Future<void> upsert({required String token, required String platform}) async {
    final user = _supabase.auth.currentUser;
    if (user == null) return;
    await _supabase.from('device_tokens').upsert(
      {
        'user_id': user.id,
        'token': token,
        'platform': platform,
        'last_seen_at': DateTime.now().toUtc().toIso8601String(),
      },
      onConflict: 'token',
    );
  }

  Future<void> remove(String token) async {
    await _supabase.from('device_tokens').delete().eq('token', token);
  }
}

final deviceTokenRepositoryProvider = Provider<DeviceTokenRepository>((ref) {
  return DeviceTokenRepository(ref.watch(supabaseProvider));
});
