import 'package:flutter/material.dart';

import '../../../data/models/appraisal_form.dart';

class CompetencyRatingCard extends StatefulWidget {
  const CompetencyRatingCard({
    super.key,
    required this.name,
    required this.entry,
    required this.field,
    this.onChanged,
    this.readOnly = false,
  });

  final String name;
  final CompetencyEntry entry;
  final RatingField field;
  final VoidCallback? onChanged;
  final bool readOnly;

  @override
  State<CompetencyRatingCard> createState() => _CompetencyRatingCardState();
}

enum RatingField { n1, n2 }

class _CompetencyRatingCardState extends State<CompetencyRatingCard> {
  late final TextEditingController _comments;
  late final TextEditingController _evidence;

  @override
  void initState() {
    super.initState();
    _comments = TextEditingController(
      text: widget.field == RatingField.n1
          ? widget.entry.commentsN1
          : widget.entry.commentsN2,
    );
    _evidence = TextEditingController(text: widget.entry.evidence);
  }

  @override
  void dispose() {
    _comments.dispose();
    _evidence.dispose();
    super.dispose();
  }

  int? get _rating => widget.field == RatingField.n1
      ? widget.entry.ratingN1
      : widget.entry.ratingN2;

  void _setRating(int? value) {
    setState(() {
      if (widget.field == RatingField.n1) {
        widget.entry.ratingN1 = value;
      } else {
        widget.entry.ratingN2 = value;
      }
    });
    widget.onChanged?.call();
  }

  void _setComments(String value) {
    if (widget.field == RatingField.n1) {
      widget.entry.commentsN1 = value;
    } else {
      widget.entry.commentsN2 = value;
    }
    widget.onChanged?.call();
  }

  void _setEvidence(String value) {
    widget.entry.evidence = value;
    widget.onChanged?.call();
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.name, style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 8),
            _RatingScale(
              value: _rating,
              onChanged: widget.readOnly ? null : _setRating,
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _comments,
              enabled: !widget.readOnly,
              minLines: 1,
              maxLines: 3,
              decoration: InputDecoration(
                labelText: widget.field == RatingField.n1
                    ? 'Self-assessment comments'
                    : 'Manager comments',
              ),
              onChanged: _setComments,
            ),
            if (widget.field == RatingField.n1) ...[
              const SizedBox(height: 8),
              TextFormField(
                controller: _evidence,
                enabled: !widget.readOnly,
                minLines: 1,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Evidence / examples',
                ),
                onChanged: _setEvidence,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _RatingScale extends StatelessWidget {
  const _RatingScale({required this.value, required this.onChanged});
  final int? value;
  final ValueChanged<int?>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 4,
      runSpacing: 4,
      children: [
        for (var i = 1; i <= 5; i++)
          ChoiceChip(
            label: Text('$i'),
            selected: value == i,
            onSelected: onChanged == null
                ? null
                : (selected) => onChanged!(selected ? i : null),
          ),
        if (value != null)
          Padding(
            padding: const EdgeInsets.only(left: 8),
            child: Text(
              kRatingLabels[value!] ?? '',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
      ],
    );
  }
}
