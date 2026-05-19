import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/api.dart';
import '../services/notification_service.dart';
import '../models/device.dart';
import '../models/sensor_data.dart';
import 'alerts_list_page.dart';

class HomeOverviewPage extends StatefulWidget {
  const HomeOverviewPage({super.key});

  @override
  State<HomeOverviewPage> createState() => _HomeOverviewPageState();
}

class _HomeOverviewPageState extends State<HomeOverviewPage> with SingleTickerProviderStateMixin {
  bool _loading = true;
  List<Device> _devices = [];
  final Map<String, SensorData?> _latest = {}; // deviceId -> latest reading
  final Map<String, List<SensorData>> _history = {}; // recent readings per device
  String? _error;
  final Map<String, StreamSubscription> _sseSubs = {};
  int _sseActive = 0;
  final Set<String> _shownAlertIds = {}; // track shown alerts to avoid duplicates
  Timer? _alertCheckTimer;

  // Animation controller for staggered list entrance
  late AnimationController _listController;

  @override
  void initState() {
    super.initState();
    _listController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );
    _loadOverview();
    _startAlertPolling();
  }

  @override
  void dispose() {
    _listController.dispose();
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
                content: Text(alert['message'] ?? 'Alert triggered'),
                behavior: SnackBarBehavior.floating,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                backgroundColor: alert['type'] == 'error' ? Colors.redAccent : Colors.orangeAccent,
              ),
            );
            NotificationService().showLocalNotification(
              title: 'Smart Farm Alert',
              body: alert['message'] ?? 'Alert triggered',
            );
          }
        }
      }
    } catch (e) {}
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
                final list = _history[device.id] ?? [];
                list.insert(0, s);
                if (list.length > 200) list.removeLast();
                _history[device.id] = list;
              });
            }
            if (evt['status'] is String) {
              final newStatus = evt['status'] as String;
              setState(() {
                final idx = _devices.indexWhere((d) => d.id == device.id);
                if (idx >= 0) {
                  final d = _devices[idx];
                  _devices[idx] = d.copyWith(status: newStatus);
                }
              });
            }
          } catch (e) {}
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
    } catch (e) {}
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
          final raw = await Api.getSensorData(auth.accessToken ?? '', d.id, limit: 20);
          if (raw.isNotEmpty) {
            final list = raw.map((e) => SensorData.fromJson(e as Map<String, dynamic>)).toList();
            _history[d.id] = list;
            _latest[d.id] = list.first;
          } else {
            _history[d.id] = [];
            _latest[d.id] = null;
          }
        } catch (_) {
          _history[d.id] = [];
          _latest[d.id] = null;
        }
      }).toList();

      await Future.wait(futures);
      for (final d in _devices) {
        _subscribeSse(auth.accessToken, d);
      }
      _listController.forward(from: 0);
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthService>(context);
    final theme = Theme.of(context);
    final userName = auth.user != null ? auth.user!['name'] ?? 'User' : 'User';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAF7),
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(),
        slivers: [
          // Elegant Header
          SliverAppBar(
            expandedHeight: 180,
            floating: false,
            pinned: true,
            backgroundColor: theme.colorScheme.primary,
            flexibleSpace: FlexibleSpaceBar(
              titlePadding: const EdgeInsets.only(left: 20, bottom: 16),
              title: Text(
                'Smart Farm Overview',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                  shadows: [Shadow(color: Colors.black26, blurRadius: 4)],
                ),
              ),
              background: Stack(
                fit: StackFit.expand,
                children: [
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          theme.colorScheme.primary,
                          theme.colorScheme.primary.withBlue(100),
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    right: -50,
                    top: -50,
                    child: Icon(Icons.eco, size: 200, color: Colors.white.withOpacity(0.1)),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 60, 20, 20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Welcome back,',
                          style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 14),
                        ),
                        Text(
                          userName,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 28,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.notifications_outlined, color: Colors.white),
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const AlertsListPage()),
                ),
              ),
              const SizedBox(width: 8),
            ],
          ),

          // Main Content
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildStatusRow(theme),
                  const SizedBox(height: 20),
                  Text(
                    'Connected Devices',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Devices List with staggered animation
          if (_loading)
            const SliverFillRemaining(child: Center(child: CircularProgressIndicator()))
          else if (_error != null)
            SliverFillRemaining(child: Center(child: Text('Error: $_error')))
          else if (_devices.isEmpty)
            const SliverFillRemaining(child: Center(child: Text('No devices found')))
          else
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final d = _devices[index];
                    return AnimatedBuilder(
                      animation: _listController,
                      builder: (context, child) {
                        final delay = (index / _devices.length);
                        final animation = CurvedAnimation(
                          parent: _listController,
                          curve: Interval(delay * 0.5, 0.5 + delay * 0.5, curve: Curves.easeOutCubic),
                        );
                        return Opacity(
                          opacity: animation.value,
                          child: Transform.translate(
                            offset: Offset(0, 30 * (1 - animation.value)),
                            child: child,
                          ),
                        );
                      },
                      child: _buildDeviceCard(context, d),
                    );
                  },
                  childCount: _devices.length,
                ),
              ),
            ),

          const SliverToBoxAdapter(child: SizedBox(height: 80)),
        ],
      ),
    );
  }

  Widget _buildStatusRow(ThemeData theme) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 10, offset: const Offset(0, 4)),
        ],
      ),
      child: Row(
        children: [
          _statusItem(
            Icons.wifi_tethering,
            'Live Feed',
            _sseActive > 0 ? 'Connected' : 'Idle',
            _sseActive > 0 ? Colors.green : Colors.grey,
          ),
          const VerticalDivider(),
          _statusItem(
            Icons.devices,
            'Devices',
            '${_devices.length} Total',
            theme.colorScheme.primary,
          ),
          const VerticalDivider(),
          _statusItem(
            Icons.warning_amber_rounded,
            'Alerts',
            'All Clean',
            Colors.orange,
          ),
        ],
      ),
    );
  }

  Widget _statusItem(IconData icon, String label, String value, Color color) {
    return Expanded(
      child: Column(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(fontSize: 10, color: Colors.grey)),
          Text(
            value,
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: color),
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildDeviceCard(BuildContext context, Device d) {
    final s = _latest[d.id];
    final hist = _history[d.id] ?? [];
    final theme = Theme.of(context);
    final isOnline = d.status == 'online';

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 8, offset: const Offset(0, 2)),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Column(
          children: [
            // Card Header
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: (isOnline ? Colors.green : Colors.grey).withOpacity(0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.sensors,
                      color: isOnline ? Colors.green : Colors.grey,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          d.name,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                        if (d.location != null)
                          Text(
                            d.location!,
                            style: const TextStyle(fontSize: 12, color: Colors.grey),
                          ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: isOnline ? Colors.green.shade50 : Colors.red.shade50,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      d.status?.toUpperCase() ?? 'OFFLINE',
                      style: TextStyle(
                        color: isOnline ? Colors.green : Colors.red,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Metrics Grid
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: GridView.count(
                shrinkWrap: true,
                crossAxisCount: 2,
                childAspectRatio: 2.2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  _newMetricTile(Icons.thermostat, 'Temp', s?.temperature, '°C', Colors.orange),
                  _newMetricTile(Icons.water_drop, 'Hum', s?.humidity, '%', Colors.blue),
                  _newMetricTile(Icons.light_mode, 'Lux', s?.lux, '', Colors.amber),
                  _newMetricTile(Icons.grass, 'Soil', s?.soilMoisture, '', Colors.brown),
                ],
              ),
            ),

            // Charts Section (Expandable)
            if (hist.isNotEmpty)
              Theme(
                data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                child: ExpansionTile(
                  title: const Text('Historical Charts', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  childrenPadding: const EdgeInsets.only(left: 16, right: 16, bottom: 16),
                  children: [
                    _buildAnimatedChart('Temperature', hist.map((e) => e.temperature).toList(), '°C', Colors.orange),
                    const SizedBox(height: 12),
                    _buildAnimatedChart('Humidity', hist.map((e) => e.humidity).toList(), '%', Colors.blue),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _newMetricTile(IconData icon, String label, double? value, String unit, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF8F9FA),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: color.withOpacity(0.7)),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 10, color: Colors.grey)),
                Text(
                  value != null ? '${value.toStringAsFixed(1)}$unit' : '--',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAnimatedChart(String title, List<double?> values, String unit, Color color) {
    final nums = values.where((v) => v != null).map((v) => v!).toList();
    final minVal = nums.isNotEmpty ? nums.reduce((a, b) => a < b ? a : b) : 0.0;
    final maxVal = nums.isNotEmpty ? nums.reduce((a, b) => a > b ? a : b) : 0.0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(title, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
            if (nums.isNotEmpty)
              Text('${nums.first.toStringAsFixed(1)}$unit', style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.bold)),
          ],
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 60,
          width: double.infinity,
          child: CustomPaint(
            painter: _CompactChartPainter(values, color),
          ),
        ),
      ],
    );
  }
}

class _CompactChartPainter extends CustomPainter {
  final List<double?> values;
  final Color color;
  _CompactChartPainter(this.values, this.color);

  @override
  void paint(Canvas canvas, Size size) {
    if (values.isEmpty) return;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round
      ..color = color;

    final fillPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [color.withOpacity(0.2), color.withOpacity(0)],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));

    final nums = values.where((v) => v != null).map((v) => v!).toList();
    if (nums.isEmpty) return;
    final minv = nums.reduce((a, b) => a < b ? a : b);
    final maxv = nums.reduce((a, b) => a > b ? a : b);
    final span = (maxv - minv) == 0 ? 1.0 : (maxv - minv);

    final path = Path();
    final fillPath = Path();

    for (var i = 0; i < values.length; i++) {
      final v = values[i] ?? minv;
      final x = (i / (values.length - 1).clamp(1, double.infinity)) * size.width;
      final y = size.height - ((v - minv) / span) * size.height;
      if (i == 0) {
        path.moveTo(x, y);
        fillPath.moveTo(x, size.height);
        fillPath.lineTo(x, y);
      } else {
        path.lineTo(x, y);
        fillPath.lineTo(x, y);
      }
    }
    fillPath.lineTo(size.width, size.height);
    fillPath.close();

    canvas.drawPath(fillPath, fillPaint);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}

// Keeping old chart classes for compatibility if referenced elsewhere
class LineChartWithStats extends StatelessWidget {
  final List<double?> data;
  final double minVal;
  final double maxVal;

  const LineChartWithStats({
    super.key,
    required this.data,
    required this.minVal,
    required this.maxVal,
  });

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _CompactChartPainter(data, Theme.of(context).colorScheme.primary),
      size: Size.infinite,
    );
  }
}
