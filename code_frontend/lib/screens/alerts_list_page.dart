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

class _AlertsListPageState extends State<AlertsListPage> {
  late List<Map<String, dynamic>> _alerts = [];
  bool _loading = true;
  String? _error;
  bool _showOnlyUnread = false;

  @override
  void initState() {
    super.initState();
    _loadAlerts();
  }

  Future<void> _loadAlerts() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final raw = await Api.getAlerts(
        auth.accessToken ?? '',
        deviceId: widget.device?.id,
        read: _showOnlyUnread ? false : null,
      );
      setState(() {
        _alerts = raw.cast<Map<String, dynamic>>();
      });
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
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.device != null ? '${widget.device!.name} - Alerts' : 'Alerts',
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8.0),
            child: Center(
              child: FilterChip(
                label: const Text('Unread Only'),
                selected: _showOnlyUnread,
                onSelected: (v) {
                  setState(() => _showOnlyUnread = v);
                  _loadAlerts();
                },
              ),
            ),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(child: Text('Error: $_error'))
          : _alerts.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.notifications_none,
                    size: 64,
                    color: Colors.grey.shade400,
                  ),
                  const SizedBox(height: 16),
                  const Text('No alerts'),
                ],
              ),
            )
          : ListView.builder(
              itemCount: _alerts.length,
              padding: const EdgeInsets.all(8),
              itemBuilder: (ctx, idx) {
                final alert = _alerts[idx];
                final isRead = alert['read'] ?? false;
                return Card(
                  color: isRead ? Colors.white : Colors.blue.shade50,
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: alert['type'] == 'error'
                            ? Colors.red
                            : Colors.orange,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(
                        alert['type'] == 'error' ? Icons.error : Icons.warning,
                        color: Colors.white,
                        size: 20,
                      ),
                    ),
                    title: Text(
                      alert['message'] ?? 'Alert',
                      style: TextStyle(
                        fontWeight: isRead
                            ? FontWeight.normal
                            : FontWeight.w600,
                      ),
                    ),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 4),
                        Text(
                          _formatTime(alert['timestamp']),
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey.shade600,
                          ),
                        ),
                      ],
                    ),
                    trailing: !isRead
                        ? IconButton(
                            icon: const Icon(
                              Icons.check_circle_outline,
                              color: Colors.blue,
                            ),
                            onPressed: () => _markAsRead(alert['_id']),
                          )
                        : null,
                    onTap: !isRead ? () => _markAsRead(alert['_id']) : null,
                  ),
                );
              },
            ),
      floatingActionButton: _alerts.isNotEmpty
          ? FloatingActionButton.extended(
              onPressed: _loadAlerts,
              icon: const Icon(Icons.refresh),
              label: const Text('Refresh'),
            )
          : null,
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
      if (diff.inDays < 7) return '${diff.inDays}d ago';
      return '${dt.month}/${dt.day} ${dt.hour}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return timestamp;
    }
  }
}
