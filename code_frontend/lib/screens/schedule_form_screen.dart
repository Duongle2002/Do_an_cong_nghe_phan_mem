import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/device.dart';
import '../providers/app_state.dart';

class ScheduleFormScreen extends StatefulWidget {
  const ScheduleFormScreen({super.key});

  @override
  State<ScheduleFormScreen> createState() => _ScheduleFormScreenState();
}

class _ScheduleFormScreenState extends State<ScheduleFormScreen> {
  final _formKey = GlobalKey<FormState>();
  String? _selectedDeviceId;
  String _selectedTarget = 'main';
  String _selectedAction = 'ON';
  String _selectedRepeat = 'daily';
  TimeOfDay _selectedTime = TimeOfDay.now();
  bool _isLoading = false;

  final List<String> _targets = ['main', 'fan', 'light', 'pump'];
  final List<String> _actions = ['ON', 'OFF'];
  final List<String> _repeats = ['daily', 'weekly'];

  Future<List<Device>> _fetchDevices(AppState appState) async {
    return await appState.apiService.fetchDevices();
  }

  void _selectTime() async {
    final TimeOfDay? newTime = await showTimePicker(
      context: context,
      initialTime: _selectedTime,
    );
    if (newTime != null) {
      setState(() {
        _selectedTime = newTime;
      });
    }
  }

  Future<void> _submit(AppState appState) async {
    if (!_formKey.currentState!.validate() || _selectedDeviceId == null) return;

    setState(() { _isLoading = true; });

    // Tạo DateTime object cho ISO8601, sử dụng thời gian hiện tại nhưng thay đổi giờ và phút
    final now = DateTime.now().toUtc();
    final timeToSave = DateTime.utc(
      now.year, now.month, now.day,
      _selectedTime.hour, _selectedTime.minute,
    );

    // Server expects ISO8601 string
    final isoTime = timeToSave.toIso8601String();

    try {
      await appState.apiService.createSchedule(
        deviceId: _selectedDeviceId!,
        target: _selectedTarget,
        action: _selectedAction,
        time: isoTime,
        repeat: _selectedRepeat,
      );
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Schedule created successfully!')),
      );
      Navigator.pop(context);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to create: $e')),
      );
    } finally {
      setState(() { _isLoading = false; });
    }
  }
  InputDecoration _inputDecoration({required String label, IconData? icon}) {
    return InputDecoration(
      labelText: label,
      prefixIcon: icon != null ? Icon(icon, color: Colors.green) : null,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10.0),
        borderSide: BorderSide.none,
      ),
      filled: true,
      fillColor: Colors.grey.shade100,
      contentPadding: const EdgeInsets.symmetric(vertical: 15, horizontal: 10),
    );
  }

  @override
  Widget build(BuildContext context) {
    final appState = Provider.of<AppState>(context, listen: false);

    return Scaffold(
      appBar: AppBar(
        title: const Text('New Schedule'),
        backgroundColor: Colors.green,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              const Text(
                'Schedule Configuration',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.green),
              ),
              const Divider(color: Colors.green),
              const SizedBox(height: 10),

              // 1. Device Selector
              FutureBuilder<List<Device>>(
                future: _fetchDevices(appState),
                builder: (context, snapshot) {
                  // ... (logic loading/error/data giữ nguyên)
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snapshot.hasError || !snapshot.hasData || snapshot.data!.isEmpty) {
                    return const Text('Cannot load devices.');
                  }
                  final devices = snapshot.data!;
                  if (_selectedDeviceId == null) {
                    _selectedDeviceId = devices.first.id;
                  }
                  return DropdownButtonFormField<String>(
                    decoration: _inputDecoration(label: 'Device', icon: Icons.devices),
                    value: _selectedDeviceId,
                    items: devices.map((d) => DropdownMenuItem(value: d.id, child: Text(d.name))).toList(),
                    onChanged: (value) { setState(() { _selectedDeviceId = value; }); },
                    validator: (value) => value == null ? 'Please select a device' : null,
                  );
                },
              ),
              const SizedBox(height: 20),

              // 2. Target Selector
              DropdownButtonFormField<String>(
                decoration: _inputDecoration(label: 'Target', icon: Icons.tune),
                value: _selectedTarget,
                items: _targets.map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
                onChanged: (value) { setState(() { _selectedTarget = value!; }); },
              ),
              const SizedBox(height: 20),

              // 3. Action Selector
              DropdownButtonFormField<String>(
                decoration: _inputDecoration(label: 'Action', icon: Icons.flash_on),
                value: _selectedAction,
                items: _actions.map((a) => DropdownMenuItem(value: a, child: Text(a))).toList(),
                onChanged: (value) { setState(() { _selectedAction = value!; }); },
              ),
              const SizedBox(height: 20),

              // 4. Time Picker
              Container(
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(10.0),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                child: Row(
                  children: [
                    const Icon(Icons.access_time, color: Colors.green),
                    const SizedBox(width: 15),
                    Expanded(
                      child: Text('Scheduled Time: ${ _selectedTime.format(context)}', style: const TextStyle(fontSize: 16)),
                    ),
                    TextButton(
                      onPressed: _selectTime,
                      child: const Text('Change Time', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // 5. Repeat Selector
              DropdownButtonFormField<String>(
                decoration: _inputDecoration(label: 'Repeat', icon: Icons.repeat),
                value: _selectedRepeat,
                items: _repeats.map((r) => DropdownMenuItem(value: r, child: Text(r))).toList(),
                onChanged: (value) { setState(() { _selectedRepeat = value!; }); },
              ),
              const SizedBox(height: 30),

              // 6. Submit Button
              _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : ElevatedButton.icon(
                icon: const Icon(Icons.save, color: Colors.white),
                label: const Text('Create Schedule', style: TextStyle(fontSize: 18, color: Colors.white)),
                onPressed: () => _submit(appState),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.green,
                  minimumSize: const Size(double.infinity, 50),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  elevation: 5,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}