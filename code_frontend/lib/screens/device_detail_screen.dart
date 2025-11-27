import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/device.dart';
import '../models/sensor_data.dart';
import '../providers/app_state.dart';
import 'package:intl/intl.dart';

class DeviceDetailScreen extends StatelessWidget {
  final Device device;

  const DeviceDetailScreen({super.key, required this.device});

  @override
  Widget build(BuildContext context) {
    final appState = Provider.of<AppState>(context, listen: false);

    return Scaffold(
      appBar: AppBar(
        title: Text(device.name),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16.0),
        children: [
          _buildStatusCard(device),
          const SizedBox(height: 20),
          _buildControlPanel(context, appState, device),
          const SizedBox(height: 20),
          _buildSensorData(appState, device.id),
        ],
      ),
    );
  }

  Widget _buildStatusCard(Device device) {
    return Card(
      elevation: 4,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Device ID: ${device.id}',
                style: const TextStyle(fontWeight: FontWeight.bold)),
            Text('Location: ${device.location}'),
            Row(
              children: [
                const Text('Status: '),
                Text(
                  device.status.toUpperCase(),
                  style: TextStyle(
                    color: device.status == 'online' ? Colors.green : Colors
                        .red,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildControlPanel(BuildContext context, AppState appState,
      Device device) {
    return Card(
      elevation: 4,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Manual Control',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const Divider(),
            _buildControlRow(context, appState, device, 'Fan', 'fan'),
            _buildControlRow(context, appState, device, 'Light', 'light'),
            _buildControlRow(context, appState, device, 'Pump', 'pump'),
          ],
        ),
      ),
    );
  }

  Widget _buildControlRow(BuildContext context, AppState appState,
      Device device, String label, String target) {
    void sendCommand(String action) async {
      try {
        await appState.apiService.sendCommand(device.id, target, action);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$label turned $action')),
        );
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    }


    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
            ),
          ),
          Row(
            children: [
              ElevatedButton.icon(
                icon: const Icon(Icons.power_settings_new, size: 18),
                label: const Text('ON'),
                onPressed: () => sendCommand('ON'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.green.shade600,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8)),
                  elevation: 2,
                ),
              ),
              const SizedBox(width: 10),
              ElevatedButton.icon(
                icon: const Icon(Icons.power_off, size: 18),
                label: const Text('OFF'),
                onPressed: () => sendCommand('OFF'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red.shade600,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8)),
                  elevation: 2,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSensorData(AppState appState, String deviceId) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Recent Sensor Data', style: TextStyle(
            fontSize: 18, fontWeight: FontWeight.bold, color: Colors.green)),
        const Divider(color: Colors.green, thickness: 1.5),
        FutureBuilder<List<SensorData>>(
          future: appState.apiService.fetchSensorData(deviceId),
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            } else if (snapshot.hasError) {
              return Center(child: Text('Error: ${snapshot.error}'));
            } else if (!snapshot.hasData || snapshot.data!.isEmpty) {
              return const Text('No sensor data available.');
            }
            final data = snapshot.data!.first;

            return Card(
              elevation: 4,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Last update: ${DateFormat('HH:mm:ss dd/MM/yyyy').format(
                          data.timestamp.toLocal())}',
                      style: const TextStyle(fontSize: 14, color: Colors.grey),
                    ),
                    const Divider(),
                    // Sử dụng Row thay vì ListTile để kiểm soát layout tốt hơn
                    _sensorDataItem(
                      icon: Icons.thermostat_outlined,
                      label: 'Temperature',
                      value: '${data.temperature?.toStringAsFixed(1) ??
                          '--'} °C',
                      color: Colors.orange,
                    ),
                    _sensorDataItem(
                      icon: Icons.water_drop,
                      label: 'Humidity',
                      value: '${data.humidity?.toStringAsFixed(1) ?? '--'} %',
                      color: Colors.blue,
                    ),
                    _sensorDataItem(
                      icon: Icons.eco,
                      label: 'Soil Moisture',
                      value: '${data.soilMoisture?.toStringAsFixed(1) ??
                          '--'} %',
                      color: Colors.brown,
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _sensorDataItem(
      {required IconData icon, required String label, required String value, required Color color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        children: [
          Icon(icon, color: color, size: 28),
          const SizedBox(width: 15),
          Expanded(child: Text(label, style: const TextStyle(fontSize: 16))),
          Text(value, style: const TextStyle(
              fontSize: 16, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}
