import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/supabase_client.dart';
import '../models/cycle_objective.dart';
import '../models/objective_comment.dart';

class ObjectiveRepository {
  ObjectiveRepository(this._supabase);
  final SupabaseClient _supabase;

  Future<List<CycleObjective>> listMyObjectives({String? cycleId}) async {
    final user = _supabase.auth.currentUser;
    if (user == null) return const [];
    final query = _supabase
        .from('cycle_objectives')
        .select()
        .eq('employee_id', user.id);
    final filtered = cycleId == null ? query : query.eq('cycle_id', cycleId);
    final rows = await filtered.order('created_at', ascending: false);
    return (rows as List)
        .map((r) => CycleObjective.fromJson(r as Map<String, dynamic>))
        .toList();
  }

  /// Manager view: pending approvals for my direct reports.
  Future<List<CycleObjective>> listPendingForApproval() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return const [];

    // Step 1: who are my direct reports?
    final reports = await _supabase
        .from('profiles')
        .select('id, full_name')
        .eq('manager_id', user.id);
    if (reports.isEmpty) return const [];
    final ids = reports.map((r) => r['id'] as String).toList();
    final nameById = <String, String>{
      for (final r in reports)
        (r['id'] as String): ((r['full_name'] ?? '') as String),
    };

    // Step 2: their submitted objectives.
    final rows = await _supabase
        .from('cycle_objectives')
        .select()
        .eq('status', 'submitted')
        .inFilter('employee_id', ids)
        .order('updated_at', ascending: false);

    return rows.map<CycleObjective>((row) {
      final map = Map<String, dynamic>.from(row);
      map['employee_name'] = nameById[map['employee_id']];
      return CycleObjective.fromJson(map);
    }).toList();
  }

  Future<CycleObjective?> getById(String id) async {
    final row = await _supabase
        .from('cycle_objectives')
        .select()
        .eq('id', id)
        .maybeSingle();
    return row == null ? null : CycleObjective.fromJson(row);
  }

  Future<List<ObjectiveComment>> listComments(String objectiveId) async {
    final rows = await _supabase
        .from('objective_comments')
        .select()
        .eq('objective_id', objectiveId)
        .order('created_at');
    // Resolve author names in a second query (avoids embed-name fragility).
    final authorIds = {for (final r in rows) r['author_id'] as String}.toList();
    final names = <String, String>{};
    if (authorIds.isNotEmpty) {
      final profiles = await _supabase
          .from('profiles')
          .select('id, full_name')
          .inFilter('id', authorIds);
      for (final p in profiles) {
        names[p['id'] as String] = (p['full_name'] ?? '') as String;
      }
    }
    return rows.map<ObjectiveComment>((r) {
      final map = Map<String, dynamic>.from(r);
      map['author_name'] = names[map['author_id']];
      return ObjectiveComment.fromJson(map);
    }).toList();
  }

  Future<CycleObjective> create({
    required String cycleId,
    required String title,
    String? description,
    String? successCriteria,
    double weight = 0,
    String? kpiId,
  }) async {
    final user = _supabase.auth.currentUser!;
    final row = await _supabase
        .from('cycle_objectives')
        .insert({
          'cycle_id': cycleId,
          'employee_id': user.id,
          'title': title,
          'description': description,
          'success_criteria': successCriteria,
          'weight': weight,
          'kpi_id': kpiId,
          'status': 'draft',
        })
        .select()
        .single();
    return CycleObjective.fromJson(row);
  }

  Future<void> update(
    String id, {
    required String title,
    String? description,
    String? successCriteria,
    double weight = 0,
    String? kpiId,
  }) {
    return _supabase.from('cycle_objectives').update({
      'title': title,
      'description': description,
      'success_criteria': successCriteria,
      'weight': weight,
      'kpi_id': kpiId,
      'updated_at': DateTime.now().toUtc().toIso8601String(),
    }).eq('id', id);
  }

  Future<void> delete(String id) {
    return _supabase.from('cycle_objectives').delete().eq('id', id);
  }

  /// Calls the SQL RPC defined in scripts/migration-mobile-v1.sql.
  Future<void> submitDraft(String cycleId) async {
    await _supabase.rpc('submit_objectives_for_cycle', params: {
      'p_cycle_id': cycleId,
    });
  }

  Future<void> approve(String objectiveId) async {
    await _supabase.rpc('approve_objective', params: {
      'p_objective_id': objectiveId,
    });
  }

  Future<void> requestRevision(String objectiveId, String comment) async {
    await _supabase.rpc('request_objective_revision', params: {
      'p_objective_id': objectiveId,
      'p_comment': comment,
    });
  }

  Future<void> reject(String objectiveId, String comment) async {
    await _supabase.rpc('reject_objective', params: {
      'p_objective_id': objectiveId,
      'p_comment': comment,
    });
  }
}

final objectiveRepositoryProvider = Provider<ObjectiveRepository>((ref) {
  return ObjectiveRepository(ref.watch(supabaseProvider));
});

final myObjectivesProvider =
    FutureProvider.family<List<CycleObjective>, String?>((ref, cycleId) {
  // Re-fetch when auth changes.
  ref.watch(authStateProvider);
  return ref.watch(objectiveRepositoryProvider).listMyObjectives(cycleId: cycleId);
});

final pendingObjectivesForApprovalProvider =
    FutureProvider<List<CycleObjective>>((ref) {
  ref.watch(authStateProvider);
  return ref.watch(objectiveRepositoryProvider).listPendingForApproval();
});
