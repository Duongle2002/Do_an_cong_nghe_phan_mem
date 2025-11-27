import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'dart:convert';
import '../services/auth_service.dart';
import '../services/api.dart';

class SchedulesPage extends StatefulWidget {
  const SchedulesPage({super.key});

  @override
  State<SchedulesPage> createState() => _SchedulesPageState();
}

class _SchedulesPageState extends State<SchedulesPage> {
  List<dynamic> _schedules = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final resp = await Api.get('/api/schedules', token: auth.accessToken);
      if (resp.statusCode == 200) {
        setState(
          () => _schedules = (resp.body.isNotEmpty)
              ? (List.from(jsonDecode(resp.body) as List))
              : [],
        );
      } else {
        setState(() => _schedules = []);
      }
    } catch (e) {
      setState(() => _schedules = []);
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Schedules')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _schedules.isEmpty
          ? const Center(child: Text('No schedules'))
          : ListView.separated(
              itemCount: _schedules.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (ctx, i) {
                final s = _schedules[i] as Map<String, dynamic>;
                return ListTile(
                  title: Text(s['name'] ?? 'Schedule'),
                  subtitle: Text(
                    'Device: ${s['deviceId'] ?? '—'} · ${s['cron'] ?? ''}',
                  ),
                );
              },
            ),
    );
  }
}
