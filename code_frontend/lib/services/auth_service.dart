import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api.dart';

class AuthService extends ChangeNotifier {
  String? accessToken;
  String? refreshToken;
  Map<String, dynamic>? user;

  bool get isLoggedIn => accessToken != null && accessToken!.isNotEmpty;

  Future<void> loadFromStorage() async {
    final sp = await SharedPreferences.getInstance();
    accessToken = sp.getString('accessToken');
    refreshToken = sp.getString('refreshToken');
    final u = sp.getString('user');
    if (u != null) user = jsonDecode(u);
    notifyListeners();
  }

  Future<void> saveToStorage() async {
    final sp = await SharedPreferences.getInstance();
    if (accessToken != null) await sp.setString('accessToken', accessToken!);
    if (refreshToken != null) await sp.setString('refreshToken', refreshToken!);
    if (user != null) await sp.setString('user', jsonEncode(user));
  }

  Future<bool> login(String email, String password) async {
    final res = await Api.login(email, password);
    if (res.containsKey('accessToken')) {
      accessToken = res['accessToken'] as String;
      refreshToken = res['refreshToken'] as String;
      user = res['user'] as Map<String, dynamic>?;
      await saveToStorage();
      notifyListeners();
      return true;
    }
    return false;
  }

  Future<void> logout() async {
    accessToken = null;
    refreshToken = null;
    user = null;
    final sp = await SharedPreferences.getInstance();
    await sp.remove('accessToken');
    await sp.remove('refreshToken');
    await sp.remove('user');
    notifyListeners();
  }
}
