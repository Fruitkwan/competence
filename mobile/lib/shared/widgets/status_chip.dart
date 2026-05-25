import 'package:flutter/material.dart';

class StatusChip extends StatelessWidget {
  const StatusChip(this.label, {super.key, this.tone = StatusTone.neutral});
  final String label;
  final StatusTone tone;

  @override
  Widget build(BuildContext context) {
    final colors = _toneColors(context, tone);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: colors.bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: colors.fg,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

enum StatusTone { neutral, success, warning, danger, info }

class _ChipColors {
  const _ChipColors(this.bg, this.fg);
  final Color bg;
  final Color fg;
}

_ChipColors _toneColors(BuildContext context, StatusTone tone) {
  final scheme = Theme.of(context).colorScheme;
  switch (tone) {
    case StatusTone.success:
      return _ChipColors(
          scheme.tertiaryContainer, scheme.onTertiaryContainer);
    case StatusTone.warning:
      return _ChipColors(scheme.secondaryContainer, scheme.onSecondaryContainer);
    case StatusTone.danger:
      return _ChipColors(scheme.errorContainer, scheme.onErrorContainer);
    case StatusTone.info:
      return _ChipColors(scheme.primaryContainer, scheme.onPrimaryContainer);
    case StatusTone.neutral:
      return _ChipColors(scheme.surfaceContainerHighest, scheme.onSurface);
  }
}
