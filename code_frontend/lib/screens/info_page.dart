import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/api.dart';
import '../models/device.dart';
import '../models/sensor_data.dart';

class InfoPage extends StatefulWidget {
  const InfoPage({super.key});

  @override
  State<InfoPage> createState() => _InfoPageState();
}

class _InfoPageState extends State<InfoPage> {
  bool _loading = true;
  List<Device> _devices = [];
  SensorData? _latestData;
  String? _error;
  bool _thinking = false;
  String? _inferenceResult;

  @override
  void initState() {
    super.initState();
    _loadDeviceData();
  }

  Future<void> _loadDeviceData() async {
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
        final rawSensors = await Api.getSensorData(auth.accessToken ?? '', d.id, limit: 1);
        if (rawSensors.isNotEmpty) {
          _latestData = SensorData.fromJson(rawSensors.first as Map<String, dynamic>);
        }
      }
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _runInference() {
    setState(() {
      _thinking = true;
      _inferenceResult = null;
    });

    // Simulate AI inference calculations
    Timer(const Duration(milliseconds: 1500), () {
      if (!mounted) return;

      final soil = _latestData?.soilMoisture ?? 52.0;
      final temp = _latestData?.temperature ?? 27.4;
      final hum = _latestData?.humidity ?? 68.0;
      final lux = _latestData?.lux ?? 4200.0;

      String advice = 'Đất đủ nước, giữ nguyên trạng thái vận hành.';
      if (soil < 45) {
        advice = 'Đất đang khô hạn. Khuyên bạn nên kích hoạt vòi tưới nước.';
      } else if (temp > 30) {
        advice = 'Nhiệt độ nhà kính tăng cao. Khuyên bạn bật quạt hút thông gió để làm mát.';
      } else if (soil > 65) {
        advice = 'Đất đang quá ẩm. Đề xuất khóa van nước và giảm tưới.';
      }

      setState(() {
        _thinking = false;
        _inferenceResult = '''[BÁO CÁO PHÂN TÍCH AGRO-SYNAPSE V2]

• Độ ẩm đất: ${soil.toStringAsFixed(0)}% (${soil >= 45 && soil <= 60 ? 'Đầy đủ, ổn định' : soil < 45 ? 'Khô hạn' : 'Dư ẩm'})
• Nhiệt độ: ${temp.toStringAsFixed(1)}°C (${temp >= 20 && temp <= 30 ? 'Lý tưởng' : 'Cần điều chỉnh'})
• Độ ẩm khí: ${hum.toStringAsFixed(0)}% (Môi trường ổn định)
• Cường độ sáng: ${lux.toStringAsFixed(0)} lx (Độ sáng tốt cho quang hợp)

👉 KẾT LUẬN & KHUYẾN NGHỊ:
$advice''';
      });
    });
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
                  : _buildAIView(),
    );
  }

  Widget _buildAIView() {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 50, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          const Text(
            'MÔ HÌNH NƠ-RON',
            style: TextStyle(
              color: Color(0xFF9EADBC),
              fontSize: 11,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Trợ lý Cây Trồng AI',
            style: TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 24),

          // Brain Card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: const Color(0xFF161B26),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF222938), width: 0.8),
            ),
            child: Column(
              children: [
                // Brain Icon container
                Container(
                  width: 80,
                  height: 80,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: const Color(0xFF10B981),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(
                    Icons.psychology,
                    color: Colors.white,
                    size: 48,
                  ),
                ),
                const SizedBox(height: 20),

                const Text(
                  'AGRO-SYNAPSE V2 MOBILE',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),

                const Text(
                  'Kết nối dữ liệu biên, phân tích xu hướng nhiệt và cung cấp lời khuyên chăm sóc nông nghiệp.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Color(0xFF9EADBC),
                    fontSize: 13,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 24),

                // Action Button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF065F46),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: const BorderSide(color: Color(0xFF10B981), width: 1),
                      ),
                    ),
                    onPressed: _thinking ? null : _runInference,
                    icon: const Icon(Icons.auto_awesome, color: Color(0xFF34D399), size: 18),
                    label: const Text(
                      'BẮT ĐẦU SUY LUẬN AI',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.1,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Inference Space Card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF161B26),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF222938), width: 0.8),
            ),
            child: _thinking
                ? Column(
                    children: const [
                      SizedBox(height: 20),
                      CircularProgressIndicator(color: Color(0xFF10B981)),
                      SizedBox(height: 16),
                      Text(
                        'MÔ HÌNH AI ĐANG SUY LUẬN...',
                        style: TextStyle(
                          color: Color(0xFF10B981),
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.1,
                        ),
                      ),
                      SizedBox(height: 20),
                    ],
                  )
                : _inferenceResult != null
                    ? Text(
                        _inferenceResult!,
                        style: const TextStyle(
                          color: Color(0xFF34D399),
                          fontFamily: 'Courier',
                          fontSize: 13,
                          height: 1.5,
                        ),
                      )
                    : const Padding(
                        padding: EdgeInsets.symmetric(vertical: 32),
                        child: Text(
                          'NHẤN NÚT TRÊN ĐỂ AI PHÂN TÍCH CẤU HÌNH ĐẤT!',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Colors.white24,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1.1,
                          ),
                        ),
                      ),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }
}
