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
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          brightness: Brightness.dark,
          colorScheme: ColorScheme.dark(
            primary: const Color(0xFF10B981), // Emerald Green
            secondary: const Color(0xFFD97706), // Amber
            surface: const Color(0xFF161B26), // Slate dark card background
            background: const Color(0xFF0C0F17), // Deep Dark Navy/Black
          ),
          scaffoldBackgroundColor: const Color(0xFF0C0F17),
          appBarTheme: const AppBarTheme(
            backgroundColor: Color(0xFF0C0F17),
            foregroundColor: Colors.white,
            elevation: 0,
            centerTitle: true,
            titleTextStyle: TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          cardTheme: CardThemeData(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: const BorderSide(color: Color(0xFF222938), width: 0.8),
            ),
            color: const Color(0xFF161B26),
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
            if (a.isLoggedIn) return const MainShell();
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
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: Color(0xFF10141D),
          border: Border(
            top: BorderSide(color: Color(0xFF1E2533), width: 1),
          ),
        ),
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: SafeArea(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildNavItem(0, Icons.grid_view_rounded, 'Trang chủ'),
              _buildNavItem(1, Icons.settings_outlined, 'Vận hành'),
              _buildNavItem(2, Icons.insert_chart_outlined, 'Báo cáo'),
              _buildNavItem(3, Icons.psychology_outlined, 'Trợ lý AI'),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(int index, IconData icon, String label) {
    final isSelected = _index == index;
    final activeColor = const Color(0xFF10B981);
    final inactiveColor = const Color(0xFF9EADBC);

    return InkWell(
      onTap: () => setState(() => _index = index),
      borderRadius: BorderRadius.circular(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Orange dot above the active icon
          Container(
            width: 4,
            height: 4,
            margin: const EdgeInsets.only(bottom: 4),
            decoration: BoxDecoration(
              color: isSelected ? const Color(0xFFF59E0B) : Colors.transparent,
              shape: BoxShape.circle,
            ),
          ),
          // Active icon has a rounded green background
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: isSelected
                ? const EdgeInsets.symmetric(horizontal: 16, vertical: 6)
                : const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            decoration: BoxDecoration(
              color: isSelected ? activeColor : Colors.transparent,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(
              icon,
              color: isSelected ? Colors.white : inactiveColor,
              size: 24,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              color: isSelected ? activeColor : inactiveColor,
              fontSize: 10,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ],
      ),
    );
  }
}
