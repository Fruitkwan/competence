import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
      showSuccessSnack(context, 'Check your email for the 6-digit OTP.');
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
                      _OtpBoxes(controller: _token),
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

class _OtpBoxes extends StatelessWidget {
  const _OtpBoxes({required this.controller});

  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('6-digit OTP', style: TextStyle(color: scheme.onSurfaceVariant)),
        const SizedBox(height: 8),
        SizedBox(
          height: 54,
          child: Stack(
            children: [
              Positioned.fill(
                child: TextField(
                  controller: controller,
                  autofocus: true,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  style: const TextStyle(color: Colors.transparent),
                  cursorColor: Colors.transparent,
                  decoration: const InputDecoration(
                    counterText: '',
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              ),
              IgnorePointer(
                child: AnimatedBuilder(
                  animation: controller,
                  builder: (context, _) {
                    final code = controller.text;
                    return Row(
                      children: List.generate(6, (i) {
                        final filled = i < code.length;
                        final active = i == code.length.clamp(0, 5);
                        return Expanded(
                          child: Padding(
                            padding: EdgeInsets.only(right: i == 5 ? 0 : 8),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 160),
                              height: 50,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: filled
                                    ? const Color(0xFFEAF6FC)
                                    : scheme.surfaceContainerHighest
                                        .withOpacity(0.38),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: filled
                                      ? const Color(0xFFD3EAF6)
                                      : Colors.transparent,
                                ),
                                boxShadow: active
                                    ? [
                                        BoxShadow(
                                          color: scheme.shadow.withOpacity(0.08),
                                          blurRadius: 10,
                                          offset: const Offset(0, 4),
                                        ),
                                      ]
                                    : null,
                              ),
                              child: Text(
                                filled ? code[i] : '',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleLarge
                                    ?.copyWith(
                                      fontWeight: FontWeight.w800,
                                      color: scheme.onSurface,
                                    ),
                              ),
                            ),
                          ),
                        );
                      }),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
