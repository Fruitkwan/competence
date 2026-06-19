// ignore_for_file: deprecated_member_use

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
import '../../shared/widgets/soft_ui.dart';
import '../../shared/widgets/status_chip.dart';

final _myCoursesProvider = FutureProvider<List<EmployeeCourse>>((ref) async {
  final emp = await ref.watch(myEmployeeRecordProvider.future);
  if (emp == null) return const [];
  return ref.watch(courseRepositoryProvider).listMyCourses(emp.employeeId);
});

final _mySkillGapsProvider = FutureProvider((ref) async {
  final emp = await ref.watch(myEmployeeRecordProvider.future);
  if (emp == null) return const [];
  return ref.watch(skillGapRepositoryProvider).listForEmployee(emp.employeeId);
});

class IdpPage extends ConsumerStatefulWidget {
  const IdpPage({super.key});

  @override
  ConsumerState<IdpPage> createState() => _IdpPageState();
}

class _IdpPageState extends ConsumerState<IdpPage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _entrance;

  @override
  void initState() {
    super.initState();
    _entrance = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..forward();
  }

  @override
  void dispose() {
    _entrance.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final courses = ref.watch(_myCoursesProvider);
    final gaps = ref.watch(_mySkillGapsProvider);

    final sections = <Widget>[
      const SectionHeader(title: 'Assigned courses'),
      const SizedBox(height: 10),
      courses.when(
        loading: () => const SkeletonBlock(height: 120),
        error: (e, _) =>
            ErrorCard(title: 'Could not load courses', detail: '$e'),
        data: (rows) {
          if (rows.isEmpty) {
            return const EmptyCard(
              icon: Icons.school_outlined,
              title: 'No courses assigned yet',
              body:
                  'Once your manager or HR assigns development activities, they will show up here.',
            );
          }
          return Column(
            children: [
              for (final c in rows)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _CourseTile(course: c),
                ),
            ],
          );
        },
      ),
      const SizedBox(height: 24),
      const SectionHeader(title: 'My skill gaps'),
      const SizedBox(height: 10),
      gaps.when(
        loading: () => const SkeletonBlock(height: 88),
        error: (e, _) =>
            ErrorCard(title: 'Could not load skill gaps', detail: '$e'),
        data: (rows) {
          if (rows.isEmpty) {
            return const EmptyCard(
              icon: Icons.celebration_outlined,
              title: 'No open skill gaps',
              body:
                  'Great work! All assessed competencies meet the required level.',
            );
          }
          return Column(
            children: [
              for (final g in rows.take(5))
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _GapTile(
                    name: g.competencyName,
                    section: g.section,
                    gap: g.gap?.toString() ?? '-',
                    severity: g.severity ?? 'low',
                  ),
                ),
            ],
          );
        },
      ),
    ];

    return RefreshIndicator(
      onRefresh: () async {
        ref
          ..invalidate(_myCoursesProvider)
          ..invalidate(_mySkillGapsProvider);
      },
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        itemCount: sections.length,
        itemBuilder: (context, index) {
          return StaggeredEntrance(
            controller: _entrance,
            interval: entranceInterval(index),
            child: sections[index],
          );
        },
      ),
    );
  }
}

class _GapTile extends StatelessWidget {
  const _GapTile({
    required this.name,
    required this.section,
    required this.gap,
    required this.severity,
  });

  final String name;
  final String section;
  final String gap;
  final String severity;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final tone = severity == 'high'
        ? StatusTone.danger
        : (severity == 'medium' ? StatusTone.warning : StatusTone.info);
    final accent = tone == StatusTone.danger
        ? scheme.error
        : (tone == StatusTone.warning ? scheme.secondary : scheme.primary);
    return SoftCard(
      leadingAccent: accent,
      padding: const EdgeInsets.fromLTRB(20, 14, 14, 14),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '$section · gap $gap',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          StatusChip(severity, tone: tone),
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
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final c = widget.course;
    final title = c.course?.title ?? c.courseId;
    final status = c.status;
    final tone = status == 'Completed'
        ? StatusTone.success
        : (status == 'In Progress'
            ? StatusTone.info
            : StatusTone.warning);
    final accent = tone == StatusTone.success
        ? scheme.tertiary
        : (tone == StatusTone.info ? scheme.primary : scheme.secondary);

    return SoftCard(
      leadingAccent: accent,
      padding: const EdgeInsets.fromLTRB(20, 14, 14, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: accent.withOpacity(0.14),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  Icons.school_rounded,
                  size: 20,
                  color: accent,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              StatusChip(status, tone: tone),
            ],
          ),
          if (c.course?.develops != null) ...[
            const SizedBox(height: 10),
            Text(
              c.course!.develops!,
              style: theme.textTheme.bodySmall?.copyWith(
                color: scheme.onSurfaceVariant,
              ),
            ),
          ],
          const SizedBox(height: 6),
          Text(
            'Enrolled ${DateFormat.yMMMd().format(c.enrolledAt)}',
            style: theme.textTheme.bodySmall?.copyWith(
              color: scheme.onSurfaceVariant.withOpacity(0.8),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              if (c.course?.link != null)
                TextButton.icon(
                  onPressed: () => launchUrl(Uri.parse(c.course!.link!)),
                  icon: const Icon(Icons.open_in_new_rounded, size: 16),
                  label: const Text('Open course'),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 6),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ),
              const Spacer(),
              if (status == 'Enrolled')
                FilledButton(
                  onPressed: _busy ? null : _markStarted,
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(0, 36),
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                  ),
                  child: const Text('Start'),
                )
              else if (status == 'In Progress')
                FilledButton(
                  onPressed: _busy ? null : _markComplete,
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(0, 36),
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                  ),
                  child: const Text('Mark complete'),
                )
              else if (c.certificateUrl != null)
                TextButton.icon(
                  onPressed: () => launchUrl(Uri.parse(c.certificateUrl!)),
                  icon: const Icon(Icons.description_outlined, size: 16),
                  label: const Text('Certificate'),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 6),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
