import 'dart:async';
import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../data/repositories/device_token_repository.dart';

/// Background handler must be top-level.
@pragma('vm:entry-point')
Future<void> _bgHandler(RemoteMessage message) async {
  // No-op: Firebase shows the system notification automatically for data+notification messages.
}

class PushService {
  static final _local = FlutterLocalNotificationsPlugin();
  static bool _initialized = false;

  /// Best-effort initializer. Silently no-ops if Firebase config is missing.
  static Future<void> tryInit() async {
    if (_initialized) return;
    try {
      await Firebase.initializeApp();
    } catch (e) {
      // No firebase_options.dart / google-services.json - skip push entirely.
      if (kDebugMode) debugPrint('PushService: Firebase init skipped ($e)');
      return;
    }

    FirebaseMessaging.onBackgroundMessage(_bgHandler);

    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const darwin = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    await _local.initialize(
      const InitializationSettings(android: android, iOS: darwin),
    );

    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission();

    FirebaseMessaging.onMessage.listen((msg) async {
      final n = msg.notification;
      if (n == null) return;
      await _local.show(
        msg.hashCode,
        n.title,
        n.body,
        const NotificationDetails(
          android: AndroidNotificationDetails(
            'default',
            'Default',
            importance: Importance.high,
            priority: Priority.high,
          ),
          iOS: DarwinNotificationDetails(),
        ),
      );
    });

    _initialized = true;
  }

  /// Call after sign-in to register/refresh the FCM token in the DB.
  static Future<void> registerForUser(ProviderContainer container) async {
    if (!_initialized) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null) return;
      final platform = Platform.isIOS ? 'ios' : 'android';
      await container
          .read(deviceTokenRepositoryProvider)
          .upsert(token: token, platform: platform);

      FirebaseMessaging.instance.onTokenRefresh.listen((newToken) async {
        await container
            .read(deviceTokenRepositoryProvider)
            .upsert(token: newToken, platform: platform);
      });
    } catch (e) {
      if (kDebugMode) debugPrint('PushService.register failed: $e');
    }
  }

  /// Call on sign-out to detach this device from the user.
  static Future<void> unregister() async {
    if (!_initialized) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        await Supabase.instance.client
            .from('device_tokens')
            .delete()
            .eq('token', token);
      }
    } catch (e) {
      if (kDebugMode) debugPrint('PushService.unregister failed: $e');
    }
  }
}
