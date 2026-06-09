import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/api.dart';
import '../models/device.dart';
import '../models/sensor_data.dart';
import 'alerts_list_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

class HomeOverviewPage extends StatefulWidget {
  const HomeOverviewPage({super.key});

  @override
  State<HomeOverviewPage> createState() => _HomeOverviewPageState();
}

class _HomeOverviewPageState extends State<HomeOverviewPage> {
  bool _loading = true;
  List<Device> _devices = [];
  String? _selectedDeviceId;
  final Map<String, SensorData?> _latest = {}; // deviceId -> latest reading
  String? _error;
  final Map<String, StreamSubscription> _sseSubs = {};
  int _sseActive = 0;
  final Set<String> _shownAlertIds = {};
  Timer? _alertCheckTimer;

  // Manual relay states (cached locally for instant feedback)
  final Map<String, bool> _pumpState = {};
  final Map<String, bool> _fanState = {};
  final Map<String, bool> _lightState = {};
  final Map<String, bool> _pendingStates = {}; // target_deviceId -> isPending
  List<dynamic> _schedules = [];
  String _opMode = 'auto';

  @override
  void initState() {
    super.initState();
    _loadOverview();
    _startAlertPolling();
  }

  @override
  void dispose() {
    _alertCheckTimer?.cancel();
    for (final s in _sseSubs.values) {
      try {
        s.cancel();
      } catch (_) {}
    }
    super.dispose();
  }

  void _startAlertPolling() {
    _alertCheckTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      _checkForNewAlerts();
    });
  }

  Future<void> _checkForNewAlerts() async {
    if (!mounted) return;
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final raw = await Api.getAlerts(auth.accessToken ?? '', read: false);
      final alerts = raw.cast<Map<String, dynamic>>();
      for (final alert in alerts) {
        final alertId = alert['_id'] as String;
        if (!_shownAlertIds.contains(alertId)) {
          _shownAlertIds.add(alertId);
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(alert['message'] ?? 'Phát hiện cảnh báo mới!'),
                behavior: SnackBarBehavior.floating,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                backgroundColor: alert['type'] == 'error' ? Colors.redAccent : Colors.orangeAccent,
              ),
            );
          }
        }
      }
    } catch (_) {}
  }

  void _subscribeSse(String? token, Device device) {
    final externalId = device.externalId ?? device.id;
    if (_sseSubs.containsKey(externalId)) return;
    try {
      final stream = Api.subscribeDeviceStream(token, externalId);
      final sub = stream.listen(
        (evt) {
          try {
            if (evt.containsKey('temperature') ||
                evt.containsKey('humidity') ||
                evt.containsKey('soilMoisture') ||
                evt.containsKey('lux')) {
              final s = SensorData.fromJson(evt);
              setState(() {
                _latest[device.id] = s;
              });
            }
            // Sync relay states
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
            if (opModeVal is String && _devices.isNotEmpty && device.id == _selectedDeviceId) {
              if (_opMode != opModeVal) {
                _opMode = opModeVal;
                changed = true;
              }
            }
            if (changed) setState(() {});
          } catch (_) {}
        },
        onDone: () {
          _sseSubs.remove(externalId);
          setState(() {
            _sseActive = (_sseActive - 1).clamp(0, 1 << 30);
          });
        },
      );
      _sseSubs[externalId] = sub;
      setState(() {
        _sseActive = _sseActive + 1;
      });
    } catch (_) {}
  }

  Future<void> _loadOverview() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final rawDevices = await Api.getDevices(auth.accessToken ?? '');
      _devices = rawDevices.map((e) => Device.fromJson(e as Map<String, dynamic>)).toList();

      final futures = _devices.map((d) async {
        try {
          final raw = await Api.getSensorData(auth.accessToken ?? '', d.id, limit: 1);
          if (raw.isNotEmpty) {
            final list = raw.map((e) => SensorData.fromJson(e as Map<String, dynamic>)).toList();
            _latest[d.id] = list.first;
          } else {
            _latest[d.id] = null;
          }

          _pumpState[d.id] = d.lastPumpState?.toUpperCase() == 'ON';
          _fanState[d.id] = d.lastFanState?.toUpperCase() == 'ON';
          _lightState[d.id] = d.lastLightState?.toUpperCase() == 'ON';
        } catch (_) {
          _latest[d.id] = null;
        }
      }).toList();

      await Future.wait(futures);

      if (_devices.isNotEmpty) {
        final prefs = await SharedPreferences.getInstance();
        _selectedDeviceId = prefs.getString('active_device_id') ?? _devices.first.id;
        if (!_devices.any((d) => d.id == _selectedDeviceId)) {
          _selectedDeviceId = _devices.first.id;
        }
        final d = _devices.firstWhere((x) => x.id == _selectedDeviceId, orElse: () => _devices.first);
        try {
          final list = await Api.getSchedules(auth.accessToken ?? '', deviceId: d.id);
          _schedules = list;
        } catch (_) {}

        if (d.opMode != null) {
          _opMode = d.opMode!;
        } else if (d.autoFanEnabled || d.autoPumpEnabled || d.autoLightEnabled) {
          _opMode = 'auto';
        } else {
          _opMode = prefs.getString('device_mode_${d.id}') ?? 'manual';
        }
      }

      for (final d in _devices) {
        _subscribeSse(auth.accessToken, d);
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

  Future<void> _toggleState(Device d, String target, bool nextState) async {
    final pendingKey = '${target}_${d.id}';
    final nextAction = nextState ? 'ON' : 'OFF';
    setState(() {
      _pendingStates[pendingKey] = true;
    });
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
    } finally {
      if (mounted) {
        setState(() {
          _pendingStates[pendingKey] = false;
        });
      }
    }
  }

  String _getInitials(String name) {
    List<String> parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      String last = parts[parts.length - 1];
      String prev = parts[parts.length - 2];
      return ((prev.isNotEmpty ? prev[0] : '') + (last.isNotEmpty ? last[0] : '')).toUpperCase();
    }
    return name.isNotEmpty ? name.substring(0, (name.length > 2 ? 2 : name.length)).toUpperCase() : 'US';
  }

  String _getTinyMLDecision(SensorData? data) {
    final soil = data?.soilMoisture ?? 52.0;
    final temp = data?.temperature ?? 27.4;
    if (soil < 45) {
      return 'Khuyên: Đất khô, cần bật vòi tưới';
    } else if (temp > 30) {
      return 'Khuyên: Nhiệt độ cao, bật quạt làm mát';
    } else if (soil > 60) {
      return 'Khuyên: Đất ẩm nhiều, giữ nguyên';
    }
    return 'Khuyên: Đất đủ nước, giữ nguyên';
  }

  void _showProfileSettings(BuildContext context, AuthService auth) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF10141D),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        final email = auth.user != null ? auth.user!['email'] ?? '' : '';
        final name = auth.user != null ? auth.user!['name'] ?? '' : 'Manager';
        return Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 30,
                    backgroundColor: const Color(0xFF10B981).withOpacity(0.2),
                    child: Text(
                      _getInitials(name),
                      style: const TextStyle(color: Color(0xFF10B981), fontWeight: FontWeight.bold, fontSize: 20),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white)),
                        Text(email, style: const TextStyle(color: Colors.white54, fontSize: 14)),
                      ],
                    ),
                  ),
                ],
              ),
              const Divider(color: Color(0xFF1E2533), height: 32),
              ListTile(
                leading: const Icon(Icons.notifications_outlined, color: Color(0xFF10B981)),
                title: const Text('Nhật ký cảnh báo', style: TextStyle(color: Colors.white)),
                trailing: const Icon(Icons.chevron_right, color: Colors.white54),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.pushNamed(context, '/alerts');
                },
              ),
              ListTile(
                leading: const Icon(Icons.sensors_outlined, color: Color(0xFF10B981)),
                title: const Text('Giả lập cảm biến (Simulation)', style: TextStyle(color: Colors.white)),
                trailing: const Icon(Icons.chevron_right, color: Colors.white54),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.pushNamed(context, '/send-sensor');
                },
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.redAccent.withOpacity(0.1),
                    foregroundColor: Colors.redAccent,
                    elevation: 0,
                    side: const BorderSide(color: Colors.redAccent, width: 0.8),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () {
                    Navigator.pop(context);
                    auth.logout();
                  },
                  icon: const Icon(Icons.logout),
                  label: const Text('ĐĂNG XUẤT HỆ THỐNG', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthService>(context);
    final userName = auth.user != null ? auth.user!['name'] ?? 'User' : 'User';

    return Scaffold(
      backgroundColor: const Color(0xFF0C0F17),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text('Đã xảy ra lỗi: $_error', style: const TextStyle(color: Colors.red)))
              : _devices.isEmpty
                  ? const Center(child: Text('Không tìm thấy thiết bị nào'))
                  : RefreshIndicator(
                      onRefresh: _loadOverview,
                      color: const Color(0xFF10B981),
                      backgroundColor: const Color(0xFF161B26),
                      child: _buildDashboard(userName, auth),
                    ),
    );
  }

  Widget _buildDashboard(String userName, AuthService auth) {
    final activeDevice = _devices.firstWhere((d) => d.id == _selectedDeviceId, orElse: () => _devices.first);
    
    SensorData? latestData = _latest[activeDevice.id];
    if (latestData == null && activeDevice.pairedSensorId != null && activeDevice.pairedSensorId!.isNotEmpty) {
      final pairedDevice = _devices.firstWhere(
        (d) => d.externalId == activeDevice.pairedSensorId || d.id == activeDevice.pairedSensorId,
        orElse: () => activeDevice
      );
      if (pairedDevice != activeDevice) {
        latestData = _latest[pairedDevice.id];
      }
    }

    // Determine current operation mode
    String modeText = 'Tự động';
    if (_opMode == 'auto') {
      modeText = 'Tự động';
    } else if (_opMode == 'scheduled') {
      modeText = 'Hẹn giờ';
    } else {
      modeText = 'Thủ công';
    }

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
      padding: const EdgeInsets.fromLTRB(20, 50, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Elegant Custom Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
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
                            final d = _devices.firstWhere((x) => x.id == val);
                            if (d.opMode != null) {
                              _opMode = d.opMode!;
                            } else if (d.autoFanEnabled || d.autoPumpEnabled || d.autoLightEnabled) {
                              _opMode = 'auto';
                            } else {
                              _opMode = 'manual';
                            }
                          });
                          _loadOverview();
                        }
                      },
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text(
                        userName,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: Color(0xFF10B981),
                          shape: BoxShape.circle,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              InkWell(
                onTap: () => _showProfileSettings(context, auth),
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: const Color(0xFF161B26),
                    border: Border.all(color: const Color(0xFF10B981).withOpacity(0.3), width: 1.5),
                    shape: BoxShape.circle,
                  ),
                  child: Text(
                    _getInitials(userName),
                    style: const TextStyle(
                      color: Color(0xFF10B981),
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // TinyML Decision Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF161B26),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF10B981).withOpacity(0.2), width: 1),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.psychology_outlined, color: Color(0xFF10B981), size: 18),
                          const SizedBox(width: 6),
                          const Text(
                            'TINYML DECISION',
                            style: TextStyle(
                              color: Color(0xFF10B981),
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.1,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _getTinyMLDecision(latestData),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(
                    color: const Color(0xFF10B981),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF10B981).withOpacity(0.5),
                        blurRadius: 8,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Metrics 2x2 Grid
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            childAspectRatio: 1.4,
            crossAxisSpacing: 16,
            mainAxisSpacing: 16,
            children: [
              _buildMetricCard(
                'NHIỆT ĐỘ',
                latestData?.temperature?.toStringAsFixed(1) ?? '27.4',
                '°C',
                Icons.thermostat,
                const Color(0xFFF97316), // Orange
              ),
              _buildMetricCard(
                'ẨM KHÔNG KHÍ',
                latestData?.humidity?.toStringAsFixed(0) ?? '68',
                '%',
                Icons.water_drop,
                const Color(0xFF3B82F6), // Blue
              ),
              _buildMetricCard(
                'ẨM ĐẤT',
                latestData?.soilMoisture?.toStringAsFixed(0) ?? '52',
                '%',
                Icons.spa,
                const Color(0xFF10B981), // Green
              ),
              _buildMetricCard(
                'ÁNH SÁNG',
                latestData?.lux?.toStringAsFixed(0) ?? '4200',
                'lx',
                Icons.wb_sunny,
                const Color(0xFFF59E0B), // Amber/Yellow
              ),
            ],
          ),
          const SizedBox(height: 32),

          // Handheld Devices List Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'THIẾT BỊ CẦM TAY',
                style: TextStyle(
                  color: Color(0xFF9EADBC),
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.1,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF10141D),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  'Chế độ: $modeText',
                  style: const TextStyle(
                    color: Color(0xFF10B981),
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Three Device Rows
          _buildDeviceRow(
            activeDevice,
            'pump',
            'Vòi tưới',
            'Máy bơm nước',
            Icons.power_settings_new,
            _pumpState[activeDevice.id] ?? false,
          ),
          _buildDeviceRow(
            activeDevice,
            'light',
            'Đèn chiếu',
            'Đèn quang hợp',
            Icons.wb_sunny_outlined,
            _lightState[activeDevice.id] ?? false,
          ),
          _buildDeviceRow(
            activeDevice,
            'fan',
            'Quạt hút',
            'Quạt thông gió',
            Icons.analytics_outlined,
            _fanState[activeDevice.id] ?? false,
          ),
          const SizedBox(height: 24),
          _buildNextScheduleSection(),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildMetricCard(String label, String value, String unit, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF161B26),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF222938), width: 0.8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: Color(0xFF9EADBC),
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: color, size: 16),
              ),
            ],
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                value,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(width: 4),
              Text(
                unit,
                style: const TextStyle(
                  color: Color(0xFF9EADBC),
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDeviceRow(Device d, String target, String title, String subtitle, IconData icon, bool isOn) {
    final isLocked = d.opMode == 'auto' || d.opMode == 'scheduled';
    final pendingKey = '${target}_${d.id}';
    final isPending = _pendingStates[pendingKey] ?? false;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  subtitle,
                  style: const TextStyle(
                    color: Color(0xFF9EADBC),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          if (isLocked)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFF271C10),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFD97706).withOpacity(0.4), width: 1),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.lock_outline, color: Color(0xFFD97706), size: 12),
                  const SizedBox(width: 4),
                  Text(
                    d.opMode == 'scheduled' ? 'HẸN GIỜ' : 'KHÓA (AI)',
                    style: const TextStyle(
                      color: Color(0xFFD97706),
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            )
          else if (isPending)
            const SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF10B981)),
            )
          else
            Switch.adaptive(
              value: isOn,
              activeColor: const Color(0xFF10B981),
              onChanged: (val) => _toggleState(d, target, val),
            ),
        ],
      ),
    );
  }

  Widget _buildNextScheduleSection() {
    // Find the next upcoming active schedule
    Map<String, dynamic>? nextSched;
    DateTime? nextSchedTime;

    final now = DateTime.now();
    for (final s in _schedules) {
      if (s is Map<String, dynamic> && s['active'] == true && s['time'] != null) {
        try {
          final schedTime = DateTime.parse(s['time']).toLocal();
          // Find next occurrence
          var occurrence = DateTime(now.year, now.month, now.day, schedTime.hour, schedTime.minute);
          if (occurrence.isBefore(now)) {
            occurrence = occurrence.add(const Duration(days: 1));
          }
          if (nextSchedTime == null || occurrence.isBefore(nextSchedTime)) {
            nextSchedTime = occurrence;
            nextSched = s;
          }
        } catch (_) {}
      }
    }

    String timeLabel = '06:00 SÁNG MAI';
    String actionLabel = 'TƯỚI NƯỚC CHU KỲ HÀNG NGÀY';
    String durationLabel = '10 phút';

    if (nextSched != null && nextSchedTime != null) {
      timeLabel = _formatNextScheduleTime(nextSchedTime);
      
      String targetName = 'TÁC VỤ';
      if (nextSched['target'] == 'pump') targetName = 'TƯỚI NƯỚC';
      if (nextSched['target'] == 'light') targetName = 'BẬT ĐÈN CHIẾU';
      if (nextSched['target'] == 'fan') targetName = 'BẬT QUẠT HÚT';

      String repeatName = 'HÀNG NGÀY';
      if (nextSched['repeat'] == 'weekly') repeatName = 'HÀNG TUẦN';

      actionLabel = '$targetName CHU KỲ $repeatName';
      durationLabel = nextSched['name'] != null && nextSched['name'].toString().isNotEmpty
          ? nextSched['name']
          : '12 tiếng';
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: const [
            Icon(Icons.access_time, color: Color(0xFF10B981), size: 16),
            SizedBox(width: 6),
            Text(
              'LỊCH TRÌNH TIẾP THEO',
              style: TextStyle(
                color: Color(0xFF9EADBC),
                fontSize: 12,
                fontWeight: FontWeight.bold,
                letterSpacing: 1.1,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF161B26),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFF222938), width: 0.8),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      timeLabel,
                      style: const TextStyle(
                        color: Color(0xFF10B981),
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      actionLabel,
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
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFF0C0F17),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  durationLabel,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  String _formatNextScheduleTime(DateTime scheduledTime) {
    final localTime = scheduledTime.toLocal();
    final hour = localTime.hour;
    final min = localTime.minute.toString().padLeft(2, '0');
    final formattedHour = hour.toString().padLeft(2, '0');
    
    final timeStr = '$formattedHour:$min';
    
    final now = DateTime.now();
    final todayTime = DateTime(now.year, now.month, now.day, localTime.hour, localTime.minute);
    
    String dayStr = 'TỐI NAY';
    if (hour >= 4 && hour < 12) {
      dayStr = now.isBefore(todayTime) ? 'SÁNG NAY' : 'SÁNG MAI';
    } else if (hour >= 12 && hour < 18) {
      dayStr = now.isBefore(todayTime) ? 'CHIỀU NAY' : 'CHIỀU MAI';
    } else if (hour >= 18 && hour < 22) {
      dayStr = now.isBefore(todayTime) ? 'TỐI NAY' : 'TỐI MAI';
    } else {
      dayStr = now.isBefore(todayTime) ? 'ĐÊM NAY' : 'ĐÊM MAI';
    }
    
    return '$timeStr $dayStr';
  }
}
