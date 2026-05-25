import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/error_handler.dart';
import '../../data/models/notification.dart';
import '../../data/repositories/notification_repository.dart';
import '../../shared/widgets/async_value_view.dart';

class NotificationsPage extends ConsumerWidget {
  const NotificationsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final list = ref.watch(notificationsProvider);
    return Scaffold(
      body: AsyncValueView<List<AppNotification>>(
        value: list,
        empty: const EmptyState(
          icon: Icons.notifications_off_outlined,
          message: 'You are all caught up.',
        ),
        data: (rows) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(notificationsProvider);
            ref.invalidate(unreadNotificationsCountProvider);
          },
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: Row(
                  children: [
                    const Spacer(),
                    TextButton.icon(
                      icon: const Icon(Icons.done_all),
                      label: const Text('Mark all read'),
                      onPressed: () async {
                        try {
                          await ref
                              .read(notificationRepositoryProvider)
                              .markAllRead();
                          ref.invalidate(notificationsProvider);
                          ref.invalidate(unreadNotificationsCountProvider);
                        } catch (e) {
                          if (context.mounted) showErrorSnack(context, e);
                        }
                      },
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: rows.length,
                  itemBuilder: (context, i) {
                    final n = rows[i];
                    return Card(
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      child: ListTile(
                        leading: Icon(
                          n.read
                              ? Icons.mark_email_read_outlined
                              : Icons.mark_email_unread_outlined,
                          color: n.read
                              ? Theme.of(context).colorScheme.outline
                              : Theme.of(context).colorScheme.primary,
                        ),
                        title: Text(
                          n.title,
                          style: TextStyle(
                            fontWeight:
                                n.read ? FontWeight.w400 : FontWeight.w600,
                          ),
                        ),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (n.body != null) Text(n.body!),
                            const SizedBox(height: 2),
                            Text(
                              DateFormat.yMMMd().add_jm().format(n.createdAt),
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ),
                        onTap: () async {
                          try {
                            await ref
                                .read(notificationRepositoryProvider)
                                .markRead(n.id);
                            ref.invalidate(notificationsProvider);
                            ref.invalidate(unreadNotificationsCountProvider);
                          } catch (_) {/* non-fatal */}
                          if (!context.mounted) return;
                          final target = _mapWebLinkToMobile(n.link);
                          if (target != null) context.go(target);
                        },
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Web routes look like `/objectives/review` or `/appraisals/<id>` — most also
/// work as-is on mobile because the router uses matching paths.
String? _mapWebLinkToMobile(String? link) {
  if (link == null || link.isEmpty) return null;
  if (link.startsWith('http')) return null;
  return link;
}
