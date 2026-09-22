import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/env.dart';
import '../../core/supabase_client.dart';
import '../models/assessment.dart';

final assessmentRepositoryProvider = Provider<AssessmentRepository>((ref) {
  return AssessmentRepository(ref.watch(supabaseProvider));
});

final myAssessmentsProvider = FutureProvider<List<AssessmentSummary>>((ref) {
  return ref.watch(assessmentRepositoryProvider).listMine();
});

final assessmentReportProvider =
    FutureProvider.family<ReportResult, String>((ref, assignmentId) {
  return ref.watch(assessmentRepositoryProvider).getReport(assignmentId);
});

/// Talks to the web app's /api/mobile/* routes. Scores and reports are
/// computed server-side because RLS hides other raters' responses and the
/// answer keys from regular employees.
class AssessmentRepository {
  AssessmentRepository(this._supabase);

  final SupabaseClient _supabase;

  Uri _uri(String path) {
    final base = Env.webApiBaseUrl;
    if (base.isEmpty) {
      throw StateError(
        'WEB_API_BASE_URL is missing from .env — set it to the deployed web '
        'app URL to load assessments.',
      );
    }
    return Uri.parse('$base$path');
  }

  Map<String, String> _headers() {
    final token = _supabase.auth.currentSession?.accessToken;
    if (token == null) throw const AuthException('Not signed in');
    return {'Authorization': 'Bearer $token'};
  }

  /// Retries once with a refreshed session when the token has expired.
  Future<http.Response> _get(Uri uri, {bool retried = false}) async {
    final res = await http.get(uri, headers: _headers());
    if (res.statusCode == 401 && !retried) {
      await _supabase.auth.refreshSession();
      return _get(uri, retried: true);
    }
    return res;
  }

  Future<List<AssessmentSummary>> listMine() async {
    final res = await _get(_uri('/api/mobile/assessments'));
    if (res.statusCode != 200) {
      throw Exception('Failed to load assessments (${res.statusCode})');
    }
    return [
      for (final row in jsonDecode(res.body) as List)
        AssessmentSummary.fromJson(row as Map<String, dynamic>),
    ];
  }

  Future<ReportResult> getReport(String assignmentId) async {
    final res =
        await _get(_uri('/api/mobile/assessments/$assignmentId/report'));
    if (res.statusCode == 404) {
      throw Exception('Report not found or results not released yet');
    }
    if (res.statusCode != 200) {
      throw Exception('Failed to load report (${res.statusCode})');
    }
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    if (body['placement'] == true) {
      return ReportResult(
        placement: PlacementReport.fromJson(
          (body['report'] as Map<String, dynamic>?) ?? const {},
        ),
      );
    }
    return ReportResult(standard: AssessmentReport.fromJson(body));
  }
}
