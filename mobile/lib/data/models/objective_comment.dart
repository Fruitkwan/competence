class ObjectiveComment {
  ObjectiveComment({
    required this.id,
    required this.objectiveId,
    required this.authorId,
    required this.body,
    required this.createdAt,
    this.authorName,
  });

  final String id;
  final String objectiveId;
  final String authorId;
  final String body;
  final DateTime createdAt;
  final String? authorName;

  factory ObjectiveComment.fromJson(Map<String, dynamic> json) {
    return ObjectiveComment(
      id: json['id'] as String,
      objectiveId: json['objective_id'] as String,
      authorId: json['author_id'] as String,
      body: json['body'] as String,
      createdAt: DateTime.parse(json['created_at'] as String),
      authorName: json['author_name'] as String?,
    );
  }
}
