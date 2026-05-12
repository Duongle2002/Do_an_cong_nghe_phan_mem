import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api.dart';
import '../services/auth_service.dart';

class AlertsPage extends StatefulWidget {
  const AlertsPage({super.key});

  @override
  State<AlertsPage> createState() => _AlertsPageState();
}

class _AlertsPageState extends State<AlertsPage> with SingleTickerProviderStateMixin {
  bool _loading = true;
  List<dynamic> _alerts = [];
  String? _error;
  late AnimationController _listController;

  @override
  void initState() {
    super.initState();
    _listController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _load();
  }

  @override
  void dispose() {
    _listController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final list = await Api.getAlerts(auth.accessToken ?? '');
      setState(() => _alerts = list);
      _listController.forward(from: 0);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F7F2),
      appBar: AppBar(
        title: const Text('Notifications', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? _buildErrorState()
          : _alerts.isEmpty
          ? _buildEmptyState()
          : ListView.builder(
              itemCount: _alerts.length,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              itemBuilder: (ctx, i) {
                final a = _alerts[i] as Map<String, dynamic>;
                return AnimatedBuilder(
                  animation: _listController,
                  builder: (context, child) {
                    final animation = CurvedAnimation(
                      parent: _listController,
                      curve: Interval((i / (_alerts.length > 10 ? 10 : _alerts.length)) * 0.5, 1.0, curve: Curves.easeOut),
                    );
                    return Opacity(
                      opacity: animation.value,
                      child: Transform.translate(offset: Offset(0, 20 * (1 - animation.value)), child: child),
                    );
                  },
                  child: _buildAlertCard(a),
                );
              },
            ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.notifications_none_outlined, size: 80, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          const Text('No notifications yet', style: TextStyle(color: Colors.grey, fontSize: 16)),
        ],
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, size: 60, color: Colors.redAccent),
          const SizedBox(height: 16),
          Text('Failed to load alerts', style: TextStyle(color: Colors.grey.shade700, fontWeight: FontWeight.bold)),
          TextButton(onPressed: _load, child: const Text('Try Again')),
        ],
      ),
    );
  }

  Widget _buildAlertCard(Map<String, dynamic> a) {
    final type = a['type']?.toString().toLowerCase() ?? 'info';
    final isWarning = type.contains('warning') || type.contains('critical') || type.contains('alert');
    final color = isWarning ? Colors.redAccent : Colors.blueAccent;
    final ts = a['timestamp'] != null ? DateTime.parse(a['timestamp']).toLocal() : DateTime.now();

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: color.withOpacity(0.1), shape: BoxShape.circle),
              child: Icon(isWarning ? Icons.warning_amber_rounded : Icons.info_outline, color: color, size: 20),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(type.toUpperCase(), style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1)),
                      Text(TimeOfDay.fromDateTime(ts).format(context), style: const TextStyle(color: Colors.grey, fontSize: 10)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(a['message'] ?? 'Unknown message', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.black87)),
                  const SizedBox(height: 4),
                  Text('Device: ${a['deviceId'] ?? 'System'}', style: TextStyle(color: Colors.grey.shade600, fontSize: 11)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
