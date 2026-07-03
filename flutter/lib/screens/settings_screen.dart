import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';
import 'notification_preferences_screen.dart';
import 'privacy_screen.dart';
import 'admin_screen.dart';

/// Mirrors `src/pages/Settings.tsx`.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  ThemeMode _theme = ThemeMode.system;
  String _language = 'English';
  String _currency = 'USD';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: const BackButton(),
        title: const Text('Settings',
            style: TextStyle(fontWeight: FontWeight.w800)),
        backgroundColor: AppColors.background,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _sectionLabel('Appearance'),
          _card([
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    _iconBubble(LucideIcons.palette),
                    const SizedBox(width: 12),
                    const Text('Theme',
                        style: TextStyle(fontWeight: FontWeight.w800)),
                  ]),
                  const SizedBox(height: 12),
                  Row(children: [
                    _themeOpt(ThemeMode.light, 'Light', LucideIcons.sun),
                    const SizedBox(width: 6),
                    _themeOpt(ThemeMode.dark, 'Dark', LucideIcons.moon),
                    const SizedBox(width: 6),
                    _themeOpt(
                        ThemeMode.system, 'System', LucideIcons.monitor),
                  ]),
                ],
              ),
            ),
          ]),
          const SizedBox(height: 16),
          _sectionLabel('Notifications'),
          _card([
            _row(LucideIcons.bell, 'Notification preferences',
                'Push, in-app, and email — choose what reaches you',
                onTap: () => Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => const NotificationPreferencesScreen()))),
            _row(LucideIcons.messageCircle, 'Test WhatsApp',
                'Send a test to your linked number',
                onTap: _sendWhatsAppTest),
          ]),
          const SizedBox(height: 16),
          _sectionLabel('Region'),
          _card([
            _picker(LucideIcons.languages, 'Language', _language,
                const ['English', 'Français', 'Español', '中文', 'العربية'],
                (v) => setState(() => _language = v)),
            _picker(LucideIcons.dollarSign, 'Currency', _currency,
                const ['USD', 'EUR', 'GBP', 'KES', 'CNY'],
                (v) => setState(() => _currency = v)),
            _rowValue(LucideIcons.globe, 'Country', 'Kenya'),
          ]),
          if (_isAdmin) ...[
            const SizedBox(height: 16),
            _sectionLabel('Admin'),
            _card([
              _row(LucideIcons.shieldCheck, 'Platform Admin',
                  'Trade assurance, top-ups, withdrawals, reviews',
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => const AdminScreen()))),
            ]),
          ],
          const SizedBox(height: 16),
          _sectionLabel('About'),
          _card([
            _rowValue(LucideIcons.smartphone, 'App version', '1.0.0'),
            _row(LucideIcons.shieldCheck, 'Terms of service', null,
                onTap: () => _openUrl('https://pubstore.app/terms')),
            _row(LucideIcons.shieldCheck, 'Privacy policy', null,
                onTap: () => Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => const PrivacyScreen()))),
          ]),
        ],
      ),
    );
  }

  bool get _isAdmin =>
      (supabase.auth.currentUser?.email ?? '').toLowerCase() ==
      'kukistacks8@gmail.com';

  Future<void> _openUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _sendWhatsAppTest() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sign in to test WhatsApp')));
      return;
    }
    try {
      await supabase.functions.invoke('test-whatsapp', body: {'user_id': uid});
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Test WhatsApp message sent')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not send: $e')));
    }
  }

  Widget _sectionLabel(String t) => Padding(
        padding: const EdgeInsets.only(bottom: 8, left: 4),
        child: Text(t.toUpperCase(),
            style: const TextStyle(
                fontSize: 11,
                letterSpacing: 1.4,
                fontWeight: FontWeight.w900,
                color: AppColors.muted)),
      );

  Widget _card(List<Widget> children) => Container(
        decoration: BoxDecoration(
          color: AppColors.card,
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(20),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(children: children),
      );

  Widget _iconBubble(IconData icon) => Container(
        width: 36,
        height: 36,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: AppColors.primary.withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, size: 16, color: AppColors.primary),
      );

  Widget _themeOpt(ThemeMode mode, String label, IconData icon) {
    final active = _theme == mode;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _theme = mode),
        child: Container(
          height: 64,
          decoration: BoxDecoration(
            color: active
                ? AppColors.primary.withOpacity(0.05)
                : AppColors.mutedSurface,
            border: Border.all(
                color: active ? AppColors.primary : AppColors.border,
                width: 2),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16),
              const SizedBox(height: 4),
              Text(label,
                  style: const TextStyle(
                      fontSize: 11, fontWeight: FontWeight.w800)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _row(IconData icon, String title, String? subtitle,
      {required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(children: [
          _iconBubble(icon),
          const SizedBox(width: 12),
          Expanded(
              child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w800)),
              if (subtitle != null)
                Text(subtitle,
                    style: const TextStyle(
                        fontSize: 11, color: AppColors.muted)),
            ],
          )),
          const Icon(LucideIcons.chevronRight,
              size: 16, color: AppColors.muted),
        ]),
      ),
    );
  }

  Widget _rowValue(IconData icon, String label, String value) => Padding(
        padding: const EdgeInsets.all(14),
        child: Row(children: [
          _iconBubble(icon),
          const SizedBox(width: 12),
          Expanded(
              child: Text(label,
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w800))),
          Text(value,
              style: const TextStyle(
                  fontSize: 12, color: AppColors.muted)),
        ]),
      );

  Widget _picker(IconData icon, String label, String value,
      List<String> options, ValueChanged<String> onChanged) {
    return Padding(
      padding: const EdgeInsets.all(14),
      child: Row(children: [
        _iconBubble(icon),
        const SizedBox(width: 12),
        Expanded(
            child: Text(label,
                style: const TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w800))),
        DropdownButton<String>(
          value: value,
          underline: const SizedBox.shrink(),
          items: options
              .map((o) => DropdownMenuItem(value: o, child: Text(o)))
              .toList(),
          onChanged: (v) {
            if (v != null) onChanged(v);
          },
        ),
      ]),
    );
  }
}
