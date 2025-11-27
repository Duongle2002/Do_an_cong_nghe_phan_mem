import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/schedule.dart';
import '../providers/app_state.dart';
import '../screens/schedule_form_screen.dart';
import 'package:intl/intl.dart';

class ScheduleListScreen extends StatelessWidget {
  const ScheduleListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = Provider.of<AppState>(context, listen: false);

    return Scaffold(
      body: FutureBuilder<List<Schedule>>(
        future: appState.apiService.fetchSchedules(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          } else if (snapshot.hasError) {
            return Center(child: Text('Error: ${snapshot.error}'));
          } else if (!snapshot.hasData || snapshot.data!.isEmpty) {
            return const Center(child: Text('No schedules found.'));
          }

          final schedules = snapshot.data!;
          return RefreshIndicator(
            onRefresh: () async {
              (context as Element).reassemble();
            },
            child: ListView.builder(
              padding: const EdgeInsets.all(8.0),
              itemCount: schedules.length,
              itemBuilder: (context, index) {
                final s = schedules[index];
                final isActive = s.active;
                final actionColor = s.action == 'ON' ? Colors.green.shade600 : Colors.red.shade600;

                return Card(
                  margin: const EdgeInsets.symmetric(vertical: 8.0, horizontal: 4.0),
                  elevation: 4,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  child: ListTile(
                    leading: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: isActive ? Colors.green.shade100 : Colors.grey.shade200,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(
                        isActive ? Icons.schedule_outlined : Icons.schedule_send,
                        color: isActive ? Colors.green.shade700 : Colors.grey.shade500,
                      ),
                    ),
                    title: Text(
                      '${s.target.toUpperCase()} - ${s.action}',
                      style: TextStyle(fontWeight: FontWeight.bold, color: actionColor),
                    ),
                    subtitle: Text(
                      '${s.repeat.toUpperCase()} at ${DateFormat('HH:mm').format(s.time.toLocal())}',
                    ),
                    trailing: IconButton(
                      icon: const Icon(Icons.delete, color: Colors.red),
                      onPressed: () => _deleteSchedule(context, appState, s.id),
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: Colors.green,
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const ScheduleFormScreen()),
          ).then((_) => (context as Element).reassemble());
        },
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  void _deleteSchedule(BuildContext context, AppState appState, String id) async {
    try {
      await appState.apiService.deleteSchedule(id);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Schedule deleted successfully!')),
      );
      (context as Element).reassemble();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to delete: $e')),
      );
    }
  }
}