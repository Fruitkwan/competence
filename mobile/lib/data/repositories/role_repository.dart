import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/supabase_client.dart';
import '../models/role_benchmark.dart';

class RoleBenchmark {
  RoleBenchmark({
    required this.profile,
    required this.competencies,
    required this.kpis,
  });
  final JobProfile profile;
  final List<RoleCompetency> competencies;
  final List<RoleKpiTemplate> kpis;
}

class RoleRepository {
  RoleRepository(this._supabase);
  final SupabaseClient _supabase;

  Future<RoleBenchmark?> getByTitle(String title) async {
    final profileRow = await _supabase
        .from('job_profiles')
        .select()
        .eq('title', title)
        .maybeSingle();
    if (profileRow == null) return null;

    final compRows = await _supabase
        .from('role_competencies')
        .select('*, competencies(name)')
        .eq('role_title', title)
        .eq('applicable', true)
        .order('sort_order');

    final kpiRows = await _supabase
        .from('role_kpi_templates')
        .select()
        .eq('role_title', title)
        .eq('active', true)
        .order('sort_order');

    return RoleBenchmark(
      profile: JobProfile.fromJson(profileRow),
      competencies: compRows
          .map<RoleCompetency>(
              (r) => RoleCompetency.fromJson(Map<String, dynamic>.from(r)))
          .toList(),
      kpis: kpiRows
          .map<RoleKpiTemplate>(
              (r) => RoleKpiTemplate.fromJson(Map<String, dynamic>.from(r)))
          .toList(),
    );
  }
}

final roleRepositoryProvider = Provider<RoleRepository>((ref) {
  return RoleRepository(ref.watch(supabaseProvider));
});

final roleBenchmarkProvider =
    FutureProvider.family<RoleBenchmark?, String>((ref, title) {
  return ref.watch(roleRepositoryProvider).getByTitle(title);
});
