import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _emailCtl = TextEditingController();
  final _passCtl = TextEditingController();
  bool _loading = false;
  String? _error;

  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animationController, curve: const Interval(0.4, 1.0, curve: Curves.easeIn)),
    );

    _slideAnimation = Tween<Offset>(begin: const Offset(0, 0.1), end: Offset.zero).animate(
      CurvedAnimation(parent: _animationController, curve: const Interval(0.4, 1.0, curve: Curves.easeOutCubic)),
    );

    _animationController.forward();
  }

  @override
  void dispose() {
    _animationController.dispose();
    _emailCtl.dispose();
    _passCtl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Background Image with Overlay
          Positioned.fill(
            child: Image.asset(
              'assets/smart_farm_bg.png',
              fit: BoxFit.cover,
            ),
          ),
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withOpacity(0.3),
                    Colors.black.withOpacity(0.8),
                  ],
                ),
              ),
            ),
          ),

          // Login Form
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 30),
                child: FadeTransition(
                  opacity: _fadeAnimation,
                  child: SlideTransition(
                    position: _slideAnimation,
                    child: Form(
                      key: _formKey,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.eco, size: 80, color: Color(0xFF81C784)),
                          const SizedBox(height: 10),
                          const Text(
                            'SMART FARM',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 28,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 4,
                            ),
                          ),
                          const Text(
                            'Digital Agriculture Control',
                            style: TextStyle(color: Colors.white70, fontSize: 14),
                          ),
                          const SizedBox(height: 50),

                          // Email Field
                          _buildTextField(
                            controller: _emailCtl,
                            label: 'Email',
                            icon: Icons.email_outlined,
                            keyboardType: TextInputType.emailAddress,
                          ),
                          const SizedBox(height: 20),

                          // Password Field
                          _buildTextField(
                            controller: _passCtl,
                            label: 'Password',
                            icon: Icons.lock_outline,
                            obscureText: true,
                          ),
                          const SizedBox(height: 30),

                          if (_error != null)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 15),
                              child: Text(
                                _error!,
                                style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold),
                              ),
                            ),

                          // Login Button
                          SizedBox(
                            width: double.infinity,
                            height: 55,
                            child: ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF2E7D32),
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                                elevation: 5,
                              ),
                              onPressed: _loading ? null : () => _submit(context),
                              child: _loading
                                  ? const CircularProgressIndicator(color: Colors.white)
                                  : const Text(
                                      'LOGIN',
                                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                                    ),
                            ),
                          ),

                          const SizedBox(height: 20),
                          TextButton(
                            onPressed: () => Navigator.of(context).pushNamed('/register'),
                            child: const Text(
                              'Don\'t have an account? Create one',
                              style: TextStyle(color: Colors.white70),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    bool obscureText = false,
    TextInputType? keyboardType,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.15),
        borderRadius: BorderRadius.circular(15),
      ),
      child: TextFormField(
        controller: controller,
        obscureText: obscureText,
        keyboardType: keyboardType,
        style: const TextStyle(color: Colors.white),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: const TextStyle(color: Colors.white70),
          prefixIcon: Icon(icon, color: Colors.white70),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 15),
        ),
        validator: (v) => (v == null || v.isEmpty) ? 'Enter $label' : null,
      ),
    );
  }

  Future<void> _submit(BuildContext context) async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final ok = await auth.login(_emailCtl.text.trim(), _passCtl.text.trim());
      if (!ok) setState(() => _error = 'Invalid credentials');
    } catch (e) {
      final message = e.toString().replaceFirst('Exception: ', '');
      setState(() => _error = message.isNotEmpty ? message : 'Login failed. Please check your connection.');
    } finally {
      setState(() => _loading = false);
    }
  }
}

