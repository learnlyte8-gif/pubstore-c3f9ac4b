import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/auth_service.dart';
import '../services/push_service.dart';
import '../services/supabase_client.dart';
import '../theme/palette.dart';

/// 1:1 mirror of `src/pages/Auth.tsx` — passwordless email OTP.
///
/// Flow:
///  1. `email` step: full name (optional) + email + phone (optional) → send code.
///  2. `code` step: 8-digit numeric input → verify → route home / onboarding.
class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key, this.redirectTo = '/home'});

  final String redirectTo;

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

enum _Step { email, code }

// Small country list — mirrors the common set from `PhoneInput.tsx`.
class _Country {
  const _Country(this.iso2, this.name, this.dial, this.flag);
  final String iso2;
  final String name;
  final String dial;
  final String flag;
}

const _defaultCountry = _Country('US', 'United States', '1', '🇺🇸');
const _countries = <_Country>[
  _defaultCountry,
  _Country('GB', 'United Kingdom', '44', '🇬🇧'),
  _Country('CA', 'Canada', '1', '🇨🇦'),
  _Country('AU', 'Australia', '61', '🇦🇺'),
  _Country('DE', 'Germany', '49', '🇩🇪'),
  _Country('FR', 'France', '33', '🇫🇷'),
  _Country('ES', 'Spain', '34', '🇪🇸'),
  _Country('IT', 'Italy', '39', '🇮🇹'),
  _Country('NL', 'Netherlands', '31', '🇳🇱'),
  _Country('IN', 'India', '91', '🇮🇳'),
  _Country('CN', 'China', '86', '🇨🇳'),
  _Country('JP', 'Japan', '81', '🇯🇵'),
  _Country('BR', 'Brazil', '55', '🇧🇷'),
  _Country('MX', 'Mexico', '52', '🇲🇽'),
  _Country('ZA', 'South Africa', '27', '🇿🇦'),
  _Country('NG', 'Nigeria', '234', '🇳🇬'),
  _Country('KE', 'Kenya', '254', '🇰🇪'),
  _Country('AE', 'United Arab Emirates', '971', '🇦🇪'),
];

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final _nameCtl = TextEditingController();
  final _emailCtl = TextEditingController();
  final _phoneCtl = TextEditingController();
  final _codeCtl = TextEditingController();

  _Step _step = _Step.email;
  _Country _country = _defaultCountry;
  bool _loading = false;
  int _resendIn = 0;
  Timer? _resendTimer;

  @override
  void dispose() {
    _nameCtl.dispose();
    _emailCtl.dispose();
    _phoneCtl.dispose();
    _codeCtl.dispose();
    _resendTimer?.cancel();
    super.dispose();
  }

  void _toast(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(
        content: Text(msg),
        backgroundColor: error ? AppColors.danger : null,
      ));
  }

  bool _validEmail(String s) =>
      RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(s.trim());

  String _toE164(String dial, String digits) => '+$dial$digits';

  void _startResendCountdown() {
    _resendTimer?.cancel();
    setState(() => _resendIn = 45);
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return;
      setState(() => _resendIn -= 1);
      if (_resendIn <= 0) t.cancel();
    });
  }

  Future<void> _sendCode() async {
    final email = _emailCtl.text.trim();
    if (!_validEmail(email)) {
      _toast('Enter a valid email', error: true);
      return;
    }
    final phoneDigits = _phoneCtl.text.replaceAll(RegExp(r'\D'), '');
    String? phoneE164;
    if (phoneDigits.isNotEmpty) {
      if (phoneDigits.length < 6 || phoneDigits.length > 15) {
        _toast('Enter a valid phone number', error: true);
        return;
      }
      phoneE164 = _toE164(_country.dial, phoneDigits);
    }

    setState(() => _loading = true);
    try {
      await authService.sendEmailOtp(
        email: email,
        displayName:
            _nameCtl.text.trim().isEmpty ? null : _nameCtl.text.trim(),
        phoneE164: phoneE164,
        phoneCountry: phoneE164 == null ? null : _country.iso2,
      );
      _toast('Code sent — check your email');
      setState(() => _step = _Step.code);
      _startResendCountdown();
    } catch (e) {
      _toast(e.toString().replaceAll('Exception: ', ''), error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _verifyCode() async {
    final code = _codeCtl.text.trim();
    if (!RegExp(r'^\d{8}$').hasMatch(code)) {
      _toast('Enter the 8-digit code', error: true);
      return;
    }
    setState(() => _loading = true);
    try {
      final user = await authService.verifyEmailOtp(
        email: _emailCtl.text.trim(),
        token: code,
      );
      final phoneDigits = _phoneCtl.text.replaceAll(RegExp(r'\D'), '');
      if (user != null && phoneDigits.isNotEmpty) {
        await authService.upsertPhone(
          userId: user.id,
          phoneE164: _toE164(_country.dial, phoneDigits),
        );
      }
      _toast('Welcome to PUBSTORE 🎉');
      await _routeForSession();
    } catch (e) {
      final msg = e.toString();
      _toast(
        msg.toLowerCase().contains('expired')
            ? 'Code expired — request a new one'
            : 'Invalid code',
        error: true,
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _signInWithGoogle() async {
    setState(() => _loading = true);
    try {
      final user = await authService.signInWithGoogle();
      if (user == null) return; // user cancelled
      _toast('Welcome to PUBSTORE 🎉');
      await _routeForSession();
    } catch (e) {
      _toast(
        e.toString().replaceAll('Exception: ', '').replaceAll('AuthException: ', ''),
        error: true,
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _routeForSession() async {
    final user = supabase.auth.currentUser;
    if (user == null || !mounted) return;
    // Register for push once we have a session (safe no-op if Firebase isn't
    // configured in the host app or permission was denied).
    // ignore: unawaited_futures
    pushService.registerForCurrentUser();
    final profile = await supabase
        .from('profiles')
        .select('profile_completed')
        .eq('user_id', user.id)
        .maybeSingle();
    if (!mounted) return;
    final completed = profile?['profile_completed'] == true;
    Navigator.of(context).pushNamedAndRemoveUntil(
      completed ? widget.redirectTo : '/onboarding',
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 380),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // ── Logo + wordmark ────────────────────────────────
                Column(
                  children: [
                    Image.asset('assets/pubstore-logo.png',
                        width: 72, height: 72),
                    const SizedBox(height: 16),
                    const Text(
                      'PUBSTORE',
                      style: TextStyle(
                        fontSize: 44,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 2,
                        color: AppColors.foreground,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 32),

                // ── Guest link ────────────────────────────────────
                Center(
                  child: TextButton(
                    onPressed: () => Navigator.of(context)
                        .pushNamedAndRemoveUntil('/home', (_) => false),
                    child: const Text(
                      'Continue browsing as guest',
                      style: TextStyle(
                          fontSize: 12,
                          color: AppColors.muted,
                          decoration: TextDecoration.underline),
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                if (_step == _Step.email)
                  _buildEmailForm()
                else
                  _buildCodeForm(),

                const SizedBox(height: 40),
                _buildLegal(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEmailForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _field(controller: _nameCtl, hint: 'Full name (optional)'),
        const SizedBox(height: 8),
        _field(
          controller: _emailCtl,
          hint: 'Email address',
          keyboard: TextInputType.emailAddress,
        ),
        const SizedBox(height: 8),
        _phoneField(),
        const SizedBox(height: 16),
        _primaryButton(
          label: 'Send code',
          onPressed: _loading ? null : _sendCode,
        ),
        const SizedBox(height: 12),
        const Text(
          "We'll email you a 8-digit code — no password needed.",
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 11, color: AppColors.muted),
        ),
        const SizedBox(height: 20),
        Row(children: const [
          Expanded(child: Divider(color: AppColors.border)),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 10),
            child: Text('or', style: TextStyle(fontSize: 11, color: AppColors.muted)),
          ),
          Expanded(child: Divider(color: AppColors.border)),
        ]),
        const SizedBox(height: 14),
        SizedBox(
          height: 48,
          child: OutlinedButton.icon(
            onPressed: _loading ? null : _signInWithGoogle,
            icon: Image.network(
              'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg',
              width: 18,
              height: 18,
              errorBuilder: (_, __, ___) =>
                  const Icon(Icons.g_mobiledata, size: 22),
            ),
            label: const Text('Continue with Google',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.foreground,
              side: const BorderSide(color: AppColors.border),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCodeForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Text.rich(
            TextSpan(
              text: 'Code sent to ',
              style: const TextStyle(fontSize: 12, color: AppColors.muted),
              children: [
                TextSpan(
                  text: _emailCtl.text.trim(),
                  style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: AppColors.foreground),
                ),
              ],
            ),
            textAlign: TextAlign.center,
          ),
        ),
        _field(
          controller: _codeCtl,
          hint: '8-digit code',
          keyboard: TextInputType.number,
          maxLength: 8,
          center: true,
          bold: true,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        ),
        const SizedBox(height: 12),
        _primaryButton(
          label: 'Verify & continue',
          onPressed: (_loading || _codeCtl.text.length != 8)
              ? null
              : _verifyCode,
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            TextButton(
              onPressed: () {
                setState(() {
                  _step = _Step.email;
                  _codeCtl.clear();
                });
              },
              child: const Text('Change email',
                  style:
                      TextStyle(fontSize: 12, color: AppColors.muted)),
            ),
            TextButton(
              onPressed: (_resendIn > 0 || _loading) ? null : _sendCode,
              child: Text(
                _resendIn > 0 ? 'Resend in ${_resendIn}s' : 'Resend code',
                style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.primary),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _field({
    required TextEditingController controller,
    required String hint,
    TextInputType? keyboard,
    int? maxLength,
    bool center = false,
    bool bold = false,
    List<TextInputFormatter>? inputFormatters,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboard,
      maxLength: maxLength,
      textAlign: center ? TextAlign.center : TextAlign.start,
      inputFormatters: inputFormatters,
      onChanged: (_) => setState(() {}),
      style: TextStyle(
        fontSize: bold ? 18 : 14,
        fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
        letterSpacing: bold ? 8 : 0,
      ),
      decoration: InputDecoration(
        hintText: hint,
        counterText: '',
        filled: true,
        fillColor: AppColors.input,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.foreground),
        ),
      ),
    );
  }

  Widget _phoneField() {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.input,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          InkWell(
            onTap: _pickCountry,
            borderRadius:
                const BorderRadius.horizontal(left: Radius.circular(8)),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                  horizontal: 12, vertical: 14),
              child: Row(
                children: [
                  Text(_country.flag,
                      style: const TextStyle(fontSize: 18)),
                  const SizedBox(width: 6),
                  Text('+${_country.dial}',
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w600)),
                  const Icon(Icons.arrow_drop_down,
                      size: 18, color: AppColors.muted),
                ],
              ),
            ),
          ),
          Container(width: 1, height: 28, color: AppColors.border),
          Expanded(
            child: TextField(
              controller: _phoneCtl,
              keyboardType: TextInputType.phone,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              style: const TextStyle(fontSize: 14),
              decoration: const InputDecoration(
                hintText: 'Phone number (optional)',
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(
                    horizontal: 12, vertical: 14),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _pickCountry() async {
    final picked = await showModalBottomSheet<_Country>(
      context: context,
      builder: (ctx) => SafeArea(
        child: ListView.builder(
          itemCount: _countries.length,
          itemBuilder: (_, i) {
            final c = _countries[i];
            return ListTile(
              leading:
                  Text(c.flag, style: const TextStyle(fontSize: 22)),
              title: Text(c.name),
              trailing: Text('+${c.dial}',
                  style: const TextStyle(color: AppColors.muted)),
              onTap: () => Navigator.of(ctx).pop(c),
            );
          },
        ),
      ),
    );
    if (picked != null) setState(() => _country = picked);
  }

  Widget _primaryButton(
      {required String label, required VoidCallback? onPressed}) {
    return SizedBox(
      height: 48,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: AppColors.primaryForeground,
          disabledBackgroundColor: AppColors.primary.withOpacity(0.6),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10)),
          textStyle: const TextStyle(
              fontSize: 15, fontWeight: FontWeight.w700),
        ),
        child: _loading
            ? const SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white))
            : Text(label),
      ),
    );
  }

  Widget _buildLegal() {
    return const Text(
      "By continuing, you agree to PUBSTORE's Terms and Privacy Policy.",
      textAlign: TextAlign.center,
      style: TextStyle(fontSize: 11, color: AppColors.muted, height: 1.5),
    );
  }
}
