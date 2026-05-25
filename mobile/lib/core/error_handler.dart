import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

String describeError(Object error) {
  if (error is AuthException) return error.message;
  if (error is PostgrestException) return error.message;
  return error.toString();
}

void showErrorSnack(BuildContext context, Object error) {
  if (!context.mounted) return;
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(describeError(error)),
        backgroundColor: Theme.of(context).colorScheme.error,
      ),
    );
}

void showSuccessSnack(BuildContext context, String message) {
  if (!context.mounted) return;
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));
}
