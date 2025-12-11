import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/api.dart';
import '../models/device.dart';

class AlertSettingsPage extends StatefulWidget {
  final Device device;
  const AlertSettingsPage({super.key, required this.device});

  @override
  State<AlertSettingsPage> createState() => _AlertSettingsPageState();
}

class _AlertSettingsPageState extends State<AlertSettingsPage> {
  late List<Map<String, dynamic>> _rules = [];
  bool _loading = true;
  String? _error;

  final List<String> _metrics = [
    'temperature',
    'humidity',
    'soilMoisture',
    'lux',
  ];
  final Map<String, String> _metricLabels = {
    'temperature': 'Temperature (°C)',
    'humidity': 'Humidity (%)',
    'soilMoisture': 'Soil Moisture',
    'lux': 'Lux',
  };

  @override
  void initState() {
    super.initState();
    _loadRules();
  }

  Future<void> _loadRules() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final raw = await Api.getAlertRules(
        auth.accessToken ?? '',
        deviceId: widget.device.id,
      );
      setState(() {
        _rules = raw.cast<Map<String, dynamic>>();
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showAddRuleDialog() {
    String? selectedMetric;
    double? minThreshold;
    double? maxThreshold;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setState) => AlertDialog(
            title: const Text('Add Alert Rule'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButton<String>(
                    isExpanded: true,
                    value: selectedMetric,
                    hint: const Text('Select Metric'),
                    items: _metrics
                        .map(
                          (m) => DropdownMenuItem(
                            value: m,
                            child: Text(_metricLabels[m] ?? m),
                          ),
                        )
                        .toList(),
                    onChanged: (v) => setState(() => selectedMetric = v),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    decoration: const InputDecoration(
                      labelText: 'Min Threshold (optional)',
                      border: OutlineInputBorder(),
                    ),
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    onChanged: (v) => minThreshold = double.tryParse(v),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    decoration: const InputDecoration(
                      labelText: 'Max Threshold (optional)',
                      border: OutlineInputBorder(),
                    ),
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    onChanged: (v) => maxThreshold = double.tryParse(v),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                onPressed: selectedMetric == null
                    ? null
                    : () async {
                        Navigator.pop(ctx);
                        await _createRule(
                          selectedMetric!,
                          minThreshold,
                          maxThreshold,
                        );
                      },
                child: const Text('Add'),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _createRule(
    String metric,
    double? minThreshold,
    double? maxThreshold,
  ) async {
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      await Api.createAlertRule(auth.accessToken ?? '', {
        'deviceId': widget.device.id,
        'metric': metric,
        'minThreshold': minThreshold,
        'maxThreshold': maxThreshold,
        'enabled': true,
      });
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Rule added')));
        _loadRules();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  Future<void> _updateRule(String ruleId, Map<String, dynamic> updates) async {
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      await Api.updateAlertRule(auth.accessToken ?? '', ruleId, updates);
      if (mounted) _loadRules();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  void _showEditCooldownDialog(Map<String, dynamic> rule) {
    int cooldown = rule['cooldownMinutes'] ?? 5;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setState) => AlertDialog(
            title: const Text('Edit Cooldown'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Current: $cooldown minute(s)'),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    for (final val in [1, 5, 10, 30, 60])
                      ElevatedButton(
                        onPressed: () => setState(() => cooldown = val),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: cooldown == val
                              ? Colors.blue
                              : Colors.grey,
                        ),
                        child: Text('$val\''),
                      ),
                  ],
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  _updateRule(rule['_id'], {'cooldownMinutes': cooldown});
                },
                child: const Text('Save'),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _deleteRule(String ruleId) async {
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      await Api.deleteAlertRule(auth.accessToken ?? '', ruleId);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Rule deleted')));
        _loadRules();
      }
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
      appBar: AppBar(title: Text('${widget.device.name} - Alert Rules')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(child: Text('Error: $_error'))
          : _rules.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text('No alert rules yet'),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: _showAddRuleDialog,
                    icon: const Icon(Icons.add),
                    label: const Text('Add Rule'),
                  ),
                ],
              ),
            )
          : ListView.builder(
              itemCount: _rules.length,
              padding: const EdgeInsets.all(12),
              itemBuilder: (ctx, idx) {
                final rule = _rules[idx];
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ExpansionTile(
                    title: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _metricLabels[rule['metric']] ?? rule['metric'],
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Min: ${rule['minThreshold'] ?? '—'} | Max: ${rule['maxThreshold'] ?? '—'}',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: Colors.grey,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Switch(
                          value: rule['enabled'] ?? true,
                          onChanged: (v) {
                            _updateRule(rule['_id'], {'enabled': v});
                          },
                        ),
                      ],
                    ),
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 8,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Notification: ${rule['notificationType'] ?? 'app'}',
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Cooldown: ${rule['cooldownMinutes'] ?? 5} min',
                            ),
                            const SizedBox(height: 12),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                              children: [
                                ElevatedButton.icon(
                                  onPressed: () =>
                                      _showEditCooldownDialog(rule),
                                  icon: const Icon(Icons.schedule, size: 16),
                                  label: const Text('Cooldown'),
                                ),
                                ElevatedButton.icon(
                                  onPressed: () => _deleteRule(rule['_id']),
                                  icon: const Icon(Icons.delete, size: 16),
                                  label: const Text('Delete'),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.red,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showAddRuleDialog,
        child: const Icon(Icons.add),
      ),
    );
  }
}
