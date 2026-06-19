import '../data/models/performance_appraisal.dart';
import 'role.dart';

String routeForAppraisal(PerformanceAppraisal appraisal, AppRole role) {
  if (!role.canManage) return '/appraisals/${appraisal.id}/self';

  if (role.isHr &&
      (appraisal.status == 'N2 Complete' ||
          appraisal.status == 'Final' ||
          appraisal.status == 'Archived')) {
    return '/appraisals/${appraisal.id}/finalize';
  }

  return '/appraisals/${appraisal.id}/review';
}

String? appraisalIdFromLink(String link) {
  final uri = Uri.tryParse(link);
  if (uri == null || uri.pathSegments.isEmpty) return null;

  final parts = uri.pathSegments;
  if (parts.length >= 3 &&
      parts[0] == 'appraisals' &&
      parts[1] == 'performance') {
    return parts[2] == 'new' ? null : parts[2];
  }
  if (parts.length >= 2 &&
      parts[0] == 'appraisals' &&
      parts[1] == 'performance') {
    return null;
  }
  if (parts.length >= 2 && parts[0] == 'appraisals') {
    return parts[1] == 'new' ? null : parts[1];
  }
  return null;
}
