import DashboardLayout from "@/components/DashboardLayout";
import { CyberPanel } from "@/components/CyberPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Docs() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-wider text-neon-cyan neon-glow-cyan">
            APK DEV DOCS
          </h1>
          <p className="text-sm font-mono text-muted-foreground mt-1">
            // ANDROID CLIENT DEVELOPMENT GUIDE
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-card border border-neon-cyan/20 p-1">
            <TabsTrigger value="overview" className="font-mono text-xs data-[state=active]:bg-neon-cyan/10 data-[state=active]:text-neon-cyan">概述</TabsTrigger>
            <TabsTrigger value="permissions" className="font-mono text-xs data-[state=active]:bg-neon-cyan/10 data-[state=active]:text-neon-cyan">权限配置</TabsTrigger>
            <TabsTrigger value="websocket" className="font-mono text-xs data-[state=active]:bg-neon-cyan/10 data-[state=active]:text-neon-cyan">WebSocket</TabsTrigger>
            <TabsTrigger value="pairing" className="font-mono text-xs data-[state=active]:bg-neon-cyan/10 data-[state=active]:text-neon-cyan">扫码配对</TabsTrigger>
            <TabsTrigger value="sms" className="font-mono text-xs data-[state=active]:bg-neon-cyan/10 data-[state=active]:text-neon-cyan">短信收发</TabsTrigger>
            <TabsTrigger value="keepalive" className="font-mono text-xs data-[state=active]:bg-neon-cyan/10 data-[state=active]:text-neon-cyan">后台保活</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <CyberPanel title="PROJECT OVERVIEW" subtitle="Architecture & tech stack">
              <div className="space-y-4 text-sm font-body text-foreground/80 leading-relaxed">
                <p>Android 被控端 APK 是短信远程控制系统的移动端组件，负责与服务器建立 WebSocket 长连接，实现短信的实时转发和远程发送功能。</p>

                <div className="bg-background/50 border border-neon-cyan/20 p-4 font-mono text-xs space-y-2">
                  <p className="text-neon-cyan">// 技术栈推荐</p>
                  <p>Language: Kotlin</p>
                  <p>Min SDK: 26 (Android 8.0)</p>
                  <p>Target SDK: 34 (Android 14)</p>
                  <p>WebSocket: OkHttp / Socket.IO Android Client</p>
                  <p>QR Scanner: ML Kit / ZXing</p>
                  <p>Background: Foreground Service + WorkManager</p>
                  <p>DI: Hilt</p>
                  <p>Architecture: MVVM + Repository</p>
                </div>

                <div className="bg-background/50 border border-neon-pink/20 p-4 font-mono text-xs space-y-2">
                  <p className="text-neon-pink">// 核心功能模块</p>
                  <p>1. 扫码配对 - 扫描控制台生成的二维码完成设备绑定</p>
                  <p>2. WebSocket 连接 - 与服务器保持实时双向通信</p>
                  <p>3. 短信监听 - 监听新收到的短信并转发到服务器</p>
                  <p>4. 短信发送 - 接收服务器指令发送短信</p>
                  <p>5. 状态上报 - 定期上报电池电量、信号强度等</p>
                  <p>6. 后台保活 - 确保服务在后台持续运行</p>
                </div>

                <div className="bg-background/50 border border-neon-purple/20 p-4 font-mono text-xs space-y-2">
                  <p className="text-neon-purple">// build.gradle 依赖</p>
                  <p>{`dependencies {`}</p>
                  <p>{`    implementation 'io.socket:socket.io-client:2.1.0'`}</p>
                  <p>{`    implementation 'com.squareup.okhttp3:okhttp:4.12.0'`}</p>
                  <p>{`    implementation 'com.google.mlkit:barcode-scanning:17.2.0'`}</p>
                  <p>{`    implementation 'androidx.camera:camera-camera2:1.3.1'`}</p>
                  <p>{`    implementation 'androidx.camera:camera-lifecycle:1.3.1'`}</p>
                  <p>{`    implementation 'androidx.camera:camera-view:1.3.1'`}</p>
                  <p>{`    implementation 'com.google.code.gson:gson:2.10.1'`}</p>
                  <p>{`    implementation 'androidx.work:work-runtime-ktx:2.9.0'`}</p>
                  <p>{`}`}</p>
                </div>
              </div>
            </CyberPanel>
          </TabsContent>

          <TabsContent value="permissions">
            <CyberPanel title="PERMISSIONS" subtitle="Required Android permissions" accentColor="pink">
              <div className="space-y-4 text-sm font-body text-foreground/80 leading-relaxed">
                <p>APK 需要申请以下关键权限才能正常工作：</p>

                <div className="bg-background/50 border border-neon-pink/20 p-4 font-mono text-xs space-y-1">
                  <p className="text-neon-pink mb-2">{'<!-- AndroidManifest.xml -->'}</p>
                  <p>{`<uses-permission android:name="android.permission.SEND_SMS" />`}</p>
                  <p>{`<uses-permission android:name="android.permission.READ_SMS" />`}</p>
                  <p>{`<uses-permission android:name="android.permission.RECEIVE_SMS" />`}</p>
                  <p>{`<uses-permission android:name="android.permission.READ_PHONE_STATE" />`}</p>
                  <p>{`<uses-permission android:name="android.permission.READ_PHONE_NUMBERS" />`}</p>
                  <p>{`<uses-permission android:name="android.permission.INTERNET" />`}</p>
                  <p>{`<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />`}</p>
                  <p>{`<uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />`}</p>
                  <p>{`<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />`}</p>
                  <p>{`<uses-permission android:name="android.permission.CAMERA" />`}</p>
                  <p>{`<uses-permission android:name="android.permission.WAKE_LOCK" />`}</p>
                  <p>{`<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />`}</p>
                </div>

                <div className="bg-background/50 border border-neon-cyan/20 p-4 font-mono text-xs space-y-1">
                  <p className="text-neon-cyan mb-2">// 运行时权限请求 (Kotlin)</p>
                  <p>{`private val requiredPermissions = arrayOf(`}</p>
                  <p>{`    Manifest.permission.SEND_SMS,`}</p>
                  <p>{`    Manifest.permission.READ_SMS,`}</p>
                  <p>{`    Manifest.permission.RECEIVE_SMS,`}</p>
                  <p>{`    Manifest.permission.READ_PHONE_STATE,`}</p>
                  <p>{`    Manifest.permission.READ_PHONE_NUMBERS,`}</p>
                  <p>{`    Manifest.permission.CAMERA,`}</p>
                  <p>{`    Manifest.permission.POST_NOTIFICATIONS`}</p>
                  <p>{`)`}</p>
                  <p>&nbsp;</p>
                  <p>{`private val permissionLauncher = registerForActivityResult(`}</p>
                  <p>{`    ActivityResultContracts.RequestMultiplePermissions()`}</p>
                  <p>{`) { permissions ->`}</p>
                  <p>{`    val allGranted = permissions.all { it.value }`}</p>
                  <p>{`    if (allGranted) {`}</p>
                  <p>{`        startSmsService()`}</p>
                  <p>{`    } else {`}</p>
                  <p>{`        showPermissionDeniedDialog()`}</p>
                  <p>{`    }`}</p>
                  <p>{`}`}</p>
                </div>

                <p className="text-neon-pink text-xs font-mono">⚠ Android 14+ 需要在 Manifest 中声明 foregroundServiceType="specialUse"</p>
              </div>
            </CyberPanel>
          </TabsContent>

          <TabsContent value="websocket">
            <CyberPanel title="WEBSOCKET CONNECTION" subtitle="Socket.IO client implementation" accentColor="cyan">
              <div className="space-y-4 text-sm font-body text-foreground/80 leading-relaxed">
                <p>使用 Socket.IO Android 客户端库连接到服务器的 /device 命名空间。连接成功后需要发送配对或重连事件。</p>

                <div className="bg-background/50 border border-neon-cyan/20 p-4 font-mono text-xs space-y-1 overflow-x-auto">
                  <p className="text-neon-cyan mb-2">// WebSocketManager.kt</p>
                  <p>{`class WebSocketManager(private val context: Context) {`}</p>
                  <p>{`    private var socket: Socket? = null`}</p>
                  <p>{`    private var deviceId: String? = null`}</p>
                  <p>&nbsp;</p>
                  <p>{`    fun connect(serverUrl: String) {`}</p>
                  <p>{`        val opts = IO.Options().apply {`}</p>
                  <p>{`            path = "/api/ws"`}</p>
                  <p>{`            transports = arrayOf("websocket")`}</p>
                  <p>{`            reconnection = true`}</p>
                  <p>{`            reconnectionAttempts = Int.MAX_VALUE`}</p>
                  <p>{`            reconnectionDelay = 3000`}</p>
                  <p>{`        }`}</p>
                  <p>&nbsp;</p>
                  <p>{`        socket = IO.socket("\${serverUrl}/device", opts)`}</p>
                  <p>&nbsp;</p>
                  <p>{`        socket?.on(Socket.EVENT_CONNECT) {`}</p>
                  <p>{`            Log.d("WS", "Connected to server")`}</p>
                  <p>{`            // 如果已有 deviceId，自动重连`}</p>
                  <p>{`            deviceId?.let { id ->`}</p>
                  <p>{`                reconnect(id)`}</p>
                  <p>{`            }`}</p>
                  <p>{`        }`}</p>
                  <p>&nbsp;</p>
                  <p>{`        socket?.on("send_sms") { args ->`}</p>
                  <p>{`            val data = args[0] as JSONObject`}</p>
                  <p>{`            val requestId = data.getString("requestId")`}</p>
                  <p>{`            val phoneNumber = data.getString("phoneNumber")`}</p>
                  <p>{`            val body = data.getString("body")`}</p>
                  <p>{`            sendSms(requestId, phoneNumber, body)`}</p>
                  <p>{`        }`}</p>
                  <p>&nbsp;</p>
                  <p>{`        socket?.connect()`}</p>
                  <p>{`    }`}</p>
                  <p>&nbsp;</p>
                  <p>{`    fun pair(token: String, deviceInfo: JSONObject) {`}</p>
                  <p>{`        val data = JSONObject().apply {`}</p>
                  <p>{`            put("token", token)`}</p>
                  <p>{`            put("deviceInfo", deviceInfo)`}</p>
                  <p>{`        }`}</p>
                  <p>{`        socket?.emit("pair", data)`}</p>
                  <p>{`    }`}</p>
                  <p>&nbsp;</p>
                  <p>{`    fun reconnect(devId: String) {`}</p>
                  <p>{`        socket?.emit("reconnect_device",`}</p>
                  <p>{`            JSONObject().put("deviceId", devId))`}</p>
                  <p>{`    }`}</p>
                  <p>&nbsp;</p>
                  <p>{`    fun reportSmsReceived(phone: String, body: String,`}</p>
                  <p>{`                          contact: String?, timestamp: Long) {`}</p>
                  <p>{`        val data = JSONObject().apply {`}</p>
                  <p>{`            put("phoneNumber", phone)`}</p>
                  <p>{`            put("body", body)`}</p>
                  <p>{`            put("timestamp", timestamp)`}</p>
                  <p>{`            contact?.let { put("contactName", it) }`}</p>
                  <p>{`        }`}</p>
                  <p>{`        socket?.emit("sms_received", data)`}</p>
                  <p>{`    }`}</p>
                  <p>&nbsp;</p>
                  <p>{`    fun reportStatus(battery: Int, signal: Int) {`}</p>
                  <p>{`        val data = JSONObject().apply {`}</p>
                  <p>{`            put("batteryLevel", battery)`}</p>
                  <p>{`            put("signalStrength", signal)`}</p>
                  <p>{`        }`}</p>
                  <p>{`        socket?.emit("status_update", data)`}</p>
                  <p>{`    }`}</p>
                  <p>{`}`}</p>
                </div>

                <div className="bg-background/50 border border-neon-pink/20 p-4 font-mono text-xs">
                  <p className="text-neon-pink mb-2">// WebSocket 事件协议</p>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="pb-2 text-neon-cyan">事件名</th>
                        <th className="pb-2 text-neon-cyan">方向</th>
                        <th className="pb-2 text-neon-cyan">说明</th>
                      </tr>
                    </thead>
                    <tbody className="text-foreground/70">
                      <tr className="border-b border-border/10"><td className="py-1.5">pair</td><td>Client→Server</td><td>发送配对令牌</td></tr>
                      <tr className="border-b border-border/10"><td className="py-1.5">pair_result</td><td>Server→Client</td><td>配对结果</td></tr>
                      <tr className="border-b border-border/10"><td className="py-1.5">reconnect_device</td><td>Client→Server</td><td>已配对设备重连</td></tr>
                      <tr className="border-b border-border/10"><td className="py-1.5">reconnect_result</td><td>Server→Client</td><td>重连结果</td></tr>
                      <tr className="border-b border-border/10"><td className="py-1.5">sms_received</td><td>Client→Server</td><td>上报收到的短信</td></tr>
                      <tr className="border-b border-border/10"><td className="py-1.5">send_sms</td><td>Server→Client</td><td>指令：发送短信</td></tr>
                      <tr className="border-b border-border/10"><td className="py-1.5">sms_send_result</td><td>Client→Server</td><td>短信发送结果</td></tr>
                      <tr><td className="py-1.5">status_update</td><td>Client→Server</td><td>上报设备状态</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </CyberPanel>
          </TabsContent>

          <TabsContent value="pairing">
            <CyberPanel title="QR CODE PAIRING" subtitle="Scan & bind device flow" accentColor="pink">
              <div className="space-y-4 text-sm font-body text-foreground/80 leading-relaxed">
                <p>配对流程：控制台生成二维码 → 手机扫码获取令牌和服务器地址 → 通过 WebSocket 发送配对请求 → 服务器验证并绑定设备。</p>

                <div className="bg-background/50 border border-neon-pink/20 p-4 font-mono text-xs space-y-1">
                  <p className="text-neon-pink mb-2">// 二维码数据结构 (JSON)</p>
                  <p>{`{`}</p>
                  <p>{`  "token": "abc123...xyz",     // 配对令牌 (32位)`}</p>
                  <p>{`  "wsUrl": "wss://xxx/api/ws", // WebSocket 地址`}</p>
                  <p>{`  "serverUrl": "https://xxx"   // 服务器地址`}</p>
                  <p>{`}`}</p>
                </div>

                <div className="bg-background/50 border border-neon-cyan/20 p-4 font-mono text-xs space-y-1 overflow-x-auto">
                  <p className="text-neon-cyan mb-2">// QrScanActivity.kt - 使用 ML Kit</p>
                  <p>{`class QrScanActivity : AppCompatActivity() {`}</p>
                  <p>{`    private lateinit var cameraProvider: ProcessCameraProvider`}</p>
                  <p>{`    private val scanner = BarcodeScanning.getClient(`}</p>
                  <p>{`        BarcodeScannerOptions.Builder()`}</p>
                  <p>{`            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)`}</p>
                  <p>{`            .build()`}</p>
                  <p>{`    )`}</p>
                  <p>&nbsp;</p>
                  <p>{`    private fun processQrCode(rawValue: String) {`}</p>
                  <p>{`        try {`}</p>
                  <p>{`            val json = JSONObject(rawValue)`}</p>
                  <p>{`            val token = json.getString("token")`}</p>
                  <p>{`            val wsUrl = json.getString("wsUrl")`}</p>
                  <p>{`            val serverUrl = json.getString("serverUrl")`}</p>
                  <p>&nbsp;</p>
                  <p>{`            // 保存服务器信息`}</p>
                  <p>{`            PreferenceManager.saveServerInfo(`}</p>
                  <p>{`                this, serverUrl, wsUrl`}</p>
                  <p>{`            )`}</p>
                  <p>&nbsp;</p>
                  <p>{`            // 收集设备信息`}</p>
                  <p>{`            val deviceInfo = JSONObject().apply {`}</p>
                  <p>{`                put("phoneModel", Build.MODEL)`}</p>
                  <p>{`                put("androidVersion", Build.VERSION.RELEASE)`}</p>
                  <p>{`                put("phoneNumber", getPhoneNumber())`}</p>
                  <p>{`                put("batteryLevel", getBatteryLevel())`}</p>
                  <p>{`                put("signalStrength", getSignalStrength())`}</p>
                  <p>{`            }`}</p>
                  <p>&nbsp;</p>
                  <p>{`            // 连接并配对`}</p>
                  <p>{`            WebSocketManager.connect(serverUrl)`}</p>
                  <p>{`            WebSocketManager.pair(token, deviceInfo)`}</p>
                  <p>{`        } catch (e: Exception) {`}</p>
                  <p>{`            showError("Invalid QR code")`}</p>
                  <p>{`        }`}</p>
                  <p>{`    }`}</p>
                  <p>{`}`}</p>
                </div>

                <div className="bg-background/50 border border-neon-purple/20 p-4 font-mono text-xs">
                  <p className="text-neon-purple mb-2">// 配对成功后保存 deviceId</p>
                  <p>{`socket.on("pair_result") { args ->`}</p>
                  <p>{`    val result = args[0] as JSONObject`}</p>
                  <p>{`    if (result.getBoolean("success")) {`}</p>
                  <p>{`        val deviceId = result.getString("deviceId")`}</p>
                  <p>{`        PreferenceManager.saveDeviceId(context, deviceId)`}</p>
                  <p>{`        startForegroundService()`}</p>
                  <p>{`    }`}</p>
                  <p>{`}`}</p>
                </div>
              </div>
            </CyberPanel>
          </TabsContent>

          <TabsContent value="sms">
            <CyberPanel title="SMS HANDLING" subtitle="Read, send & monitor SMS" accentColor="cyan">
              <div className="space-y-4 text-sm font-body text-foreground/80 leading-relaxed">
                <p>短信功能包含两个核心部分：监听新收到的短信并上报服务器，以及接收服务器指令发送短信。</p>

                <div className="bg-background/50 border border-neon-cyan/20 p-4 font-mono text-xs space-y-1 overflow-x-auto">
                  <p className="text-neon-cyan mb-2">// SmsReceiver.kt - 监听新短信</p>
                  <p>{`class SmsReceiver : BroadcastReceiver() {`}</p>
                  <p>{`    override fun onReceive(context: Context, intent: Intent) {`}</p>
                  <p>{`        if (intent.action != Telephony.Sms.Intents`}</p>
                  <p>{`                .SMS_RECEIVED_ACTION) return`}</p>
                  <p>&nbsp;</p>
                  <p>{`        val messages = Telephony.Sms.Intents`}</p>
                  <p>{`            .getMessagesFromIntent(intent)`}</p>
                  <p>&nbsp;</p>
                  <p>{`        messages.forEach { sms ->`}</p>
                  <p>{`            val phone = sms.displayOriginatingAddress`}</p>
                  <p>{`            val body = sms.displayMessageBody`}</p>
                  <p>{`            val timestamp = sms.timestampMillis`}</p>
                  <p>{`            val contact = getContactName(context, phone)`}</p>
                  <p>&nbsp;</p>
                  <p>{`            // 通过 WebSocket 上报`}</p>
                  <p>{`            WebSocketManager.reportSmsReceived(`}</p>
                  <p>{`                phone, body, contact, timestamp`}</p>
                  <p>{`            )`}</p>
                  <p>{`        }`}</p>
                  <p>{`    }`}</p>
                  <p>{`}`}</p>
                </div>

                <div className="bg-background/50 border border-neon-pink/20 p-4 font-mono text-xs space-y-1 overflow-x-auto">
                  <p className="text-neon-pink mb-2">// SmsSender.kt - 发送短信</p>
                  <p>{`fun sendSms(requestId: String, phone: String, body: String) {`}</p>
                  <p>{`    try {`}</p>
                  <p>{`        val smsManager = context.getSystemService(`}</p>
                  <p>{`            SmsManager::class.java`}</p>
                  <p>{`        )`}</p>
                  <p>&nbsp;</p>
                  <p>{`        // 处理长短信分段发送`}</p>
                  <p>{`        val parts = smsManager.divideMessage(body)`}</p>
                  <p>{`        if (parts.size == 1) {`}</p>
                  <p>{`            smsManager.sendTextMessage(`}</p>
                  <p>{`                phone, null, body, null, null`}</p>
                  <p>{`            )`}</p>
                  <p>{`        } else {`}</p>
                  <p>{`            smsManager.sendMultipartTextMessage(`}</p>
                  <p>{`                phone, null, parts, null, null`}</p>
                  <p>{`            )`}</p>
                  <p>{`        }`}</p>
                  <p>&nbsp;</p>
                  <p>{`        // 上报发送成功`}</p>
                  <p>{`        socket?.emit("sms_send_result",`}</p>
                  <p>{`            JSONObject().apply {`}</p>
                  <p>{`                put("requestId", requestId)`}</p>
                  <p>{`                put("success", true)`}</p>
                  <p>{`            }`}</p>
                  <p>{`        )`}</p>
                  <p>{`    } catch (e: Exception) {`}</p>
                  <p>{`        socket?.emit("sms_send_result",`}</p>
                  <p>{`            JSONObject().apply {`}</p>
                  <p>{`                put("requestId", requestId)`}</p>
                  <p>{`                put("success", false)`}</p>
                  <p>{`                put("error", e.message)`}</p>
                  <p>{`            }`}</p>
                  <p>{`        )`}</p>
                  <p>{`    }`}</p>
                  <p>{`}`}</p>
                </div>
              </div>
            </CyberPanel>
          </TabsContent>

          <TabsContent value="keepalive">
            <CyberPanel title="BACKGROUND KEEPALIVE" subtitle="Foreground service & wake lock" accentColor="purple">
              <div className="space-y-4 text-sm font-body text-foreground/80 leading-relaxed">
                <p>Android 后台保活是确保 WebSocket 连接持续运行的关键。推荐使用前台服务 + WorkManager 双重保障方案。</p>

                <div className="bg-background/50 border border-neon-purple/20 p-4 font-mono text-xs space-y-1 overflow-x-auto">
                  <p className="text-neon-purple mb-2">// SmsService.kt - 前台服务</p>
                  <p>{`class SmsService : Service() {`}</p>
                  <p>{`    private lateinit var wsManager: WebSocketManager`}</p>
                  <p>{`    private lateinit var wakeLock: PowerManager.WakeLock`}</p>
                  <p>&nbsp;</p>
                  <p>{`    override fun onCreate() {`}</p>
                  <p>{`        super.onCreate()`}</p>
                  <p>{`        wsManager = WebSocketManager(this)`}</p>
                  <p>&nbsp;</p>
                  <p>{`        // 获取 WakeLock 防止 CPU 休眠`}</p>
                  <p>{`        val pm = getSystemService(POWER_SERVICE)`}</p>
                  <p>{`            as PowerManager`}</p>
                  <p>{`        wakeLock = pm.newWakeLock(`}</p>
                  <p>{`            PowerManager.PARTIAL_WAKE_LOCK,`}</p>
                  <p>{`            "SmsRemote::WakeLock"`}</p>
                  <p>{`        )`}</p>
                  <p>{`        wakeLock.acquire()`}</p>
                  <p>{`    }`}</p>
                  <p>&nbsp;</p>
                  <p>{`    override fun onStartCommand(`}</p>
                  <p>{`        intent: Intent?, flags: Int, startId: Int`}</p>
                  <p>{`    ): Int {`}</p>
                  <p>{`        val notification = createNotification()`}</p>
                  <p>{`        startForeground(NOTIFICATION_ID, notification)`}</p>
                  <p>&nbsp;</p>
                  <p>{`        // 连接 WebSocket`}</p>
                  <p>{`        val serverUrl = PreferenceManager`}</p>
                  <p>{`            .getServerUrl(this)`}</p>
                  <p>{`        wsManager.connect(serverUrl)`}</p>
                  <p>&nbsp;</p>
                  <p>{`        // 定期上报状态 (每60秒)`}</p>
                  <p>{`        startStatusReporting()`}</p>
                  <p>&nbsp;</p>
                  <p>{`        return START_STICKY`}</p>
                  <p>{`    }`}</p>
                  <p>&nbsp;</p>
                  <p>{`    private fun startStatusReporting() {`}</p>
                  <p>{`        val handler = Handler(Looper.getMainLooper())`}</p>
                  <p>{`        handler.postDelayed(object : Runnable {`}</p>
                  <p>{`            override fun run() {`}</p>
                  <p>{`                wsManager.reportStatus(`}</p>
                  <p>{`                    getBatteryLevel(),`}</p>
                  <p>{`                    getSignalStrength()`}</p>
                  <p>{`                )`}</p>
                  <p>{`                handler.postDelayed(this, 60_000)`}</p>
                  <p>{`            }`}</p>
                  <p>{`        }, 60_000)`}</p>
                  <p>{`    }`}</p>
                  <p>{`}`}</p>
                </div>

                <div className="bg-background/50 border border-neon-cyan/20 p-4 font-mono text-xs space-y-1 overflow-x-auto">
                  <p className="text-neon-cyan mb-2">// KeepAliveWorker.kt - WorkManager 守护</p>
                  <p>{`class KeepAliveWorker(`}</p>
                  <p>{`    context: Context,`}</p>
                  <p>{`    params: WorkerParameters`}</p>
                  <p>{`) : Worker(context, params) {`}</p>
                  <p>&nbsp;</p>
                  <p>{`    override fun doWork(): Result {`}</p>
                  <p>{`        // 检查前台服务是否运行`}</p>
                  <p>{`        if (!isServiceRunning(SmsService::class.java)) {`}</p>
                  <p>{`            val intent = Intent(applicationContext,`}</p>
                  <p>{`                SmsService::class.java)`}</p>
                  <p>{`            ContextCompat.startForegroundService(`}</p>
                  <p>{`                applicationContext, intent`}</p>
                  <p>{`            )`}</p>
                  <p>{`        }`}</p>
                  <p>{`        return Result.success()`}</p>
                  <p>{`    }`}</p>
                  <p>&nbsp;</p>
                  <p>{`    companion object {`}</p>
                  <p>{`        fun schedule(context: Context) {`}</p>
                  <p>{`            val request = PeriodicWorkRequestBuilder`}</p>
                  <p>{`                <KeepAliveWorker>(15, TimeUnit.MINUTES)`}</p>
                  <p>{`                .build()`}</p>
                  <p>{`            WorkManager.getInstance(context)`}</p>
                  <p>{`                .enqueueUniquePeriodicWork(`}</p>
                  <p>{`                    "keepalive",`}</p>
                  <p>{`                    ExistingPeriodicWorkPolicy.KEEP,`}</p>
                  <p>{`                    request`}</p>
                  <p>{`                )`}</p>
                  <p>{`        }`}</p>
                  <p>{`    }`}</p>
                  <p>{`}`}</p>
                </div>

                <div className="bg-background/50 border border-neon-pink/20 p-4 font-mono text-xs space-y-2">
                  <p className="text-neon-pink mb-1">// 保活策略总结</p>
                  <p>1. Foreground Service + 常驻通知（最核心）</p>
                  <p>2. WakeLock 防止 CPU 休眠</p>
                  <p>3. WorkManager 定期检查服务存活</p>
                  <p>4. START_STICKY 确保服务被杀后自动重启</p>
                  <p>5. 请求忽略电池优化（需用户手动允许）</p>
                  <p>6. Socket.IO 自动重连机制</p>
                  <p className="text-neon-pink mt-2">⚠ 部分厂商（小米/华为/OPPO）有额外限制，</p>
                  <p className="text-neon-pink">需引导用户在设置中开启自启动和后台运行权限</p>
                </div>
              </div>
            </CyberPanel>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
