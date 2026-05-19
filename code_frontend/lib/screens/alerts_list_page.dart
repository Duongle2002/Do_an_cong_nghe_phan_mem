import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/api.dart';
import '../models/device.dart';

class AlertsListPage extends StatefulWidget {
  final Device? device; // if null, show all alerts
  const AlertsListPage({super.key, this.device});

  @override
  State<AlertsListPage> createState() => _AlertsListPageState();
}

class _AlertsListPageState extends State<AlertsListPage> with SingleTickerProviderStateMixin {
  late List<Map<String, dynamic>> _alerts = [];
  bool _loading = true;
  String? _error;
  bool _showOnlyUnread = false;

  late AnimationController _listController;

  @override
  void initState() {
    super.initState();
    _listController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _loadAlerts();
  }

  @override
  void dispose() {
    _listController.dispose();
    super.dispose();
  }

  Future<void> _loadAlerts() async {
    setState(() { _loading = true; _error = null; });
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final raw = await Api.getAlerts(
        auth.accessToken ?? '',
        deviceId: widget.device?.id,
        read: _showOnlyUnread ? false : null,
      );
      setState(() => _alerts = raw.cast<Map<String, dynamic>>());
      _listController.forward(from: 0);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _markAsRead(String alertId) async {
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      await Api.markAlertAsRead(auth.accessToken ?? '', alertId);
      if (mounted) _loadAlerts();
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F7F2),
      appBar: AppBar(
        title: Text(widget.device != null ? '${widget.device!.name} Logs' : 'Device Logs', style: const TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(icon: Icon(_showOnlyUnread ? Icons.filter_list : Icons.filter_list_off), onPressed: () { setState(() => _showOnlyUnread = !_showOnlyUnread); _loadAlerts(); }),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(child: Text('Error: $_error'))
          : _alerts.isEmpty
          ? _buildEmptyState()
          : ListView.builder(
              itemCount: _alerts.length,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              itemBuilder: (ctx, idx) {
                final alert = _alerts[idx];
                return AnimatedBuilder(
                  animation: _listController,
                  builder: (context, child) {
                    final animation = CurvedAnimation(
                      parent: _listController,
                      curve: Interval((idx / (_alerts.length > 10 ? 10 : _alerts.length)) * 0.5, 1.0, curve: Curves.easeOut),
                    );
                    return Opacity(opacity: animation.value, child: Transform.translate(offset: Offset(0, 20 * (1 - animation.value)), child: child));
                  },
                  child: _buildAlertItem(alert),
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
          Icon(Icons.history_outlined, size: 80, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          const Text('No logs found', style: TextStyle(color: Colors.grey, fontSize: 16)),
        ],
      ),
    );
  }

  Widget _buildAlertItem(Map<String, dynamic> a) {
    final isRead = a['read'] == true;
    final type = a['type']?.toString().toLowerCase() ?? 'info';
    final isWarning = type.contains('warning') || type.contains('critical') || type.contains('error');
    final color = isWarning ? Colors.redAccent : Colors.blueAccent;
    final ts = a['timestamp'] != null ? DateTime.parse(a['timestamp']).toLocal() : DateTime.now();

    return GestureDetector(
      onTap: !isRead ? () => _markAsRead(a['_id']) : null,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: isRead ? Colors.white.withOpacity(0.8) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: isRead ? null : Border.all(color: color.withOpacity(0.3), width: 1),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4))],
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: color.withOpacity(0.1), shape: BoxShape.circle),
                child: Icon(isWarning ? Icons.error_outline : Icons.info_outline, color: color, size: 20),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_formatTime(a['timestamp']), style: const TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    Text(a['message'] ?? 'Alert', style: TextStyle(fontWeight: isRead ? FontWeight.normal : FontWeight.bold, fontSize: 14, color: isRead ? Colors.black54 : Colors.black87)),
                  ],
                ),
              ),
              if (!isRead) Icon(Icons.circle, color: color, size: 8),
            ],
          ),
        ),
      ),
    );
  }

  String _formatTime(String? timestamp) {
    if (timestamp == null) return 'Unknown time';
    try {
      final dt = DateTime.parse(timestamp);
      final now = DateTime.now();
      final diff = now.difference(dt);
      if (diff.inMinutes < 1) return 'Just now';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
      if (diff.inHours < 24) return '${diff.inHours}h ago';
      return '${dt.day}/${dt.month} ${dt.hour}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) { return timestamp; }
  }
}
