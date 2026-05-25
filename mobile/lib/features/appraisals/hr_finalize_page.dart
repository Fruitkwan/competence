import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/error_handler.dart';
import '../../data/models/performance_appraisal.dart';
import '../../data/repositories/appraisal_repository.dart';
import '../../shared/widgets/async_value_view.dart';
import '../../shared/widgets/status_chip.dart';

class HrFinalizePage extends ConsumerStatefulWidget {
  const HrFinalizePage({super.key, required this.appraisalId});
  final String appraisalId;

  @override
  ConsumerState<HrFinalizePage> createState() => _HrFinalizePageState();
}

class _HrFinalizePageState extends ConsumerState<HrFinalizePage> {
  final _hrRep = TextEditingController();
  final _rationale = TextEditingController();
  int? _calibrated;
  bool _saving = false;
  bool _initialized = false;

  @override
  void dispose() {
    _hrRep.dispose();
    _rationale.dispose();
    super.dispose();
  }

  void _hydrate(PerformanceAppraisal a) {
    if (_initialized) return;
    _initialized = true;
    _hrRep.text = a.hrRepresentative ?? '';
    _rationale.text = a.calibrationRationale ?? '';
    _calibrated = a.calibratedRating ?? a.finalRating;
  }

  Future<void> _finalize() async {
    setState(() => _saving = true);
    try {
      await ref.read(appraisalRepositoryProvider).finalize(
            id: widget.appraisalId,
            calibratedRating: _calibrated,
            calibrationRationale: _rationale.text.trim().isEmpty
                ? null
                : _rationale.text.trim(),
            hrRepresentative: _hrRep.text.trim().isEmpty ? null : _hrRep.text.trim(),
          );
      if (!mounted) return;
      ref.invalidate(appraisalByIdProvider(widget.appraisalId));
      ref.invalidate(allAppraisalsProvider);
      ref.invalidate(appraisalsAwaitingCalibrationProvider);
      showSuccessSnack(context, 'Appraisal finalized.');
      if (mounted) context.pop();
    } catch (e) {
      if (mounted) showErrorSnack(context, e);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(appraisalByIdProvider(widget.appraisalId));
    return Scaffold(
      appBar: AppBar(title: const Text('Finalize appraisal')),
      body: AsyncValueView<PerformanceAppraisal?>(
        value: async,
        data: (a) {
          if (a == null) {
            return const EmptyState(
              icon: Icons.error_outline,
              message: 'Appraisal not found.',
            );
          }
          _hydrate(a);
          final isFinal = a.status == 'Final' || a.status == 'Archived';

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: ListTile(
                  title: Text(a.employeeName ?? a.employeeId),
                  subtitle: Text(a.appraisalPeriod ?? ''),
                  trailing: StatusChip(a.status,
                      tone: isFinal ? StatusTone.success : StatusTone.info),
                ),
              ),
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Manager outcome',
                          style: Theme.of(context).textTheme.titleSmall),
                      const SizedBox(height: 8),
                      _kv('Final rating', a.finalRating?.toString() ?? '—'),
                      _kv('Overall', a.overallLabel ?? '—'),
                      _kv('Recommended', a.recommendedAction ?? '—'),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text('HR calibration',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              Wrap(
                spacing: 4,
                children: [
                  for (var i = 1; i <= 5; i++)
                    ChoiceChip(
                      label: Text('$i'),
                      selected: _calibrated == i,
                      onSelected:
                          isFinal ? null : (s) => setState(() => _calibrated = s ? i : null),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _rationale,
                readOnly: isFinal,
                minLines: 2,
                maxLines: 4,
                decoration: const InputDecoration(
                    labelText: 'Calibration rationale (optional)'),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _hrRep,
                readOnly: isFinal,
                decoration: const InputDecoration(labelText: 'HR representative'),
              ),
              const SizedBox(height: 24),
              if (!isFinal)
                FilledButton(
                  onPressed: _saving ? null : _finalize,
                  child: _saving
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Finalize and sign off'),
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _kv(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            SizedBox(width: 140, child: Text(k)),
            Expanded(child: Text(v)),
          ],
        ),
      );
}
