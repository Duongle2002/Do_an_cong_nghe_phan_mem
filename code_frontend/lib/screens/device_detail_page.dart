import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
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

class _DeviceDetailPageState extends State<DeviceDetailPage> with SingleTickerProviderStateMixin {
  List<SensorData> _data = [];
  bool _loading = true;
  bool _autoFan = false;
  bool _autoPump = false;
  bool _autoLight = false;
  final _fanThrCtrl = TextEditingController();
  final _pumpThrCtrl = TextEditingController();
  final _lightThrCtrl = TextEditingController();
  final _fanHysCtrl = TextEditingController();
  final _pumpHysCtrl = TextEditingController();
  final _lightHysCtrl = TextEditingController();
  final _minGapCtrl = TextEditingController();
  bool _pumpOn = false;
  bool _fanOn = false;
  bool _lightOn = false;
  bool _pumpPending = false;
  bool _fanPending = false;
  bool _lightPending = false;
  StreamSubscription<Map<String, dynamic>>? _sseSub;
  List<Device> _devices = [];
  String? _selectedSensorId;

  late AnimationController _animationController;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );
    _load();
    _initControls();
    _animationController.forward();
  }

  @override
  void dispose() {
    _animationController.dispose();
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
      final raw = await Api.getSensorData(auth.accessToken ?? '', widget.device.id, limit: 100);
      _data = raw.map((e) => SensorData.fromJson(e as Map<String, dynamic>)).toList();
      if (widget.device.externalId?.startsWith('esp32s3-') == true) {
        final rawDevices = await Api.getDevices(auth.accessToken ?? '');
        _devices = rawDevices.map((e) => Device.fromJson(e as Map<String, dynamic>)).toList();
      }
    } catch (_) {}
    finally { setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F7F2),
      appBar: AppBar(
        title: Text(widget.device.name, style: const TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.history),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => AlertsListPage(device: widget.device))),
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => AlertSettingsPage(device: widget.device))),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              child: Column(
                children: [
                  _buildHeaderCard(),
                  const SizedBox(height: 24),
                  _buildSectionTitle('Live Metrics'),
                  const SizedBox(height: 12),
                  _buildMetricsGrid(),
                  const SizedBox(height: 24),
                  _buildSectionTitle('Manual Control'),
                  const SizedBox(height: 12),
                  _buildControlPanel(),
                  const SizedBox(height: 24),
                  if (widget.device.externalId?.startsWith('esp32s3-') == true) ...[
                    _buildSectionTitle('Device Pairing'),
                    const SizedBox(height: 12),
                    _buildPairingCard(),
                    const SizedBox(height: 24),
                  ],
                  _buildSectionTitle('Intelligent Automation'),
                  const SizedBox(height: 12),
                  _buildAutomationCard(),
                  const SizedBox(height: 40),
                ],
              ),
            ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey, letterSpacing: 1.5),
      ),
    );
  }

  Widget _buildHeaderCard() {
    final status = widget.device.status ?? 'offline';
    final isOnline = status == 'online';
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF2E7D32),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [BoxShadow(color: Colors.green.withOpacity(0.3), blurRadius: 15, offset: const Offset(0, 8))],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Colors.white.withOpacity(0.2), shape: BoxShape.circle),
            child: const Icon(Icons.developer_board, color: Colors.white, size: 30),
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(widget.device.name, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                Text(widget.device.location ?? 'Main Greenhouse', style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 13)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(color: isOnline ? Colors.greenAccent.withOpacity(0.2) : Colors.redAccent.withOpacity(0.2), borderRadius: BorderRadius.circular(12), border: Border.all(color: isOnline ? Colors.greenAccent : Colors.redAccent, width: 0.5)),
            child: Text(status.toUpperCase(), style: TextStyle(color: isOnline ? Colors.greenAccent : Colors.redAccent, fontSize: 10, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricsGrid() {
    final latest = _data.isNotEmpty ? _data.first : null;
    return GridView.count(
      shrinkWrap: true,
      crossAxisCount: 2,
      childAspectRatio: 1.5,
      mainAxisSpacing: 15,
      crossAxisSpacing: 15,
      physics: const NeverScrollableScrollPhysics(),
      children: [
        _metricCard('Temperature', latest?.temperature, '°C', Icons.thermostat, Colors.orange),
        _metricCard('Humidity', latest?.humidity, '%', Icons.water_drop, Colors.blue),
        _metricCard('Soil Moisture', latest?.soilMoisture, '%', Icons.grass, Colors.brown),
        _metricCard('Illumination', latest?.lux, 'Lx', Icons.light_mode, Colors.amber),
      ],
    );
  }

  Widget _metricCard(String label, double? value, String unit, IconData icon, Color color) {
    final decimals = (label == 'Temperature' || label == 'Humidity') ? 2 : 1;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Icon(icon, color: color, size: 20),
              Text(unit, style: const TextStyle(color: Colors.grey, fontSize: 10)),
            ],
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(value != null ? value.toStringAsFixed(decimals) : '--', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
              Text(label, style: const TextStyle(color: Colors.grey, fontSize: 11)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildControlPanel() {
    return Row(
      children: [
        _tacticalToggle('PUMP', Icons.water_drop, _pumpOn, _pumpPending, (v) => _toggleTarget('pump', v)),
        const SizedBox(width: 15),
        _tacticalToggle('FAN', Icons.air, _fanOn, _fanPending, (v) => _toggleTarget('fan', v)),
        const SizedBox(width: 15),
        _tacticalToggle('LIGHT', Icons.lightbulb, _lightOn, _lightPending, (v) => _toggleTarget('light', v)),
      ],
    );
  }

  Widget _tacticalToggle(String label, IconData icon, bool isOn, bool isPending, Function(bool) onChanged) {
    return Expanded(
      child: GestureDetector(
        onTap: isPending ? null : () => onChanged(!isOn),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          padding: const EdgeInsets.symmetric(vertical: 20),
          decoration: BoxDecoration(
            color: isOn ? const Color(0xFF2E7D32) : Colors.white,
            borderRadius: BorderRadius.circular(20),
            boxShadow: isOn ? [BoxShadow(color: Colors.green.withOpacity(0.3), blurRadius: 10, offset: const Offset(0, 4))] : [],
          ),
          child: Column(
            children: [
              if (isPending)
                const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              else
                Icon(icon, color: isOn ? Colors.white : Colors.black54),
              const SizedBox(height: 10),
              Text(label, style: TextStyle(color: isOn ? Colors.white : Colors.black54, fontSize: 12, fontWeight: FontWeight.bold)),
              Text(isOn ? 'ACTIVE' : 'READY', style: TextStyle(color: isOn ? Colors.white70 : Colors.black26, fontSize: 9)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAutomationCard() {
    return Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24)),
      child: Column(
        children: [
          _automationRow('Fan Threshold', _autoFan, _fanThrCtrl, '°C', (v) => setState(() => _autoFan = v)),
          const Divider(height: 1, indent: 20, endIndent: 20),
          _automationRow('Pump Threshold', _autoPump, _pumpThrCtrl, '%', (v) => setState(() => _autoPump = v)),
          const Divider(height: 1, indent: 20, endIndent: 20),
          _automationRow('Light Threshold', _autoLight, _lightThrCtrl, 'Lx', (v) => setState(() => _autoLight = v)),
          Padding(
            padding: const EdgeInsets.all(20),
            child: SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2E7D32), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15))),
                onPressed: _saveAutomation,
                child: const Text('SAVE AUTOMATION RULES', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, letterSpacing: 1)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _automationRow(String label, bool enabled, TextEditingController ctrl, String unit, Function(bool) onToggle) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 15),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              Switch.adaptive(value: enabled, activeColor: Colors.green, onChanged: onToggle),
            ],
          ),
          if (enabled) ...[
            const SizedBox(height: 10),
            TextField(
              controller: ctrl,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                suffixText: unit,
                hintText: 'Enter threshold value',
                contentPadding: const EdgeInsets.symmetric(horizontal: 15, vertical: 10),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: Colors.grey.shade300)),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _refreshControlState() async {
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final cmds = await Api.listCommands(auth.accessToken ?? '', deviceId: widget.device.id);
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
        if (pump != null) _pumpOn = pump;
        if (fan != null) _fanOn = fan;
        if (light != null) _lightOn = light;
      });
    } catch (_) {}
  }

  void _initControls() {
    _refreshControlState();
    _loadDeviceSettings();
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final ext = widget.device.externalId ?? widget.device.id;
      _sseSub = Api.subscribeDeviceStream(auth.accessToken, ext).listen((evt) {
        final target = evt['target'] as String?;
        final state = evt['state'];
        final relayFan = evt['relayFan'];
        final relayLight = evt['relayLight'];
        final relayPump = evt['relayPump'];
        setState(() {
          if (target != null && state is bool) {
            if (target == 'pump') _pumpOn = state;
            if (target == 'fan') _fanOn = state;
            if (target == 'light') _lightOn = state;
          }
          if (relayFan is String) _fanOn = relayFan.toUpperCase() == 'ON';
          if (relayLight is String) _lightOn = relayLight.toUpperCase() == 'ON';
          if (relayPump is String) _pumpOn = relayPump.toUpperCase() == 'ON';
          final t = evt['temperature'];
          final h = evt['humidity'];
          final s = evt['soilMoisture'];
          final l = evt['lux'];
          if (t is num || h is num || s is num || l is num) {
            _data = [SensorData(
              timestamp: DateTime.now(),
              temperature: t is num ? t.toDouble() : (_data.isNotEmpty ? _data.first.temperature : null),
              humidity: h is num ? h.toDouble() : (_data.isNotEmpty ? _data.first.humidity : null),
              soilMoisture: s is num ? s.toDouble() : (_data.isNotEmpty ? _data.first.soilMoisture : null),
              lux: l is num ? l.toDouble() : (_data.isNotEmpty ? _data.first.lux : null),
            ), ..._data.take(99)];
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
        _selectedSensorId = dev['pairedSensorId'];
        if (dev['autoFanTempAbove'] != null) _fanThrCtrl.text = dev['autoFanTempAbove'].toString();
        if (dev['autoPumpSoilBelow'] != null) _pumpThrCtrl.text = dev['autoPumpSoilBelow'].toString();
        if (dev['autoLightLuxBelow'] != null) _lightThrCtrl.text = dev['autoLightLuxBelow'].toString();
      });
    } catch (_) {}
  }

  Future<void> _toggleTarget(String target, bool desired) async {
    setState(() {
      if (target == 'pump') { _pumpPending = true; _pumpOn = desired; }
      if (target == 'fan') { _fanPending = true; _fanOn = desired; }
      if (target == 'light') { _lightPending = true; _lightOn = desired; }
    });
    try {
      await Api.createCommand(Provider.of<AuthService>(context, listen: false).accessToken ?? '', {
        'deviceId': widget.device.id,
        'target': target,
        'action': desired ? 'ON' : 'OFF',
      });
      await _refreshControlState();
    } catch (_) {
      _refreshControlState();
    } finally {
      if (mounted) setState(() {
        if (target == 'pump') _pumpPending = false;
        if (target == 'fan') _fanPending = false;
        if (target == 'light') _lightPending = false;
      });
    }
  }

  Future<void> _saveAutomation() async {
    final auth = Provider.of<AuthService>(context, listen: false);
    final payload = {
      'autoFanEnabled': _autoFan,
      'autoFanTempAbove': double.tryParse(_fanThrCtrl.text),
      'autoPumpEnabled': _autoPump,
      'autoPumpSoilBelow': double.tryParse(_pumpThrCtrl.text),
      'autoLightEnabled': _autoLight,
      'autoLightLuxBelow': double.tryParse(_lightThrCtrl.text),
    }..removeWhere((k, v) => v == null);
    try {
      await Api.updateDevice(auth.accessToken ?? '', widget.device.id, payload);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Automation settings saved')));
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to save: $e')));
    }
  }

  Widget _buildPairingCard() {
    final sensors = _devices.where((d) => d.id != widget.device.id && d.externalId != null && !d.externalId!.startsWith('esp32s3-')).toList();
    final auth = Provider.of<AuthService>(context, listen: false);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Ghép cặp Node cảm biến', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 6),
          const Text('Chọn node cảm biến WROOM để liên kết dữ liệu điều khiển cho bộ rơ-le này.', style: TextStyle(color: Colors.grey, fontSize: 12)),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            value: _selectedSensorId != null && _selectedSensorId!.isNotEmpty ? _selectedSensorId : null,
            decoration: InputDecoration(
              contentPadding: const EdgeInsets.symmetric(horizontal: 15, vertical: 10),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: Colors.grey.shade300)),
              hintText: 'Chưa ghép cặp',
            ),
            items: [
              const DropdownMenuItem<String>(
                value: null,
                child: Text('Không ghép cặp / Tắt liên kết'),
              ),
              ...sensors.map((s) => DropdownMenuItem<String>(
                value: s.externalId,
                child: Text('${s.name} (${s.externalId})'),
              )),
            ],
            onChanged: (val) {
              setState(() {
                _selectedSensorId = val;
              });
            },
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2E7D32),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15))
              ),
              onPressed: () async {
                try {
                  await Api.updateDevice(auth.accessToken ?? '', widget.device.id, {
                    'pairedSensorId': _selectedSensorId ?? '',
                  });
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ghép đôi thiết bị thành công! S3 sẽ nhận cấu hình qua MQTT.')));
                } catch (e) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to save pairing: $e')));
                }
              },
              child: const Text('LƯU LIÊN KẾT THIẾT BỊ', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, letterSpacing: 1)),
            ),
          ),
        ],
      ),
    );
  }
}

