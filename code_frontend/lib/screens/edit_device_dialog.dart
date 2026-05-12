import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/api.dart';
import '../models/device.dart';

class EditDeviceDialog extends StatefulWidget {
  final Device device;
  const EditDeviceDialog({super.key, required this.device});

  @override
  State<EditDeviceDialog> createState() => _EditDeviceDialogState();
}

class _EditDeviceDialogState extends State<EditDeviceDialog> {
  final _formKey = GlobalKey<FormState>();
  late String _name;
  late String _location;
  late String _externalId;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _name = widget.device.name;
    _location = widget.device.location ?? '';
    _externalId = widget.device.externalId ?? '';
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    _formKey.currentState!.save();
    setState(() => _busy = true);
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final payload = {'name': _name, 'location': _location, 'externalId': _externalId.isEmpty ? null : _externalId};
      await Api.updateDevice(auth.accessToken ?? '', widget.device.id, payload);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Update failed: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      title: const Text('Edit Device Details', style: TextStyle(fontWeight: FontWeight.bold)),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildField(label: 'Name', initialValue: _name, icon: Icons.label_outline, onSave: (v) => _name = v ?? '', required: true),
              const SizedBox(height: 15),
              _buildField(label: 'Location', initialValue: _location, icon: Icons.location_on_outlined, onSave: (v) => _location = v ?? ''),
              const SizedBox(height: 15),
              _buildField(label: 'Hardware ID', initialValue: _externalId, icon: Icons.fingerprint_outlined, onSave: (v) => _externalId = v ?? ''),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
        ElevatedButton(
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2E7D32), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
          onPressed: _busy ? null : _submit,
          child: _busy ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('UPDATE'),
        ),
      ],
    );
  }

  Widget _buildField({required String label, required String initialValue, required IconData icon, required Function(String?) onSave, bool required = false}) {
    return TextFormField(
      initialValue: initialValue,
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
