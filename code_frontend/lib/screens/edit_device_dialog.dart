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
      final payload = {
        'name': _name,
        'location': _location,
        'externalId': _externalId.isEmpty ? null : _externalId,
      };
      await Api.updateDevice(auth.accessToken ?? '', widget.device.id, payload);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Update device failed: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Edit device'),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                initialValue: _name,
                decoration: const InputDecoration(labelText: 'Name'),
                onSaved: (v) => _name = v ?? '',
                validator: (v) => v == null || v.isEmpty ? 'Required' : null,
              ),
              TextFormField(
                initialValue: _location,
                decoration: const InputDecoration(labelText: 'Location'),
                onSaved: (v) => _location = v ?? '',
              ),
              TextFormField(
                initialValue: _externalId,
                decoration: const InputDecoration(labelText: 'External ID'),
                onSaved: (v) => _externalId = v ?? '',
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
              : const Text('Save'),
        ),
      ],
    );
  }
}
