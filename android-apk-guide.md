# SMS Remote Control - Android 被控端 APK 开发指南

**版本:** 1.0  
**作者:** Manus AI  
**日期:** 2026-03-01  

---

## 一、项目概述

SMS Remote Control 系统的 Android 被控端 APK 是运行在手机上的客户端应用，负责与服务器建立 WebSocket 长连接，实现短信的实时转发和远程发送功能。用户通过扫描控制台生成的二维码完成设备配对，之后手机将在后台持续运行，将收到的短信实时同步到控制台，并接收控制台下发的短信发送指令。

### 核心功能

| 功能模块 | 说明 |
|---------|------|
| 扫码配对 | 使用相机扫描控制台生成的二维码，解析配对令牌和服务器地址，完成设备绑定 |
| WebSocket 连接 | 与服务器建立 Socket.IO 长连接，支持自动重连和断线恢复 |
| 短信监听 | 通过 BroadcastReceiver 监听新收到的短信，实时转发到服务器 |
| 短信发送 | 接收服务器下发的发送指令，调用 SmsManager 发送短信并回报结果 |
| 状态上报 | 定期上报电池电量、信号强度等设备状态信息 |
| 后台保活 | 使用前台服务 + WorkManager 确保应用在后台持续运行 |

### 技术栈

| 技术 | 版本/说明 |
|------|----------|
| 语言 | Kotlin |
| Min SDK | 26 (Android 8.0) |
| Target SDK | 34 (Android 14) |
| WebSocket | Socket.IO Android Client 2.1.0 |
| 二维码扫描 | Google ML Kit Barcode Scanning |
| 相机 | CameraX |
| 后台任务 | WorkManager |
| 依赖注入 | Hilt (可选) |
| 架构 | MVVM + Repository |

---

## 二、项目配置

### 2.1 build.gradle (app)

```groovy
android {
    compileSdk 34
    
    defaultConfig {
        applicationId "com.smsremote.client"
        minSdk 26
        targetSdk 34
        versionCode 1
        versionName "1.0"
    }
    
    buildFeatures {
        viewBinding true
    }
    
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
    
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // Socket.IO
    implementation 'io.socket:socket.io-client:2.1.0'
    
    // OkHttp
    implementation 'com.squareup.okhttp3:okhttp:4.12.0'
    
    // ML Kit 二维码扫描
    implementation 'com.google.mlkit:barcode-scanning:17.2.0'
    
    // CameraX
    implementation 'androidx.camera:camera-camera2:1.3.1'
    implementation 'androidx.camera:camera-lifecycle:1.3.1'
    implementation 'androidx.camera:camera-view:1.3.1'
    
    // JSON
    implementation 'com.google.code.gson:gson:2.10.1'
    
    // WorkManager
    implementation 'androidx.work:work-runtime-ktx:2.9.0'
    
    // AndroidX
    implementation 'androidx.core:core-ktx:1.12.0'
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
    implementation 'androidx.lifecycle:lifecycle-viewmodel-ktx:2.7.0'
    implementation 'androidx.lifecycle:lifecycle-livedata-ktx:2.7.0'
}
```

### 2.2 AndroidManifest.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.smsremote.client">

    <!-- 网络权限 -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    
    <!-- 短信权限 -->
    <uses-permission android:name="android.permission.SEND_SMS" />
    <uses-permission android:name="android.permission.READ_SMS" />
    <uses-permission android:name="android.permission.RECEIVE_SMS" />
    
    <!-- 电话状态（获取手机号） -->
    <uses-permission android:name="android.permission.READ_PHONE_STATE" />
    <uses-permission android:name="android.permission.READ_PHONE_NUMBERS" />
    
    <!-- 相机（扫码） -->
    <uses-permission android:name="android.permission.CAMERA" />
    
    <!-- 前台服务 -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
    
    <!-- 通知 -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    
    <!-- 保活相关 -->
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

    <application
        android:name=".SmsRemoteApp"
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="SMS Remote"
        android:supportsRtl="true"
        android:theme="@style/Theme.SmsRemote"
        android:usesCleartextTraffic="true">

        <activity
            android:name=".ui.MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <activity android:name=".ui.QrScanActivity" />

        <!-- 短信接收广播 -->
        <receiver
            android:name=".receiver.SmsReceiver"
            android:exported="true"
            android:permission="android.permission.BROADCAST_SMS">
            <intent-filter android:priority="999">
                <action android:name="android.provider.Telephony.SMS_RECEIVED" />
            </intent-filter>
        </receiver>

        <!-- 前台服务 -->
        <service
            android:name=".service.SmsService"
            android:foregroundServiceType="specialUse"
            android:exported="false" />

        <!-- 开机自启 -->
        <receiver
            android:name=".receiver.BootReceiver"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
            </intent-filter>
        </receiver>
    </application>
</manifest>
```

---

## 三、核心模块实现

### 3.1 权限请求

应用启动时需要请求运行时权限。以下代码展示了如何在 MainActivity 中请求所有必要权限：

```kotlin
class MainActivity : AppCompatActivity() {
    
    private val requiredPermissions = arrayOf(
        Manifest.permission.SEND_SMS,
        Manifest.permission.READ_SMS,
        Manifest.permission.RECEIVE_SMS,
        Manifest.permission.READ_PHONE_STATE,
        Manifest.permission.READ_PHONE_NUMBERS,
        Manifest.permission.CAMERA,
        Manifest.permission.POST_NOTIFICATIONS
    )
    
    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.all { it.value }
        if (allGranted) {
            onPermissionsGranted()
        } else {
            showPermissionDeniedDialog()
        }
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        if (hasAllPermissions()) {
            onPermissionsGranted()
        } else {
            permissionLauncher.launch(requiredPermissions)
        }
    }
    
    private fun hasAllPermissions(): Boolean {
        return requiredPermissions.all {
            ContextCompat.checkSelfPermission(this, it) == 
                PackageManager.PERMISSION_GRANTED
        }
    }
    
    private fun onPermissionsGranted() {
        // 检查是否已配对
        val deviceId = PreferenceManager.getDeviceId(this)
        if (deviceId != null) {
            // 已配对，启动前台服务
            startSmsService()
            showConnectedUI()
        } else {
            // 未配对，显示扫码按钮
            showPairingUI()
        }
    }
    
    private fun requestBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = getSystemService(POWER_SERVICE) as PowerManager
            if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                val intent = Intent(
                    Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    Uri.parse("package:$packageName")
                )
                startActivity(intent)
            }
        }
    }
}
```

### 3.2 WebSocket 管理器

WebSocketManager 是整个应用的通信核心，负责与服务器建立和维护 Socket.IO 连接：

```kotlin
object WebSocketManager {
    private var socket: Socket? = null
    private var deviceId: String? = null
    private var isConnected = false
    
    // 连接状态回调
    var onConnectionChanged: ((Boolean) -> Unit)? = null
    var onPairResult: ((Boolean, String?) -> Unit)? = null
    
    fun connect(serverUrl: String) {
        try {
            val opts = IO.Options().apply {
                path = "/api/ws"
                transports = arrayOf("websocket")
                reconnection = true
                reconnectionAttempts = Int.MAX_VALUE
                reconnectionDelay = 3000
                reconnectionDelayMax = 30000
                timeout = 20000
            }
            
            socket = IO.socket("${serverUrl}/device", opts)
            
            socket?.on(Socket.EVENT_CONNECT) {
                Log.d("WS", "Connected to server")
                isConnected = true
                onConnectionChanged?.invoke(true)
                
                // 如果已有 deviceId，自动重连
                deviceId?.let { id ->
                    reconnect(id)
                }
            }
            
            socket?.on(Socket.EVENT_DISCONNECT) {
                Log.d("WS", "Disconnected from server")
                isConnected = false
                onConnectionChanged?.invoke(false)
            }
            
            socket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
                Log.e("WS", "Connection error: ${args.firstOrNull()}")
            }
            
            // 配对结果
            socket?.on("pair_result") { args ->
                val data = args[0] as JSONObject
                val success = data.getBoolean("success")
                if (success) {
                    deviceId = data.getString("deviceId")
                    onPairResult?.invoke(true, deviceId)
                } else {
                    val error = data.optString("error", "Unknown error")
                    onPairResult?.invoke(false, error)
                }
            }
            
            // 重连结果
            socket?.on("reconnect_result") { args ->
                val data = args[0] as JSONObject
                val success = data.getBoolean("success")
                Log.d("WS", "Reconnect result: $success")
            }
            
            // 接收发送短信指令
            socket?.on("send_sms") { args ->
                val data = args[0] as JSONObject
                val requestId = data.getString("requestId")
                val phoneNumber = data.getString("phoneNumber")
                val body = data.getString("body")
                SmsSender.sendSms(requestId, phoneNumber, body)
            }
            
            socket?.connect()
            
        } catch (e: Exception) {
            Log.e("WS", "Failed to connect", e)
        }
    }
    
    fun pair(token: String, deviceInfo: JSONObject) {
        val data = JSONObject().apply {
            put("token", token)
            put("deviceInfo", deviceInfo)
        }
        socket?.emit("pair", data)
    }
    
    fun reconnect(devId: String) {
        deviceId = devId
        socket?.emit("reconnect_device",
            JSONObject().put("deviceId", devId))
    }
    
    fun reportSmsReceived(
        phone: String, body: String,
        contact: String?, timestamp: Long
    ) {
        val data = JSONObject().apply {
            put("phoneNumber", phone)
            put("body", body)
            put("timestamp", timestamp)
            contact?.let { put("contactName", it) }
        }
        socket?.emit("sms_received", data)
    }
    
    fun reportSendResult(
        requestId: String, success: Boolean, error: String? = null
    ) {
        val data = JSONObject().apply {
            put("requestId", requestId)
            put("success", success)
            error?.let { put("error", it) }
        }
        socket?.emit("sms_send_result", data)
    }
    
    fun reportStatus(battery: Int, signal: Int) {
        val data = JSONObject().apply {
            put("batteryLevel", battery)
            put("signalStrength", signal)
        }
        socket?.emit("status_update", data)
    }
    
    fun disconnect() {
        socket?.disconnect()
        socket = null
        isConnected = false
    }
    
    fun isConnected(): Boolean = isConnected
}
```

### 3.3 二维码扫描与配对

使用 Google ML Kit 和 CameraX 实现二维码扫描功能：

```kotlin
class QrScanActivity : AppCompatActivity() {
    private lateinit var binding: ActivityQrScanBinding
    private lateinit var cameraProvider: ProcessCameraProvider
    
    private val scanner = BarcodeScanning.getClient(
        BarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .build()
    )
    
    private var isProcessing = false
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityQrScanBinding.inflate(layoutInflater)
        setContentView(binding.root)
        startCamera()
    }
    
    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            cameraProvider = cameraProviderFuture.get()
            
            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(binding.previewView.surfaceProvider)
            }
            
            val imageAnalyzer = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also {
                    it.setAnalyzer(
                        ContextCompat.getMainExecutor(this),
                        QrCodeAnalyzer { rawValue ->
                            processQrCode(rawValue)
                        }
                    )
                }
            
            val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA
            
            cameraProvider.unbindAll()
            cameraProvider.bindToLifecycle(
                this, cameraSelector, preview, imageAnalyzer
            )
        }, ContextCompat.getMainExecutor(this))
    }
    
    private fun processQrCode(rawValue: String) {
        if (isProcessing) return
        isProcessing = true
        
        try {
            val json = JSONObject(rawValue)
            val token = json.getString("token")
            val wsUrl = json.getString("wsUrl")
            val serverUrl = json.getString("serverUrl")
            
            // 保存服务器信息
            PreferenceManager.saveServerInfo(this, serverUrl, wsUrl)
            
            // 收集设备信息
            val deviceInfo = JSONObject().apply {
                put("phoneModel", Build.MODEL)
                put("androidVersion", Build.VERSION.RELEASE)
                put("phoneNumber", getPhoneNumber())
                put("batteryLevel", getBatteryLevel())
                put("signalStrength", getSignalStrength())
            }
            
            // 连接并配对
            WebSocketManager.connect(serverUrl)
            WebSocketManager.onPairResult = { success, result ->
                runOnUiThread {
                    if (success) {
                        PreferenceManager.saveDeviceId(this, result!!)
                        Toast.makeText(this, "配对成功！", Toast.LENGTH_SHORT).show()
                        
                        // 启动前台服务
                        val intent = Intent(this, SmsService::class.java)
                        ContextCompat.startForegroundService(this, intent)
                        
                        setResult(RESULT_OK)
                        finish()
                    } else {
                        Toast.makeText(this, "配对失败: $result", Toast.LENGTH_LONG).show()
                        isProcessing = false
                    }
                }
            }
            WebSocketManager.pair(token, deviceInfo)
            
        } catch (e: Exception) {
            Log.e("QR", "Invalid QR code", e)
            Toast.makeText(this, "无效的二维码", Toast.LENGTH_SHORT).show()
            isProcessing = false
        }
    }
    
    private fun getPhoneNumber(): String? {
        return try {
            val tm = getSystemService(TELEPHONY_SERVICE) as TelephonyManager
            if (ActivityCompat.checkSelfPermission(this,
                    Manifest.permission.READ_PHONE_NUMBERS) == 
                    PackageManager.PERMISSION_GRANTED) {
                tm.line1Number
            } else null
        } catch (e: Exception) { null }
    }
    
    private fun getBatteryLevel(): Int {
        val bm = getSystemService(BATTERY_SERVICE) as BatteryManager
        return bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
    }
    
    private fun getSignalStrength(): Int {
        return try {
            val tm = getSystemService(TELEPHONY_SERVICE) as TelephonyManager
            val ss = tm.signalStrength
            ss?.level?.times(25) ?: 0  // 0-4 级转换为百分比
        } catch (e: Exception) { 0 }
    }
}

// QR Code 图像分析器
class QrCodeAnalyzer(
    private val onQrCodeDetected: (String) -> Unit
) : ImageAnalysis.Analyzer {
    
    private val scanner = BarcodeScanning.getClient(
        BarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .build()
    )
    
    @OptIn(ExperimentalGetImage::class)
    override fun analyze(imageProxy: ImageProxy) {
        val mediaImage = imageProxy.image ?: run {
            imageProxy.close()
            return
        }
        
        val inputImage = InputImage.fromMediaImage(
            mediaImage, imageProxy.imageInfo.rotationDegrees
        )
        
        scanner.process(inputImage)
            .addOnSuccessListener { barcodes ->
                barcodes.firstOrNull()?.rawValue?.let { value ->
                    onQrCodeDetected(value)
                }
            }
            .addOnCompleteListener {
                imageProxy.close()
            }
    }
}
```

### 3.4 短信监听与转发

通过 BroadcastReceiver 监听新收到的短信：

```kotlin
class SmsReceiver : BroadcastReceiver() {
    
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        
        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        
        // 合并同一发送者的多段短信
        val smsMap = mutableMapOf<String, StringBuilder>()
        var timestamp = System.currentTimeMillis()
        
        messages.forEach { sms ->
            val phone = sms.displayOriginatingAddress
            smsMap.getOrPut(phone) { StringBuilder() }.append(sms.displayMessageBody)
            timestamp = sms.timestampMillis
        }
        
        smsMap.forEach { (phone, bodyBuilder) ->
            val body = bodyBuilder.toString()
            val contactName = getContactName(context, phone)
            
            // 通过 WebSocket 上报
            WebSocketManager.reportSmsReceived(
                phone, body, contactName, timestamp
            )
        }
    }
    
    private fun getContactName(context: Context, phoneNumber: String): String? {
        return try {
            val uri = Uri.withAppendedPath(
                ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
                Uri.encode(phoneNumber)
            )
            context.contentResolver.query(
                uri,
                arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME),
                null, null, null
            )?.use { cursor ->
                if (cursor.moveToFirst()) {
                    cursor.getString(0)
                } else null
            }
        } catch (e: Exception) { null }
    }
}
```

### 3.5 短信发送

接收服务器指令发送短信：

```kotlin
object SmsSender {
    
    private lateinit var context: Context
    
    fun init(ctx: Context) {
        context = ctx.applicationContext
    }
    
    fun sendSms(requestId: String, phoneNumber: String, body: String) {
        try {
            val smsManager = context.getSystemService(SmsManager::class.java)
            
            // 处理长短信分段发送
            val parts = smsManager.divideMessage(body)
            
            if (parts.size == 1) {
                // 短短信直接发送
                val sentIntent = PendingIntent.getBroadcast(
                    context, requestId.hashCode(),
                    Intent("SMS_SENT").putExtra("requestId", requestId),
                    PendingIntent.FLAG_IMMUTABLE
                )
                smsManager.sendTextMessage(
                    phoneNumber, null, body, sentIntent, null
                )
            } else {
                // 长短信分段发送
                val sentIntents = ArrayList<PendingIntent>()
                parts.forEachIndexed { index, _ ->
                    sentIntents.add(
                        PendingIntent.getBroadcast(
                            context,
                            requestId.hashCode() + index,
                            Intent("SMS_SENT").putExtra("requestId", requestId),
                            PendingIntent.FLAG_IMMUTABLE
                        )
                    )
                }
                smsManager.sendMultipartTextMessage(
                    phoneNumber, null, parts, sentIntents, null
                )
            }
            
            // 上报发送成功
            WebSocketManager.reportSendResult(requestId, true)
            
        } catch (e: Exception) {
            Log.e("SMS", "Failed to send SMS", e)
            WebSocketManager.reportSendResult(requestId, false, e.message)
        }
    }
}
```

### 3.6 前台服务与后台保活

```kotlin
class SmsService : Service() {
    private lateinit var wakeLock: PowerManager.WakeLock
    private val statusHandler = Handler(Looper.getMainLooper())
    
    private val statusRunnable = object : Runnable {
        override fun run() {
            reportDeviceStatus()
            statusHandler.postDelayed(this, 60_000) // 每60秒上报
        }
    }
    
    override fun onCreate() {
        super.onCreate()
        SmsSender.init(this)
        
        // 获取 WakeLock
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "SmsRemote::ServiceWakeLock"
        )
        wakeLock.acquire()
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = createNotification()
        startForeground(NOTIFICATION_ID, notification)
        
        // 连接 WebSocket
        val serverUrl = PreferenceManager.getServerUrl(this)
        val deviceId = PreferenceManager.getDeviceId(this)
        
        if (serverUrl != null) {
            WebSocketManager.connect(serverUrl)
            if (deviceId != null) {
                WebSocketManager.reconnect(deviceId)
            }
        }
        
        // 开始定期状态上报
        statusHandler.post(statusRunnable)
        
        // 注册 WorkManager 守护
        KeepAliveWorker.schedule(this)
        
        return START_STICKY
    }
    
    override fun onDestroy() {
        statusHandler.removeCallbacks(statusRunnable)
        if (wakeLock.isHeld) wakeLock.release()
        WebSocketManager.disconnect()
        super.onDestroy()
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
    
    private fun createNotification(): Notification {
        val channelId = "sms_remote_service"
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "SMS Remote Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "保持短信远程控制服务运行"
            }
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(channel)
        }
        
        val pendingIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        
        return NotificationCompat.Builder(this, channelId)
            .setContentTitle("SMS Remote Control")
            .setContentText("服务运行中 - 已连接到控制台")
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }
    
    private fun reportDeviceStatus() {
        val battery = getBatteryLevel()
        val signal = getSignalStrength()
        WebSocketManager.reportStatus(battery, signal)
    }
    
    private fun getBatteryLevel(): Int {
        val bm = getSystemService(BATTERY_SERVICE) as BatteryManager
        return bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
    }
    
    private fun getSignalStrength(): Int {
        return try {
            val tm = getSystemService(TELEPHONY_SERVICE) as TelephonyManager
            tm.signalStrength?.level?.times(25) ?: 0
        } catch (e: Exception) { 0 }
    }
    
    companion object {
        const val NOTIFICATION_ID = 1001
    }
}
```

### 3.7 WorkManager 守护进程

```kotlin
class KeepAliveWorker(
    context: Context,
    params: WorkerParameters
) : Worker(context, params) {
    
    override fun doWork(): Result {
        if (!isServiceRunning(SmsService::class.java)) {
            val intent = Intent(applicationContext, SmsService::class.java)
            ContextCompat.startForegroundService(applicationContext, intent)
        }
        return Result.success()
    }
    
    private fun isServiceRunning(serviceClass: Class<*>): Boolean {
        val manager = applicationContext
            .getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        @Suppress("DEPRECATION")
        return manager.getRunningServices(Int.MAX_VALUE)
            .any { it.service.className == serviceClass.name }
    }
    
    companion object {
        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<KeepAliveWorker>(
                15, TimeUnit.MINUTES
            ).setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            ).build()
            
            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(
                    "sms_remote_keepalive",
                    ExistingPeriodicWorkPolicy.KEEP,
                    request
                )
        }
    }
}
```

### 3.8 开机自启

```kotlin
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            val deviceId = PreferenceManager.getDeviceId(context)
            if (deviceId != null) {
                val serviceIntent = Intent(context, SmsService::class.java)
                ContextCompat.startForegroundService(context, serviceIntent)
            }
        }
    }
}
```

### 3.9 本地数据存储

```kotlin
object PreferenceManager {
    private const val PREF_NAME = "sms_remote_prefs"
    private const val KEY_SERVER_URL = "server_url"
    private const val KEY_WS_URL = "ws_url"
    private const val KEY_DEVICE_ID = "device_id"
    
    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
    }
    
    fun saveServerInfo(context: Context, serverUrl: String, wsUrl: String) {
        getPrefs(context).edit()
            .putString(KEY_SERVER_URL, serverUrl)
            .putString(KEY_WS_URL, wsUrl)
            .apply()
    }
    
    fun getServerUrl(context: Context): String? {
        return getPrefs(context).getString(KEY_SERVER_URL, null)
    }
    
    fun saveDeviceId(context: Context, deviceId: String) {
        getPrefs(context).edit()
            .putString(KEY_DEVICE_ID, deviceId)
            .apply()
    }
    
    fun getDeviceId(context: Context): String? {
        return getPrefs(context).getString(KEY_DEVICE_ID, null)
    }
    
    fun clearAll(context: Context) {
        getPrefs(context).edit().clear().apply()
    }
}
```

---

## 四、WebSocket 通信协议

### 4.1 事件列表

| 事件名 | 方向 | 数据格式 | 说明 |
|--------|------|----------|------|
| `pair` | Client → Server | `{ token, deviceInfo }` | 发送配对令牌和设备信息 |
| `pair_result` | Server → Client | `{ success, deviceId?, error? }` | 配对结果 |
| `reconnect_device` | Client → Server | `{ deviceId }` | 已配对设备重连 |
| `reconnect_result` | Server → Client | `{ success, error? }` | 重连结果 |
| `sms_received` | Client → Server | `{ phoneNumber, body, contactName?, timestamp }` | 上报收到的短信 |
| `send_sms` | Server → Client | `{ requestId, phoneNumber, body }` | 指令：发送短信 |
| `sms_send_result` | Client → Server | `{ requestId, success, error? }` | 短信发送结果回报 |
| `status_update` | Client → Server | `{ batteryLevel, signalStrength }` | 上报设备状态 |

### 4.2 连接参数

| 参数 | 值 | 说明 |
|------|-----|------|
| namespace | `/device` | 设备专用命名空间 |
| path | `/api/ws` | WebSocket 路径 |
| transports | `["websocket"]` | 传输协议 |
| reconnection | `true` | 自动重连 |
| reconnectionDelay | `3000` | 重连延迟（毫秒） |

### 4.3 配对数据（二维码内容）

二维码包含 JSON 格式的配对信息：

```json
{
  "token": "abc123...xyz789",
  "wsUrl": "wss://your-server.com/api/ws",
  "serverUrl": "https://your-server.com"
}
```

`token` 为 32 位随机字符串，有效期 10 分钟。

---

## 五、厂商适配指南

不同 Android 厂商对后台进程有不同的限制策略，需要引导用户手动开启相关权限：

| 厂商 | 需要开启的设置 |
|------|---------------|
| 小米 (MIUI) | 自启动管理 → 允许自启动；电池优化 → 无限制 |
| 华为 (EMUI) | 应用启动管理 → 手动管理 → 允许自启动、后台活动、关联启动 |
| OPPO (ColorOS) | 应用管理 → 自启动管理 → 允许；省电 → 应用速冻 → 排除 |
| vivo (Funtouch) | i管家 → 应用管理 → 权限管理 → 自启动 → 允许 |
| 三星 (One UI) | 设备维护 → 电池 → 未监视的应用 → 添加 |
| 一加 (OxygenOS) | 电池优化 → 不优化 |

建议在应用首次启动时弹出引导页面，根据检测到的手机品牌显示对应的设置步骤。

---

## 六、项目结构

```
app/src/main/java/com/smsremote/client/
├── SmsRemoteApp.kt          // Application 类
├── receiver/
│   ├── SmsReceiver.kt        // 短信接收广播
│   └── BootReceiver.kt       // 开机自启广播
├── service/
│   ├── SmsService.kt         // 前台服务
│   └── KeepAliveWorker.kt    // WorkManager 守护
├── network/
│   └── WebSocketManager.kt   // WebSocket 管理
├── sms/
│   └── SmsSender.kt          // 短信发送
├── ui/
│   ├── MainActivity.kt       // 主界面
│   └── QrScanActivity.kt     // 扫码界面
└── util/
    └── PreferenceManager.kt   // 本地存储
```

---

## 七、安全注意事项

在开发和部署过程中，请注意以下安全要点：

1. **通信加密**：生产环境必须使用 WSS（WebSocket Secure）协议，确保数据传输加密。

2. **令牌安全**：配对令牌设有 10 分钟有效期，使用后立即失效，防止重放攻击。

3. **设备认证**：每台设备拥有唯一的 `deviceId`，重连时需要验证身份。

4. **权限最小化**：仅申请必要的 Android 权限，避免过度授权。

5. **数据存储**：敏感信息（如 deviceId、serverUrl）存储在 SharedPreferences 中，建议使用 EncryptedSharedPreferences 加密存储。

6. **短信内容**：短信内容在传输过程中通过 TLS 加密，服务端存储时建议考虑数据脱敏策略。

---

*本文档提供了 Android 被控端 APK 的完整开发指南，涵盖了从权限配置到后台保活的所有关键实现细节。开发者可以根据此文档快速搭建一个功能完整的 SMS Remote Control 客户端应用。*
