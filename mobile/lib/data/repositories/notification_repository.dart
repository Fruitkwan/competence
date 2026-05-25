import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/supabase_client.dart';
import '../models/notification.dart';

class NotificationRepository {
  NotificationRepository(this._supabase);
  final SupabaseClient _supabase;

  Future<List<AppNotification>> listMine({int limit = 50}) async {
    final user = _supabase.auth.currentUser;
    if (user == null) return const [];
    final rows = await _supabase
        .from('notifications')
        .select()
        .eq('user_id', user.id)
        .order('created_at', ascending: false)
        .limit(limit);
    return rows
        .map<AppNotification>(
            (r) => AppNotification.fromJson(Map<String, dynamic>.from(r)))
        .toList();
  }

  Future<int> unreadCount() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return 0;
    final resp = await _supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('read', false)
        .count(CountOption.exact);
    return resp.count;
  }

  Future<void> markRead(String id) {
    return _supabase
        .from('notifications')
        .update({'read': true})
        .eq('id', id);
  }

  Future<void> markAllRead() {
    final user = _supabase.auth.currentUser;
    if (user == null) return Future.value();
    return _supabase
        .from('notifications')
        .update({'read': true})
        .eq('user_id', user.id)
        .eq('read', false);
  }
}

final notificationRepositoryProvider = Provider<NotificationRepository>((ref) {
  return NotificationRepository(ref.watch(supabaseProvider));
});

final notificationsProvider = FutureProvider<List<AppNotification>>((ref) {
  ref.watch(authStateProvider);
  return ref.watch(notificationRepositoryProvider).listMine();
});

final unreadNotificationsCountProvider = FutureProvider<int>((ref) {
  ref.watch(authStateProvider);
  return ref.watch(notificationRepositoryProvider).unreadCount();
});
