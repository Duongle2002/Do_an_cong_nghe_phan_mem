import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/api.dart';
import 'package:intl/intl.dart';
import '../models/device.dart';

class SchedulesPage extends StatefulWidget {
  const SchedulesPage({super.key});

  @override
  State<SchedulesPage> createState() => _SchedulesPageState();
}

class _SchedulesPageState extends State<SchedulesPage> with SingleTickerProviderStateMixin {
  List<dynamic> _schedules = [];
  bool _loading = true;
  bool _busy = false;

  late AnimationController _listController;

  @override
  void initState() {
    super.initState();
    _listController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _load();
  }

  @override
  void dispose() {
    _listController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final list = await Api.getSchedules(auth.accessToken ?? '');
      setState(() => _schedules = list);
      _listController.forward(from: 0);
    } catch (e) {
      setState(() => _schedules = []);
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _showEditor({Map<String, dynamic>? existing}) async {
    final auth = Provider.of<AuthService>(context, listen: false);
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => ScheduleEditorDialog(existing: existing),
    );
    if (result != null) {
      setState(() => _busy = true);
      try {
        if (existing == null) {
          await Api.createSchedule(auth.accessToken ?? '', result);
        } else {
          await Api.updateSchedule(auth.accessToken ?? '', existing['_id'], result);
        }
        await _load();
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      } finally {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _delete(String id) async {
    final auth = Provider.of<AuthService>(context, listen: false);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete schedule?'),
        content: const Text('Are you sure you want to delete this schedule?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.of(ctx).pop(true), child: const Text('Delete')),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      await Api.deleteSchedule(auth.accessToken ?? '', id);
      await _load();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Delete failed: $e')));
    } finally {
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F7F2),
      appBar: AppBar(
        title: const Text('Operation Schedule', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _schedules.isEmpty
          ? _buildEmptyState()
          : Stack(
              children: [
                ListView.builder(
                  itemCount: _schedules.length,
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  itemBuilder: (ctx, i) {
                    final s = _schedules[i] as Map<String, dynamic>;
                    return AnimatedBuilder(
                      animation: _listController,
                      builder: (context, child) {
                        final animation = CurvedAnimation(
                          parent: _listController,
                          curve: Interval((i / _schedules.length) * 0.5, 1.0, curve: Curves.easeOut),
                        );
                        return Opacity(
                          opacity: animation.value,
                          child: Transform.translate(
                            offset: Offset(0, 30 * (1 - animation.value)),
                            child: child,
                          ),
                        );
                      },
                      child: _buildScheduleCard(s),
                    );
                  },
                ),
                if (_busy) const Positioned.fill(child: ColoredBox(color: Colors.black12)),
              ],
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showEditor(),
        label: const Text('Add Task'),
        icon: const Icon(Icons.add_alarm),
        backgroundColor: const Color(0xFF2E7D32),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.calendar_today_outlined, size: 80, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          const Text('No operations scheduled', style: TextStyle(color: Colors.grey, fontSize: 16)),
        ],
      ),
    );
  }

  Widget _buildScheduleCard(Map<String, dynamic> s) {
    final when = s['time'] != null ? DateTime.parse(s['time']).toLocal() : null;
    final whenStr = when != null ? DateFormat('HH:mm · MMM d').format(when) : 'No time';
    final isActive = s['active'] == true;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: isActive ? Colors.green.withOpacity(0.2) : Colors.transparent, width: 2),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 10, offset: const Offset(0, 4)),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: (isActive ? Colors.green : Colors.grey).withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                s['target'] == 'pump' ? Icons.water_drop : s['target'] == 'fan' ? Icons.air : Icons.settings,
                color: isActive ? Colors.green : Colors.grey,
                size: 24,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${s['target']?.toUpperCase() ?? 'TASK'} → ${s['action'] ?? ''}',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: isActive ? Colors.black87 : Colors.grey),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(Icons.access_time, size: 12, color: Colors.grey.shade600),
                      const SizedBox(width: 4),
                      Text(whenStr, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                      if (s['repeat'] != null) ...[
                        const SizedBox(width: 10),
                        Icon(Icons.repeat, size: 12, color: Colors.grey.shade600),
                        const SizedBox(width: 4),
                        Text(s['repeat'], style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                      ]
                    ],
                  ),
                ],
              ),
            ),
            Switch.adaptive(
              value: isActive,
              activeColor: Colors.green,
              onChanged: (v) async {
                final auth = Provider.of<AuthService>(context, listen: false);
                final body = Map<String, dynamic>.from(s);
                body['active'] = v;
                try {
                  await Api.updateSchedule(auth.accessToken ?? '', s['_id'], body);
                  _load();
                } catch (_) {}
              },
            ),
            IconButton(
              icon: const Icon(Icons.more_vert, color: Colors.grey, size: 20),
              onPressed: () => _showScheduleOptions(s),
            ),
          ],
        ),
      ),
    );
  }

  void _showScheduleOptions(Map<String, dynamic> s) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(25))),
      builder: (ctx) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 10),
          Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 10),
          ListTile(leading: const Icon(Icons.edit), title: const Text('Edit Task'), onTap: () { Navigator.pop(ctx); _showEditor(existing: s); }),
          ListTile(leading: const Icon(Icons.delete, color: Colors.red), title: const Text('Delete Task', style: TextStyle(color: Colors.red)), onTap: () { Navigator.pop(ctx); _delete(s['_id']); }),
          const SizedBox(height: 20),
        ],
      ),
    );
  }
}

class ScheduleEditorDialog extends StatefulWidget {
  final Map<String, dynamic>? existing;
  const ScheduleEditorDialog({super.key, this.existing});

  @override
  State<ScheduleEditorDialog> createState() => _ScheduleEditorDialogState();
}

class _ScheduleEditorDialogState extends State<ScheduleEditorDialog> {
  final _formKey = GlobalKey<FormState>();
  String _name = '';
  String _deviceId = '';
  String _target = 'main';
  String _action = 'ON';
  DateTime? _time;
  String _repeat = 'daily';
  bool _active = true;
  List<Device> _devices = [];
  bool _loadingDevices = true;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    if (e != null) {
      _name = e['name'] ?? '';
      _deviceId = e['deviceId'] ?? '';
      _target = e['target'] ?? 'main';
      _action = e['action'] ?? 'ON';
      _repeat = e['repeat'] ?? 'daily';
      _active = e['active'] ?? true;
      if (e['time'] != null) _time = DateTime.parse(e['time']);
    }
    _loadDevices();
  }

  Future<void> _loadDevices() async {
    setState(() => _loadingDevices = true);
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final raw = await Api.getDevices(auth.accessToken ?? '');
      final list = raw
          .map((e) => Device.fromJson(e as Map<String, dynamic>))
          .toList();
      setState(() => _devices = List<Device>.from(list));
    } catch (e) {
      setState(() => _devices = []);
    } finally {
      setState(() => _loadingDevices = false);
    }
  }

  Future<void> _pickDateTime() async {
    final now = DateTime.now();
    final d = await showDatePicker(
      context: context,
      initialDate: _time ?? now,
      firstDate: now.subtract(const Duration(days: 365)),
      lastDate: now.add(const Duration(days: 365)),
    );
    if (d == null) return;
    final t = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_time ?? now),
    );
    if (t == null) return;
    setState(() => _time = DateTime(d.year, d.month, d.day, t.hour, t.minute));
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    _formKey.currentState!.save();
    final Map<String, dynamic> payload = {
      'name': _name,
      'deviceId': _deviceId,
      'target': _target,
      'action': _action,
      'repeat': _repeat,
      'active': _active,
    };
    if (_time != null) payload['time'] = _time!.toUtc().toIso8601String();
    Navigator.of(context).pop(payload);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(
        widget.existing == null ? 'Create schedule' : 'Edit schedule',
      ),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Device selector: show dropdown of devices assigned to account
              _loadingDevices
                  ? const Padding(
                      padding: EdgeInsets.symmetric(vertical: 12.0),
                      child: LinearProgressIndicator(),
                    )
                  : DropdownButtonFormField<String>(
                      value: _deviceId.isNotEmpty ? _deviceId : null,
                      items: _devices
                          .map(
                            (d) => DropdownMenuItem(
                              value: d.id,
                              child: Text(d.name.isNotEmpty ? d.name : d.id),
                            ),
                          )
                          .toList(),
                      onChanged: (v) => setState(() => _deviceId = v ?? ''),
                      onSaved: (v) => _deviceId = v ?? '',
                      validator: (v) =>
                          v == null || v.isEmpty ? 'Required' : null,
                      decoration: const InputDecoration(labelText: 'Device'),
                    ),
              if (!_loadingDevices && _devices.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 8.0),
                  child: Text(
                    'No devices assigned to your account',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              DropdownButtonFormField<String>(
                value: _target,
                items: const [
                  DropdownMenuItem(value: 'main', child: Text('Main')),
                  DropdownMenuItem(value: 'fan', child: Text('Fan')),
                  DropdownMenuItem(value: 'light', child: Text('Light')),
                  DropdownMenuItem(value: 'pump', child: Text('Pump')),
                ],
                onChanged: (v) => setState(() => _target = v ?? 'main'),
                decoration: const InputDecoration(labelText: 'Target'),
              ),
              DropdownButtonFormField<String>(
                value: _action,
                items: const [
                  DropdownMenuItem(value: 'ON', child: Text('ON')),
                  DropdownMenuItem(value: 'OFF', child: Text('OFF')),
                ],
                onChanged: (v) => setState(() => _action = v ?? 'ON'),
                decoration: const InputDecoration(labelText: 'Action'),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      _time != null
                          ? DateFormat.yMd().add_jm().format(_time!)
                          : 'No time selected',
                    ),
                  ),
                  TextButton(
                    onPressed: _pickDateTime,
                    child: const Text('Pick'),
                  ),
                ],
              ),
              SwitchListTile(
                title: const Text('Active'),
                value: _active,
                onChanged: (v) => setState(() => _active = v),
              ),
              ExpansionTile(
                title: const Text('Advanced'),
                children: [
                  TextFormField(
                    initialValue: _name,
                    decoration: const InputDecoration(labelText: 'Name'),
                    onSaved: (v) => _name = v ?? '',
                  ),
                  DropdownButtonFormField<String>(
                    value: _repeat,
                    items: const [
                      DropdownMenuItem(value: 'daily', child: Text('Daily')),
                      DropdownMenuItem(value: 'weekly', child: Text('Weekly')),
                    ],
                    onChanged: (v) => setState(() => _repeat = v ?? 'daily'),
                    decoration: const InputDecoration(labelText: 'Repeat'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed:
              (_loadingDevices ||
                  (!_loadingDevices &&
                      _devices.isEmpty &&
                      widget.existing == null))
              ? null
              : _submit,
          child: const Text('Save'),
        ),
      ],
    );
  }
}
