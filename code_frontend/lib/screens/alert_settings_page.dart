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

class _AlertSettingsPageState extends State<AlertSettingsPage> with SingleTickerProviderStateMixin {
  late List<Map<String, dynamic>> _rules = [];
  bool _loading = true;
  String? _error;

  late AnimationController _listController;

  final List<String> _metrics = ['temperature', 'humidity', 'soilMoisture', 'lux'];
  final Map<String, String> _metricLabels = {
    'temperature': 'Temperature (°C)',
    'humidity': 'Humidity (%)',
    'soilMoisture': 'Soil Moisture',
    'lux': 'Lux',
  };

  @override
  void initState() {
    super.initState();
    _listController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _loadRules();
  }

  @override
  void dispose() {
    _listController.dispose();
    super.dispose();
  }

  Future<void> _loadRules() async {
    setState(() { _loading = true; _error = null; });
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final raw = await Api.getAlertRules(auth.accessToken ?? '', deviceId: widget.device.id);
      setState(() => _rules = raw.cast<Map<String, dynamic>>());
      _listController.forward(from: 0);
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
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: const Text('Add Alert Rule', style: TextStyle(fontWeight: FontWeight.bold)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  decoration: InputDecoration(labelText: 'Metric', border: OutlineInputBorder(borderRadius: BorderRadius.circular(12))),
                  value: selectedMetric,
                  items: _metrics.map((m) => DropdownMenuItem(value: m, child: Text(_metricLabels[m] ?? m))).toList(),
                  onChanged: (v) => setState(() => selectedMetric = v),
                ),
                const SizedBox(height: 15),
                TextField(
                  decoration: InputDecoration(labelText: 'Min Threshold', border: OutlineInputBorder(borderRadius: BorderRadius.circular(12))),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  onChanged: (v) => minThreshold = double.tryParse(v),
                ),
                const SizedBox(height: 15),
                TextField(
                  decoration: InputDecoration(labelText: 'Max Threshold', border: OutlineInputBorder(borderRadius: BorderRadius.circular(12))),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  onChanged: (v) => maxThreshold = double.tryParse(v),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2E7D32), foregroundColor: Colors.white),
              onPressed: selectedMetric == null ? null : () async {
                Navigator.pop(ctx);
                await _createRule(selectedMetric!, minThreshold, maxThreshold);
              },
              child: const Text('Add Rule'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _createRule(String metric, double? minThreshold, double? maxThreshold) async {
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      await Api.createAlertRule(auth.accessToken ?? '', {
        'deviceId': widget.device.id,
        'metric': metric,
        'minThreshold': minThreshold,
        'maxThreshold': maxThreshold,
        'enabled': true,
      });
      _loadRules();
    } catch (_) {}
  }

  Future<void> _updateRule(String ruleId, Map<String, dynamic> updates) async {
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      await Api.updateAlertRule(auth.accessToken ?? '', ruleId, updates);
      _loadRules();
    } catch (_) {}
  }

  Future<void> _deleteRule(String ruleId) async {
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      await Api.deleteAlertRule(auth.accessToken ?? '', ruleId);
      _loadRules();
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F7F2),
      appBar: AppBar(
        title: Text('${widget.device.name} Rules', style: const TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(child: Text('Error: $_error'))
          : _rules.isEmpty
          ? _buildEmptyState()
          : ListView.builder(
              itemCount: _rules.length,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              itemBuilder: (ctx, idx) {
                final rule = _rules[idx];
                return AnimatedBuilder(
                  animation: _listController,
                  builder: (context, child) {
                    final animation = CurvedAnimation(
                      parent: _listController,
                      curve: Interval((idx / (_rules.length > 10 ? 10 : _rules.length)) * 0.5, 1.0, curve: Curves.easeOut),
                    );
                    return Opacity(opacity: animation.value, child: Transform.translate(offset: Offset(0, 20 * (1 - animation.value)), child: child));
                  },
                  child: _buildRuleCard(rule),
                );
              },
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddRuleDialog,
        label: const Text('Add Rule'),
        icon: const Icon(Icons.add_alert_outlined),
        backgroundColor: const Color(0xFF2E7D32),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.rule_outlined, size: 80, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          const Text('No alert rules set for this device', style: TextStyle(color: Colors.grey, fontSize: 16)),
          const SizedBox(height: 20),
          ElevatedButton(onPressed: _showAddRuleDialog, child: const Text('Set First Rule')),
        ],
      ),
    );
  }

  Widget _buildRuleCard(Map<String, dynamic> rule) {
    final metric = rule['metric'] ?? '';
    final label = _metricLabels[metric] ?? metric;
    final enabled = rule['enabled'] == true;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        title: Text(label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        subtitle: Text('Min: ${rule['minThreshold'] ?? '—'} | Max: ${rule['maxThreshold'] ?? '—'}', style: const TextStyle(fontSize: 11, color: Colors.grey)),
        trailing: Switch.adaptive(value: enabled, activeColor: Colors.green, onChanged: (v) => _updateRule(rule['_id'], {'enabled': v})),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton.icon(onPressed: () => _deleteRule(rule['_id']), icon: const Icon(Icons.delete_outline, size: 18, color: Colors.redAccent), label: const Text('Delete', style: TextStyle(color: Colors.redAccent))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
