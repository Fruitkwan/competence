import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth_controller.dart';
import '../../core/biometric_auth.dart';
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

  String? _validateWorkEmail(String? v) {
    final value = (v ?? '').trim().toLowerCase();
    if (value.isEmpty) return 'Email is required';
    if (!value.contains('@')) return 'Invalid email';
    if (!value.endsWith('@dhofarglobal.com')) {
      return 'Use your @dhofarglobal.com email';
    }
    return null;
  }

  @override
  void dispose() {
    _email.dispose();
    _token.dispose();
    super.dispose();
  }

  Future<void> _sendOtp() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final email = _email.text.trim().toLowerCase();
    setState(() => _sending = true);
    try {
      await ref.read(authControllerProvider).sendOtp(email);
      if (!mounted) return;
      setState(() => _otpSent = true);
      showSuccessSnack(context, 'Check your email for the 8-digit OTP.');
    } catch (e) {
      if (mounted) showErrorSnack(context, e);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _verifyOtp() async {
    final code = _token.text.trim();
    if (code.length < 8) {
      showErrorSnack(context, 'Enter the 8-digit OTP.');
      return;
    }
    setState(() => _verifying = true);
    try {
      await ref.read(authControllerProvider).verifyOtp(
            email: _email.text.trim().toLowerCase(),
            token: code,
          );
      if (!mounted) return;
      await _offerBiometrics();
      if (!mounted) return;
      context.go('/dashboard');
    } catch (e) {
      if (mounted) showErrorSnack(context, e);
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  Future<void> _offerBiometrics() async {
    final biometrics = ref.read(biometricAuthProvider);
    if (await biometrics.isEnabled()) return;
    if (!await biometrics.canUse) return;
    if (!mounted) return;
    final enable = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Enable biometric login?'),
        content: const Text(
          'Use fingerprint or face unlock the next time you open the app.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Not now'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Enable'),
          ),
        ],
      ),
    );
    if (enable != true) return;
    final ok = await biometrics.authenticate();
    if (!ok) return;
    await biometrics.enable();
    if (mounted) showSuccessSnack(context, 'Biometric login enabled.');
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
                    TweenAnimationBuilder<double>(
                      tween: Tween(begin: 0, end: 1),
                      duration: const Duration(milliseconds: 900),
                      curve: Curves.easeOutBack,
                      builder: (context, value, child) {
                        final opacity = value.clamp(0.0, 1.0);
                        return Opacity(
                          opacity: opacity,
                          child: Transform.scale(
                            scale: 0.92 + (value * 0.08),
                            child: Transform.translate(
                              offset: Offset(0, 24 * (1 - value)),
                              child: child,
                            ),
                          ),
                        );
                      },
                      child: Column(
                        children: [
                          Image.asset(
                            'assets/logo.png',
                            height: 96,
                            fit: BoxFit.contain,
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'Dhofar Global',
                            textAlign: TextAlign.center,
                            style: theme.textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
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
                      validator: _validateWorkEmail,
                    ),
                    if (_otpSent) ...[
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _token,
                        keyboardType: TextInputType.number,
                        autofocus: true,
                        maxLength: 8,
                        decoration: const InputDecoration(
                          counterText: '',
                          labelText: '8-digit OTP',
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
                            : const Text('Send OTP'),
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
