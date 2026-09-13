import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/supabase_client.dart';
import '../models/profile.dart';

class ProfileRepository {
  ProfileRepository(this._supabase);
  final SupabaseClient _supabase;

  Future<Profile?> getById(String id) async {
    final row = await _supabase
        .from('profiles')
        .select()
        .eq('id', id)
        .maybeSingle();
    if (row == null) return null;
    return Profile.fromJson(row);
  }
}

final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  return ProfileRepository(ref.watch(supabaseProvider));
});
