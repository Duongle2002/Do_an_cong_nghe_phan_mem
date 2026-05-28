#pragma once

#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>

class WifiConfigPortal {
public:
  WifiConfigPortal(const char* storageNamespace,
                   const char* apSsid,
                   const char* apPassword,
                   const char* deviceName)
      : _storageNamespace(storageNamespace),
        _apSsid(apSsid),
        _apPassword(apPassword),
        _deviceName(deviceName),
        _dnsServer(),
        _server(80) {}

  void begin() {
    load();
    tryConnectStored();
    if (WiFi.status() == WL_CONNECTED) return;
    startPortal();
  }

  void process() {
    if (_portalActive) {
      _dnsServer.processNextRequest();
      _server.handleClient();
    }
  }

  bool connected() const {
    return WiFi.status() == WL_CONNECTED;
  }

  String ssid() const {
    return _ssid;
  }

  String password() const {
    return _password;
  }

  String ip() const {
    return WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : WiFi.softAPIP().toString();
  }

private:
  const char* _storageNamespace;
  const char* _apSsid;
  const char* _apPassword;
  const char* _deviceName;
  DNSServer _dnsServer;
  WebServer _server;
  Preferences _prefs;
  String _ssid;
  String _password;
  bool _portalActive = false;

  static String htmlEscape(const String& input) {
    String out = input;
    out.replace("&", "&amp;");
    out.replace("<", "&lt;");
    out.replace(">", "&gt;");
    out.replace("\"", "&quot;");
    out.replace("'", "&#39;");
    return out;
  }

  String renderNetworkOptions() {
    String options;
    int count = WiFi.scanNetworks(false, true);
    if (count <= 0) {
      options += "<option value=''>Khong tim thay WiFi (bam Quet lai)</option>";
      return options;
    }

    const int maxItems = count > 20 ? 20 : count;
    for (int i = 0; i < maxItems; i++) {
      String ssid = WiFi.SSID(i);
      if (ssid.isEmpty()) continue;

      String escaped = htmlEscape(ssid);
      int rssi = WiFi.RSSI(i);
      bool encrypted = WiFi.encryptionType(i) != WIFI_AUTH_OPEN;

      options += "<option value='" + escaped + "'";
      if (ssid == _ssid) options += " selected";
      options += ">";
      options += escaped + " (" + String(rssi) + " dBm";
      options += encrypted ? ", khoa" : ", mo";
      options += ")</option>";
    }

    if (options.isEmpty()) {
      options += "<option value=''>Khong tim thay WiFi (bam Quet lai)</option>";
    }
    return options;
  }

  void load() {
    _prefs.begin(_storageNamespace, true);
    _ssid = _prefs.getString("wifi_ssid", "");
    _password = _prefs.getString("wifi_pass", "");
    _prefs.end();
  }

  void save(const String& ssid, const String& password) {
    _prefs.begin(_storageNamespace, false);
    _prefs.putString("wifi_ssid", ssid);
    _prefs.putString("wifi_pass", password);
    _prefs.end();
    _ssid = ssid;
    _password = password;
  }

  void tryConnectStored() {
    if (_ssid.isEmpty()) {
      Serial.println("[WifiConfigPortal] Khong co thong tin WiFi duoc luu.");
      return;
    }
    Serial.printf("[WifiConfigPortal] Dang thu ket noi toi WiFi luu san: \"%s\"...\n", _ssid.c_str());
    
    // Reset hoan toan vi mach WiFi
    WiFi.disconnect(true);
    WiFi.mode(WIFI_OFF);
    delay(200);
    
    // Khoi chay che do STA va cho driver khoi dong xong
    WiFi.mode(WIFI_STA);
    delay(500); // Cho driver WiFi khoi dong on dinh
    
    WiFi.begin(_ssid.c_str(), _password.c_str());
    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 30000UL) {
      delay(1000);
      wl_status_t stat = WiFi.status();
      Serial.print("[WiFi] Status: ");
      switch(stat) {
        case WL_IDLE_STATUS: Serial.println("IDLE_STATUS (Dang chuan bi...)"); break;
        case WL_NO_SSID_AVAIL: Serial.println("NO_SSID_AVAIL (Khong thay SSID)"); break;
        case WL_SCAN_COMPLETED: Serial.println("SCAN_COMPLETED"); break;
        case WL_CONNECTED: Serial.println("CONNECTED (Da ket noi)"); break;
        case WL_CONNECT_FAILED: Serial.println("CONNECT_FAILED (Sai mat khau hoac loi bao mat)"); break;
        case WL_CONNECTION_LOST: Serial.println("CONNECTION_LOST (Mat ket noi)"); break;
        case WL_DISCONNECTED: Serial.println("DISCONNECTED (Chua ket noi/Dang doi IP...)"); break;
        default: Serial.println(stat); break;
      }
    }
    Serial.println();
    if (WiFi.status() == WL_CONNECTED) {
      Serial.printf("[WifiConfigPortal] Ket noi WiFi THANH CONG! IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
      Serial.println("[WifiConfigPortal] Ket noi WiFi THAT BAI (Timeout 30s). Chuyen sang phat AP de cau hinh.");
    }
  }

  void startPortal() {
    WiFi.mode(WIFI_AP_STA);
    WiFi.softAP(_apSsid, _apPassword);
    delay(200);
    IPAddress apIP = WiFi.softAPIP();
    _dnsServer.start(53, "*", apIP);

    _server.on("/", HTTP_GET, [this]() {
      String options = renderNetworkOptions();
      String html;
      html += "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>";
      html += "<style>body{font-family:Arial,sans-serif;max-width:420px;margin:40px auto;padding:16px}input,select,button,a.btn{width:100%;padding:12px;margin:8px 0;font-size:16px;box-sizing:border-box}a.btn{text-decoration:none;display:block;text-align:center;background:#efefef;color:#111;border:1px solid #ccc}small{color:#666}p.meta{background:#f8f8f8;padding:8px;border:1px solid #eee}</style>";
      html += "</head><body>";
      html += "<h2>" + String(_deviceName) + " WiFi setup</h2>";
      // show currently saved network (if any) with auto-scroll when long
      if (!_ssid.isEmpty()) {
        html += "<p class='meta'><strong>Mang da luu:</strong> <span class='marquee'><span id='saved_ssid'>" + htmlEscape(_ssid) + "</span></span>";
        if (_password.isEmpty()) html += " <small>(khong co mat khau)</small>";
        html += "</p>";
      } else {
        html += "<p class='meta'><strong>Chua luu mang nao</strong></p>";
      }
      html += "<form method='POST' action='/save'>";
      html += "<label>Danh sach WiFi</label>";
      html += "<select id='ssid_select'>" + options + "</select>";
      html += "<a class='btn' href='/'>Quet lai WiFi</a>";
      html += "<input id='ssid_input' name='ssid' placeholder='WiFi SSID (hoac nhap tay)' value='" + htmlEscape(_ssid) + "' required>";
      html += "<input name='pass' placeholder='WiFi password' type='password' value='" + _password + "'>";
      html += "<button type='submit'>Save and connect</button>";
      html += "</form><small>Saved credentials are stored in NVS and reused after reboot.</small>";
      html += "<p style='margin-top:12px'><a class='btn' href='/reset'>Cai lai / Reconfigure WiFi</a></p>";
      html += "<script>const s=document.getElementById('ssid_select');const i=document.getElementById('ssid_input');if(s&&i){s.addEventListener('change',()=>{if(s.value)i.value=s.value;});if(s.value&&!i.value)i.value=s.value;}";
      html += "(function(){var cont=document.querySelector('.marquee');if(!cont) return;var inner=document.getElementById('saved_ssid');if(!inner) return;setTimeout(function(){if(inner.scrollWidth>cont.clientWidth){inner.style.display='inline-block';inner.style.paddingLeft='10px';inner.style.animation='marquee 8s linear infinite';}},200);})();";
      html += "</script>";
      html += "<style>@keyframes marquee{0%{transform:translateX(0%)}100%{transform:translateX(-100%)}}</style>";
      html += "</body></html>";
      _server.send(200, "text/html; charset=utf-8", html);
    });

    _server.on("/save", HTTP_POST, [this]() {
      String ssid = _server.arg("ssid");
      String password = _server.arg("pass");
      ssid.trim();
      password.trim();
      if (ssid.isEmpty()) {
        _server.send(400, "text/plain", "SSID is required");
        return;
      }
      Serial.printf("[WifiConfigPortal] Da nhan cau hinh WiFi tu web portal: SSID=\"%s\"\n", ssid.c_str());
      save(ssid, password);
      _server.send(200, "text/html; charset=utf-8", "<html><body><h3>Da luu thong tin! ESP32-S3 se khoi dong lai de ket noi vao WiFi.</h3><p>Ban co the dong trang nay.</p></body></html>");
      delay(1000);
      Serial.println("[WifiConfigPortal] Dang khoi dong lai thiet bi...");
      ESP.restart();
    });

    _server.on("/reset", HTTP_GET, [this]() {
      save("", "");
      String html = "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head><body>";
      html += "<h3>Da xoa thong tin WiFi.</h3><p>Thiet bi se khoi dong lai de bat dau cai dat WiFi.</p>";
      html += "<p>You may close this page.</p></body></html>";
      _server.send(200, "text/html; charset=utf-8", html);
      delay(800);
      ESP.restart();
    });

    _server.onNotFound([this]() {
      _server.sendHeader("Location", "/", true);
      _server.send(302, "text/plain", "");
    });

    _server.begin();
    _portalActive = true;
    Serial.printf("WiFi portal active at http://%s\n", apIP.toString().c_str());
    Serial.printf("AP SSID: %s\n", _apSsid);
  }
};
