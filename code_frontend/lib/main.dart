import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'services/auth_service.dart';
import 'screens/login_page.dart';
import 'screens/devices_page.dart';
import 'screens/home_overview.dart';
import 'screens/schedules_page.dart';
import 'screens/info_page.dart';
import 'screens/register_page.dart';
import 'screens/alerts_page.dart';
import 'screens/sensor_upload_page.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final auth = AuthService();
  await auth.loadFromStorage();
  runApp(MyApp(auth: auth));
}

class MyApp extends StatelessWidget {
  final AuthService auth;
  const MyApp({super.key, required this.auth});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: auth,
      child: MaterialApp(
        title: 'Smart Farm',
        theme: ThemeData(primarySwatch: Colors.green),
        routes: {
          '/devices': (_) => const DevicesPage(),
          '/schedules': (_) => const SchedulesPage(),
          '/register': (_) => const RegisterPage(),
          '/alerts': (_) => const AlertsPage(),
          '/send-sensor': (_) => const SensorUploadPage(),
        },
        home: Consumer<AuthService>(
          builder: (ctx, a, _) {
            if (a.isLoggedIn) return MainShell();
            return const LoginPage();
          },
        ),
      ),
    );
  }
}

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _index = 0;
  static const _pages = [
    HomeOverviewPage(),
    DevicesPage(),
    SchedulesPage(),
    InfoPage(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _pages[_index],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _index,
        type: BottomNavigationBarType.fixed,
        onTap: (v) => setState(() => _index = v),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.devices), label: 'Devices'),
          BottomNavigationBarItem(
            icon: Icon(Icons.schedule),
            label: 'Schedules',
          ),
          BottomNavigationBarItem(icon: Icon(Icons.info), label: 'Info'),
        ],
      ),
    );
  }
}
