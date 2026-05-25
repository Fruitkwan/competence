import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/auth_controller.dart';
import '../../core/error_handler.dart';
import '../../data/models/performance_appraisal.dart';
import '../../data/repositories/appraisal_repository.dart';
import '../../shared/widgets/async_value_view.dart';

class CalibrationPage extends ConsumerWidget {
  const CalibrationPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final role = ref.watch(currentRoleProvider);
    if (!role.isHr) {
      return Scaffold(
        appBar: AppBar(title: const Text('Calibration')),
        body: const EmptyState(
          icon: Icons.lock_outline,
          message: 'Only HR users can calibrate appraisals.',
        ),
      );
    }
    final pending = ref.watch(appraisalsAwaitingCalibrationProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Calibration')),
      body: AsyncValueView<List<PerformanceAppraisal>>(
        value: pending,
        empty: const EmptyState(
          icon: Icons.check_circle_outline,
          message: 'No appraisals awaiting calibration.',
        ),
        data: (rows) => RefreshIndicator(
          onRefresh: () async =>
              ref.invalidate(appraisalsAwaitingCalibrationProvider),
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: rows.length,
            itemBuilder: (context, i) =>
                _CalibrationCard(appraisal: rows[i]),
          ),
        ),
      ),
    );
  }
}

class _CalibrationCard extends ConsumerStatefulWidget {
  const _CalibrationCard({required this.appraisal});
  final PerformanceAppraisal appraisal;

  @override
  ConsumerState<_CalibrationCard> createState() => _CalibrationCardState();
}

class _CalibrationCardState extends ConsumerState<_CalibrationCard> {
  late int? _calibrated = widget.appraisal.calibratedRating ??
      widget.appraisal.finalRating;
  final _rationale = TextEditingController();
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _rationale.text = widget.appraisal.calibrationRationale ?? '';
  }

  @override
  void dispose() {
    _rationale.dispose();
    super.dispose();
  }

  Future<void> _signOff() async {
    if (_calibrated == null) {
      showErrorSnack(context, 'Pick a calibrated rating.');
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(appraisalRepositoryProvider).signOffCalibration(
            id: widget.appraisal.id,
            calibratedRating: _calibrated!,
            rationale: _rationale.text.trim().isEmpty ? null : _rationale.text.trim(),
          );
      if (!mounted) return;
      ref.invalidate(appraisalsAwaitingCalibrationProvider);
      ref.invalidate(allAppraisalsProvider);
      showSuccessSnack(context, 'Calibration signed off.');
    } catch (e) {
      if (mounted) showErrorSnack(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.appraisal;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(a.employeeName ?? a.employeeId,
                style: Theme.of(context).textTheme.titleMedium),
            Text(
              '${a.appraisalPeriod ?? ''} · Updated ${DateFormat.yMMMd().format(a.updatedAt)}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 8),
            Text('Manager final rating: ${a.finalRating ?? '—'}'),
            const SizedBox(height: 8),
            Text('Calibrated rating',
                style: Theme.of(context).textTheme.bodyMedium),
            Wrap(
              spacing: 4,
              children: [
                for (var i = 1; i <= 5; i++)
                  ChoiceChip(
                    label: Text('$i'),
                    selected: _calibrated == i,
                    onSelected: (s) => setState(() => _calibrated = s ? i : null),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _rationale,
              minLines: 2,
              maxLines: 4,
              decoration:
                  const InputDecoration(labelText: 'Rationale (optional)'),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: FilledButton(
                    onPressed: _busy ? null : _signOff,
                    child: _busy
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('Sign off'),
                  ),
                ),
                const SizedBox(width: 8),
                OutlinedButton(
                  onPressed: () =>
                      context.go('/appraisals/${a.id}/finalize'),
                  child: const Text('Finalize'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
