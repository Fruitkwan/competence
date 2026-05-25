import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/error_handler.dart';
import '../../data/models/course.dart';
import '../../data/repositories/course_repository.dart';
import '../../data/repositories/employee_repository.dart';
import '../../data/repositories/skill_gap_repository.dart';
import '../../shared/widgets/async_value_view.dart';
import '../../shared/widgets/status_chip.dart';

final _myCoursesProvider =
    FutureProvider<List<EmployeeCourse>>((ref) async {
  final emp = await ref.watch(myEmployeeRecordProvider.future);
  if (emp == null) return const [];
  return ref
      .watch(courseRepositoryProvider)
      .listMyCourses(emp.employeeId);
});

final _mySkillGapsProvider = FutureProvider((ref) async {
  final emp = await ref.watch(myEmployeeRecordProvider.future);
  if (emp == null) return const [];
  return ref.watch(skillGapRepositoryProvider).listForEmployee(emp.employeeId);
});

class IdpPage extends ConsumerWidget {
  const IdpPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final courses = ref.watch(_myCoursesProvider);
    final gaps = ref.watch(_mySkillGapsProvider);

    return RefreshIndicator(
      onRefresh: () async {
        ref
          ..invalidate(_myCoursesProvider)
          ..invalidate(_mySkillGapsProvider);
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Assigned courses',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          courses.when(
            loading: () => const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (e, _) => Card(child: ListTile(title: Text('$e'))),
            data: (rows) {
              if (rows.isEmpty) {
                return Card(
                  child: ListTile(
                    leading: const Icon(Icons.school_outlined),
                    title: const Text('No courses assigned yet'),
                    subtitle: const Text(
                      'Once your manager or HR assigns development activities, they will show up here.',
                    ),
                  ),
                );
              }
              return Column(
                children: [
                  for (final c in rows) _CourseTile(course: c),
                ],
              );
            },
          ),
          const SizedBox(height: 24),
          Text('My skill gaps',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          gaps.when(
            loading: () => const SizedBox.shrink(),
            error: (e, _) => Text('$e'),
            data: (rows) {
              if (rows.isEmpty) {
                return Card(
                  child: ListTile(
                    leading: const Icon(Icons.celebration_outlined),
                    title: const Text('No open skill gaps'),
                    subtitle: const Text(
                      'Great work! All assessed competencies meet the required level.',
                    ),
                  ),
                );
              }
              return Column(
                children: [
                  for (final g in rows.take(5))
                    Card(
                      child: ListTile(
                        title: Text(g.competencyName),
                        subtitle: Text(
                          '${g.section} · gap ${g.gap ?? '-'}',
                        ),
                        trailing: StatusChip(
                          g.severity ?? 'low',
                          tone: g.severity == 'high'
                              ? StatusTone.danger
                              : (g.severity == 'medium'
                                  ? StatusTone.warning
                                  : StatusTone.info),
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _CourseTile extends ConsumerStatefulWidget {
  const _CourseTile({required this.course});
  final EmployeeCourse course;

  @override
  ConsumerState<_CourseTile> createState() => _CourseTileState();
}

class _CourseTileState extends ConsumerState<_CourseTile> {
  bool _busy = false;

  Future<void> _markStarted() async {
    setState(() => _busy = true);
    try {
      await ref.read(courseRepositoryProvider).markStarted(widget.course.id);
      ref.invalidate(_myCoursesProvider);
    } catch (e) {
      if (mounted) showErrorSnack(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _markComplete() async {
    final pickFile = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Upload certificate?'),
        content: const Text(
          'You can attach a completion certificate (PDF / image) or skip.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Skip'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Upload'),
          ),
        ],
      ),
    );
    if (pickFile == null) return;

    String? url;
    if (pickFile) {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['pdf', 'png', 'jpg', 'jpeg'],
        withData: true,
      );
      final file = result?.files.first;
      if (file == null) return;
      try {
        url = await ref.read(courseRepositoryProvider).uploadCertificate(
              employeeId: widget.course.employeeId,
              courseId: widget.course.courseId,
              bytes: file.bytes ?? Uint8List(0),
              filename: file.name,
            );
      } catch (e) {
        if (mounted) showErrorSnack(context, e);
        return;
      }
    }

    setState(() => _busy = true);
    try {
      await ref
          .read(courseRepositoryProvider)
          .markCompleted(widget.course.id, certificateUrl: url);
      ref.invalidate(_myCoursesProvider);
      if (mounted) showSuccessSnack(context, 'Marked complete.');
    } catch (e) {
      if (mounted) showErrorSnack(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.course;
    final t = c.course?.title ?? c.courseId;
    final status = c.status;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(t,
                      style: Theme.of(context).textTheme.titleMedium),
                ),
                StatusChip(
                  status,
                  tone: status == 'Completed'
                      ? StatusTone.success
                      : (status == 'In Progress'
                          ? StatusTone.info
                          : StatusTone.warning),
                ),
              ],
            ),
            if (c.course?.develops != null) ...[
              const SizedBox(height: 4),
              Text(c.course!.develops!,
                  style: Theme.of(context).textTheme.bodySmall),
            ],
            const SizedBox(height: 4),
            Text(
              'Enrolled ${DateFormat.yMMMd().format(c.enrolledAt)}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                if (c.course?.link != null)
                  TextButton.icon(
                    onPressed: () =>
                        launchUrl(Uri.parse(c.course!.link!)),
                    icon: const Icon(Icons.open_in_new),
                    label: const Text('Open course'),
                  ),
                const Spacer(),
                if (status == 'Enrolled')
                  FilledButton(
                    onPressed: _busy ? null : _markStarted,
                    child: const Text('Start'),
                  )
                else if (status == 'In Progress')
                  FilledButton(
                    onPressed: _busy ? null : _markComplete,
                    child: const Text('Mark complete'),
                  )
                else if (c.certificateUrl != null)
                  TextButton.icon(
                    onPressed: () =>
                        launchUrl(Uri.parse(c.certificateUrl!)),
                    icon: const Icon(Icons.description_outlined),
                    label: const Text('Certificate'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
