import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api.dart';
import '../services/auth_service.dart';

class SensorUploadPage extends StatefulWidget {
  const SensorUploadPage({super.key});

  @override
  State<SensorUploadPage> createState() => _SensorUploadPageState();
}

class _SensorUploadPageState extends State<SensorUploadPage> {
  final _formKey = GlobalKey<FormState>();
  String _deviceId = '';
  String _temperature = '';
  String _humidity = '';
  String _soil = '';
  String _pH = '';
  bool _loading = false;
  String? _error;

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    _formKey.currentState!.save();
    setState(() { _loading = true; _error = null; });
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final Map<String, dynamic> body = {
        'deviceId': _deviceId,
      };
      if (_temperature.isNotEmpty) body['temperature'] = double.parse(_temperature);
      if (_humidity.isNotEmpty) body['humidity'] = double.parse(_humidity);
      if (_soil.isNotEmpty) body['soilMoisture'] = double.parse(_soil);
      if (_pH.isNotEmpty) body['pH'] = double.parse(_pH);
      await Api.ingestSensor(auth.accessToken ?? '', body);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Sensor data ingested')));
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      setState(() { _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Send Sensor Data')),
      body: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Form(
          key: _formKey,
          child: ListView(
            children: [
              TextFormField(decoration: const InputDecoration(labelText: 'Device ID'), onSaved: (v) => _deviceId = v ?? '', validator: (v) => v == null || v.isEmpty ? 'Required' : null,),
              TextFormField(decoration: const InputDecoration(labelText: 'Temperature'), keyboardType: TextInputType.number, onSaved: (v) => _temperature = v ?? ''),
              TextFormField(decoration: const InputDecoration(labelText: 'Humidity'), keyboardType: TextInputType.number, onSaved: (v) => _humidity = v ?? ''),
              TextFormField(decoration: const InputDecoration(labelText: 'Soil Moisture'), keyboardType: TextInputType.number, onSaved: (v) => _soil = v ?? ''),
              TextFormField(decoration: const InputDecoration(labelText: 'pH'), keyboardType: TextInputType.number, onSaved: (v) => _pH = v ?? ''),
              const SizedBox(height: 12),
              if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
              ElevatedButton(onPressed: _loading ? null : _submit, child: _loading ? const CircularProgressIndicator() : const Text('Send')),
            ],
          ),
        ),
      ),
    );
  }
}
