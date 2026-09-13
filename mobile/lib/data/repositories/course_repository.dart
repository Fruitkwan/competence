import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/supabase_client.dart';
import '../models/course.dart';

class CourseRepository {
  CourseRepository(this._supabase);
  final SupabaseClient _supabase;

  Future<List<EmployeeCourse>> listMyCourses(String employeeId) async {
    final rows = await _supabase
        .from('employee_courses')
        .select('*, courses(*)')
        .eq('employee_id', employeeId)
        .order('enrolled_at', ascending: false);
    return rows
        .map<EmployeeCourse>(
            (r) => EmployeeCourse.fromJson(Map<String, dynamic>.from(r)))
        .toList();
  }

  Future<void> markStarted(String id) {
    return _supabase.from('employee_courses').update({
      'status': 'In Progress',
      'started_at': DateTime.now().toUtc().toIso8601String(),
    }).eq('id', id);
  }

  Future<void> markCompleted(String id, {String? certificateUrl, double? score}) {
    final update = <String, dynamic>{
      'status': 'Completed',
      'completed_at': DateTime.now().toUtc().toIso8601String(),
    };
    if (certificateUrl != null) update['certificate_url'] = certificateUrl;
    if (score != null) update['score'] = score;
    return _supabase.from('employee_courses').update(update).eq('id', id);
  }

  Future<String> uploadCertificate({
    required String employeeId,
    required String courseId,
    required Uint8List bytes,
    required String filename,
  }) async {
    final path = 'certificates/$employeeId/$courseId-$filename';
    await _supabase.storage.from('certificates').uploadBinary(
          path,
          bytes,
          fileOptions: const FileOptions(upsert: true),
        );
    return _supabase.storage.from('certificates').getPublicUrl(path);
  }
}

final courseRepositoryProvider = Provider<CourseRepository>((ref) {
  return CourseRepository(ref.watch(supabaseProvider));
});
