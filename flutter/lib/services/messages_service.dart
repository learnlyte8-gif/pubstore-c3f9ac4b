import 'supabase_client.dart';

/// Chat reads/writes — mirrors `src/pages/Messages.tsx` on web.
class MessagesService {
  const MessagesService();

  Future<List<Map<String, dynamic>>> listConversations(String userId) async {
    final rows = await supabase
        .from('conversations')
        .select('id, buyer_id, supplier_id, peer_user_id, kind, title, '
            'last_message, last_message_at, '
            'supplier:suppliers(id, name, logo, verified)')
        .or('buyer_id.eq.$userId,peer_user_id.eq.$userId')
        .order('last_message_at', ascending: false)
        .limit(80);
    return (rows as List).cast<Map<String, dynamic>>();
  }

  Future<List<Map<String, dynamic>>> listMessages(String conversationId) async {
    final rows = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, body, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', ascending: true)
        .limit(200);
    return (rows as List).cast<Map<String, dynamic>>();
  }

  Future<void> sendMessage({
    required String conversationId,
    required String senderId,
    required String body,
  }) async {
    await supabase.from('messages').insert({
      'conversation_id': conversationId,
      'sender_id': senderId,
      'body': body,
    });
    await supabase.from('conversations').update({
      'last_message': body,
      'last_message_at': DateTime.now().toIso8601String(),
    }).eq('id', conversationId);
  }
}

const messagesService = MessagesService();
