import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/supabase_client.dart';
import '../models/employee.dart';

class EmployeeFilter {
  const EmployeeFilter({
    this.query = '',
    this.country,
    this.department,
    this.job,
    this.status,
  });

  final String query;
  final String? country;
  final String? department;
  final String? job;
  final String? status; // 'active' | 'inactive'

  EmployeeFilter copyWith({
    String? query,
    String? country,
    String? department,
    String? job,
    String? status,
    bool clearCountry = false,
    bool clearDepartment = false,
    bool clearJob = false,
    bool clearStatus = false,
  }) {
    return EmployeeFilter(
      query: query ?? this.query,
      country: clearCountry ? null : (country ?? this.country),
      department:
          clearDepartment ? null : (department ?? this.department),
      job: clearJob ? null : (job ?? this.job),
      status: clearStatus ? null : (status ?? this.status),
    );
  }
}

class EmployeesPage {
  EmployeesPage(this.items, this.total, this.pageSize, this.page);
  final List<Employee> items;
  final int total;
  final int pageSize;
  final int page;
  int get totalPages => (total / pageSize).ceil().clamp(1, 9999);
}

class EmployeeRepository {
  EmployeeRepository(this._supabase);
  final SupabaseClient _supabase;

  PostgrestFilterBuilder<List<Map<String, dynamic>>> _applyFilter(
    PostgrestFilterBuilder<List<Map<String, dynamic>>> q,
    EmployeeFilter filter,
  ) {
    var query = q;
    if (filter.country != null && filter.country!.isNotEmpty) {
      query = query.eq('country_code', filter.country!);
    }
    if (filter.department != null && filter.department!.isNotEmpty) {
      query = query.eq('department', filter.department!);
    }
    if (filter.job != null && filter.job!.isNotEmpty) {
      query = query.eq('job_title', filter.job!);
    }
    if (filter.status == 'active') query = query.eq('active', true);
    if (filter.status == 'inactive') query = query.eq('active', false);
    if (filter.query.isNotEmpty) {
      final like = '%${filter.query}%';
      query = query.or(
        'full_name.ilike.$like,employee_id.ilike.$like,email.ilike.$like,job_title.ilike.$like,department.ilike.$like,manager_name.ilike.$like',
      );
    }
    return query;
  }

  Future<EmployeesPage> list({
    EmployeeFilter filter = const EmployeeFilter(),
    int page = 1,
    int pageSize = 25,
  }) async {
    final from = (page - 1) * pageSize;
    final to = from + pageSize - 1;

    final rows = await _applyFilter(_supabase.from('employees').select(), filter)
        .order('full_name')
        .range(from, to);

    final countResp =
        await _applyFilter(_supabase.from('employees').select('employee_id'), filter)
            .count(CountOption.exact);

    final items = rows
        .map((r) => Employee.fromJson(Map<String, dynamic>.from(r)))
        .toList();
    return EmployeesPage(items, countResp.count, pageSize, page);
  }

  Future<List<String>> distinctCountries() async {
    final rows = await _supabase
        .from('employees')
        .select('country_code')
        .not('country_code', 'is', null)
        .order('country_code');
    return (rows
            .map((r) => r['country_code'] as String?)
            .whereType<String>()
            .toSet()
            .toList())
      ..sort();
  }

  Future<List<String>> distinctJobs() async {
    final rows =
        await _supabase.from('employees').select('job_title').order('job_title');
    return (rows
            .map((r) => r['job_title'] as String?)
            .whereType<String>()
            .toSet()
            .toList())
      ..sort();
  }

  Future<List<String>> distinctDepartments() async {
    final rows = await _supabase
        .from('employees')
        .select('department')
        .not('department', 'is', null)
        .order('department');
    return (rows
            .map((r) => r['department'] as String?)
            .whereType<String>()
            .toSet()
            .toList())
      ..sort();
  }

  Future<Employee?> getByUserId(String userId) async {
    final row = await _supabase
        .from('employees')
        .select()
        .eq('user_id', userId)
        .maybeSingle();
    return row == null ? null : Employee.fromJson(row);
  }
}

final employeeRepositoryProvider = Provider<EmployeeRepository>((ref) {
  return EmployeeRepository(ref.watch(supabaseProvider));
});

final myEmployeeRecordProvider = FutureProvider<Employee?>((ref) {
  final user = ref.watch(currentUserProvider);
  if (user == null) return Future.value(null);
  return ref.watch(employeeRepositoryProvider).getByUserId(user.id);
});

final countriesProvider = FutureProvider<List<String>>(
    (ref) => ref.watch(employeeRepositoryProvider).distinctCountries());
final jobsProvider = FutureProvider<List<String>>(
    (ref) => ref.watch(employeeRepositoryProvider).distinctJobs());
final departmentsProvider = FutureProvider<List<String>>(
    (ref) => ref.watch(employeeRepositoryProvider).distinctDepartments());
