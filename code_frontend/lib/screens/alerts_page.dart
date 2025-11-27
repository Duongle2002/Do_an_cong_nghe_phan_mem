import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api.dart';
import '../services/auth_service.dart';

class AlertsPage extends StatefulWidget {
  const AlertsPage({super.key});

  @override
  State<AlertsPage> createState() => _AlertsPageState();
}

class _AlertsPageState extends State<AlertsPage> {
  bool _loading = true;
  List<dynamic> _alerts = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final list = await Api.getAlerts(auth.accessToken ?? '');
      setState(() { _alerts = list; });
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      setState(() { _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Alerts')),
      body: _loading ? const Center(child: CircularProgressIndicator()) : _error != null ? Center(child: Text('Error: $_error')) : _alerts.isEmpty ? const Center(child: Text('No alerts')) : ListView.separated(
        itemCount: _alerts.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (ctx, i) {
          final a = _alerts[i] as Map<String, dynamic>;
          final ts = a['timestamp'] ?? '';
          return ListTile(
            title: Text(a['message'] ?? ''),
            subtitle: Text('${a['type'] ?? ''} · ${a['deviceId'] ?? ''} · $ts'),
          );
        },
      ),
    );
  }
}
