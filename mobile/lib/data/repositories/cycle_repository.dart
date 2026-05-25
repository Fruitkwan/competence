import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/supabase_client.dart';
import '../models/appraisal_cycle.dart';

class CycleRepository {
  CycleRepository(this._supabase);
  final SupabaseClient _supabase;

  Future<List<AppraisalCycle>> listOpen() async {
    final rows = await _supabase
        .from('appraisal_cycles')
        .select()
        .neq('status', 'closed')
        .order('start_date', ascending: false);
    return (rows as List)
        .map((r) => AppraisalCycle.fromJson(r as Map<String, dynamic>))
        .toList();
  }

  Future<AppraisalCycle?> currentForObjectives() async {
    final row = await _supabase
        .from('appraisal_cycles')
        .select()
        .eq('status', 'objective_setting')
        .order('start_date', ascending: false)
        .limit(1)
        .maybeSingle();
    if (row != null) return AppraisalCycle.fromJson(row);
    // Fall back to any open cycle.
    final any = await _supabase
        .from('appraisal_cycles')
        .select()
        .neq('status', 'closed')
        .order('start_date', ascending: false)
        .limit(1)
        .maybeSingle();
    return any == null ? null : AppraisalCycle.fromJson(any);
  }

  Future<AppraisalCycle?> getById(String id) async {
    final row = await _supabase
        .from('appraisal_cycles')
        .select()
        .eq('id', id)
        .maybeSingle();
    return row == null ? null : AppraisalCycle.fromJson(row);
  }
}

final cycleRepositoryProvider = Provider<CycleRepository>((ref) {
  return CycleRepository(ref.watch(supabaseProvider));
});

final openCyclesProvider = FutureProvider<List<AppraisalCycle>>((ref) {
  return ref.watch(cycleRepositoryProvider).listOpen();
});

final currentObjectiveCycleProvider = FutureProvider<AppraisalCycle?>((ref) {
  return ref.watch(cycleRepositoryProvider).currentForObjectives();
});
