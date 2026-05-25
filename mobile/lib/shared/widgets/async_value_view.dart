import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/error_handler.dart';

class AsyncValueView<T> extends StatelessWidget {
  const AsyncValueView({
    super.key,
    required this.value,
    required this.data,
    this.empty,
    this.loading,
  });

  final AsyncValue<T> value;
  final Widget Function(T data) data;
  final Widget? empty;
  final Widget? loading;

  @override
  Widget build(BuildContext context) {
    return value.when(
      data: (d) {
        if (d is Iterable && d.isEmpty && empty != null) return empty!;
        return data(d);
      },
      error: (e, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 36),
              const SizedBox(height: 8),
              Text(
                describeError(e),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
      loading: () =>
          loading ?? const Center(child: CircularProgressIndicator()),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.message});
  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon,
                size: 40, color: Theme.of(context).colorScheme.outline),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }
}
