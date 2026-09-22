import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

class Env {
  static String get supabaseUrl {
    final value = dotenv.maybeGet('SUPABASE_URL');
    if (value == null || value.isEmpty) {
      throw StateError('SUPABASE_URL is missing from .env');
    }
    return value;
  }

  static String get supabaseAnonKey {
    final value = dotenv.maybeGet('SUPABASE_ANON_KEY');
    if (value == null || value.isEmpty) {
      throw StateError('SUPABASE_ANON_KEY is missing from .env');
    }
    return value;
  }

  static bool get enablePush {
    final value = dotenv.maybeGet('ENABLE_PUSH')?.toLowerCase();
    return value == 'true' || value == '1' || value == 'yes';
  }

  /// Debug-only: auto sign-in on launch (see splash_page.dart).
  static bool get devAutoLoginEnabled {
    if (!kDebugMode) return false;
    return devAutoLoginEmail.isNotEmpty && devAutoLoginPassword.isNotEmpty;
  }

  static String get devAutoLoginEmail =>
      dotenv.maybeGet('DEV_AUTO_LOGIN_EMAIL')?.trim() ?? '';

  static String get devAutoLoginPassword =>
      dotenv.maybeGet('DEV_AUTO_LOGIN_PASSWORD') ?? '';

  /// Emails allowed to sign in with a password instead of OTP
  /// (comma-separated SUPERUSER_EMAILS in .env). The account must exist in
  /// Supabase Auth with a password — this is not an auth bypass.
  static Set<String> get superuserEmails => {
        for (final e in (dotenv.maybeGet('SUPERUSER_EMAILS') ?? '').split(','))
          if (e.trim().isNotEmpty) e.trim().toLowerCase(),
      };

  /// Base URL of the deployed web app; serves the /api/mobile/* endpoints.
  static String get webApiBaseUrl => (dotenv.maybeGet('WEB_API_BASE_URL') ?? '')
      .trim()
      .replaceAll(RegExp(r'/$'), '');
}
