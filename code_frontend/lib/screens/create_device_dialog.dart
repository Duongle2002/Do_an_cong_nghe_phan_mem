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
      final payload = {
        'name': _name,
        'location': _location,
        'externalId': _externalId,
      };
      await Api.createDevice(auth.accessToken ?? '', payload);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Create device failed: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Add device'),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                decoration: const InputDecoration(labelText: 'Name'),
                onSaved: (v) => _name = v ?? '',
                validator: (v) => v == null || v.isEmpty ? 'Required' : null,
              ),
              TextFormField(
                decoration: const InputDecoration(labelText: 'Location'),
                onSaved: (v) => _location = v ?? '',
              ),
              TextFormField(
                decoration: const InputDecoration(labelText: 'External ID'),
                onSaved: (v) => _externalId = v ?? '',
                validator: (v) => v == null || v.isEmpty ? 'Required' : null,
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: _busy ? null : _submit,
          child: _busy
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Create'),
        ),
      ],
    );
  }
}
