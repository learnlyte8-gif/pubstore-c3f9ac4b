import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/auth_service.dart';
import '../theme/palette.dart';

/// Email + password auth — same UX as `src/pages/Auth.tsx`.
class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key});

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

enum _Mode { signIn, signUp, reset }

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final _emailCtl = TextEditingController();
  final _passCtl = TextEditingController();
  final _nameCtl = TextEditingController();
  _Mode _mode = _Mode.signIn;
  bool _busy = false;
  String? _error;
  String? _info;

  @override
  void dispose() {
    _emailCtl.dispose();
    _passCtl.dispose();
    _nameCtl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
      _info = null;
    });
    try {
      switch (_mode) {
        case _Mode.signIn:
          await authService.signInWithPassword(
              _emailCtl.text.trim(), _passCtl.text);
          if (mounted) Navigator.of(context).pop();
          break;
        case _Mode.signUp:
          await authService.signUp(
            _emailCtl.text.trim(),
            _passCtl.text,
            displayName: _nameCtl.text.trim().isEmpty
                ? null
                : _nameCtl.text.trim(),
          );
          setState(() =>
              _info = 'Account created. Check your email to confirm, then sign in.');
          break;
        case _Mode.reset:
          await authService.sendPasswordReset(_emailCtl.text.trim());
          setState(() => _info = 'Password reset link sent.');
          break;
      }
    } catch (e) {
      setState(() => _error = _friendly(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _friendly(Object e) {
    final s = e.toString();
    if (s.contains('Invalid login')) return 'Wrong email or password.';
    if (s.contains('already registered')) {
      return 'That email is already registered — try signing in.';
    }
    return s.replaceAll('Exception: ', '');
  }

  @override
  Widget build(BuildContext context) {
    final title = switch (_mode) {
      _Mode.signIn => 'Sign in',
      _Mode.signUp => 'Create account',
      _Mode.reset => 'Reset password',
    };
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(LucideIcons.chevronLeft),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(title,
            style: const TextStyle(fontWeight: FontWeight.w800)),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 8),
              const Text('PUBSTORE',
                  style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.5)),
              const SizedBox(height: 4),
              Text(_subtitle(),
                  style: const TextStyle(color: AppColors.muted, fontSize: 13)),
              const SizedBox(height: 24),
              if (_mode == _Mode.signUp) ...[
                TextField(
                  controller: _nameCtl,
                  decoration: const InputDecoration(
                    labelText: 'Display name (optional)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
              ],
              TextField(
                controller: _emailCtl,
                keyboardType: TextInputType.emailAddress,
                autocorrect: false,
                decoration: const InputDecoration(
                  labelText: 'Email',
                  border: OutlineInputBorder(),
                ),
              ),
              if (_mode != _Mode.reset) ...[
                const SizedBox(height: 12),
                TextField(
                  controller: _passCtl,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Password',
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!,
                    style: const TextStyle(
                        color: AppColors.danger, fontSize: 12)),
              ],
              if (_info != null) ...[
                const SizedBox(height: 12),
                Text(_info!,
                    style: const TextStyle(
                        color: AppColors.success, fontSize: 12)),
              ],
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: _busy ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.foreground,
                  foregroundColor: AppColors.background,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: _busy
                    ? const SizedBox(
                        height: 16,
                        width: 16,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : Text(_ctaLabel()),
              ),
              const SizedBox(height: 14),
              if (_mode == _Mode.signIn) ...[
                TextButton(
                  onPressed: () => setState(() => _mode = _Mode.signUp),
                  child: const Text('New here? Create an account'),
                ),
                TextButton(
                  onPressed: () => setState(() => _mode = _Mode.reset),
                  child: const Text('Forgot password?'),
                ),
              ] else
                TextButton(
                  onPressed: () => setState(() => _mode = _Mode.signIn),
                  child: const Text('Back to sign in'),
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _subtitle() => switch (_mode) {
        _Mode.signIn => 'Welcome back — sign in to sync your cart & orders.',
        _Mode.signUp => 'Create an account to save, order, and message suppliers.',
        _Mode.reset => "We'll email you a secure link to reset your password.",
      };

  String _ctaLabel() => switch (_mode) {
        _Mode.signIn => 'Sign in',
        _Mode.signUp => 'Create account',
        _Mode.reset => 'Send reset link',
      };
}
