import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/api.dart';

class CreateDevicePage extends StatefulWidget {
  const CreateDevicePage({super.key});

  @override
  State<CreateDevicePage> createState() => _CreateDevicePageState();
}

class _CreateDevicePageState extends State<CreateDevicePage> {
  final _formKey = GlobalKey<FormState>();
  String _name = '';
  String _location = '';
  String _externalId = '';
  bool _busy = false;

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    _formKey.currentState!.save();
    setState(() => _busy = true);
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final payload = {'name': _name, 'location': _location, 'externalId': _externalId};
      await Api.createDevice(auth.accessToken ?? '', payload);
      Navigator.of(context).pop(true);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to create device: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F7F2),
      appBar: AppBar(
        title: const Text('Add New Device', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4))]),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Device Configuration', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Text('Link your IoT hardware to the farm network.', style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                const SizedBox(height: 32),
                _buildField(label: 'Device Name', hint: 'e.g. Tomato Greenhouse A', icon: Icons.label_outline, onSave: (v) => _name = v ?? ''),
                const SizedBox(height: 20),
                _buildField(label: 'Location', hint: 'e.g. Sector 1, North Wing', icon: Icons.location_on_outlined, onSave: (v) => _location = v ?? ''),
                const SizedBox(height: 20),
                _buildField(label: 'Hardware ID (MAC/UUID)', hint: 'Enter unique external ID', icon: Icons.fingerprint_outlined, onSave: (v) => _externalId = v ?? '', required: true),
                const SizedBox(height: 40),
                SizedBox(
                  width: double.infinity,
                  height: 55,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2E7D32), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15))),
                    onPressed: _busy ? null : _submit,
                    child: _busy ? const CircularProgressIndicator(color: Colors.white) : const Text('REGISTER DEVICE', style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildField({required String label, required String hint, required IconData icon, required Function(String?) onSave, bool required = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.black54)),
        const SizedBox(height: 8),
        TextFormField(
          decoration: InputDecoration(
            hintText: hint,
            prefixIcon: Icon(icon, size: 20),
            filled: true,
            fillColor: const Color(0xFFF9FBF9),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(15), borderSide: BorderSide.none),
            contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 15),
          ),
          onSaved: onSave,
          validator: required ? (v) => (v == null || v.isEmpty) ? 'Required field' : null : null,
        ),
      ],
    );
  }
}
