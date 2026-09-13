import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/error_handler.dart';
import '../../data/repositories/cycle_repository.dart';
import '../../data/repositories/objective_repository.dart';

class ObjectiveEditPage extends ConsumerStatefulWidget {
  const ObjectiveEditPage({super.key, this.objectiveId, this.cycleId});
  final String? objectiveId;
  final String? cycleId;

  @override
  ConsumerState<ObjectiveEditPage> createState() => _ObjectiveEditPageState();
}

class _ObjectiveEditPageState extends ConsumerState<ObjectiveEditPage> {
  final _formKey = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _successCriteria = TextEditingController();
  final _weight = TextEditingController();

  String? _cycleId;
  bool _loading = false;
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    _cycleId = widget.cycleId;
  }

  Future<void> _load() async {
    if (_initialized) return;
    _initialized = true;
    if (widget.objectiveId != null) {
      final o = await ref
          .read(objectiveRepositoryProvider)
          .getById(widget.objectiveId!);
      if (o != null && mounted) {
        setState(() {
          _title.text = o.title;
          _description.text = o.description ?? '';
          _successCriteria.text = o.successCriteria ?? '';
          _weight.text = o.weight.toString();
          _cycleId = o.cycleId;
        });
      }
    } else if (_cycleId == null) {
      final c = await ref.read(cycleRepositoryProvider).currentForObjectives();
      if (c != null && mounted) setState(() => _cycleId = c.id);
    }
  }

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _successCriteria.dispose();
    _weight.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_cycleId == null) {
      showErrorSnack(context, 'No active cycle.');
      return;
    }
    setState(() => _loading = true);
    try {
      final repo = ref.read(objectiveRepositoryProvider);
      final weight = double.tryParse(_weight.text.trim()) ?? 0;
      if (widget.objectiveId == null) {
        await repo.create(
          cycleId: _cycleId!,
          title: _title.text.trim(),
          description: _description.text.trim().isEmpty ? null : _description.text.trim(),
          successCriteria: _successCriteria.text.trim().isEmpty
              ? null
              : _successCriteria.text.trim(),
          weight: weight,
        );
      } else {
        await repo.update(
          widget.objectiveId!,
          title: _title.text.trim(),
          description: _description.text.trim().isEmpty ? null : _description.text.trim(),
          successCriteria: _successCriteria.text.trim().isEmpty
              ? null
              : _successCriteria.text.trim(),
          weight: weight,
        );
      }
      if (!mounted) return;
      ref.invalidate(myObjectivesProvider(null));
      context.pop();
    } catch (e) {
      if (mounted) showErrorSnack(context, e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.objectiveId == null ? 'New objective' : 'Edit objective'),
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              TextFormField(
                controller: _title,
                decoration: const InputDecoration(labelText: 'Title *'),
                validator: (v) =>
                    (v ?? '').trim().isEmpty ? 'Title is required' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _description,
                minLines: 2,
                maxLines: 5,
                decoration: const InputDecoration(labelText: 'Description'),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _successCriteria,
                minLines: 2,
                maxLines: 5,
                decoration:
                    const InputDecoration(labelText: 'Success criteria'),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _weight,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration:
                    const InputDecoration(labelText: 'Weight (%)', helperText: '0-100'),
                validator: (v) {
                  final n = double.tryParse((v ?? '').trim());
                  if (n == null) return 'Enter a number';
                  if (n < 0 || n > 100) return 'Between 0 and 100';
                  return null;
                },
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _loading ? null : _save,
                child: _loading
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Save'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
