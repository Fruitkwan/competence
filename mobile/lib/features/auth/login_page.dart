import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth_controller.dart';
import '../../core/error_handler.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _email = TextEditingController();
  final _token = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  bool _sending = false;
  bool _verifying = false;
  bool _otpSent = false;

  @override
  void dispose() {
    _email.dispose();
    _token.dispose();
    super.dispose();
  }

  Future<void> _sendOtp() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _sending = true);
    try {
      await ref.read(authControllerProvider).sendOtp(_email.text.trim());
      if (!mounted) return;
      setState(() => _otpSent = true);
      showSuccessSnack(context, 'Check your email for the 6-digit code.');
    } catch (e) {
      if (mounted) showErrorSnack(context, e);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _verifyOtp() async {
    final code = _token.text.trim();
    if (code.length < 6) {
      showErrorSnack(context, 'Enter the 6-digit code.');
      return;
    }
    setState(() => _verifying = true);
    try {
      await ref.read(authControllerProvider).verifyOtp(
            email: _email.text.trim(),
            token: code,
          );
      if (!mounted) return;
      context.go('/dashboard');
    } catch (e) {
      if (mounted) showErrorSnack(context, e);
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Icon(Icons.show_chart_rounded,
                        size: 48, color: theme.colorScheme.primary),
                    const SizedBox(height: 16),
                    Text(
                      'Performance Hub',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Sign in with your work email.',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 32),
                    TextFormField(
                      controller: _email,
                      enabled: !_otpSent,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.email],
                      decoration: const InputDecoration(
                        labelText: 'Work email',
                        prefixIcon: Icon(Icons.mail_outline),
                      ),
                      validator: (v) {
                        final value = (v ?? '').trim();
                        if (value.isEmpty) return 'Email is required';
                        if (!value.contains('@')) return 'Invalid email';
                        return null;
                      },
                    ),
                    if (_otpSent) ...[
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _token,
                        keyboardType: TextInputType.number,
                        autofocus: true,
                        decoration: const InputDecoration(
                          labelText: '6-digit code',
                          prefixIcon: Icon(Icons.lock_outline),
                        ),
                      ),
                    ],
                    const SizedBox(height: 24),
                    if (!_otpSent)
                      FilledButton(
                        onPressed: _sending ? null : _sendOtp,
                        child: _sending
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Text('Send code'),
                      )
                    else
                      FilledButton(
                        onPressed: _verifying ? null : _verifyOtp,
                        child: _verifying
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Text('Verify & sign in'),
                      ),
                    if (_otpSent) ...[
                      const SizedBox(height: 8),
                      TextButton(
                        onPressed: () => setState(() {
                          _otpSent = false;
                          _token.clear();
                        }),
                        child: const Text('Use a different email'),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
