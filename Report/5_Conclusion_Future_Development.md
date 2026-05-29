# CHƯƠNG 5: KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN

---

## 5.1. Những kết quả đã đạt được

Sau quá trình nghiên cứu, thiết kế, triển khai và kiểm thử toàn diện, đồ án **"Hệ thống giám sát tưới tiêu thông minh"** đã hoàn thành được các mục tiêu đề ra ban đầu và đạt được những kết quả đáng ghi nhận trên cả ba phương diện: phần cứng nhúng, phần mềm đa nền tảng và trí tuệ nhân tạo biên.

### 5.1.1. Hoàn thiện hệ thống phần cứng IoT hoạt động ổn định

Hệ thống đã xây dựng thành công kiến trúc phần cứng hai lớp (Two-tier Hardware Architecture) với sự phân tách rõ ràng giữa chức năng cảm biến và chức năng chấp hành:

- **Node cảm biến ESP32-WROOM:** Đảm nhiệm vai trò thu thập dữ liệu môi trường từ bốn loại cảm biến vật lý — nhiệt độ không khí, độ ẩm không khí (cảm biến AHT20 giao tiếp I2C), cường độ ánh sáng (cảm biến BH1750 giao tiếp I2C) và độ ẩm đất (cảm biến điện trở đọc qua ADC 12-bit). Dữ liệu được đọc theo chu kỳ 5 giây, chuẩn hóa Min-Max về miền [0, 1] và đưa vào mô hình TinyML để suy luận tại chỗ trước khi truyền về máy chủ qua giao thức MQTT với chu kỳ 10 giây.

- **Node chấp hành ESP32-S3:** Tiếp nhận quyết định điều khiển từ node cảm biến (thông qua MQTT topic `farm/<deviceId>/state`) hoặc lệnh thủ công từ máy chủ (thông qua MQTT topic `farm/<deviceId>/control/<target>`) để đóng/ngắt các relay vật lý điều khiển quạt thông gió, đèn chiếu sáng và máy bơm nước. Bo mạch ESP32-S3 tích hợp màn hình OLED hiển thị trạng thái hoạt động trực quan tại hiện trường, giúp kỹ thuật viên vận hành có thể kiểm tra nhanh mà không cần truy cập phần mềm quản lý.

- **Cơ chế dự phòng khi mất kết nối (Fallback Mode):** Khi mạng Wi-Fi bị gián đoạn, node cảm biến WROOM tự động chuyển sang chế độ dự phòng cục bộ: mô hình TinyML tiếp tục hoạt động và đưa ra quyết định tại chỗ; dữ liệu telemetry được truyền trực tiếp từ WROOM sang S3 thông qua kết nối TCP nội bộ không phụ thuộc Internet, đảm bảo hệ thống tưới tiêu không bị gián đoạn ngay cả trong điều kiện hạ tầng mạng không ổn định.

- **Portal cấu hình Wi-Fi qua giao diện Web (Captive Portal):** Cả hai bo mạch đều tích hợp cơ chế cấu hình Wi-Fi không cần nạp lại firmware — khi chưa có thông tin mạng hoặc khi người dùng nhấn giữ nút cứng Reset Wi-Fi trong 6 giây, thiết bị tự động phát một mạng Access Point (AP) riêng biệt kèm giao diện Web nhập SSID/Password, sau đó lưu vào bộ nhớ NVS (Non-Volatile Storage) của ESP32.

### 5.1.2. Phát triển thành công nền tảng phần mềm đa lớp

Hệ thống đã triển khai kiến trúc phần mềm ba tầng hoàn chỉnh, đảm bảo tính module hóa và khả năng mở rộng:

- **Tầng Backend (Node.js + Express + MongoDB):** Máy chủ xây dựng trên nền tảng Node.js với framework Express cung cấp đầy đủ các RESTful API cho quản lý xác thực người dùng (JWT), quản lý thiết bị (CRUD, ghép đôi sensor – controller), lưu trữ và truy vấn lịch sử cảm biến (với hàng triệu bản ghi trên MongoDB Atlas), thiết lập lịch trình tưới tự động (Scheduler Service), cấu hình luật cảnh báo thông minh (Alert Rules) và gửi thông báo qua email (Nodemailer). Ngoài ra, hệ thống tích hợp module MQTT Client kết nối tới broker đám mây (HiveMQ Cloud hoặc EMQX) để thu nhận dữ liệu telemetry thời gian thực từ các node IoT, đồng thời phân phối lệnh điều khiển ngược xuống thiết bị chấp hành. Cơ chế truyền tải dữ liệu thời gian thực tới giao diện người dùng được hiện thực qua Server-Sent Events (SSE), cho phép Dashboard cập nhật biểu đồ và trạng thái relay gần như tức thì mà không cần polling.

- **Tầng Frontend (React + Vite + Recharts):** Giao diện quản trị Dashboard được phát triển bằng React kết hợp công cụ build Vite, cung cấp trải nghiệm người dùng mượt mà trên trình duyệt web với các tính năng: bảng điều khiển tổng quan hiển thị số liệu cảm biến theo thời gian thực (biểu đồ đường tương tác bằng thư viện Recharts), bảng điều khiển thiết bị bật/tắt thủ công quạt – đèn – máy bơm, giao diện cấu hình lịch trình tưới tự động, giao diện thiết lập cảnh báo và tab theo dõi trạng thái AI trên thiết bị. Bố cục giao diện được thiết kế theo phong cách hiện đại, tối ưu cho cả máy tính để bàn và thiết bị di động.

- **Hạ tầng triển khai lai (Hybrid Deployment):** Hệ thống được triển khai trên mô hình lai kết hợp máy chủ vật lý nội bộ (Proxmox VE + Ubuntu LXC Container chạy PM2 + Cloudflare Tunnel) và các dịch vụ đám mây công cộng (MongoDB Atlas trên AWS Singapore, HiveMQ Cloud Broker), đảm bảo tính sẵn sàng cao và chi phí vận hành tối ưu cho quy mô đồ án.

### 5.1.3. Áp dụng thành công trí tuệ nhân tạo biên (TinyML)

Đây là điểm nhấn kỹ thuật quan trọng nhất của đồ án, thể hiện khả năng tích hợp công nghệ AI tiên tiến vào thiết bị nhúng có tài nguyên giới hạn:

- **Mô hình mạng nơ-ron nhân tạo:** Xây dựng mô hình phân loại đa nhãn (Multi-label Classification) sử dụng kiến trúc mạng nơ-ron truyền thẳng hai lớp (Input → Dense 8 ReLU → Dense 3 Sigmoid) được huấn luyện bằng TensorFlow/Keras trên bộ dữ liệu 10.000 mẫu. Mô hình nhận bốn đầu vào cảm biến (nhiệt độ, độ ẩm, độ ẩm đất, ánh sáng) đã chuẩn hóa và xuất ba xác suất tương ứng với quyết định bật/tắt quạt, đèn và máy bơm.

- **Lượng tử hóa INT8 (Full Integer Quantization):** Mô hình sau huấn luyện được chuyển đổi sang định dạng TensorFlow Lite và lượng tử hóa toàn bộ trọng số cùng phép tính kích hoạt sang dạng số nguyên 8-bit thông qua Representative Dataset gồm 128 mẫu. Kết quả là mô hình `.tflite` có kích thước chỉ khoảng vài KB, đủ nhỏ để nhúng trực tiếp vào bộ nhớ Flash của ESP32-WROOM dưới dạng mảng byte C (`model.h`).

- **Suy luận tại chỗ (On-device Inference):** Mô hình TinyML chạy trực tiếp trên vi điều khiển ESP32-WROOM thông qua thư viện TensorFlow Lite for Microcontrollers, thực thi suy luận mỗi 5 giây với thời gian xử lý cỡ mili-giây. Kết quả suy luận được áp dụng cơ chế ngưỡng trễ Hysteresis (ngưỡng bật ON = 0.60, ngưỡng tắt OFF = 0.45) nhằm tránh hiện tượng rung relay (Relay Chattering) khi giá trị xác suất dao động quanh ngưỡng quyết định.

- **Ý nghĩa thực tiễn:** Việc áp dụng TinyML cho phép thiết bị tự ra quyết định tưới tiêu mà không phụ thuộc vào kết nối Internet hay máy chủ trung tâm. Đây là yếu tố then chốt trong bối cảnh nông nghiệp thực tế, nơi hạ tầng viễn thông thường không đảm bảo tính liên tục.

### 5.1.4. Xây dựng cơ chế an toàn ba tầng (3-Tier Safety)

Hệ thống triển khai cơ chế an toàn nhiều lớp cho hoạt động tưới tự động:

- **Tầng 1 — Suy luận AI tại biên:** Mô hình TinyML trên ESP32-WROOM đưa ra quyết định dựa trên dữ liệu cảm biến thực tế.
- **Tầng 2 — Kiểm duyệt trên máy chủ:** Server Node.js đóng vai trò "người giám sát" (Supervisor), kiểm tra quyết định AI của WROOM dựa trên cửa sổ an toàn thời gian (Safety Windows) trước khi chuyển tiếp lệnh điều khiển xuống bo mạch chấp hành ESP32-S3. Nếu thời điểm hiện tại nằm ngoài khung giờ an toàn, lệnh bật máy bơm sẽ bị chặn lại bất kể AI có đề xuất tưới.
- **Tầng 3 — Chế độ vận hành:** Khi người dùng chuyển chế độ từ AUTO sang MANUAL hoặc SCHEDULED trên giao diện, toàn bộ quyết định từ AI bị ghi đè bởi ý chí người vận hành, đảm bảo quyền kiểm soát cuối cùng luôn thuộc về con người.

---

## 5.2. Những hạn chế còn tồn tại

Mặc dù đã đạt được các kết quả tích cực nêu trên, hệ thống vẫn tồn tại một số hạn chế khách quan cần được nhận diện rõ ràng nhằm đảm bảo tính trung thực khoa học của đồ án.

### 5.2.1. Phụ thuộc vào hạ tầng mạng Wi-Fi

Hạ tầng truyền thông hiện tại của hệ thống được xây dựng hoàn toàn trên giao thức Wi-Fi (chuẩn IEEE 802.11 b/g/n, tần số 2.4 GHz). Mặc dù đã triển khai cơ chế dự phòng Fallback Mode khi mất kết nối Internet (node cảm biến giao tiếp trực tiếp với node chấp hành qua TCP nội bộ), hạn chế cố hữu của Wi-Fi vẫn ảnh hưởng đáng kể đến khả năng mở rộng:

- **Phạm vi phủ sóng hạn chế:** Tầm phát sóng hiệu quả của bộ phát Wi-Fi thông thường trong môi trường mở (outdoor) chỉ đạt khoảng 50–100 mét. Khi triển khai trên các cánh đồng nông nghiệp có diện tích từ vài hecta trở lên, hệ thống sẽ gặp khó khăn nghiêm trọng trong việc duy trì kết nối ổn định cho các node cảm biến đặt ở xa điểm phát. Việc lắp đặt thêm các bộ khuếch đại tín hiệu (Wi-Fi Repeater) hoặc Access Point mở rộng sẽ làm tăng chi phí hạ tầng và phức tạp hóa quá trình vận hành.

- **Can nhiễu tín hiệu trong môi trường nông nghiệp:** Tín hiệu Wi-Fi ở tần số 2.4 GHz dễ bị suy hao bởi các yếu tố vật lý trong môi trường canh tác thực tế như tán lá cây dày đặc, địa hình gồ ghề, độ ẩm không khí cao và các thiết bị điện nông nghiệp gây nhiễu điện từ.

- **Tiêu thụ năng lượng cao:** Module Wi-Fi trên ESP32 tiêu thụ dòng điện trung bình khoảng 80–160 mA khi truyền dữ liệu, đây là mức tiêu thụ đáng kể nếu hệ thống cần hoạt động bằng pin hoặc nguồn năng lượng tái tạo trong thời gian dài tại các vùng canh tác không có lưới điện.

### 5.2.2. Độ bền cảm biến độ ẩm đất theo thời gian

Cảm biến độ ẩm đất kiểu điện trở (Resistive Soil Moisture Sensor) được sử dụng trong hệ thống hiện tại có nhược điểm vật lý cố hữu: các điện cực kim loại tiếp xúc trực tiếp với đất ẩm sẽ bị oxy hóa và ăn mòn điện hóa (Galvanic Corrosion) theo thời gian, đặc biệt trong môi trường đất có độ pH thấp (đất chua) hoặc chứa nhiều muối khoáng. Quá trình ăn mòn này dẫn đến:

- **Sai lệch giá trị đo (Measurement Drift):** Điện trở bề mặt điện cực thay đổi do lớp oxit tích tụ, khiến giá trị ADC đọc được không còn phản ánh chính xác độ ẩm thực tế của đất. Hiện tượng này diễn ra từ từ và khó phát hiện nếu không có quy trình hiệu chuẩn định kỳ.

- **Tuổi thọ hạn chế:** Theo các nghiên cứu thực nghiệm, cảm biến độ ẩm đất kiểu điện trở thường chỉ duy trì độ chính xác chấp nhận được trong khoảng 3–6 tháng sử dụng liên tục ngoài trời. Để vận hành lâu dài, cần thay thế cảm biến định kỳ hoặc nâng cấp sang loại cảm biến điện dung (Capacitive Soil Moisture Sensor) có độ bền cao hơn do không tiếp xúc trực tiếp kim loại với đất.

### 5.2.3. Hạn chế về bảo mật giao thức MQTT

Ở phiên bản triển khai hiện tại, hệ thống chưa áp dụng đầy đủ các cơ chế bảo mật chuyên sâu cho giao thức MQTT:

- **Chưa triển khai mã hóa TLS/SSL trên toàn tuyến:** Mặc dù khi sử dụng dịch vụ HiveMQ Cloud, kết nối MQTT được bảo mật bởi TLS qua cổng 8883, nhưng trong quá trình phát triển và kiểm thử thực tế, hệ thống thường sử dụng broker EMQX công cộng hoặc Mosquitto nội bộ với cổng 1883 (plain TCP) mà không có lớp mã hóa truyền tải. Điều này có nghĩa là các bản tin MQTT — bao gồm cả dữ liệu cảm biến và đặc biệt là lệnh điều khiển thiết bị chấp hành (bật/tắt máy bơm, quạt, đèn) — được truyền dưới dạng văn bản thuần (plaintext) trên đường truyền mạng.

- **Xác thực đơn giản bằng Username/Password:** Cơ chế xác thực hiện tại dừng lại ở việc sử dụng cặp Username/Password tĩnh được cấu hình cứng trong mã nguồn firmware. Hệ thống chưa triển khai xác thực dựa trên chứng chỉ số X.509 (Mutual TLS Authentication) — vốn là tiêu chuẩn bảo mật được khuyến nghị trong các ứng dụng IoT vận hành thực tế nhằm đảm bảo danh tính của cả client và broker được xác minh chặt chẽ.

- **Chưa có cơ chế phân quyền topic chi tiết (Topic-level ACL):** Ở trạng thái hiện tại, bất kỳ MQTT client nào xác thực thành công đều có quyền subscribe và publish lên toàn bộ cây topic. Trong môi trường sản xuất thực tế, cần thiết lập chính sách Access Control List (ACL) chi tiết để mỗi thiết bị chỉ được phép truy cập đúng các topic thuộc phạm vi của mình.

### 5.2.4. Hạn chế về mô hình TinyML

- **Bộ dữ liệu huấn luyện chưa đa dạng:** Mô hình được huấn luyện trên bộ dữ liệu 10.000 mẫu được tạo dựa trên các quy tắc logic (rule-based) kết hợp nhiễu ngẫu nhiên, chưa phải dữ liệu thực tế thu thập từ đồng ruộng trong nhiều mùa vụ và điều kiện khí hậu khác nhau. Do đó, khả năng tổng quát hóa (Generalization) của mô hình đối với các tình huống ngoại lệ trong canh tác thực tế vẫn cần được đánh giá thêm.

- **Kiến trúc mạng đơn giản:** Mô hình sử dụng kiến trúc hai lớp Dense (8 nơ-ron ẩn) nhằm phù hợp với tài nguyên hạn chế của vi điều khiển. Tuy nhiên, kiến trúc này có năng lực biểu diễn (Representational Capacity) giới hạn và có thể không nắm bắt được các mối quan hệ phi tuyến phức tạp giữa các biến môi trường trong thực tế, đặc biệt khi cần xem xét yếu tố thời gian (time-series) và sự tương tác giữa nhiều loại cây trồng khác nhau.

---

## 5.3. Hướng phát triển

Dựa trên các hạn chế đã được nhận diện ở Mục 5.2 và xu hướng phát triển của công nghệ IoT nông nghiệp (Agriculture IoT — AgriIoT), nhóm tác giả đề xuất các hướng phát triển sau nhằm nâng tầm hệ thống từ quy mô đồ án tốt nghiệp lên mức ứng dụng thực tiễn:

### 5.3.1. Nâng cấp giao thức truyền thông sang LoRaWAN

Để khắc phục triệt để hạn chế về phạm vi phủ sóng và tiêu thụ năng lượng của Wi-Fi, hướng phát triển ưu tiên hàng đầu là chuyển đổi giao tiếp phần cứng sang chuẩn truyền thông không dây tầm xa LoRaWAN (Long Range Wide Area Network):

- **Phạm vi truyền thông vượt trội:** Công nghệ LoRa cho phép truyền dữ liệu với tầm phủ từ 2–5 km trong khu vực đô thị và lên đến 10–15 km ở vùng nông thôn có địa hình thoáng, đủ để bao phủ toàn bộ diện tích một trang trại quy mô lớn chỉ với một Gateway duy nhất.

- **Tiêu thụ năng lượng cực thấp (Ultra-low Power):** Module LoRa tiêu thụ dòng điện trung bình chỉ khoảng 10–50 mA khi truyền và chỉ vài μA ở chế độ ngủ sâu (Deep Sleep), thấp hơn nhiều lần so với Wi-Fi. Đặc tính này cho phép node cảm biến hoạt động bằng pin trong nhiều tháng đến hàng năm mà không cần thay thế nguồn điện.

- **Kiến trúc đề xuất:** Mỗi node cảm biến ESP32 sẽ được tích hợp thêm module LoRa (ví dụ: SX1276/SX1278 tần số 433 MHz hoặc 868 MHz). Dữ liệu telemetry được đóng gói gọn và truyền lên LoRaWAN Gateway qua giao thức LoRaWAN Class A (tiết kiệm pin nhất). Gateway sau đó chuyển tiếp dữ liệu tới máy chủ qua mạng IP thông thường (4G/Ethernet). Giao thức MQTT trên tầng ứng dụng vẫn được giữ nguyên để đảm bảo tính tương thích ngược với kiến trúc phần mềm hiện có.

### 5.3.2. Tích hợp nguồn năng lượng mặt trời cho node cảm biến

Khi kết hợp với module LoRa tiêu thụ năng lượng thấp, việc cấp nguồn cho các node cảm biến bằng pin năng lượng mặt trời trở nên hoàn toàn khả thi:

- **Thiết kế phần cứng:** Mỗi node cảm biến sẽ được trang bị một tấm pin năng lượng mặt trời công suất nhỏ (3–6W), mạch sạc năng lượng mặt trời MPPT (Maximum Power Point Tracking) và pin Lithium-ion (dung lượng 3.7V/2000–4000 mAh) làm nguồn dự trữ. Vào ban ngày, tấm pin mặt trời vừa cấp nguồn trực tiếp cho vi điều khiển vừa sạc pin dự trữ; vào ban đêm hoặc khi trời nhiều mây, hệ thống chuyển sang sử dụng năng lượng từ pin dự trữ.

- **Tối ưu hóa firmware:** Vi điều khiển ESP32 sẽ được lập trình sử dụng chế độ Deep Sleep giữa các chu kỳ đọc cảm biến, chỉ thức dậy vài giây để đọc dữ liệu, chạy suy luận TinyML và truyền gói tin LoRa, sau đó lập tức quay lại trạng thái ngủ. Chu kỳ hoạt động (Duty Cycle) có thể được tối ưu xuống mức 1–2% thời gian, kéo dài tuổi thọ pin đáng kể.

- **Ý nghĩa thực tiễn:** Giải pháp năng lượng mặt trời giúp loại bỏ hoàn toàn sự phụ thuộc vào lưới điện, cho phép triển khai node cảm biến ở bất kỳ vị trí nào trên cánh đồng mà không cần kéo dây điện, giảm thiểu chi phí hạ tầng và tăng tính cơ động khi cần di chuyển vị trí lắp đặt giữa các mùa vụ.

### 5.3.3. Phát triển thuật toán học máy trên đám mây để dự báo sâu bệnh

Ngoài việc nâng cấp phần cứng, hướng phát triển về mặt trí tuệ nhân tạo có tiềm năng mang lại giá trị kinh tế lớn nhất cho nông dân:

- **Thu thập và tích hợp dữ liệu đa nguồn:** Xây dựng bộ dữ liệu huấn luyện quy mô lớn bằng cách kết hợp dữ liệu cảm biến lịch sử của hệ thống (nhiệt độ, độ ẩm, ánh sáng, độ ẩm đất tích lũy qua nhiều mùa vụ) với dữ liệu thời tiết lịch sử từ các API khí tượng công cộng (OpenWeatherMap, Visual Crossing), dữ liệu viễn thám vệ tinh về chỉ số thực vật NDVI (Normalized Difference Vegetation Index) và hồ sơ dịch bệnh cây trồng theo vùng địa lý do cơ quan Bảo vệ thực vật công bố.

- **Mô hình dự báo trên Cloud:** Triển khai các thuật toán học máy tiên tiến trên máy chủ đám mây (Cloud ML) — bao gồm mô hình chuỗi thời gian LSTM (Long Short-Term Memory), mô hình Gradient Boosting (XGBoost/LightGBM) hoặc kiến trúc Transformer — để dự báo nguy cơ xuất hiện sâu bệnh dựa trên xu hướng biến động của các yếu tố vi khí hậu. Ví dụ: sự kết hợp giữa nhiệt độ ban đêm liên tục trên 25°C, độ ẩm không khí trên 85% và mưa kéo dài là điều kiện lý tưởng cho bệnh đạo ôn (Blast Disease) phát triển trên lúa.

- **Cảnh báo sớm và khuyến nghị hành động:** Kết quả dự báo sẽ được gửi đến người dùng qua nhiều kênh: thông báo đẩy (Push Notification) trên ứng dụng di động, email cảnh báo và hiển thị trực tiếp trên Dashboard dưới dạng bản đồ nhiệt nguy cơ (Risk Heatmap). Hệ thống không chỉ cảnh báo mà còn đề xuất các biện pháp phòng ngừa cụ thể (ví dụ: phun thuốc phòng trước, điều chỉnh chế độ tưới, thay đổi thông gió) giúp nông dân chủ động can thiệp trước khi dịch bệnh bùng phát.

### 5.3.4. Nâng cấp bảo mật toàn diện

Để đưa hệ thống vào vận hành thương mại, cần hoàn thiện các lớp bảo mật:

- **Triển khai TLS/SSL cho toàn bộ kết nối MQTT:** Cấu hình broker bắt buộc sử dụng cổng 8883 (MQTT over TLS) và vô hiệu hóa cổng 1883 (plaintext). Đối với các vi điều khiển ESP32, tích hợp thư viện WiFiClientSecure với chứng chỉ CA (Certificate Authority) được nhúng trong firmware để thiết lập kết nối mã hóa đầu cuối.

- **Xác thực Mutual TLS (mTLS):** Mỗi thiết bị IoT được cấp một cặp chứng chỉ X.509 riêng biệt, đảm bảo cả broker và client đều xác minh danh tính lẫn nhau trước khi thiết lập kết nối MQTT.

- **Phân quyền Topic chi tiết (ACL):** Triển khai chính sách Access Control List trên broker, giới hạn mỗi thiết bị chỉ được publish/subscribe trên các topic thuộc phạm vi deviceId của chính nó, ngăn chặn nguy cơ thiết bị A gửi lệnh điều khiển trái phép tới thiết bị B.

### 5.3.5. Mở rộng hệ sinh thái ứng dụng

- **Ứng dụng di động đa nền tảng (Flutter):** Phát triển ứng dụng di động bằng framework Flutter để cung cấp trải nghiệm giám sát và điều khiển trang trại mọi lúc mọi nơi trên cả iOS và Android, tích hợp thông báo đẩy (Push Notification) cho các cảnh báo khẩn cấp.

- **Hỗ trợ đa trang trại (Multi-farm):** Mở rộng kiến trúc để một tài khoản người dùng có thể quản lý nhiều trang trại ở các vị trí địa lý khác nhau, mỗi trang trại có nhóm thiết bị riêng biệt với dashboard và cấu hình độc lập.

- **Tích hợp trợ lý ảo AI (AI Chatbot):** Tích hợp mô hình ngôn ngữ lớn (LLM) vào giao diện Dashboard và ứng dụng di động, cho phép nông dân tương tác bằng ngôn ngữ tự nhiên — ví dụ: "Tình hình độ ẩm đất khu vực A tuần này thế nào?" hoặc "Hãy tưới khu B trong 15 phút" — thay vì phải thao tác thủ công trên các biểu đồ và nút bấm.

---

## 5.4. Lời kết

Đồ án **"Hệ thống giám sát tưới tiêu thông minh"** đã chứng minh được tính khả thi của việc ứng dụng tổng hợp các công nghệ hiện đại — Internet vạn vật (IoT), trí tuệ nhân tạo biên (TinyML), điện toán đám mây (Cloud Computing) và phát triển phần mềm Full-stack — vào bài toán tự động hóa nông nghiệp thông minh. Hệ thống không dừng lại ở mức nguyên mẫu thí nghiệm (Proof of Concept) mà đã được triển khai và vận hành thực tế với phần cứng thật, xử lý dữ liệu thời gian thực và giao diện người dùng hoàn chỉnh.

Đặc biệt, việc áp dụng thành công TinyML — cho phép thiết bị nhúng có tài nguyên giới hạn tự ra quyết định tưới tiêu tại chỗ mà không phụ thuộc vào kết nối mạng — là một đóng góp có giá trị cả về mặt học thuật lẫn thực tiễn, mở ra hướng tiếp cận mới cho bài toán nông nghiệp chính xác (Precision Agriculture) tại Việt Nam.

Với các hướng phát triển đã đề xuất — nâng cấp truyền thông LoRaWAN, tích hợp năng lượng mặt trời, dự báo sâu bệnh bằng AI đám mây và hoàn thiện bảo mật — hệ thống có tiềm năng phát triển thành một nền tảng giám sát nông nghiệp thông minh hoàn chỉnh, đáp ứng nhu cầu thực tế của ngành nông nghiệp hiện đại và góp phần vào quá trình chuyển đổi số nông nghiệp tại Việt Nam.
