import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../widgets/skeletons.dart';

/// Mirrors `src/pages/Verification.tsx` — KYC upload flow with real storage uploads.
class VerificationScreen extends StatefulWidget {
  const VerificationScreen({super.key});
  @override
  State<VerificationScreen> createState() => _VerificationScreenState();
}

class _VerificationScreenState extends State<VerificationScreen> {
  Future<Map<String, dynamic>?>? _future;
  XFile? _idFile;
  XFile? _proofFile;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>?> _load() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return null;
    final row = await supabase.from('user_verifications').select('*').eq('user_id', uid).maybeSingle();
    return row == null ? null : Map<String, dynamic>.from(row);
  }

  Future<void> _pick(bool isId) async {
    final picker = ImagePicker();
    final res = await picker.pickImage(source: ImageSource.gallery, maxWidth: 2000, imageQuality: 85);
    if (res == null) return;
    setState(() {
      if (isId) {
        _idFile = res;
      } else {
        _proofFile = res;
      }
    });
  }

  Future<String> _upload(XFile file, String uid, String kind) async {
    final ext = file.name.split('.').last.toLowerCase();
    final path = '$uid/$kind-${DateTime.now().millisecondsSinceEpoch}.$ext';
    final bytes = await File(file.path).readAsBytes();
    await supabase.storage.from('verifications').uploadBinary(
          path,
          bytes,
          fileOptions: FileOptions(upsert: true, contentType: 'image/$ext'),
        );
    return path;
  }

  Future<void> _submit() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    if (_idFile == null || _proofFile == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Both documents are required')));
      return;
    }
    setState(() => _submitting = true);
    try {
      final idPath = await _upload(_idFile!, uid, 'id');
      final proofPath = await _upload(_proofFile!, uid, 'proof');
      await supabase.from('user_verifications').upsert({
        'user_id': uid,
        'id_card_url': idPath,
        'proof_residency_url': proofPath,
        'status': 'pending',
        'submitted_at': DateTime.now().toIso8601String(),
        'reviewed_at': null,
        'notes': null,
      }, onConflict: 'user_id');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Submitted for review')));
      setState(() {
        _idFile = null;
        _proofFile = null;
        _future = _load();
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Upload failed: $e')));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Identity verification')),
      body: FutureBuilder<Map<String, dynamic>?>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) return Skeletons.list(count: 4);
          final v = snap.data;
          final status = (v?['status'] ?? 'none').toString();

          return ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 100), children: [
            // Hero
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.primary, Color(0xFF60A5FA)],
                  begin: Alignment.topLeft, end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: const [
                  Icon(LucideIcons.shieldCheck, size: 16, color: Colors.white),
                  SizedBox(width: 6),
                  Text('COD ELIGIBILITY',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 10, letterSpacing: 1.2)),
                ]),
                const SizedBox(height: 8),
                const Text('Verify your identity to unlock COD',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 15)),
                const SizedBox(height: 4),
                const Text('Upload a government ID and a proof of residency. A supplier will review and approve your account.',
                    style: TextStyle(color: Colors.white70, fontSize: 12)),
              ]),
            ),
            const SizedBox(height: 12),
            _StatusCard(status: status, notes: v?['notes']?.toString()),
            if (status != 'approved') ...[
              const SizedBox(height: 12),
              _UploadField(
                icon: LucideIcons.fileText,
                label: 'Government-issued ID',
                hint: 'National ID, passport or driver\'s licence',
                file: _idFile,
                onTap: () => _pick(true),
              ),
              const SizedBox(height: 10),
              _UploadField(
                icon: LucideIcons.home,
                label: 'Proof of residency',
                hint: 'Recent utility bill or bank statement showing your address',
                file: _proofFile,
                onTap: () => _pick(false),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.warning.withValues(alpha: 0.08),
                  border: Border.all(color: AppColors.warning.withValues(alpha: 0.3)),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: const [
                  Icon(LucideIcons.alertCircle, size: 14, color: AppColors.warning),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Your documents are stored privately and are only visible to verified PUBSTORE suppliers for review. We never share them publicly.',
                      style: TextStyle(fontSize: 11, color: AppColors.muted, height: 1.4),
                    ),
                  ),
                ]),
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _submitting || _idFile == null || _proofFile == null ? null : _submit,
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48), shape: const StadiumBorder()),
                child: _submitting
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(status == 'pending' ? 'Re-submit documents' : 'Submit for review'),
              ),
            ],
          ]);
        },
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.status, this.notes});
  final String status;
  final String? notes;

  @override
  Widget build(BuildContext context) {
    late final Color color;
    late final IconData icon;
    late final String title;
    late final String subtitle;
    switch (status) {
      case 'approved':
        color = AppColors.success;
        icon = LucideIcons.checkCircle2;
        title = "You're verified";
        subtitle = 'Cash on delivery is now available at checkout.';
        break;
      case 'pending':
        color = AppColors.warning;
        icon = LucideIcons.clock;
        title = 'Awaiting review';
        subtitle = "A supplier will review your documents soon. You'll be notified when approved.";
        break;
      case 'rejected':
        color = AppColors.destructive;
        icon = LucideIcons.alertCircle;
        title = 'Submission rejected';
        subtitle = notes?.isNotEmpty == true ? notes! : 'Please re-submit clearer documents.';
        break;
      default:
        color = AppColors.primary;
        icon = LucideIcons.shieldCheck;
        title = 'Not verified yet';
        subtitle = 'Submit two documents to enable Cash on delivery.';
    }
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        border: Border.all(color: color.withValues(alpha: 0.3)),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, size: 20, color: color),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w900, color: AppColors.foreground)),
            const SizedBox(height: 2),
            Text(subtitle, style: const TextStyle(fontSize: 11, color: AppColors.muted, height: 1.4)),
          ]),
        ),
      ]),
    );
  }
}

class _UploadField extends StatelessWidget {
  const _UploadField({required this.icon, required this.label, required this.hint, required this.file, required this.onTap});
  final IconData icon;
  final String label;
  final String hint;
  final XFile? file;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.card,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: AppColors.border)),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              width: 40, height: 40,
              decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
              child: Icon(icon, size: 20, color: AppColors.primary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(label, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
                const SizedBox(height: 2),
                Text(hint, style: const TextStyle(fontSize: 11, color: AppColors.muted, height: 1.3)),
                if (file != null) ...[
                  const SizedBox(height: 6),
                  Row(children: [
                    const Icon(LucideIcons.checkCircle2, size: 12, color: AppColors.success),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(file!.name,
                          maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.success)),
                    ),
                  ]),
                ],
              ]),
            ),
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(10)),
              child: const Icon(LucideIcons.upload, size: 16, color: AppColors.muted),
            ),
          ]),
        ),
      ),
    );
  }
}
