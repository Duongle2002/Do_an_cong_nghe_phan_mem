import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
// chart package removed for compatibility; showing simple list instead
import '../models/device.dart';
import '../models/sensor_data.dart';
import '../services/api.dart';
import '../services/auth_service.dart';
import 'alert_settings_page.dart';
import 'alerts_list_page.dart';

class DeviceDetailPage extends StatefulWidget {
  final Device device;
  const DeviceDetailPage({super.key, required this.device});

  @override
  State<DeviceDetailPage> createState() => _DeviceDetailPageState();
}

class _DeviceDetailPageState extends State<DeviceDetailPage> {
  List<SensorData> _data = [];
  bool _loading = true;
  // Automation form state
  bool _autoFan = false;
  bool _autoPump = false;
  bool _autoLight = false;
  final _fanThrCtrl = TextEditingController(); // autoFanTempAbove
  final _pumpThrCtrl = TextEditingController(); // autoPumpSoilBelow
  final _lightThrCtrl = TextEditingController(); // autoLightLuxBelow
  final _fanHysCtrl = TextEditingController();
  final _pumpHysCtrl = TextEditingController();
  final _lightHysCtrl = TextEditingController();
  final _minGapCtrl = TextEditingController(); // minToggleIntervalSec
  // Control state + pending
  bool _pumpOn = false;
  bool _fanOn = false;
  bool _lightOn = false;
  bool _pumpPending = false;
  bool _fanPending = false;
  bool _lightPending = false;
  StreamSubscription<Map<String, dynamic>>? _sseSub;

  @override
  void initState() {
    super.initState();
    _load();
    _initControls();
  }

  @override
  void dispose() {
    _fanThrCtrl.dispose();
    _pumpThrCtrl.dispose();
    _lightThrCtrl.dispose();
    _fanHysCtrl.dispose();
    _pumpHysCtrl.dispose();
    _lightHysCtrl.dispose();
    _minGapCtrl.dispose();
    _sseSub?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final raw = await Api.getSensorData(
        auth.accessToken ?? '',
        widget.device.id,
        limit: 100,
      );
      _data = raw
          .map((e) => SensorData.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (e) {
      // ignore for now
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _sendCommand(String target, String action) async {
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      await Api.createCommand(auth.accessToken ?? '', {
        'deviceId': widget.device.id,
        'target': target,
        'action': action,
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Command $action sent to $target')),
      );
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Failed to send command: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.device.name),
        actions: [
          PopupMenuButton<String>(
            onSelected: (value) {
              if (value == 'alerts') {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => AlertSettingsPage(device: widget.device),
                  ),
                );
              } else if (value == 'alertsLog') {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => AlertsListPage(device: widget.device),
                  ),
                );
              }
            },
            itemBuilder: (ctx) => [
              const PopupMenuItem(
                value: 'alertsLog',
                child: Row(
                  children: [
                    Icon(Icons.list, size: 20),
                    SizedBox(width: 12),
                    Text('Alerts Log'),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'alerts',
                child: Row(
                  children: [
                    Icon(Icons.notifications, size: 20),
                    SizedBox(width: 12),
                    Text('Alert Rules'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(12.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Top: current metrics summary
                  _buildCurrentMetrics(),
                  const SizedBox(height: 12),
                  // Middle: control buttons
                  _buildControls(),
                  const SizedBox(height: 12),
                  // Bottom: automation settings (no history)
                  Expanded(child: _buildAutomationSettings()),
                ],
              ),
            ),
    );
  }

  Widget _buildControls() {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const ListTile(
              title: Text(
                'Điều khiển thủ công',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              dense: true,
            ),
            SwitchListTile(
              title: const Text('Bơm (Pump)'),
              secondary: _pumpPending
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.water_drop),
              value: _pumpOn,
              onChanged: _pumpPending ? null : (v) => _toggleTarget('pump', v),
            ),
            SwitchListTile(
              title: const Text('Quạt (Fan)'),
              secondary: _fanPending
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.air),
              value: _fanOn,
              onChanged: _fanPending ? null : (v) => _toggleTarget('fan', v),
            ),
            SwitchListTile(
              title: const Text('Đèn (Light)'),
              secondary: _lightPending
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.lightbulb),
              value: _lightOn,
              onChanged: _lightPending
                  ? null
                  : (v) => _toggleTarget('light', v),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCurrentMetrics() {
    final latest = _data.isNotEmpty ? _data.first : null;
    final temp = latest?.temperature;
    final hum = latest?.humidity;
    final soil = latest?.soilMoisture;
    final lux = latest?.lux;
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
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
                    widget.device.name,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                Text(
                  widget.device.location ?? 'Unknown',
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ],
            ),
            const SizedBox(height: 8),
            GridView.count(
              shrinkWrap: true,
              crossAxisCount: 2,
              physics: const NeverScrollableScrollPhysics(),
              childAspectRatio: 2.3,
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              children: [
                _metricChip(
                  'Temp',
                  temp != null ? '${temp.toStringAsFixed(1)} °C' : '—',
                ),
                _metricChip(
                  'Hum',
                  hum != null ? '${hum.toStringAsFixed(1)} %' : '—',
                ),
                _metricChip('Lux', lux != null ? lux.toStringAsFixed(0) : '—'),
                _metricChip(
                  'Soil',
                  soil != null ? soil.toStringAsFixed(1) : '—',
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _refreshControlState() async {
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final cmds = await Api.listCommands(
        auth.accessToken ?? '',
        deviceId: widget.device.id,
      );
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
      setState(() {
        if (pump != null) _pumpOn = pump;
        if (fan != null) _fanOn = fan;
        if (light != null) _lightOn = light;
      });
    } catch (_) {}
  }

  void _initControls() {
    _refreshControlState();
    _loadDeviceSettings();
    // Subscribe SSE for status updates
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final ext = widget.device.externalId ?? widget.device.id;
      final stream = Api.subscribeDeviceStream(auth.accessToken, ext);
      _sseSub = stream.listen((evt) {
        final target = evt['target'] as String?;
        final state = evt['state'];
        final relayFan = evt['relayFan'];
        final relayLight = evt['relayLight'];
        final relayPump = evt['relayPump'];
        setState(() {
          if (target != null && state is bool) {
            switch (target) {
              case 'pump':
                _pumpOn = state;
                break;
              case 'fan':
                _fanOn = state;
                break;
              case 'light':
                _lightOn = state;
                break;
            }
          }
          if (relayFan is String) _fanOn = relayFan.toUpperCase() == 'ON';
          if (relayLight is String) _lightOn = relayLight.toUpperCase() == 'ON';
          if (relayPump is String) _pumpOn = relayPump.toUpperCase() == 'ON';
          // Update latest metrics from telemetry if present
          final t = evt['temperature'];
          final h = evt['humidity'];
          final s = evt['soilMoisture'];
          final l = evt['lux'];
          if (t is num || h is num || s is num || l is num) {
            final now = DateTime.now();
            final sd = SensorData(
              timestamp: now,
              temperature: t is num
                  ? t.toDouble()
                  : (_data.isNotEmpty ? _data.first.temperature : null),
              humidity: h is num
                  ? h.toDouble()
                  : (_data.isNotEmpty ? _data.first.humidity : null),
              soilMoisture: s is num
                  ? s.toDouble()
                  : (_data.isNotEmpty ? _data.first.soilMoisture : null),
              lux: l is num
                  ? l.toDouble()
                  : (_data.isNotEmpty ? _data.first.lux : null),
            );
            _data = [sd];
          }
        });
      });
    } catch (_) {}
  }

  Future<void> _loadDeviceSettings() async {
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final dev = await Api.getDevice(auth.accessToken ?? '', widget.device.id);
      setState(() {
        _autoFan = dev['autoFanEnabled'] == true;
        _autoPump = dev['autoPumpEnabled'] == true;
        _autoLight = dev['autoLightEnabled'] == true;
        if (dev['autoFanTempAbove'] != null)
          _fanThrCtrl.text = dev['autoFanTempAbove'].toString();
        if (dev['autoPumpSoilBelow'] != null)
          _pumpThrCtrl.text = dev['autoPumpSoilBelow'].toString();
        if (dev['autoLightLuxBelow'] != null)
          _lightThrCtrl.text = dev['autoLightLuxBelow'].toString();
        if (dev['autoFanHysteresis'] != null)
          _fanHysCtrl.text = dev['autoFanHysteresis'].toString();
        if (dev['autoPumpHysteresis'] != null)
          _pumpHysCtrl.text = dev['autoPumpHysteresis'].toString();
        if (dev['autoLightHysteresis'] != null)
          _lightHysCtrl.text = dev['autoLightHysteresis'].toString();
        if (dev['minToggleIntervalSec'] != null)
          _minGapCtrl.text = dev['minToggleIntervalSec'].toString();
      });
    } catch (_) {}
  }

  Widget _metricChip(String label, String value) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.shade300),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey.shade700)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildAutomationSettings() {
    return SingleChildScrollView(
      child: Card(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        elevation: 1,
        child: ExpansionTile(
          title: const Text('Tự động theo ngưỡng'),
          subtitle: const Text('Bật/tắt tự động và ngưỡng — ẩn bớt cho gọn'),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          children: [
            // FAN
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text(
                'Quạt (Fan) — bật khi nhiệt độ ≥ ngưỡng, tắt khi xuống dưới',
              ),
              value: _autoFan,
              onChanged: (v) => setState(() => _autoFan = v),
            ),
            Row(
              children: [
                Expanded(
                  child: _numField(
                    'Ngưỡng nhiệt độ (°C)',
                    _fanThrCtrl,
                    hint: 'vd: 30.0',
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _numField(
                    'Hysteresis (°C)',
                    _fanHysCtrl,
                    hint: 'vd: 1.0',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            // PUMP
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text(
                'Bơm (Pump) — bật khi ẩm đất ≤ ngưỡng, tắt khi vượt ngưỡng',
              ),
              value: _autoPump,
              onChanged: (v) => setState(() => _autoPump = v),
            ),
            Row(
              children: [
                Expanded(
                  child: _numField(
                    'Ngưỡng ẩm đất',
                    _pumpThrCtrl,
                    hint: 'vd: 40.0',
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _numField('Hysteresis', _pumpHysCtrl, hint: 'vd: 2.0'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            // LIGHT
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text(
                'Đèn (Light) — bật khi Lux ≤ ngưỡng, tắt khi vượt ngưỡng',
              ),
              value: _autoLight,
              onChanged: (v) => setState(() => _autoLight = v),
            ),
            Row(
              children: [
                Expanded(
                  child: _numField(
                    'Ngưỡng Lux',
                    _lightThrCtrl,
                    hint: 'vd: 2500',
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _numField('Hysteresis', _lightHysCtrl, hint: 'vd: 50'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            _numField(
              'Khoảng cách lần bật/tắt tối thiểu (giây)',
              _minGapCtrl,
              hint: 'vd: 60',
            ),
            const SizedBox(height: 8),
            const Text('Thiết bị sẽ tự TẮT khi vượt ngưỡng nhờ hysteresis.'),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton.icon(
                onPressed: _saveAutomation,
                icon: const Icon(Icons.save),
                label: const Text('Lưu cấu hình'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _toggleTarget(String target, bool desired) async {
    String? pendingKey;
    bool? prev;
    setState(() {
      switch (target) {
        case 'pump':
          pendingKey = 'pump';
          _pumpPending = true;
          prev = _pumpOn;
          _pumpOn = desired;
          break;
        case 'fan':
          pendingKey = 'fan';
          _fanPending = true;
          prev = _fanOn;
          _fanOn = desired;
          break;
        case 'light':
          pendingKey = 'light';
          _lightPending = true;
          prev = _lightOn;
          _lightOn = desired;
          break;
      }
    });
    try {
      await _sendCommand(target, desired ? 'ON' : 'OFF');
      await _refreshControlState();
    } catch (_) {
      // revert
      setState(() {
        switch (target) {
          case 'pump':
            _pumpOn = prev ?? _pumpOn;
            break;
          case 'fan':
            _fanOn = prev ?? _fanOn;
            break;
          case 'light':
            _lightOn = prev ?? _lightOn;
            break;
        }
      });
    } finally {
      setState(() {
        switch (pendingKey) {
          case 'pump':
            _pumpPending = false;
            break;
          case 'fan':
            _fanPending = false;
            break;
          case 'light':
            _lightPending = false;
            break;
        }
      });
    }
  }

  Widget _numField(String label, TextEditingController ctrl, {String? hint}) {
    return TextField(
      controller: ctrl,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        border: const OutlineInputBorder(),
      ),
    );
  }

  Future<void> _saveAutomation() async {
    final auth = Provider.of<AuthService>(context, listen: false);
    double? parseNum(String s) {
      if (s.trim().isEmpty) return null;
      return double.tryParse(s.trim());
    }

    final payload = <String, dynamic>{
      'autoFanEnabled': _autoFan,
      'autoFanTempAbove': parseNum(_fanThrCtrl.text),
      'autoFanHysteresis': parseNum(_fanHysCtrl.text),
      'autoPumpEnabled': _autoPump,
      'autoPumpSoilBelow': parseNum(_pumpThrCtrl.text),
      'autoPumpHysteresis': parseNum(_pumpHysCtrl.text),
      'autoLightEnabled': _autoLight,
      'autoLightLuxBelow': parseNum(_lightThrCtrl.text),
      'autoLightHysteresis': parseNum(_lightHysCtrl.text),
      'minToggleIntervalSec': parseNum(_minGapCtrl.text),
    }..removeWhere((k, v) => v == null);

    try {
      await Api.updateDevice(auth.accessToken ?? '', widget.device.id, payload);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Đã lưu cấu hình tự động')));
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Failed to save: $e')));
    }
  }
}
