import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:intl/intl.dart';
import '../services/auth_service.dart';
import '../services/api.dart';
import '../models/device.dart';

class DevicesPage extends StatefulWidget {
  const DevicesPage({super.key});

  @override
  State<DevicesPage> createState() => _DevicesPageState();
}

class _DevicesPageState extends State<DevicesPage> {
  List<Device> _devices = [];
  String? _selectedDeviceId;
  bool _loading = true;
  String? _error;
  String _opMode = 'auto'; // 'manual' | 'auto' | 'scheduled'
  bool _modeChanging = false;

  // Manual relay states (cached locally)
  final Map<String, bool> _pumpState = {};
  final Map<String, bool> _fanState = {};
  final Map<String, bool> _lightState = {};

  List<dynamic> _schedules = [];
  bool _loadingSchedules = false;
  final Map<String, StreamSubscription> _sseSubs = {};

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  @override
  void dispose() {
    for (final s in _sseSubs.values) {
      try {
        s.cancel();
      } catch (_) {}
    }
    super.dispose();
  }

  Future<void> _loadAll() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final raw = await Api.getDevices(auth.accessToken ?? '');
      _devices = raw.map((e) => Device.fromJson(e as Map<String, dynamic>)).toList();

      if (_devices.isNotEmpty) {
        final prefs = await SharedPreferences.getInstance();
        _selectedDeviceId = prefs.getString('active_device_id') ?? _devices.first.id;
        if (!_devices.any((d) => d.id == _selectedDeviceId)) {
          _selectedDeviceId = _devices.first.id;
        }
        final activeDevice = _devices.firstWhere((d) => d.id == _selectedDeviceId, orElse: () => _devices.first);

        // Load mode from device settings & local preference
        if (activeDevice.opMode != null) {
          _opMode = activeDevice.opMode!;
        } else if (activeDevice.autoFanEnabled || activeDevice.autoPumpEnabled || activeDevice.autoLightEnabled) {
          _opMode = 'auto';
        } else {
          _opMode = prefs.getString('device_mode_${activeDevice.id}') ?? 'manual';
        }

        _pumpState[activeDevice.id] = activeDevice.lastPumpState?.toUpperCase() == 'ON';
        _fanState[activeDevice.id] = activeDevice.lastFanState?.toUpperCase() == 'ON';
        _lightState[activeDevice.id] = activeDevice.lastLightState?.toUpperCase() == 'ON';

        await _loadSchedules(activeDevice.id);
        _subscribeSse(activeDevice);
      }
    } catch (e) {
      _error = e.toString();
      if (_error!.contains('Unauthorized') || _error!.contains('401')) {
        Provider.of<AuthService>(context, listen: false).logout();
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _subscribeSse(Device device) {
    final auth = Provider.of<AuthService>(context, listen: false);
    final externalId = device.externalId ?? device.id;
    if (_sseSubs.containsKey(externalId)) return;
    try {
      final stream = Api.subscribeDeviceStream(auth.accessToken, externalId);
      final sub = stream.listen((evt) {
        final relayFan = evt['relayFan'];
        final relayLight = evt['relayLight'];
        final relayPump = evt['relayPump'];
        final opModeVal = evt['opMode'];
        bool changed = false;

        if (relayFan is String) {
          bool v = relayFan.toUpperCase() == 'ON';
          if (_fanState[device.id] != v) {
            _fanState[device.id] = v;
            changed = true;
          }
        }
        if (relayLight is String) {
          bool v = relayLight.toUpperCase() == 'ON';
          if (_lightState[device.id] != v) {
            _lightState[device.id] = v;
            changed = true;
          }
        }
        if (relayPump is String) {
          bool v = relayPump.toUpperCase() == 'ON';
          if (_pumpState[device.id] != v) {
            _pumpState[device.id] = v;
            changed = true;
          }
        }
        if (opModeVal is String) {
          if (_opMode != opModeVal) {
            _opMode = opModeVal;
            changed = true;
          }
        }
        if (changed) setState(() {});
      });
      _sseSubs[externalId] = sub;
    } catch (_) {}
  }

  Future<void> _loadSchedules(String deviceId) async {
    setState(() => _loadingSchedules = true);
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final list = await Api.getSchedules(auth.accessToken ?? '', deviceId: deviceId);
      setState(() => _schedules = list);
    } catch (_) {
      setState(() => _schedules = []);
    } finally {
      setState(() => _loadingSchedules = false);
    }
  }

  Device get _activeDevice => _devices.firstWhere(
        (d) => d.id == _selectedDeviceId,
        orElse: () => _devices.first,
      );

  Future<void> _changeMode(String mode) async {
    if (_devices.isEmpty || _modeChanging) return;
    final activeDevice = _activeDevice;

    // Save client preference
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('device_mode_${activeDevice.id}', mode);

    setState(() {
      _opMode = mode;
      _modeChanging = true;
    });

    try {
      final isAuto = mode == 'auto';
      final payload = {
        'opMode': mode,
        'autoFanEnabled': isAuto,
        'autoPumpEnabled': isAuto,
        'autoLightEnabled': isAuto,
      };
      final auth = Provider.of<AuthService>(context, listen: false);
      final updatedRaw = await Api.updateDevice(auth.accessToken ?? '', activeDevice.id, payload);
      final updatedDev = Device.fromJson(updatedRaw);

      // Update in our list
      setState(() {
        final idx = _devices.indexWhere((d) => d.id == activeDevice.id);
        if (idx >= 0) _devices[idx] = updatedDev;
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Không thể đổi chế độ: $e')),
      );
    } finally {
      if (mounted) setState(() => _modeChanging = false);
    }
  }

  Future<void> _toggleState(Device d, String target, bool nextState) async {
    final nextAction = nextState ? 'ON' : 'OFF';
    try {
      final auth = Provider.of<AuthService>(context, listen: false);
      await Api.createCommand(auth.accessToken ?? '', {
        'deviceId': d.id,
        'target': target,
        'action': nextAction,
      });
      setState(() {
        if (target == 'pump') _pumpState[d.id] = nextState;
        if (target == 'fan') _fanState[d.id] = nextState;
        if (target == 'light') _lightState[d.id] = nextState;
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Không thể điều khiển thiết bị: $e')),
      );
    }
  }

  Future<void> _showScheduleEditor({Map<String, dynamic>? existing}) async {
    if (_devices.isEmpty) return;
    final activeDevice = _activeDevice;
    final auth = Provider.of<AuthService>(context, listen: false);

    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => ScheduleEditorDialog(
        existing: existing,
        defaultDeviceId: activeDevice.id,
        devices: _devices,
      ),
    );

    if (result != null) {
      try {
        if (existing == null) {
          await Api.createSchedule(auth.accessToken ?? '', result);
        } else {
          await Api.updateSchedule(auth.accessToken ?? '', existing['_id'], result);
        }
        await _loadSchedules(activeDevice.id);
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Lỗi: $e')));
      }
    }
  }

  Future<void> _deleteSchedule(String id) async {
    final activeDevice = _activeDevice;
    final auth = Provider.of<AuthService>(context, listen: false);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF161B26),
        title: const Text('Xóa lịch trình?'),
        content: const Text('Bạn có chắc chắn muốn xóa lịch trình này?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Hủy', style: TextStyle(color: Colors.white60)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );

    if (ok == true) {
      try {
        await Api.deleteSchedule(auth.accessToken ?? '', id);
        await _loadSchedules(activeDevice.id);
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Xóa thất bại: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0C0F17),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text('Lỗi: $_error', style: const TextStyle(color: Colors.red)))
              : _devices.isEmpty
                  ? const Center(child: Text('Không tìm thấy thiết bị nào'))
                  : RefreshIndicator(
                      onRefresh: _loadAll,
                      color: const Color(0xFF10B981),
                      backgroundColor: const Color(0xFF161B26),
                      child: _buildContent(),
                    ),
    );
  }

  Widget _buildContent() {
    final activeDevice = _devices.firstWhere((d) => d.id == _selectedDeviceId, orElse: () => _devices.first);

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
      padding: const EdgeInsets.fromLTRB(20, 50, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _selectedDeviceId,
              dropdownColor: const Color(0xFF161B26),
              icon: const Icon(Icons.arrow_drop_down, color: Color(0xFF10B981), size: 16),
              style: const TextStyle(
                color: Color(0xFF10B981),
                fontSize: 11,
                fontWeight: FontWeight.bold,
                letterSpacing: 1.2,
              ),
              items: _devices.map((d) {
                return DropdownMenuItem<String>(
                  value: d.id,
                  child: Text(d.name.toUpperCase()),
                );
              }).toList(),
              onChanged: (val) async {
                if (val != null) {
                  final prefs = await SharedPreferences.getInstance();
                  await prefs.setString('active_device_id', val);
                  setState(() {
                    _selectedDeviceId = val;
                  });
                  _loadAll();
                }
              },
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Vận hành máy',
            style: TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 24),

          // Three-segment Button Selector
          Container(
            height: 50,
            decoration: BoxDecoration(
              color: const Color(0xFF10141D),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                _buildModeTab('manual', 'MỞ TAY'),
                _buildModeTab('auto', 'TỰ ĐỘNG'),
                _buildModeTab('scheduled', 'HẸN GIỜ'),
              ],
            ),
          ),
          const SizedBox(height: 32),

          // Actuators list header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'BỘ KÍCH HOẠT CHẤP HÀNH',
                style: TextStyle(
                  color: Color(0xFF9EADBC),
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.1,
                ),
              ),
              if (_opMode == 'manual')
                const Text(
                  'Chạm để điều khiển',
                  style: TextStyle(
                    color: Color(0xFF10B981),
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                )
              else
                const Text(
                  'Bật Thủ Công để chạm',
                  style: TextStyle(
                    color: Color(0xFFF59E0B),
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),

          // Actuator rows
          _buildActuatorRow(
            activeDevice,
            'pump',
            'Vòi tưới',
            _pumpState[activeDevice.id] ?? false,
            Icons.power_settings_new,
          ),
          _buildActuatorRow(
            activeDevice,
            'light',
            'Đèn chiếu',
            _lightState[activeDevice.id] ?? false,
            Icons.wb_sunny_outlined,
          ),
          _buildActuatorRow(
            activeDevice,
            'fan',
            'Quạt hút',
            _fanState[activeDevice.id] ?? false,
            Icons.analytics_outlined,
          ),
          const SizedBox(height: 32),

          // Schedules section
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'MA TRẬN HẸN GIỜ',
                style: TextStyle(
                  color: Color(0xFF9EADBC),
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.1,
                ),
              ),
              TextButton.icon(
                onPressed: () => _showScheduleEditor(),
                icon: const Icon(Icons.add, size: 16, color: Color(0xFF10B981)),
                label: const Text(
                  'Thêm',
                  style: TextStyle(
                    color: Color(0xFF10B981),
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          _loadingSchedules
              ? const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()))
              : _schedules.isEmpty
                  ? _buildEmptySchedules()
                  : ListView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: _schedules.length,
                      itemBuilder: (ctx, i) {
                        final s = _schedules[i] as Map<String, dynamic>;
                        return _buildScheduleItem(s);
                      },
                    ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildModeTab(String mode, String label) {
    final isSelected = _opMode == mode;
    return Expanded(
      child: GestureDetector(
        onTap: () => _changeMode(mode),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          alignment: Alignment.center,
          margin: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF10B981) : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: isSelected ? Colors.white : const Color(0xFF9EADBC),
              fontWeight: FontWeight.bold,
              fontSize: 12,
              letterSpacing: 0.8,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildActuatorRow(Device d, String target, String label, bool isOn, IconData icon) {
    final isDisabled = _opMode != 'manual';

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF161B26),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF222938), width: 0.8),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFF0C0F17),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: Colors.white, size: 20),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                if (isDisabled)
                  Row(
                    children: const [
                      Icon(Icons.wifi_tethering, color: Color(0xFF3B82F6), size: 12),
                      SizedBox(width: 4),
                      Text(
                        'CHỜ LỆNH LÂN CẬN',
                        style: TextStyle(
                          color: Color(0xFF3B82F6),
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  )
                else
                  Text(
                    isOn ? 'BẬT THỦ CÔNG' : 'TẮT THỦ CÔNG',
                    style: TextStyle(
                      color: isOn ? const Color(0xFF10B981) : Colors.white38,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
              ],
            ),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: isDisabled
                  ? const Color(0xFF1E2533)
                  : (isOn ? const Color(0xFF10B981) : const Color(0xFF374151)),
              foregroundColor: isDisabled ? Colors.white30 : Colors.white,
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            onPressed: isDisabled ? null : () => _toggleState(d, target, !isOn),
            child: Text(
              isOn ? 'TẮT' : 'BẬT',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptySchedules() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 32),
      decoration: BoxDecoration(
        color: const Color(0xFF161B26),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF222938), width: 0.8),
      ),
      child: Column(
        children: const [
          Icon(Icons.calendar_today, size: 40, color: Colors.white24),
          SizedBox(height: 12),
          Text(
            'Chưa có lịch trình hoạt động nào',
            style: TextStyle(color: Colors.white54, fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _buildScheduleItem(Map<String, dynamic> s) {
    final when = s['time'] != null ? DateTime.parse(s['time']).toLocal() : null;
    final whenStr = when != null ? DateFormat('HH:mm').format(when) : '--:--';
    final isActive = s['active'] == true;

    // Map targets to display labels
    String targetLabel = 'TÁC VỤ';
    if (s['target'] == 'pump') targetLabel = 'MÁY BƠM NƯỚC';
    if (s['target'] == 'light') targetLabel = 'ĐÈN CHIẾU KÍCH TRƯỞNG';
    if (s['target'] == 'fan') targetLabel = 'QUẠT THÔNG GIÓ';

    String repeatLabel = '';
    if (s['repeat'] == 'daily') repeatLabel = '• HÀNG NGÀY';
    if (s['repeat'] == 'weekly') repeatLabel = '• HÀNG TUẦN';

    // Show name as duration badge (e.g. "12 tiếng", "15 phút")
    String durationLabel = s['name'] != null && s['name'].toString().isNotEmpty ? s['name'] : '12 tiếng';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF161B26),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isActive ? const Color(0xFF10B981).withOpacity(0.3) : const Color(0xFF222938),
          width: 0.8,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  whenStr,
                  style: TextStyle(
                    color: isActive ? const Color(0xFF10B981) : Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '$targetLabel $repeatLabel',
                  style: const TextStyle(
                    color: Color(0xFF9EADBC),
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFF0C0F17),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              durationLabel,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 11,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Switch.adaptive(
            value: isActive,
            activeColor: const Color(0xFF10B981),
            onChanged: (val) async {
              final auth = Provider.of<AuthService>(context, listen: false);
              final body = Map<String, dynamic>.from(s);
              body['active'] = val;
              try {
                await Api.updateSchedule(auth.accessToken ?? '', s['_id'], body);
                if (_devices.isNotEmpty) {
                  _loadSchedules(_activeDevice.id);
                }
              } catch (_) {}
            },
          ),
          IconButton(
            icon: const Icon(Icons.more_vert, color: Colors.white30, size: 20),
            onPressed: () => _showScheduleOptions(s),
          ),
        ],
      ),
    );
  }

  void _showScheduleOptions(Map<String, dynamic> s) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF10141D),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 10),
          Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 10),
          ListTile(
            leading: const Icon(Icons.edit, color: Colors.white),
            title: const Text('Chỉnh sửa lịch hẹn', style: TextStyle(color: Colors.white)),
            onTap: () {
              Navigator.pop(ctx);
              _showScheduleEditor(existing: s);
            },
          ),
          ListTile(
            leading: const Icon(Icons.delete, color: Colors.redAccent),
            title: const Text('Xóa lịch hẹn', style: TextStyle(color: Colors.redAccent)),
            onTap: () {
              Navigator.pop(ctx);
              _deleteSchedule(s['_id']);
            },
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }
}

class ScheduleEditorDialog extends StatefulWidget {
  final Map<String, dynamic>? existing;
  final String defaultDeviceId;
  final List<Device> devices;
  const ScheduleEditorDialog({
    super.key,
    this.existing,
    required this.defaultDeviceId,
    required this.devices,
  });

  @override
  State<ScheduleEditorDialog> createState() => _ScheduleEditorDialogState();
}

class _ScheduleEditorDialogState extends State<ScheduleEditorDialog> {
  final _formKey = GlobalKey<FormState>();
  String _name = '12 tiếng';
  String _deviceId = '';
  String _target = 'pump';
  String _action = 'ON';
  DateTime? _time;
  String _repeat = 'daily';
  bool _active = true;

  @override
  void initState() {
    super.initState();
    _deviceId = widget.defaultDeviceId;
    final e = widget.existing;
    if (e != null) {
      _name = e['name'] ?? '12 tiếng';
      _deviceId = e['deviceId'] ?? widget.defaultDeviceId;
      _target = e['target'] ?? 'pump';
      _action = e['action'] ?? 'ON';
      _repeat = e['repeat'] ?? 'daily';
      _active = e['active'] ?? true;
      if (e['time'] != null) _time = DateTime.parse(e['time']).toLocal();
    } else {
      _time = DateTime.now();
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
      backgroundColor: const Color(0xFF161B26),
      title: Text(
        widget.existing == null ? 'Tạo lịch hẹn' : 'Sửa lịch hẹn',
        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
      ),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                initialValue: _name,
                decoration: const InputDecoration(
                  labelText: 'Thời lượng (ví dụ: 12 tiếng, 15 phút)',
                  labelStyle: TextStyle(color: Colors.white54),
                ),
                style: const TextStyle(color: Colors.white),
                onSaved: (v) => _name = v ?? '12 tiếng',
              ),
              DropdownButtonFormField<String>(
                dropdownColor: const Color(0xFF161B26),
                value: _target,
                items: const [
                  DropdownMenuItem(value: 'pump', child: Text('Vòi tưới (Bơm)', style: TextStyle(color: Colors.white))),
                  DropdownMenuItem(value: 'light', child: Text('Đèn chiếu', style: TextStyle(color: Colors.white))),
                  DropdownMenuItem(value: 'fan', child: Text('Quạt hút', style: TextStyle(color: Colors.white))),
                ],
                onChanged: (v) => setState(() => _target = v ?? 'pump'),
                decoration: const InputDecoration(labelText: 'Thiết bị chọn', labelStyle: TextStyle(color: Colors.white54)),
              ),
              DropdownButtonFormField<String>(
                dropdownColor: const Color(0xFF161B26),
                value: _action,
                items: const [
                  DropdownMenuItem(value: 'ON', child: Text('BẬT', style: TextStyle(color: Colors.white))),
                  DropdownMenuItem(value: 'OFF', child: Text('TẮT', style: TextStyle(color: Colors.white))),
                ],
                onChanged: (v) => setState(() => _action = v ?? 'ON'),
                decoration: const InputDecoration(labelText: 'Tác vụ', labelStyle: TextStyle(color: Colors.white54)),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      _time != null ? DateFormat('HH:mm').format(_time!) : 'Chưa chọn giờ',
                      style: const TextStyle(color: Colors.white, fontSize: 16),
                    ),
                  ),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      foregroundColor: Colors.white,
                    ),
                    onPressed: _pickDateTime,
                    child: const Text('Chọn giờ'),
                  ),
                ],
              ),
              SwitchListTile(
                title: const Text('Kích hoạt', style: TextStyle(color: Colors.white)),
                value: _active,
                activeColor: const Color(0xFF10B981),
                onChanged: (v) => setState(() => _active = v),
              ),
              DropdownButtonFormField<String>(
                dropdownColor: const Color(0xFF161B26),
                value: _repeat,
                items: const [
                  DropdownMenuItem(value: 'daily', child: Text('Hàng ngày', style: TextStyle(color: Colors.white))),
                  DropdownMenuItem(value: 'weekly', child: Text('Hàng tuần', style: TextStyle(color: Colors.white))),
                ],
                onChanged: (v) => setState(() => _repeat = v ?? 'daily'),
                decoration: const InputDecoration(labelText: 'Lặp lại', labelStyle: TextStyle(color: Colors.white54)),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Hủy', style: TextStyle(color: Colors.white54)),
        ),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF10B981),
            foregroundColor: Colors.white,
          ),
          onPressed: _submit,
          child: const Text('Lưu'),
        ),
      ],
    );
  }
}
