import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/supabase_client.dart';
import '../models/skill_gap.dart';

class SkillGapRepository {
  SkillGapRepository(this._supabase);
  final SupabaseClient _supabase;

  Future<List<SkillGap>> listForEmployee(String employeeId) async {
    final rows = await _supabase
        .from('skill_gaps')
        .select()
        .eq('employee_id', employeeId)
        .order('created_at', ascending: false);
    return rows
        .map<SkillGap>((r) => SkillGap.fromJson(Map<String, dynamic>.from(r)))
        .toList();
  }

  Future<List<Map<String, dynamic>>> topGapsByCompetency({int limit = 5}) async {
    // Aggregate via RPC; falls back to client-side roll-up if RPC missing.
    try {
      final rows = await _supabase.rpc('top_skill_gaps', params: {'p_limit': limit});
      return (rows as List)
          .map((r) => Map<String, dynamic>.from(r as Map))
          .toList();
    } on PostgrestException {
      final rows = await _supabase.from('skill_gaps').select('competency_name, severity');
      final counts = <String, int>{};
      for (final r in rows) {
        final name = (r['competency_name'] ?? '') as String;
        counts[name] = (counts[name] ?? 0) + 1;
      }
      final sorted = counts.entries.toList()
        ..sort((a, b) => b.value.compareTo(a.value));
      return sorted
          .take(limit)
          .map((e) => {'competency_name': e.key, 'count': e.value})
          .toList();
    }
  }
}

final skillGapRepositoryProvider = Provider<SkillGapRepository>((ref) {
  return SkillGapRepository(ref.watch(supabaseProvider));
});
