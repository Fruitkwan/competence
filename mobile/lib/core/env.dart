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
}
