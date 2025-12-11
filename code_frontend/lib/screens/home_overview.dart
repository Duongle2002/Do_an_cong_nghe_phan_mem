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

class _HomeOverviewPageState extends State<HomeOverviewPage> {
  bool _loading = true;
  List<Device> _devices = [];
  final Map<String, SensorData?> _latest = {}; // deviceId -> latest reading
  final Map<String, List<SensorData>> _history =
      {}; // recent readings per device
  String? _error;
  final Map<String, StreamSubscription> _sseSubs = {};
  int _sseActive = 0;
  final Set<String> _shownAlertIds =
      {}; // track shown alerts to avoid duplicates
  Timer? _alertCheckTimer;

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
    // Poll for new unread alerts every 10 seconds
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
            // Show toast notification
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(alert['message'] ?? 'Alert triggered'),
                backgroundColor: alert['type'] == 'error'
                    ? Colors.red
                    : Colors.orange,
                duration: const Duration(seconds: 5),
              ),
            );

            // Show local notification
            NotificationService().showLocalNotification(
              title: 'Smart Farm Alert',
              body: alert['message'] ?? 'Alert triggered',
            );
          }
        }
      }
    } catch (e) {
      // Silent fail on error
    }
  }

  void _subscribeSse(String? token, Device device) {
    final externalId = device.externalId ?? device.id;
    if (_sseSubs.containsKey(externalId)) return;
    try {
      final stream = Api.subscribeDeviceStream(token, externalId);
      final sub = stream.listen(
        (evt) {
          try {
            // Handle telemetry payloads
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
            // Handle status-only events
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
          } catch (e) {
            print('sse parse error: $e');
          }
        },
        onError: (e) {
          print('SSE error for $externalId: $e');
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
    } catch (e) {
      print('subscribeSse error: $e');
    }
  }

  Future<void> _loadOverview() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final rawDevices = await Api.getDevices(auth.accessToken ?? '');
      _devices = rawDevices
          .map((e) => Device.fromJson(e as Map<String, dynamic>))
          .toList();

      // fetch recent sensor data (history) for each device in parallel
      final futures = _devices.map((d) async {
        try {
          final raw = await Api.getSensorData(
            auth.accessToken ?? '',
            d.id,
            limit: 20,
          );
          if (raw.isNotEmpty) {
            final list = raw
                .map((e) => SensorData.fromJson(e as Map<String, dynamic>))
                .toList();
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
      // subscribe to SSE for realtime updates per device
      for (final d in _devices) {
        _subscribeSse(auth.accessToken, d);
      }
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthService>(context);
    final userName = auth.user != null ? auth.user!['name'] ?? 'User' : 'User';

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(12.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      'Welcome, $userName',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.notifications_active),
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const AlertsListPage(),
                        ),
                      );
                    },
                  ),
                ],
              ),
              const SizedBox(height: 12),
              const Text(
                'Environment Overview',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  Text(
                    'Live stream: ',
                    style: TextStyle(
                      color: Theme.of(
                        context,
                      ).colorScheme.onSurface.withOpacity(0.7),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: _sseActive > 0
                          ? const Color(0xFF2ECC71)
                          : Colors.grey.shade400,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      _sseActive > 0
                          ? 'connected (${_sseActive}/${_devices.length})'
                          : 'disconnected',
                      style: const TextStyle(color: Colors.white, fontSize: 11),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Expanded(
                child: _loading
                    ? const Center(child: CircularProgressIndicator())
                    : _error != null
                    ? Center(child: Text('Error: $_error'))
                    : _devices.isEmpty
                    ? const Center(child: Text('No devices'))
                    : ListView.separated(
                        itemCount: _devices.length,
                        padding: EdgeInsets.zero,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                          final d = _devices[index];
                          final s = _latest[d.id];
                          final hist = _history[d.id] ?? [];
                          return Card(
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            elevation: 1,
                            margin: const EdgeInsets.symmetric(vertical: 6.0),
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
                                      if (d.location != null &&
                                          d.location!.isNotEmpty)
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
                                          color: (d.status == 'online')
                                              ? const Color(0xFF2ECC71)
                                              : (d.status == 'offline')
                                              ? const Color(0xFFE74C3C)
                                              : Colors.grey.shade400,
                                          borderRadius: BorderRadius.circular(
                                            12,
                                          ),
                                        ),
                                        child: Text(
                                          d.status ?? 'unknown',
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 11,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 10),
                                  GridView.count(
                                    shrinkWrap: true,
                                    crossAxisCount: 2,
                                    childAspectRatio: 1.25,
                                    padding: EdgeInsets.zero,
                                    mainAxisSpacing: 8,
                                    crossAxisSpacing: 8,
                                    physics:
                                        const NeverScrollableScrollPhysics(),
                                    children: [
                                      _metricTile(
                                        d.name,
                                        'Temp',
                                        s?.temperature != null
                                            ? '${s!.temperature!.toStringAsFixed(1)} °C'
                                            : '—',
                                      ),
                                      _metricTile(
                                        d.name,
                                        'Hum',
                                        s?.humidity != null
                                            ? '${s!.humidity!.toStringAsFixed(1)} %'
                                            : '—',
                                      ),
                                      _metricTile(
                                        d.name,
                                        'Lux',
                                        s?.lux != null
                                            ? '${s!.lux!.toStringAsFixed(0)}'
                                            : '—',
                                      ),
                                      _metricTile(
                                        d.name,
                                        'Soil',
                                        s?.soilMoisture != null
                                            ? '${s!.soilMoisture!.toStringAsFixed(1)}'
                                            : '—',
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  if (hist.isNotEmpty) ...[
                                    _buildChartSection(
                                      context,
                                      'Temperature',
                                      hist.map((e) => e.temperature).toList(),
                                      '°C',
                                    ),
                                    const SizedBox(height: 12),
                                    _buildChartSection(
                                      context,
                                      'Humidity',
                                      hist.map((e) => e.humidity).toList(),
                                      '%',
                                    ),
                                    const SizedBox(height: 12),
                                    _buildChartSection(
                                      context,
                                      'Soil Moisture',
                                      hist.map((e) => e.soilMoisture).toList(),
                                      '',
                                    ),
                                    const SizedBox(height: 12),
                                    _buildChartSection(
                                      context,
                                      'Lux',
                                      hist.map((e) => e.lux).toList(),
                                      'lux',
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          );
                        },
                      ),
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  Widget _metricTile(String deviceName, String metric, String value) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.shade300),
      ),
      padding: const EdgeInsets.all(8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // device name top-left small
          Text(
            deviceName,
            style: TextStyle(fontSize: 11, color: Colors.grey.shade700),
          ),
          const SizedBox(height: 6),
          // metric name centered
          Center(
            child: Text(
              metric,
              style: TextStyle(
                fontSize: 12,
                color: Theme.of(
                  context,
                ).colorScheme.onSurface.withOpacity(0.85),
              ),
            ),
          ),
          const Spacer(),
          // value large
          Center(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Theme.of(context).colorScheme.onSurface,
              ),
            ),
          ),
          const SizedBox(height: 6),
        ],
      ),
    );
  }

  Widget _buildChartSection(
    BuildContext context,
    String title,
    List<double?> values,
    String unit,
  ) {
    final nums = values.where((v) => v != null).map((v) => v!).toList();
    final currentValue = nums.isNotEmpty ? nums.last : null;
    final minVal = nums.isNotEmpty ? nums.reduce((a, b) => a < b ? a : b) : 0.0;
    final maxVal = nums.isNotEmpty ? nums.reduce((a, b) => a > b ? a : b) : 0.0;
    final avgVal = nums.isNotEmpty
        ? nums.reduce((a, b) => a + b) / nums.length
        : 0.0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              title,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: Theme.of(context).colorScheme.onSurface.withOpacity(0.9),
              ),
            ),
            if (currentValue != null)
              Text(
                '${currentValue.toStringAsFixed(1)} $unit',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                  color: Theme.of(context).colorScheme.primary,
                ),
              ),
          ],
        ),
        const SizedBox(height: 6),
        SizedBox(
          height: 120,
          child: LineChartWithStats(
            data: values,
            minVal: minVal,
            maxVal: maxVal,
          ),
        ),
        const SizedBox(height: 4),
        // Show min/avg/max below chart
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            _statLabel('Min', '${minVal.toStringAsFixed(1)}$unit'),
            _statLabel('Avg', '${avgVal.toStringAsFixed(1)}$unit'),
            _statLabel('Max', '${maxVal.toStringAsFixed(1)}$unit'),
          ],
        ),
      ],
    );
  }

  Widget _statLabel(String label, String value) {
    return Column(
      children: [
        Text(
          label,
          style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
        ),
      ],
    );
  }
}

class TempChart extends StatelessWidget {
  final List<SensorData> data;
  const TempChart({super.key, required this.data});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (ctx, constraints) {
        final w = constraints.maxWidth;
        final h = constraints.maxHeight > 0 ? constraints.maxHeight : 120.0;
        return CustomPaint(
          painter: _TempChartPainter(
            data.map((e) => e.temperature).toList(),
            Theme.of(context).colorScheme.primary,
          ),
          size: Size(w, h),
        );
      },
    );
  }
}

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
    return LayoutBuilder(
      builder: (ctx, constraints) {
        final w = constraints.maxWidth;
        final h = constraints.maxHeight > 0 ? constraints.maxHeight : 120.0;
        return CustomPaint(
          painter: _LineChartPainterWithStats(
            data,
            Theme.of(context).colorScheme.primary,
            minVal,
            maxVal,
          ),
          size: Size(w, h),
        );
      },
    );
  }
}

// Keep old chart classes for backward compatibility
class HumChart extends StatelessWidget {
  final List<SensorData> data;
  const HumChart({super.key, required this.data});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (ctx, constraints) {
        final w = constraints.maxWidth;
        final h = constraints.maxHeight > 0 ? constraints.maxHeight : 120.0;
        return CustomPaint(
          painter: _LineChartPainter(
            data.map((e) => e.humidity).toList(),
            Theme.of(context).colorScheme.primary,
          ),
          size: Size(w, h),
        );
      },
    );
  }
}

class SoilChart extends StatelessWidget {
  final List<SensorData> data;
  const SoilChart({super.key, required this.data});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (ctx, constraints) {
        final w = constraints.maxWidth;
        final h = constraints.maxHeight > 0 ? constraints.maxHeight : 120.0;
        return CustomPaint(
          painter: _LineChartPainter(
            data.map((e) => e.soilMoisture).toList(),
            Theme.of(context).colorScheme.secondary,
          ),
          size: Size(w, h),
        );
      },
    );
  }
}

class LuxChart extends StatelessWidget {
  final List<SensorData> data;
  const LuxChart({super.key, required this.data});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (ctx, constraints) {
        final w = constraints.maxWidth;
        final h = constraints.maxHeight > 0 ? constraints.maxHeight : 120.0;
        return CustomPaint(
          painter: _LineChartPainter(
            data.map((e) => e.lux).toList(),
            Theme.of(context).colorScheme.tertiary,
          ),
          size: Size(w, h),
        );
      },
    );
  }
}

class _TempChartPainter extends CustomPainter {
  final List<double?> values;
  final Color color;
  _TempChartPainter(this.values, this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..color = color;

    final w = size.width;
    final h = size.height;
    final pts = <Offset>[];
    final nums = values.where((v) => v != null).map((v) => v!).toList();
    if (nums.isEmpty) return;
    final minv = nums.reduce((a, b) => a < b ? a : b);
    final maxv = nums.reduce((a, b) => a > b ? a : b);
    final span = (maxv - minv) == 0 ? 1.0 : (maxv - minv);
    for (var i = 0; i < values.length; i++) {
      final v = values[i];
      if (v == null) continue;
      final x = (i / (values.length - 1)) * w;
      final y = h - ((v - minv) / span) * h;
      pts.add(Offset(x, y));
    }
    if (pts.length < 2) return;
    final path = Path()..moveTo(pts.first.dx, pts.first.dy);
    for (var i = 1; i < pts.length; i++) path.lineTo(pts[i].dx, pts[i].dy);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}

class _LineChartPainterWithStats extends CustomPainter {
  final List<double?> values;
  final Color color;
  final double minVal;
  final double maxVal;

  _LineChartPainterWithStats(this.values, this.color, this.minVal, this.maxVal);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..color = color;

    final w = size.width;
    final h = size.height;
    final padding = 30.0; // space for axis labels
    final chartW = w - padding;
    final chartH = h - padding;

    final pts = <Offset>[];
    final nums = values.where((v) => v != null).map((v) => v!).toList();
    if (nums.isEmpty) return;

    final span = (maxVal - minVal).abs() == 0 ? 1.0 : (maxVal - minVal).abs();

    // Draw axis
    canvas.drawLine(
      Offset(padding, 0),
      Offset(padding, chartH),
      Paint()
        ..color = Colors.grey.shade400
        ..strokeWidth = 1,
    );
    canvas.drawLine(
      Offset(padding, chartH),
      Offset(w, chartH),
      Paint()
        ..color = Colors.grey.shade400
        ..strokeWidth = 1,
    );

    // Draw Y-axis labels (min, max)
    final textPainter1 = TextPainter(
      text: TextSpan(
        text: maxVal.toStringAsFixed(0),
        style: const TextStyle(color: Colors.grey, fontSize: 10),
      ),
      textDirection: TextDirection.ltr,
    );
    textPainter1.layout();
    textPainter1.paint(canvas, Offset(2, 0));

    final textPainter2 = TextPainter(
      text: TextSpan(
        text: minVal.toStringAsFixed(0),
        style: const TextStyle(color: Colors.grey, fontSize: 10),
      ),
      textDirection: TextDirection.ltr,
    );
    textPainter2.layout();
    textPainter2.paint(canvas, Offset(2, chartH - 10));

    // Plot points
    for (var i = 0; i < values.length; i++) {
      final v = values[i];
      if (v == null) continue;
      final x =
          padding +
          (i / (values.length - 1).clamp(1, double.infinity)) * chartW;
      final y = chartH - ((v - minVal) / span) * chartH;
      pts.add(Offset(x, y));
    }

    if (pts.length < 2) return;
    final path = Path()..moveTo(pts.first.dx, pts.first.dy);
    for (var i = 1; i < pts.length; i++) path.lineTo(pts[i].dx, pts[i].dy);
    canvas.drawPath(path, paint);

    // Draw current value point
    if (pts.isNotEmpty) {
      canvas.drawCircle(pts.last, 3, Paint()..color = color);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}

class _LineChartPainter extends CustomPainter {
  final List<double?> values;
  final Color color;
  _LineChartPainter(this.values, this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..color = color;

    final w = size.width;
    final h = size.height;
    final pts = <Offset>[];
    final nums = values.where((v) => v != null).map((v) => v!).toList();
    if (nums.isEmpty) return;
    final minv = nums.reduce((a, b) => a < b ? a : b);
    final maxv = nums.reduce((a, b) => a > b ? a : b);
    final span = (maxv - minv) == 0 ? 1.0 : (maxv - minv);
    for (var i = 0; i < values.length; i++) {
      final v = values[i];
      if (v == null) continue;
      final x = (i / (values.length - 1).clamp(1, double.infinity)) * w;
      final y = h - ((v - minv) / span) * h;
      pts.add(Offset(x, y));
    }
    if (pts.length < 2) return;
    final path = Path()..moveTo(pts.first.dx, pts.first.dy);
    for (var i = 1; i < pts.length; i++) path.lineTo(pts[i].dx, pts[i].dy);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
