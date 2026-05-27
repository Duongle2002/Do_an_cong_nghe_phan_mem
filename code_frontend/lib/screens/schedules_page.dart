import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../services/auth_service.dart';
import '../services/api.dart';
import '../models/device.dart';
import '../models/sensor_data.dart';

class SchedulesPage extends StatefulWidget {
  const SchedulesPage({super.key});

  @override
  State<SchedulesPage> createState() => _SchedulesPageState();
}

class _SchedulesPageState extends State<SchedulesPage> {
  bool _loading = true;
  List<Device> _devices = [];
  List<SensorData> _sensorHistory = [];
  final List<String> _rawLogs = [];
  String? _error;
  StreamSubscription? _sseSub;

  @override
  void initState() {
    super.initState();
    _loadTelemetry();
  }

  @override
  void dispose() {
    _sseSub?.cancel();
    super.dispose();
  }

  Future<void> _loadTelemetry() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final rawDevs = await Api.getDevices(auth.accessToken ?? '');
      _devices = rawDevs.map((e) => Device.fromJson(e as Map<String, dynamic>)).toList();

      if (_devices.isNotEmpty) {
        final d = _devices.first;
        final rawSensors = await Api.getSensorData(auth.accessToken ?? '', d.id, limit: 15);
        _sensorHistory = rawSensors.map((e) => SensorData.fromJson(e as Map<String, dynamic>)).toList();
        
        // Populate initial raw logs
        for (final s in _sensorHistory) {
          final timeStr = DateFormat('HH:mm:ss').format(s.timestamp.toLocal());
          final tempStr = s.temperature?.toStringAsFixed(1) ?? '--';
          final soilStr = s.soilMoisture?.toStringAsFixed(0) ?? '--';
          final humStr = s.humidity?.toStringAsFixed(0) ?? '--';
          final luxStr = s.lux?.toStringAsFixed(0) ?? '--';
          _rawLogs.add('[$timeStr] Nhiệt độ: $tempStr°C | Độ ẩm đất: $soilStr% | Độ ẩm khí: $humStr% | Lux: $luxStr');
        }

        _subscribeSse(d);
      }
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _subscribeSse(Device device) {
    final auth = Provider.of<AuthService>(context, listen: false);
    final externalId = device.externalId ?? device.id;
    _sseSub?.cancel();
    try {
      final stream = Api.subscribeDeviceStream(auth.accessToken, externalId);
      _sseSub = stream.listen((evt) {
        if (evt.containsKey('temperature') ||
            evt.containsKey('humidity') ||
            evt.containsKey('soilMoisture') ||
            evt.containsKey('lux')) {
          final s = SensorData.fromJson(evt);
          final timeStr = DateFormat('HH:mm:ss').format(DateTime.now());
          final tempStr = s.temperature?.toStringAsFixed(1) ?? '--';
          final soilStr = s.soilMoisture?.toStringAsFixed(0) ?? '--';
          final humStr = s.humidity?.toStringAsFixed(0) ?? '--';
          final luxStr = s.lux?.toStringAsFixed(0) ?? '--';
          setState(() {
            _sensorHistory.insert(0, s);
            if (_sensorHistory.length > 30) _sensorHistory.removeLast();

            _rawLogs.insert(0, '[$timeStr] SSE: Temp=$tempStr°C, Soil=$soilStr%, Hum=$humStr%, Lux=$luxStr');
            if (_rawLogs.length > 50) _rawLogs.removeLast();
          });
        }
      });
    } catch (_) {}
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
                  ? const Center(child: Text('Không tìm thấy thiết bị'))
                  : _buildTelemetryView(),
    );
  }

  Widget _buildTelemetryView() {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 50, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          const Text(
            'DỮ LIỆU THỰC NGHIỆM',
            style: TextStyle(
              color: Color(0xFF9EADBC),
              fontSize: 11,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Phân tích Telemetry',
            style: TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 24),

          // Chart Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF161B26),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF222938), width: 0.8),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'ĐỘ ẨM ĐẤT & NHIỆT ĐỘ',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF065F46),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'THỰC TẾ',
                        style: TextStyle(
                          color: Color(0xFF34D399),
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // Custom Painter Chart
                SizedBox(
                  height: 180,
                  width: double.infinity,
                  child: CustomPaint(
                    painter: DoubleLineChartPainter(data: _sensorHistory),
                  ),
                ),
                const SizedBox(height: 12),

                // Chart Legend
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _buildLegendItem('Nhiệt độ (°C)', const Color(0xFFF97316)),
                    const SizedBox(width: 24),
                    _buildLegendItem('Độ ẩm đất (%)', const Color(0xFF10B981)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Raw Logs Card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF161B26),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF222938), width: 0.8),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'NHẬT KÝ DỮ LIỆU THÔ',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  height: 240,
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0C0F17),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF222938), width: 0.8),
                  ),
                  child: _rawLogs.isEmpty
                      ? const Center(
                          child: Text(
                            'ĐANG CHỜ TÍN HIỆU NODE...',
                            style: TextStyle(
                              color: Colors.white24,
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.1,
                            ),
                          ),
                        )
                      : ListView.builder(
                          physics: const BouncingScrollPhysics(),
                          itemCount: _rawLogs.length,
                          itemBuilder: (ctx, i) {
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 6),
                              child: Text(
                                _rawLogs[i],
                                style: const TextStyle(
                                  color: Color(0xFF34D399),
                                  fontFamily: 'Courier',
                                  fontSize: 11,
                                ),
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildLegendItem(String label, Color color) {
    return Row(
      children: [
        Container(
          width: 12,
          height: 4,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: const TextStyle(
            color: Colors.white54,
            fontSize: 11,
          ),
        ),
      ],
    );
  }
}

class DoubleLineChartPainter extends CustomPainter {
  final List<SensorData> data;
  DoubleLineChartPainter({required this.data});

  @override
  void paint(Canvas canvas, Size size) {
    final gridPaint = Paint()
      ..color = Colors.white12
      ..strokeWidth = 0.5;

    // Draw horizontal grid lines
    const gridLines = 4;
    for (int i = 0; i <= gridLines; i++) {
      final y = (size.height / gridLines) * i;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    // Fallback data if API history is empty
    final List<double> tempPoints = [];
    final List<double> soilPoints = [];

    if (data.isEmpty) {
      tempPoints.addAll([25.0, 26.2, 27.4, 28.1, 27.0, 26.5]);
      soilPoints.addAll([50.0, 51.5, 52.0, 53.0, 52.5, 52.0]);
    } else {
      // API reads starting from newest. Reverse to plot chronological order
      final list = data.reversed.toList();
      for (final s in list) {
        tempPoints.add(s.temperature ?? 27.4);
        soilPoints.add(s.soilMoisture ?? 52.0);
      }
    }

    if (tempPoints.length < 2) return;

    // Temp range: 15 to 35
    const double minTemp = 15;
    const double maxTemp = 35;
    final double tempSpan = maxTemp - minTemp;

    // Soil range: 30 to 70
    const double minSoil = 30;
    const double maxSoil = 70;
    final double soilSpan = maxSoil - minSoil;

    final tempPath = Path();
    final soilPath = Path();

    final tempPaint = Paint()
      ..color = const Color(0xFFF97316)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;

    final soilPaint = Paint()
      ..color = const Color(0xFF10B981)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;

    final stepX = size.width / (tempPoints.length - 1);

    for (int i = 0; i < tempPoints.length; i++) {
      final x = stepX * i;

      // Map temp to Y coordinate
      final tVal = tempPoints[i].clamp(minTemp, maxTemp);
      final yTemp = size.height - ((tVal - minTemp) / tempSpan) * size.height;

      // Map soil to Y coordinate
      final sVal = soilPoints[i].clamp(minSoil, maxSoil);
      final ySoil = size.height - ((sVal - minSoil) / soilSpan) * size.height;

      if (i == 0) {
        tempPath.moveTo(x, yTemp);
        soilPath.moveTo(x, ySoil);
      } else {
        tempPath.lineTo(x, yTemp);
        soilPath.lineTo(x, ySoil);
      }
    }

    canvas.drawPath(tempPath, tempPaint);
    canvas.drawPath(soilPath, soilPaint);

    // Draw little marker circles for the last/latest point
    final lastX = size.width;
    final lastTVal = tempPoints.last.clamp(minTemp, maxTemp);
    final lastYTemp = size.height - ((lastTVal - minTemp) / tempSpan) * size.height;

    final lastSVal = soilPoints.last.clamp(minSoil, maxSoil);
    final lastYSoil = size.height - ((lastSVal - minSoil) / soilSpan) * size.height;

    final markerOuterPaint = Paint()..style = PaintingStyle.fill;
    final markerInnerPaint = Paint()..style = PaintingStyle.fill..color = Colors.white;

    // Temp marker
    markerOuterPaint.color = const Color(0xFFF97316);
    canvas.drawCircle(Offset(lastX, lastYTemp), 6, markerOuterPaint);
    canvas.drawCircle(Offset(lastX, lastYTemp), 3, markerInnerPaint);

    // Soil marker
    markerOuterPaint.color = const Color(0xFF10B981);
    canvas.drawCircle(Offset(lastX, lastYSoil), 6, markerOuterPaint);
    canvas.drawCircle(Offset(lastX, lastYSoil), 3, markerInnerPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
