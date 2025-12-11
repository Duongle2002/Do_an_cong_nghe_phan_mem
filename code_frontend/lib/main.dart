import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'services/auth_service.dart';
import 'services/notification_service.dart';
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

  // Initialize notifications
  await NotificationService().initialize();

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
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFF558B2F), // primary moss green
            primary: const Color(0xFF558B2F),
            secondary: const Color(0xFFFF7043), // CTA burnt orange
            background: const Color(0xFFFFF8E1),
            surface: const Color(0xFFECEFF1),
            onPrimary: const Color(0xFFFFFFFF),
            onSurface: const Color(0xFF4E342E),
          ),
          scaffoldBackgroundColor: const Color(0xFFFFF8E1),
          appBarTheme: const AppBarTheme(
            backgroundColor: Color(0xFFECEFF1),
            foregroundColor: Color(0xFF4E342E),
            elevation: 0,
            centerTitle: false,
          ),
          elevatedButtonTheme: ElevatedButtonThemeData(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF558B2F),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),
          floatingActionButtonTheme: const FloatingActionButtonThemeData(
            backgroundColor: Color(0xFF558B2F),
          ),
          bottomNavigationBarTheme: const BottomNavigationBarThemeData(
            selectedItemColor: Color(0xFF558B2F),
            unselectedItemColor: Color(0xFF7b6a63),
            backgroundColor: Color(0xFFFFF8E1),
          ),
        ),
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
