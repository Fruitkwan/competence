// ignore_for_file: deprecated_member_use

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/appraisal_routes.dart';
import '../../core/auth_controller.dart';
import '../../core/error_handler.dart';
import '../../core/role.dart';
import '../../data/models/notification.dart';
import '../../data/repositories/appraisal_repository.dart';
import '../../data/repositories/notification_repository.dart';
import '../../shared/widgets/soft_ui.dart';

class NotificationsPage extends ConsumerStatefulWidget {
  const NotificationsPage({super.key});

  @override
  ConsumerState<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends ConsumerState<NotificationsPage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _entrance;

  @override
  void initState() {
    super.initState();
    _entrance = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..forward();
  }

  @override
  void dispose() {
    _entrance.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final list = ref.watch(notificationsProvider);
    final role = ref.watch(currentRoleProvider);

    final unread = list.valueOrNull?.where((n) => !n.read).length ?? 0;
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/dashboard'),
        ),
        title: const Text('Inbox'),
        actions: [
          if (unread > 0)
            TextButton.icon(
              onPressed: () => _markAll(context, ref),
              icon: const Icon(Icons.done_all_rounded, size: 18),
              label: const Text('Mark all read'),
            ),
          const SizedBox(width: 4),
        ],
      ),
      body: list.when(
        loading: () => const Padding(
          padding: EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Column(
            children: [
              SkeletonBlock(height: 72),
              SizedBox(height: 10),
              SkeletonBlock(height: 72),
              SizedBox(height: 10),
              SkeletonBlock(height: 72),
            ],
          ),
        ),
        error: (e, _) => Padding(
          padding: const EdgeInsets.all(16),
          child: ErrorCard(
            title: 'Could not load notifications',
            detail: describeError(e),
          ),
        ),
        data: (rows) {
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(notificationsProvider);
              ref.invalidate(unreadNotificationsCountProvider);
            },
            child: ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              itemCount: rows.isEmpty ? 2 : rows.length + 1,
              itemBuilder: (context, i) {
                if (i == 0) {
                  return StaggeredEntrance(
                    controller: _entrance,
                    interval: entranceInterval(0),
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _InboxHeader(unread: unread),
                    ),
                  );
                }
                if (rows.isEmpty) {
                  return StaggeredEntrance(
                    controller: _entrance,
                    interval: entranceInterval(1),
                    child: const EmptyCard(
                      icon: Icons.notifications_off_outlined,
                      title: 'You are all caught up',
                      body: 'New notifications will appear here.',
                    ),
                  );
                }
                final n = rows[i - 1];
                return StaggeredEntrance(
                  controller: _entrance,
                  interval: entranceInterval(i, step: 0.04, span: 0.4),
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _NotificationTile(
                      notification: n,
                      onTap: () => _open(context, ref, role, n),
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }

  Future<void> _markAll(BuildContext context, WidgetRef ref) async {
    try {
      await ref.read(notificationRepositoryProvider).markAllRead();
      ref.invalidate(notificationsProvider);
      ref.invalidate(unreadNotificationsCountProvider);
    } catch (e) {
      if (context.mounted) showErrorSnack(context, e);
    }
  }

  Future<void> _open(
    BuildContext context,
    WidgetRef ref,
    AppRole role,
    AppNotification n,
  ) async {
    try {
      await ref.read(notificationRepositoryProvider).markRead(n.id);
      ref.invalidate(notificationsProvider);
      ref.invalidate(unreadNotificationsCountProvider);
    } catch (_) {/* non-fatal */}
    if (!context.mounted) return;
    final target = await _mapWebLinkToMobile(ref, role, n.link);
    if (!context.mounted) return;
    if (target != null) context.go(target);
  }
}

class _InboxHeader extends StatelessWidget {
  const _InboxHeader({required this.unread});

  final int unread;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: unread > 0
              ? scheme.primaryContainer
              : scheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (unread > 0) ...[
              PulsingDot(color: scheme.primary, size: 10),
              const SizedBox(width: 8),
            ],
            Text(
              unread > 0 ? '$unread unread' : 'All caught up',
              style: TextStyle(
                color: unread > 0
                    ? scheme.onPrimaryContainer
                    : scheme.onSurfaceVariant,
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.notification, required this.onTap});

  final AppNotification notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final unread = !notification.read;
    return SoftCard(
      onTap: onTap,
      leadingAccent: unread ? scheme.primary : null,
      padding: const EdgeInsets.fromLTRB(20, 14, 14, 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: unread
                  ? scheme.primaryContainer
                  : scheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              unread
                  ? Icons.mark_email_unread_rounded
                  : Icons.mark_email_read_outlined,
              size: 20,
              color: unread ? scheme.onPrimaryContainer : scheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        notification.title,
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight:
                              unread ? FontWeight.w700 : FontWeight.w500,
                          color: unread
                              ? scheme.onSurface
                              : scheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                    if (unread) ...[
                      const SizedBox(width: 8),
                      PulsingDot(color: scheme.primary, size: 8),
                    ],
                  ],
                ),
                if (notification.body != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    notification.body!,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                const SizedBox(height: 6),
                Text(
                  DateFormat.yMMMd().add_jm().format(notification.createdAt),
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant.withOpacity(0.7),
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Web routes look like `/objectives/review` or `/appraisals/<id>` — most also
/// work as-is on mobile because the router uses matching paths.
Future<String?> _mapWebLinkToMobile(
  WidgetRef ref,
  AppRole role,
  String? link,
) async {
  if (link == null || link.isEmpty) return null;
  if (link.startsWith('http')) return null;
  final appraisalId = appraisalIdFromLink(link);
  if (appraisalId != null) {
    final appraisal =
        await ref.read(appraisalRepositoryProvider).getById(appraisalId);
    if (appraisal != null) return routeForAppraisal(appraisal, role);
  }
  return link;
}
