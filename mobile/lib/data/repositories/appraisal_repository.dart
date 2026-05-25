import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/supabase_client.dart';
import '../models/appraisal_form.dart';
import '../models/performance_appraisal.dart';

class AppraisalRepository {
  AppraisalRepository(this._supabase);
  final SupabaseClient _supabase;

  /// All appraisals visible to the current user (RLS handles filtering).
  Future<List<PerformanceAppraisal>> listAll({String? cycleId}) async {
    var q = _supabase
        .from('performance_appraisals')
        .select('*, employees(full_name)');
    if (cycleId != null) q = q.eq('cycle_id', cycleId);
    final rows = await q.order('updated_at', ascending: false);
    return rows.map<PerformanceAppraisal>((r) {
      final map = Map<String, dynamic>.from(r as Map);
      final emp = map['employees'];
      if (emp is Map) map['employee_name'] = emp['full_name'];
      return PerformanceAppraisal.fromJson(map);
    }).toList();
  }

  Future<List<PerformanceAppraisal>> listForMe() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return const [];
    // We need to find the employee_id for this user via the employees table.
    final emp = await _supabase
        .from('employees')
        .select('employee_id')
        .eq('user_id', user.id)
        .maybeSingle();
    if (emp == null) return const [];
    final rows = await _supabase
        .from('performance_appraisals')
        .select()
        .eq('employee_id', emp['employee_id'])
        .order('updated_at', ascending: false);
    return rows
        .map<PerformanceAppraisal>(
            (r) => PerformanceAppraisal.fromJson(Map<String, dynamic>.from(r)))
        .toList();
  }

  Future<List<PerformanceAppraisal>> awaitingCalibration() async {
    final rows = await _supabase
        .from('performance_appraisals')
        .select('*, employees(full_name)')
        .eq('status', 'N2 Complete')
        .filter('calibrated_rating', 'is', null)
        .order('updated_at', ascending: false);
    return rows.map<PerformanceAppraisal>((r) {
      final map = Map<String, dynamic>.from(r as Map);
      final emp = map['employees'];
      if (emp is Map) map['employee_name'] = emp['full_name'];
      return PerformanceAppraisal.fromJson(map);
    }).toList();
  }

  Future<PerformanceAppraisal?> getById(String id) async {
    final row = await _supabase
        .from('performance_appraisals')
        .select('*, employees(full_name)')
        .eq('id', id)
        .maybeSingle();
    if (row == null) return null;
    final map = Map<String, dynamic>.from(row);
    final emp = map['employees'];
    if (emp is Map) map['employee_name'] = emp['full_name'];
    return PerformanceAppraisal.fromJson(map);
  }

  /// Save self-assessment (N1) fields and flip status to N1 Complete if requested.
  Future<void> saveSelfAssessment({
    required String id,
    required Map<String, CompetencyEntry> coreCompetencies,
    required Map<String, CompetencyEntry> leadership,
    required Map<String, CompetencyEntry> valuesCulture,
    required Map<String, dynamic> feedbackN1,
    required List<GoalRow> goals,
    bool markComplete = false,
  }) async {
    await _supabase.rpc('save_appraisal_self', params: {
      'p_id': id,
      'p_goals': goals.map((g) => g.toJson()).toList(),
      'p_core': dumpCompetencyMap(coreCompetencies),
      'p_leadership': dumpCompetencyMap(leadership),
      'p_values': dumpCompetencyMap(valuesCulture),
      'p_feedback_n1': feedbackN1,
      'p_mark_complete': markComplete,
    });
  }

  /// Manager review (N2).
  Future<void> saveManagerReview({
    required String id,
    required Map<String, CompetencyEntry> coreCompetencies,
    required Map<String, CompetencyEntry> leadership,
    required Map<String, CompetencyEntry> valuesCulture,
    required Map<String, dynamic> feedbackN2,
    required List<GoalRow> goals,
    int? finalRating,
    String? overallLabel,
    String? recommendedAction,
    bool markComplete = false,
  }) async {
    await _supabase.rpc('save_appraisal_manager', params: {
      'p_id': id,
      'p_goals': goals.map((g) => g.toJson()).toList(),
      'p_core': dumpCompetencyMap(coreCompetencies),
      'p_leadership': dumpCompetencyMap(leadership),
      'p_values': dumpCompetencyMap(valuesCulture),
      'p_feedback_n2': feedbackN2,
      'p_final_rating': finalRating,
      'p_overall_label': overallLabel,
      'p_recommended_action': recommendedAction,
      'p_mark_complete': markComplete,
    });
  }

  /// HR finalize (sign off + freeze).
  Future<void> finalize({
    required String id,
    int? calibratedRating,
    String? calibrationRationale,
    String? hrRepresentative,
  }) async {
    await _supabase.rpc('finalize_appraisal', params: {
      'p_id': id,
      'p_calibrated_rating': calibratedRating,
      'p_calibration_rationale': calibrationRationale,
      'p_hr_representative': hrRepresentative,
    });
  }

  /// Calibration sign-off (sets calibrated rating and rationale only).
  Future<void> signOffCalibration({
    required String id,
    required int calibratedRating,
    String? rationale,
  }) async {
    await _supabase.rpc('calibrate_appraisal', params: {
      'p_id': id,
      'p_calibrated_rating': calibratedRating,
      'p_rationale': rationale,
    });
  }
}

final appraisalRepositoryProvider = Provider<AppraisalRepository>((ref) {
  return AppraisalRepository(ref.watch(supabaseProvider));
});

final myAppraisalsProvider = FutureProvider<List<PerformanceAppraisal>>((ref) {
  ref.watch(authStateProvider);
  return ref.watch(appraisalRepositoryProvider).listForMe();
});

final allAppraisalsProvider = FutureProvider<List<PerformanceAppraisal>>((ref) {
  ref.watch(authStateProvider);
  return ref.watch(appraisalRepositoryProvider).listAll();
});

final appraisalsAwaitingCalibrationProvider =
    FutureProvider<List<PerformanceAppraisal>>((ref) {
  ref.watch(authStateProvider);
  return ref.watch(appraisalRepositoryProvider).awaitingCalibration();
});

final appraisalByIdProvider =
    FutureProvider.family<PerformanceAppraisal?, String>((ref, id) {
  return ref.watch(appraisalRepositoryProvider).getById(id);
});
