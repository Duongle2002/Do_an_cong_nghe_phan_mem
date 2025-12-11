import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';

class InfoPage extends StatelessWidget {
  const InfoPage({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthService>(context);
    final user = auth.user ?? {};
    return Scaffold(
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Account', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            ListTile(
              title: Text(user['name'] ?? '—'),
              subtitle: Text(user['email'] ?? '—'),
              leading: const Icon(Icons.person),
            ),
            const SizedBox(height: 12),
            const Text('App', style: TextStyle(fontWeight: FontWeight.bold)),
            ListTile(
              leading: const Icon(Icons.info_outline),
              title: const Text('Version'),
              subtitle: const Text('1.0.0'),
            ),
            const SizedBox(height: 12),
            LayoutBuilder(
              builder: (ctx, constraints) {
                // If width is small, stack buttons vertically to avoid overflow.
                final narrow = constraints.maxWidth < 420;
                final children = <Widget>[
                  ElevatedButton.icon(
                    onPressed: () => Navigator.of(context).pushNamed('/alerts'),
                    icon: const Icon(Icons.warning),
                    label: const Text('Alerts'),
                  ),
                  ElevatedButton.icon(
                    onPressed: () =>
                        Navigator.of(context).pushNamed('/send-sensor'),
                    icon: const Icon(Icons.upload),
                    label: const Text('Send Sensor Data'),
                  ),
                  ElevatedButton.icon(
                    onPressed: () => auth.logout(),
                    icon: const Icon(Icons.logout),
                    label: const Text('Logout'),
                  ),
                ];
                if (narrow) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: children
                        .map(
                          (w) => Padding(
                            padding: const EdgeInsets.only(bottom: 8.0),
                            child: w,
                          ),
                        )
                        .toList(),
                  );
                } else {
                  return Row(
                    children: [
                      children[0],
                      const SizedBox(width: 8),
                      children[1],
                      const Spacer(),
                      children[2],
                    ],
                  );
                }
              },
            ),
          ],
        ),
      ),
    );
  }
}
