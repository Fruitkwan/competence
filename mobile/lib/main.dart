import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app.dart';
import 'core/env.dart';
import 'features/notifications/push_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await dotenv.load(fileName: '.env');

  await Supabase.initialize(
    url: Env.supabaseUrl,
    anonKey: Env.supabaseAnonKey,
    debug: false,
  );

  // Best-effort push init. If Firebase config files are missing this is a no-op.
  if (Env.enablePush) {
    await PushService.tryInit();
  }

  final container = ProviderContainer();

  // Register / unregister the FCM token as auth state changes.
  Supabase.instance.client.auth.onAuthStateChange.listen((state) {
    if (!Env.enablePush) return;
    final ev = state.event;
    if (ev == AuthChangeEvent.signedIn || ev == AuthChangeEvent.tokenRefreshed) {
      PushService.registerForUser(container);
    } else if (ev == AuthChangeEvent.signedOut) {
      PushService.unregister();
    }
  });

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const PerformanceHubApp(),
    ),
  );
}
