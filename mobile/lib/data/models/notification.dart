class AppNotification {
  AppNotification({
    required this.id,
    required this.userId,
    required this.type,
    required this.title,
    this.body,
    this.link,
    required this.read,
    required this.createdAt,
    this.metadata = const <String, dynamic>{},
  });

  final String id;
  final String userId;
  final String type;
  final String title;
  final String? body;
  final String? link;
  final bool read;
  final DateTime createdAt;
  final Map<String, dynamic> metadata;

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    final meta = json['metadata'];
    return AppNotification(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      type: json['type'] as String,
      title: json['title'] as String,
      body: json['body'] as String?,
      link: json['link'] as String?,
      read: (json['read'] ?? false) as bool,
      createdAt: DateTime.parse(json['created_at'] as String),
      metadata: meta is Map
          ? Map<String, dynamic>.from(meta)
          : const <String, dynamic>{},
    );
  }
}
