import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/device.dart';
import '../providers/app_state.dart';
import '../screens/device_detail_screen.dart';

class DeviceListScreen extends StatelessWidget {
  const DeviceListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = Provider.of<AppState>(context, listen: false);
    return FutureBuilder<List<Device>>(
      future: appState.apiService.fetchDevices(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        } else if (snapshot.hasError) {
          return Center(child: Text('Error: ${snapshot.error}'));
        } else if (!snapshot.hasData || snapshot.data!.isEmpty) {
          return const Center(child: Text('No devices found.'));
        }
        final devices = snapshot.data!;
        return RefreshIndicator(
          color: Colors.green,
          onRefresh: () async {
            (context as Element).reassemble();
          },
          child: ListView.builder(
            padding: const EdgeInsets.all(8.0),
            itemCount: devices.length,
            itemBuilder: (context, index) {
              final device = devices[index];
              final isOnline = device.status == 'online';
        return Card(
            margin: const EdgeInsets.symmetric(vertical: 8.0, horizontal: 4.0),
            elevation: 4,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: ListTile(
              contentPadding: const EdgeInsets.all(12),
              leading: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                    color: isOnline ? Colors.green.shade100 : Colors.red.shade100,
                    borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                isOnline ? Icons.wifi : Icons.wifi_off,
                color: isOnline ? Colors.green.shade700 : Colors.red.shade700,
                ),
              ),
                title: Text(
                device.name,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
                subtitle: Text(device.location.isNotEmpty ? device.location : 'Unspecified Location'),
                trailing: Icon(
                  Icons.arrow_forward_ios,
                  color: Colors.grey.shade400,
                  size: 16,
                ),
            onTap: () {
            Navigator.push(
            context,
            MaterialPageRoute(
            builder: (context) => DeviceDetailScreen(device: device),
        ),
        );
        },
        ),
        );
            },
          ),
        );
      },
    );
  }
}