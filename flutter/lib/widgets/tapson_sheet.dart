import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../config/env.dart';
import '../theme/palette.dart';

/// AI shopping assistant — mirrors `src/components/TapsonAssistant.tsx`.
///
/// Streams responses from the `tapson-chat` edge function (SSE) so the
/// bubble types in live like the web experience.
class TapsonSheet extends StatefulWidget {
  const TapsonSheet({super.key, this.seed});

  /// Optional first user prompt to auto-send (used from Search's "Tapson's take").
  final String? seed;

  static Future<void> show(BuildContext context, {String? seed}) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      useSafeArea: true,
      builder: (_) => TapsonSheet(seed: seed),
    );
  }

  @override
  State<TapsonSheet> createState() => _TapsonSheetState();
}

class _Msg {
  _Msg(this.role, this.content);
  final String role; // 'user' | 'assistant'
  String content;
  Map<String, dynamic> toJson() => {'role': role, 'content': content};
}

class _TapsonSheetState extends State<TapsonSheet> {
  final _messages = <_Msg>[];
  final _input = TextEditingController();
  final _scroll = ScrollController();
  bool _loading = false;
  HttpClient? _client;

  static const _quickPrompts = [
    'Find a verified supplier for 500 wireless earbuds',
    "Show me today's best deals",
    'Help me write an RFQ for cotton t-shirts',
    'Compare top suppliers near me',
  ];

  @override
  void initState() {
    super.initState();
    if (widget.seed != null && widget.seed!.trim().isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _send(widget.seed!));
    }
  }

  @override
  void dispose() {
    _client?.close(force: true);
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _send([String? text]) async {
    final t = (text ?? _input.text).trim();
    if (t.isEmpty || _loading) return;
    _input.clear();
    setState(() {
      _messages.add(_Msg('user', t));
      _loading = true;
    });
    _scrollDown();

    final assistant = _Msg('assistant', '');
    setState(() => _messages.add(assistant));

    try {
      final client = HttpClient();
      _client = client;
      final uri = Uri.parse('${Env.supabaseUrl}/functions/v1/tapson-chat');
      final req = await client.postUrl(uri);
      req.headers.set('Content-Type', 'application/json');
      req.headers.set('Authorization', 'Bearer ${Env.supabaseAnonKey}');
      req.add(utf8.encode(jsonEncode({
        'messages': _messages
            .where((m) => m.content.isNotEmpty || m.role == 'user')
            .map((m) => m.toJson())
            .toList(),
      })));
      final resp = await req.close();

      if (resp.statusCode >= 400) {
        assistant.content = resp.statusCode == 429
            ? 'Tapson is busy right now. Try again in a moment.'
            : resp.statusCode == 402
                ? 'AI credits exhausted. Please add credits to continue.'
                : 'Tapson hit a snag. Try again shortly.';
        if (mounted) setState(() {});
        return;
      }

      String buf = '';
      await for (final chunk in resp.transform(utf8.decoder)) {
        buf += chunk;
        while (true) {
          final nl = buf.indexOf('\n');
          if (nl == -1) break;
          var line = buf.substring(0, nl);
          buf = buf.substring(nl + 1);
          if (line.endsWith('\r')) line = line.substring(0, line.length - 1);
          if (line.isEmpty || line.startsWith(':')) continue;
          if (!line.startsWith('data: ')) continue;
          final json = line.substring(6).trim();
          if (json == '[DONE]') return;
          try {
            final delta = (jsonDecode(json)['choices'] as List?)
                ?.firstOrNull?['delta']?['content'] as String?;
            if (delta != null && delta.isNotEmpty) {
              assistant.content += delta;
              if (mounted) setState(() {});
              _scrollDown();
            }
          } catch (_) {}
        }
      }
    } catch (e) {
      assistant.content = assistant.content.isEmpty
          ? 'Connection lost. Please try again.'
          : assistant.content;
      if (mounted) setState(() {});
    } finally {
      _client = null;
      if (mounted) setState(() => _loading = false);
    }
  }

  void _scrollDown() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent + 200,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return DraggableScrollableSheet(
      initialChildSize: 0.9,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollCtrl) {
        return Container(
          decoration: const BoxDecoration(
            color: AppColors.background,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              _header(),
              Expanded(
                child: _messages.isEmpty
                    ? _empty(scrollCtrl)
                    : ListView.builder(
                        controller: _scroll,
                        padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                        itemCount: _messages.length +
                            (_loading && _messages.last.role == 'user' ? 1 : 0),
                        itemBuilder: (_, i) {
                          if (i >= _messages.length) {
                            return const Padding(
                              padding: EdgeInsets.symmetric(vertical: 8),
                              child: Row(children: [
                                SizedBox(
                                    width: 14,
                                    height: 14,
                                    child: CircularProgressIndicator(strokeWidth: 2)),
                                SizedBox(width: 8),
                                Text('Tapson is thinking…',
                                    style: TextStyle(
                                        color: AppColors.muted, fontSize: 12)),
                              ]),
                            );
                          }
                          return _bubble(_messages[i]);
                        },
                      ),
              ),
              Padding(
                padding: EdgeInsets.fromLTRB(12, 8, 12, 12 + bottom),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _input,
                        minLines: 1,
                        maxLines: 5,
                        textInputAction: TextInputAction.send,
                        onSubmitted: (_) => _send(),
                        decoration: InputDecoration(
                          hintText: 'Ask anything about PUBSTORE…',
                          filled: true,
                          fillColor: AppColors.mutedSurface,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(20),
                            borderSide: BorderSide.none,
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 10),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Material(
                      color: AppColors.primary,
                      shape: const CircleBorder(),
                      child: InkWell(
                        customBorder: const CircleBorder(),
                        onTap: _loading ? null : () => _send(),
                        child: SizedBox(
                          width: 44,
                          height: 44,
                          child: Icon(
                            _loading ? LucideIcons.loader : LucideIcons.send,
                            color: Colors.white,
                            size: 18,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _header() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 8, 14),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(children: [
        Container(
          width: 40,
          height: 40,
          decoration: const BoxDecoration(
            color: AppColors.primary,
            shape: BoxShape.circle,
          ),
          child: const Icon(LucideIcons.sparkles, color: Colors.white, size: 20),
        ),
        const SizedBox(width: 12),
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Tapson',
                  style:
                      TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
              Text('AI shopping assistant · Online',
                  style: TextStyle(color: AppColors.muted, fontSize: 10)),
            ],
          ),
        ),
        if (_messages.isNotEmpty)
          IconButton(
            icon: const Icon(LucideIcons.eraser, size: 18),
            onPressed: () => setState(_messages.clear),
          ),
        IconButton(
          icon: const Icon(LucideIcons.x),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ]),
    );
  }

  Widget _empty(ScrollController ctrl) {
    return SingleChildScrollView(
      controller: ctrl,
      padding: const EdgeInsets.all(24),
      child: Column(children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [
              AppColors.primary,
              Color(0xFF7C5CFF),
            ]),
            shape: BoxShape.circle,
          ),
          child:
              const Icon(LucideIcons.sparkles, color: Colors.white, size: 32),
        ),
        const SizedBox(height: 12),
        const Text("Hi, I'm Tapson 👋",
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        const SizedBox(height: 6),
        const Text(
          'Your AI sourcing partner. Ask me about products, suppliers, RFQs, orders — anything on PUBSTORE.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.muted, fontSize: 12),
        ),
        const SizedBox(height: 20),
        ..._quickPrompts.map((q) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () => _send(q),
                  style: OutlinedButton.styleFrom(
                    alignment: Alignment.centerLeft,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  child: Text(q,
                      style: const TextStyle(fontSize: 12), textAlign: TextAlign.left),
                ),
              ),
            )),
      ]),
    );
  }

  Widget _bubble(_Msg m) {
    final isUser = m.role == 'user';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment:
            isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [
          if (!isUser) ...[
            Container(
              width: 28,
              height: 28,
              decoration: const BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
              ),
              child: const Icon(LucideIcons.sparkles,
                  color: Colors.white, size: 14),
            ),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: isUser ? AppColors.primary : AppColors.mutedSurface,
                borderRadius: BorderRadius.circular(16).copyWith(
                  bottomRight: isUser
                      ? const Radius.circular(4)
                      : const Radius.circular(16),
                  bottomLeft: isUser
                      ? const Radius.circular(16)
                      : const Radius.circular(4),
                ),
              ),
              child: Text(
                m.content.isEmpty ? '…' : _stripCards(m.content),
                style: TextStyle(
                  fontSize: 14,
                  height: 1.4,
                  color: isUser ? Colors.white : AppColors.foreground,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Strip `::product[id]` / `::supplier[id]` / `::cta[...]` markers so the
  /// text reads cleanly; rich cards live on the web variant.
  String _stripCards(String s) => s
      .replaceAll(RegExp(r'::(product|supplier|live)\[[a-z0-9_-]+\]',
          caseSensitive: false), '')
      .replaceAll(RegExp(r'::cta\[[^\]]+\]'), '')
      .trim();
}

extension _FirstOrNull<E> on List<E> {
  E? get firstOrNull => isEmpty ? null : first;
}
