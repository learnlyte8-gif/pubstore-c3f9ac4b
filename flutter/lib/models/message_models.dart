/// Chat models mirroring the shapes used in `src/pages/Messages.tsx`.
library message_models;

typedef Reactions = Map<String, List<String>>; // emoji -> userIds

/// Attachment payload stored in `messages.attachment` (jsonb).
/// Discriminated by [kind] — matches web `ChatAttachment`.
class ChatAttachment {
  ChatAttachment({required this.kind, required this.data});
  final String kind; // product | supplier | wishlist | catalog | cart-unlock
  final Map<String, dynamic> data;

  factory ChatAttachment.fromJson(Map<String, dynamic> j) =>
      ChatAttachment(kind: (j['kind'] ?? '').toString(), data: Map<String, dynamic>.from(j));

  Map<String, dynamic> toJson() => {'kind': kind, ...data};
}

class ChatMessage {
  ChatMessage({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.body,
    required this.createdAt,
    this.attachment,
    this.replyToId,
    this.reactions,
    this.forwarded = false,
  });

  final String id;
  final String conversationId;
  final String senderId;
  final String body;
  final DateTime createdAt;
  final ChatAttachment? attachment;
  final String? replyToId;
  Reactions? reactions;
  final bool forwarded;

  ChatMessage copyWith({Reactions? reactions}) => ChatMessage(
        id: id,
        conversationId: conversationId,
        senderId: senderId,
        body: body,
        createdAt: createdAt,
        attachment: attachment,
        replyToId: replyToId,
        reactions: reactions ?? this.reactions,
        forwarded: forwarded,
      );

  factory ChatMessage.fromRow(Map<String, dynamic> r) {
    final att = r['attachment'];
    final rx = r['reactions'];
    final Reactions? parsedRx = rx is Map
        ? {
            for (final e in rx.entries)
              e.key.toString(): (e.value as List?)?.map((x) => x.toString()).toList() ?? const [],
          }
        : null;
    return ChatMessage(
      id: r['id'].toString(),
      conversationId: r['conversation_id'].toString(),
      senderId: (r['sender_id'] ?? '').toString(),
      body: (r['body'] ?? '').toString(),
      createdAt: DateTime.parse(r['created_at'].toString()).toLocal(),
      attachment: att is Map ? ChatAttachment.fromJson(Map<String, dynamic>.from(att)) : null,
      replyToId: r['reply_to_id']?.toString(),
      reactions: parsedRx,
      forwarded: r['forwarded'] == true,
    );
  }
}

/// Conversation row + resolved peer/supplier metadata.
class ChatPeer {
  ChatPeer({
    required this.name,
    this.logo,
    this.verified = false,
    this.subtitle,
    this.supplierId,
    this.groupBuyId,
  });
  final String name;
  final String? logo;
  final bool verified;
  final String? subtitle;
  final String? supplierId;
  final String? groupBuyId;
}

class ChatConversation {
  ChatConversation({
    required this.id,
    required this.buyerId,
    this.supplierId,
    this.peerUserId,
    this.kind,
    this.title,
    this.lastMessage,
    this.lastMessageAt,
    this.supplierOwnerId,
    this.peer,
  });

  final String id;
  final String buyerId;
  final String? supplierId;
  final String? peerUserId;
  final String? kind; // buyer_supplier | dm | group_buy
  final String? title;
  final String? lastMessage;
  final DateTime? lastMessageAt;
  final String? supplierOwnerId;
  ChatPeer? peer;

  String get resolvedKind => kind ?? 'buyer_supplier';

  factory ChatConversation.fromRow(Map<String, dynamic> r) => ChatConversation(
        id: r['id'].toString(),
        buyerId: (r['buyer_id'] ?? '').toString(),
        supplierId: r['supplier_id']?.toString(),
        peerUserId: r['peer_user_id']?.toString(),
        kind: r['kind']?.toString(),
        title: r['title']?.toString(),
        lastMessage: r['last_message']?.toString(),
        lastMessageAt: r['last_message_at'] == null
            ? null
            : DateTime.tryParse(r['last_message_at'].toString())?.toLocal(),
      );
}
