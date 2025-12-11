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

class _DevicesPageState extends State<DevicesPage> {
  List<Device> _devices = [];
  bool _loading = true;
  String? _error;
  final Map<String, bool> _fanState = {}; // local ON/OFF state per device (fan)
  final Map<String, bool> _lightState =
      {}; // local ON/OFF state per device (light)
  final Map<String, bool> _pumpState =
      {}; // local ON/OFF state per device (pump)
  // pending flags to disable buttons and show progress while sending commands
  final Map<String, bool> _pumpPending = {};
  final Map<String, bool> _fanPending = {};
  final Map<String, bool> _lightPending = {};
  Timer? _statePoller;
  final Map<String, StreamSubscription<Map<String, dynamic>>> _sseSubs = {};
  final Map<String, String> _status = {}; // deviceId -> online/offline
  final Map<String, bool> _controlsExpanded = {}; // deviceId -> expansion state

  @override
  void initState() {
    super.initState();
    _load();
    _statePoller = Timer.periodic(
      const Duration(seconds: 5),
      (_) => _refreshStatesForAll(),
    );
  }

  @override
  void dispose() {
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
      _devices = raw
          .map((e) => Device.fromJson(e as Map<String, dynamic>))
          .toList();
      await _refreshStatesForAll();
      _subscribeSseForAll();
    } catch (e) {
      _error = e.toString();
    } finally {
      setState(() {
        _loading = false;
      });
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
            // Handle status target/state OR telemetry relay* fields
            final target = evt['target'] as String?;
            final state = evt['state'];
            final relayFan = evt['relayFan'];
            final relayLight = evt['relayLight'];
            final relayPump = evt['relayPump'];
            final status = evt['status'];
            bool changed = false;
            if (target != null && state is bool) {
              switch (target) {
                case 'pump':
                  if ((_pumpState[d.id] ?? false) != state) {
                    _pumpState[d.id] = state;
                    changed = true;
                  }
                  break;
                case 'fan':
                  if ((_fanState[d.id] ?? false) != state) {
                    _fanState[d.id] = state;
                    changed = true;
                  }
                  break;
                case 'light':
                  if ((_lightState[d.id] ?? false) != state) {
                    _lightState[d.id] = state;
                    changed = true;
                  }
                  break;
              }
            }
            if (relayFan is String) {
              final v = relayFan.toUpperCase() == 'ON';
              if ((_fanState[d.id] ?? false) != v) {
                _fanState[d.id] = v;
                changed = true;
              }
            }
            if (relayLight is String) {
              final v = relayLight.toUpperCase() == 'ON';
              if ((_lightState[d.id] ?? false) != v) {
                _lightState[d.id] = v;
                changed = true;
              }
            }
            if (relayPump is String) {
              final v = relayPump.toUpperCase() == 'ON';
              if ((_pumpState[d.id] ?? false) != v) {
                _pumpState[d.id] = v;
                changed = true;
              }
            }
            if (status is String) {
              if ((_status[d.id] ?? '') != status) {
                _status[d.id] = status;
                changed = true;
              }
            }
            if (changed) setState(() {});
          },
          onError: (_) {},
          onDone: () {
            _sseSubs.remove(d.id);
          },
        );
        _sseSubs[d.id] = sub;
      } catch (_) {}
    }
    if (_sseSubs.isNotEmpty) {
      _statePoller
          ?.cancel(); // disable visible periodic refresh when SSE is active
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(child: Text('Error: $_error'))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView.separated(
                itemCount: _devices.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                padding: const EdgeInsets.all(12),
                itemBuilder: (ctx, i) {
                  final d = _devices[i];
                  return Card(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 1,
                    child: Padding(
                      padding: const EdgeInsets.all(12.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  d.name,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                              if (d.location != null && d.location!.isNotEmpty)
                                Text(
                                  d.location!,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: Colors.grey,
                                  ),
                                ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color:
                                      ((_status[d.id] ?? d.status) == 'online')
                                      ? const Color(0xFF2ECC71)
                                      : ((_status[d.id] ?? d.status) ==
                                            'offline')
                                      ? const Color(0xFFE74C3C)
                                      : Colors.grey.shade400,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  (_status[d.id] ?? d.status ?? 'unknown'),
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 11,
                                  ),
                                ),
                              ),
                              PopupMenuButton<String>(
                                onSelected: (key) async {
                                  if (key == 'edit') {
                                    final ok = await showDialog<bool>(
                                      context: context,
                                      builder: (_) =>
                                          EditDeviceDialog(device: d),
                                    );
                                    if (ok == true) {
                                      await _load();
                                      if (mounted)
                                        ScaffoldMessenger.of(
                                          context,
                                        ).showSnackBar(
                                          const SnackBar(
                                            content: Text('Device updated'),
                                          ),
                                        );
                                    }
                                  } else if (key == 'delete') {
                                    final confirm = await showDialog<bool>(
                                      context: context,
                                      builder: (_) => AlertDialog(
                                        title: const Text('Delete device'),
                                        content: Text(
                                          'Are you sure you want to delete "${d.name}"? This will remove related data.',
                                        ),
                                        actions: [
                                          TextButton(
                                            onPressed: () =>
                                                Navigator.pop(context, false),
                                            child: const Text('Cancel'),
                                          ),
                                          ElevatedButton(
                                            onPressed: () =>
                                                Navigator.pop(context, true),
                                            child: const Text('Delete'),
                                          ),
                                        ],
                                      ),
                                    );
                                    if (confirm == true) {
                                      final auth = Provider.of<AuthService>(
                                        context,
                                        listen: false,
                                      );
                                      try {
                                        await Api.deleteDevice(
                                          auth.accessToken ?? '',
                                          d.id,
                                        );
                                        await _load();
                                        if (mounted)
                                          ScaffoldMessenger.of(
                                            context,
                                          ).showSnackBar(
                                            const SnackBar(
                                              content: Text('Device deleted'),
                                            ),
                                          );
                                      } catch (e) {
                                        if (mounted)
                                          ScaffoldMessenger.of(
                                            context,
                                          ).showSnackBar(
                                            SnackBar(
                                              content: Text(
                                                'Delete failed: $e',
                                              ),
                                            ),
                                          );
                                      }
                                    }
                                  }
                                },
                                itemBuilder: (_) => const [
                                  PopupMenuItem(
                                    value: 'edit',
                                    child: Text('Edit'),
                                  ),
                                  PopupMenuItem(
                                    value: 'delete',
                                    child: Text('Delete'),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          // Controls grouped in a compact Card with expand/collapse
                          Card(
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                            elevation: 0,
                            child: ExpansionTile(
                              initiallyExpanded:
                                  _controlsExpanded[d.id] ?? false,
                              onExpansionChanged: (v) => setState(() {
                                _controlsExpanded[d.id] = v;
                              }),
                              title: const Text(
                                'Điều khiển',
                                style: TextStyle(fontWeight: FontWeight.w600),
                              ),
                              childrenPadding: const EdgeInsets.symmetric(
                                horizontal: 8.0,
                              ),
                              children: [
                                SwitchListTile(
                                  dense: true,
                                  contentPadding: EdgeInsets.zero,
                                  title: const Text('Bơm (Pump)'),
                                  secondary: (_pumpPending[d.id] ?? false)
                                      ? const SizedBox(
                                          width: 18,
                                          height: 18,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                          ),
                                        )
                                      : const Icon(Icons.water_drop),
                                  value: _pumpState[d.id] ?? false,
                                  onChanged: (_pumpPending[d.id] ?? false)
                                      ? null
                                      : (v) async {
                                          final wasOn =
                                              _pumpState[d.id] ?? false;
                                          final nextAction = v ? 'ON' : 'OFF';
                                          setState(() {
                                            _pumpPending[d.id] = true;
                                            _pumpState[d.id] = v;
                                          });
                                          try {
                                            await _sendCommand(
                                              d,
                                              'pump',
                                              nextAction,
                                            );
                                            await _refreshStates(d);
                                          } catch (e) {
                                            setState(() {
                                              _pumpState[d.id] = wasOn;
                                            });
                                          } finally {
                                            setState(() {
                                              _pumpPending[d.id] = false;
                                            });
                                          }
                                        },
                                ),
                                SwitchListTile(
                                  dense: true,
                                  contentPadding: EdgeInsets.zero,
                                  title: const Text('Quạt (Fan)'),
                                  secondary: (_fanPending[d.id] ?? false)
                                      ? const SizedBox(
                                          width: 18,
                                          height: 18,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                          ),
                                        )
                                      : const Icon(Icons.air),
                                  value: _fanState[d.id] ?? false,
                                  onChanged: (_fanPending[d.id] ?? false)
                                      ? null
                                      : (v) async {
                                          final wasOn =
                                              _fanState[d.id] ?? false;
                                          final nextAction = v ? 'ON' : 'OFF';
                                          setState(() {
                                            _fanPending[d.id] = true;
                                            _fanState[d.id] = v;
                                          });
                                          try {
                                            await _sendCommand(
                                              d,
                                              'fan',
                                              nextAction,
                                            );
                                            await _refreshStates(d);
                                          } catch (e) {
                                            setState(() {
                                              _fanState[d.id] = wasOn;
                                            });
                                          } finally {
                                            setState(() {
                                              _fanPending[d.id] = false;
                                            });
                                          }
                                        },
                                ),
                                SwitchListTile(
                                  dense: true,
                                  contentPadding: EdgeInsets.zero,
                                  title: const Text('Đèn (Light)'),
                                  secondary: (_lightPending[d.id] ?? false)
                                      ? const SizedBox(
                                          width: 18,
                                          height: 18,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                          ),
                                        )
                                      : const Icon(Icons.lightbulb),
                                  value: _lightState[d.id] ?? false,
                                  onChanged: (_lightPending[d.id] ?? false)
                                      ? null
                                      : (v) async {
                                          final wasOn =
                                              _lightState[d.id] ?? false;
                                          final nextAction = v ? 'ON' : 'OFF';
                                          setState(() {
                                            _lightPending[d.id] = true;
                                            _lightState[d.id] = v;
                                          });
                                          try {
                                            await _sendCommand(
                                              d,
                                              'light',
                                              nextAction,
                                            );
                                            await _refreshStates(d);
                                          } catch (e) {
                                            setState(() {
                                              _lightState[d.id] = wasOn;
                                            });
                                          } finally {
                                            setState(() {
                                              _lightPending[d.id] = false;
                                            });
                                          }
                                        },
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 8),
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton(
                              onPressed: () => Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => DeviceDetailPage(device: d),
                                ),
                              ),
                              child: const Text('Details'),
                            ),
                          ),
                          const SizedBox(height: 8),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          final created = await showDialog<bool>(
            context: context,
            builder: (_) => const CreateDeviceDialog(),
          );
          if (created == true) {
            await _load();
            ScaffoldMessenger.of(
              context,
            ).showSnackBar(const SnackBar(content: Text('Device created')));
          }
        },
        child: const Icon(Icons.add),
      ),
    );
  }

  Future<void> _sendCommand(Device device, String target, String action) async {
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      await Api.createCommand(auth.accessToken ?? '', {
        'deviceId': device.id,
        'target': target,
        'action': action,
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Sent $action to $target on ${device.name}')),
      );
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Command failed: $e')));
    }
  }

  Future<void> _refreshStatesForAll() async {
    for (final d in _devices) {
      await _refreshStates(d);
    }
  }

  Future<void> _refreshStates(Device device) async {
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final cmds = await Api.listCommands(
        auth.accessToken ?? '',
        deviceId: device.id,
      );
      // Determine latest ON/OFF for each target
      bool? pump;
      bool? fan;
      bool? light;
      for (final c in cmds) {
        if (c is Map<String, dynamic>) {
          final target = c['target'] as String?;
          final action = c['action'] as String?;
          if (target == null || action == null) continue;
          final isOn = action.toUpperCase() == 'ON';
          switch (target) {
            case 'pump':
              pump = isOn;
              break;
            case 'fan':
              fan = isOn;
              break;
            case 'light':
              light = isOn;
              break;
          }
        }
      }
      bool changed = false;
      if (pump != null && (_pumpState[device.id] ?? false) != pump) {
        _pumpState[device.id] = pump;
        changed = true;
      }
      if (fan != null && (_fanState[device.id] ?? false) != fan) {
        _fanState[device.id] = fan;
        changed = true;
      }
      if (light != null && (_lightState[device.id] ?? false) != light) {
        _lightState[device.id] = light;
        changed = true;
      }
      if (changed) setState(() {});
    } catch (_) {
      // ignore
    }
  }
}
