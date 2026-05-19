import 'package:flutter/material.dart';
import 'dart:async';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/api.dart';
import '../models/device.dart';
import 'device_detail_page.dart';
import 'create_device_dialog.dart';
import 'edit_device_dialog.dart';

class DevicesPage extends StatefulWidget {
  const DevicesPage({super.key});

  @override
  State<DevicesPage> createState() => _DevicesPageState();
}

class _DevicesPageState extends State<DevicesPage> with SingleTickerProviderStateMixin {
  List<Device> _devices = [];
  bool _loading = true;
  String? _error;
  final Map<String, bool> _fanState = {};
  final Map<String, bool> _lightState = {};
  final Map<String, bool> _pumpState = {};
  final Map<String, bool> _pumpPending = {};
  final Map<String, bool> _fanPending = {};
  final Map<String, bool> _lightPending = {};
  Timer? _statePoller;
  final Map<String, StreamSubscription<Map<String, dynamic>>> _sseSubs = {};
  final Map<String, String> _status = {};

  late AnimationController _listController;

  @override
  void initState() {
    super.initState();
    _listController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _load();
    _statePoller = Timer.periodic(const Duration(seconds: 5), (_) => _refreshStatesForAll());
  }

  @override
  void dispose() {
    _listController.dispose();
    _statePoller?.cancel();
    for (final s in _sseSubs.values) {
      try {
        s.cancel();
      } catch (_) {}
    }
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final raw = await Api.getDevices(auth.accessToken ?? '');
      _devices = raw.map((e) => Device.fromJson(e as Map<String, dynamic>)).toList();
      await _refreshStatesForAll();
      _subscribeSseForAll();
      _listController.forward(from: 0);
    } catch (e) {
      _error = e.toString();
    } finally {
      setState(() => _loading = false);
    }
  }

  void _subscribeSseForAll() {
    final auth = Provider.of<AuthService>(context, listen: false);
    for (final d in _devices) {
      if (_sseSubs.containsKey(d.id)) continue;
      try {
        final ext = d.externalId ?? d.id;
        final stream = Api.subscribeDeviceStream(auth.accessToken, ext);
        final sub = stream.listen(
          (evt) {
            final target = evt['target'] as String?;
            final state = evt['state'];
            final relayFan = evt['relayFan'];
            final relayLight = evt['relayLight'];
            final relayPump = evt['relayPump'];
            final status = evt['status'];
            bool changed = false;
            if (target != null && state is bool) {
              if (target == 'pump' && (_pumpState[d.id] ?? false) != state) { _pumpState[d.id] = state; changed = true; }
              if (target == 'fan' && (_fanState[d.id] ?? false) != state) { _fanState[d.id] = state; changed = true; }
              if (target == 'light' && (_lightState[d.id] ?? false) != state) { _lightState[d.id] = state; changed = true; }
            }
            if (relayFan is String) { bool v = relayFan.toUpperCase() == 'ON'; if ((_fanState[d.id] ?? false) != v) { _fanState[d.id] = v; changed = true; } }
            if (relayLight is String) { bool v = relayLight.toUpperCase() == 'ON'; if ((_lightState[d.id] ?? false) != v) { _lightState[d.id] = v; changed = true; } }
            if (relayPump is String) { bool v = relayPump.toUpperCase() == 'ON'; if ((_pumpState[d.id] ?? false) != v) { _pumpState[d.id] = v; changed = true; } }
            if (status is String && (_status[d.id] ?? '') != status) { _status[d.id] = status; changed = true; }
            if (changed) setState(() {});
          },
          onDone: () => _sseSubs.remove(d.id),
        );
        _sseSubs[d.id] = sub;
      } catch (_) {}
    }
    if (_sseSubs.isNotEmpty) _statePoller?.cancel();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: const Color(0xFFF4F7F2),
      appBar: AppBar(
        title: const Text('Device Control', style: TextStyle(fontWeight: FontWeight.bold)),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.black87,
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(child: Text('Error: $_error'))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView.builder(
                itemCount: _devices.length,
                padding: const EdgeInsets.fromLTRB(20, 10, 20, 100),
                itemBuilder: (ctx, i) {
                  final d = _devices[i];
                  return AnimatedBuilder(
                    animation: _listController,
                    builder: (context, child) {
                      final animation = CurvedAnimation(
                        parent: _listController,
                        curve: Interval((i / _devices.length) * 0.5, 1.0, curve: Curves.easeOut),
                      );
                      return Opacity(
                        opacity: animation.value,
                        child: Transform.translate(
                          offset: Offset(0, 50 * (1 - animation.value)),
                          child: child,
                        ),
                      );
                    },
                    child: _buildDeviceRemote(d),
                  );
                },
              ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final created = await showDialog<bool>(context: context, builder: (_) => const CreateDeviceDialog());
          if (created == true) _load();
        },
        label: const Text('Add Device'),
        icon: const Icon(Icons.add),
        backgroundColor: const Color(0xFF2E7D32),
      ),
    );
  }

  Widget _buildDeviceRemote(Device d) {
    final status = _status[d.id] ?? d.status;
    final isOnline = status == 'online';

    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 15, offset: const Offset(0, 5)),
        ],
      ),
      child: Column(
        children: [
          // Header with Device Info
          Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                CircleAvatar(
                  backgroundColor: (isOnline ? Colors.green : Colors.grey).withOpacity(0.1),
                  child: Icon(Icons.developer_board, color: isOnline ? Colors.green : Colors.grey),
                ),
                const SizedBox(width: 15),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(d.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      Text(d.location ?? 'Unknown Location', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                    ],
                  ),
                ),
                _buildStatusChip(status),
                _buildDeviceMenu(d),
              ],
            ),
          ),

          // Control Grid (Remote Style)
          Container(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            child: GridView.count(
              shrinkWrap: true,
              crossAxisCount: 3,
              mainAxisSpacing: 15,
              crossAxisSpacing: 15,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                _controlButton(d, 'pump', Icons.water_drop, 'Pump', _pumpState[d.id] ?? false, _pumpPending[d.id] ?? false),
                _controlButton(d, 'fan', Icons.air, 'Fan', _fanState[d.id] ?? false, _fanPending[d.id] ?? false),
                _controlButton(d, 'light', Icons.lightbulb, 'Light', _lightState[d.id] ?? false, _lightPending[d.id] ?? false),
              ],
            ),
          ),

          // Footer Details Link
          InkWell(
            onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => DeviceDetailPage(device: d))),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAF7),
                borderRadius: const BorderRadius.only(bottomLeft: Radius.circular(24), bottomRight: Radius.circular(24)),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('VIEW TELEMETRY DATA', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.green, letterSpacing: 1.2)),
                  SizedBox(width: 5),
                  Icon(Icons.arrow_forward_ios, size: 10, color: Colors.green),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusChip(String? status) {
    final isOnline = status == 'online';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: isOnline ? Colors.green.shade50 : Colors.red.shade50,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        status?.toUpperCase() ?? 'OFFLINE',
        style: TextStyle(color: isOnline ? Colors.green : Colors.red, fontSize: 9, fontWeight: FontWeight.bold),
      ),
    );
  }

  Widget _buildDeviceMenu(Device d) {
    return PopupMenuButton<String>(
      icon: const Icon(Icons.more_vert, color: Colors.grey),
      onSelected: (key) async {
        if (key == 'edit') {
          final ok = await showDialog<bool>(context: context, builder: (_) => EditDeviceDialog(device: d));
          if (ok == true) _load();
        } else if (key == 'delete') {
          _confirmDelete(d);
        }
      },
      itemBuilder: (_) => [
        const PopupMenuItem(value: 'edit', child: Text('Edit')),
        const PopupMenuItem(value: 'delete', child: Text('Delete')),
      ],
    );
  }

  void _confirmDelete(Device d) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete device'),
        content: Text('Are you sure you want to delete "${d.name}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete')),
        ],
      ),
    );
    if (confirm == true) {
      final auth = Provider.of<AuthService>(context, listen: false);
      try {
        await Api.deleteDevice(auth.accessToken ?? '', d.id);
        _load();
      } catch (_) {}
    }
  }

  Widget _controlButton(Device d, String target, IconData icon, String label, bool isOn, bool isPending) {
    return InkWell(
      onTap: isPending ? null : () => _toggleState(d, target, !isOn),
      borderRadius: BorderRadius.circular(20),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        decoration: BoxDecoration(
          color: isOn ? const Color(0xFF2E7D32) : const Color(0xFFF1F1F1),
          borderRadius: BorderRadius.circular(20),
          boxShadow: isOn ? [BoxShadow(color: Colors.green.withOpacity(0.3), blurRadius: 10, offset: const Offset(0, 4))] : [],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (isPending)
              const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            else
              Icon(icon, color: isOn ? Colors.white : Colors.black54, size: 28),
            const SizedBox(height: 8),
            Text(label, style: TextStyle(color: isOn ? Colors.white : Colors.black54, fontSize: 11, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text(isOn ? 'ON' : 'OFF', style: TextStyle(color: isOn ? Colors.white.withOpacity(0.7) : Colors.black38, fontSize: 9)),
          ],
        ),
      ),
    );
  }

  Future<void> _toggleState(Device d, String target, bool nextState) async {
    final nextAction = nextState ? 'ON' : 'OFF';
    setState(() {
      if (target == 'pump') _pumpPending[d.id] = true;
      if (target == 'fan') _fanPending[d.id] = true;
      if (target == 'light') _lightPending[d.id] = true;
    });
    try {
      await Api.createCommand(Provider.of<AuthService>(context, listen: false).accessToken ?? '', {
        'deviceId': d.id,
        'target': target,
        'action': nextAction,
      });
      await _refreshStates(d);
    } catch (_) {}
    finally {
      if (mounted) {
        setState(() {
          if (target == 'pump') _pumpPending[d.id] = false;
          if (target == 'fan') _fanPending[d.id] = false;
          if (target == 'light') _lightPending[d.id] = false;
        });
      }
    }
  }

  Future<void> _refreshStatesForAll() async { for (final d in _devices) { await _refreshStates(d); } }

  Future<void> _refreshStates(Device device) async {
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final cmds = await Api.listCommands(auth.accessToken ?? '', deviceId: device.id);
      bool? pump, fan, light;
      for (final c in cmds) {
        if (c is Map<String, dynamic>) {
          final target = c['target'] as String?;
          final action = c['action'] as String?;
          final isOn = action?.toUpperCase() == 'ON';
          if (target == 'pump') pump = isOn;
          if (target == 'fan') fan = isOn;
          if (target == 'light') light = isOn;
        }
      }
      if (mounted) setState(() {
        if (pump != null) _pumpState[device.id] = pump;
        if (fan != null) _fanState[device.id] = fan;
        if (light != null) _lightState[device.id] = light;
      });
    } catch (_) {}
  }
}

