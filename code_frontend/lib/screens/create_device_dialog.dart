import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/api.dart';

class CreateDeviceDialog extends StatefulWidget {
  const CreateDeviceDialog({super.key});

  @override
  State<CreateDeviceDialog> createState() => _CreateDeviceDialogState();
}

class _CreateDeviceDialogState extends State<CreateDeviceDialog> {
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
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      title: const Text('Add New Device', style: TextStyle(fontWeight: FontWeight.bold)),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildField(label: 'Name', icon: Icons.label_outline, onSave: (v) => _name = v ?? '', required: true),
              const SizedBox(height: 15),
              _buildField(label: 'Location', icon: Icons.location_on_outlined, onSave: (v) => _location = v ?? ''),
              const SizedBox(height: 15),
              _buildField(label: 'Hardware ID', icon: Icons.fingerprint_outlined, onSave: (v) => _externalId = v ?? '', required: true),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
        ElevatedButton(
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2E7D32), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
          onPressed: _busy ? null : _submit,
          child: _busy ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('REGISTER'),
        ),
      ],
    );
  }

  Widget _buildField({required String label, required IconData icon, required Function(String?) onSave, bool required = false}) {
    return TextFormField(
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, size: 20),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(15)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      ),
      onSaved: onSave,
      validator: required ? (v) => (v == null || v.isEmpty) ? 'Required' : null : null,
    );
  }
}
