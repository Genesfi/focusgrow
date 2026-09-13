package com.genesfi.focusgrow

import android.content.Intent
import android.content.ComponentName
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.State
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.zIndex
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.ImageLoader
import coil.compose.AsyncImage
import coil.decode.GifDecoder
import coil.decode.ImageDecoderDecoder
import kotlin.math.max
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.Spring
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.unit.Velocity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Locale

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        SyncManager.init(this)

        // Request notification permission for Android 13+ (API 33+)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 101)
            }
        }

        try {
            val intent = Intent(this, SyncService::class.java)
            startService(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }

        setContent {
            FocusGrowTheme {
                MainScreen()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        SyncManager.isServiceActive = (SyncService.instance != null && !FocusBlockerService.isServiceDisabled)
    }

    @Composable
    fun MainScreen() {
    val context = LocalContext.current
    val packageManager = remember(context) { context.packageManager }
    val scope = rememberCoroutineScope()
    var selectedTab by remember { mutableStateOf(0) }
    var selectedAppForConfig by remember { mutableStateOf<Pair<String, String>?>(null) }
    var usageTimeRange by remember { mutableStateOf(UsageTimeRange.TODAY) }
    var usageResult by remember { mutableStateOf<AppUsageResult?>(null) }
    var isLoadingUsage by remember { mutableStateOf(false) }
    var showAllUsageApps by remember { mutableStateOf(false) }

    LaunchedEffect(selectedTab, usageTimeRange) {
        if (selectedTab == 1 && SyncManager.hasUsageStatsPermission(context)) {
            isLoadingUsage = true
            val isEn = SyncManager.currentLanguage == "en"
            val res = withContext(Dispatchers.IO) {
                AppUsageTracker.getUsageStats(context, usageTimeRange, isEn)
            }
            usageResult = res
            isLoadingUsage = false
        }
    }
        var ipInput by remember { mutableStateOf(SyncManager.pcIpAddress) }
        val status = SyncManager.currentStatus
        val isPrayerBreak = status.isPrayerBreak
        val isBreakMode = status.state == "resting" || isPrayerBreak

        // Pull to refresh gesture & state
        var isRefreshing by remember { mutableStateOf(false) }
        var pullOffset by remember { mutableFloatStateOf(0f) }
        val refreshTrigger = 240f

        val nestedScrollConnection = remember {
            object : NestedScrollConnection {
                override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
                    if (pullOffset > 0f && available.y < 0f) {
                        val consumed = available.y
                        pullOffset = (pullOffset + consumed).coerceAtLeast(0f)
                        return Offset(0f, consumed)
                    }
                    return Offset.Zero
                }

                override fun onPostScroll(consumed: Offset, available: Offset, source: NestedScrollSource): Offset {
                    if (available.y > 0f && source == NestedScrollSource.Drag) {
                        val friction = 0.35f // Balanced pull friction
                        pullOffset = (pullOffset + available.y * friction).coerceAtMost(380f)
                        return Offset(0f, available.y)
                    }
                    return Offset.Zero
                }

                override suspend fun onPreFling(available: Velocity): Velocity {
                    if (pullOffset >= refreshTrigger && !isRefreshing) {
                        isRefreshing = true
                        pullOffset = refreshTrigger
                        SyncService.triggerManualSync {
                            isRefreshing = false
                            pullOffset = 0f
                        }
                    } else {
                        pullOffset = 0f
                    }
                    return Velocity.Zero
                }
            }
        }

        val animatedPullOffsetState = animateFloatAsState(
            targetValue = if (isRefreshing) 60f else pullOffset,
            animationSpec = spring(stiffness = Spring.StiffnessMediumLow),
            label = "pullOffset"
        )

        // Dynamic theme accents
        val primaryAccent = when {
            isPrayerBreak -> Color(0xFF10B981) // Islamic Emerald
            status.state == "resting" -> Color(0xFF14B8A6) // Refreshing Teal
            status.state == "focusing" -> Color(0xFF38BDF8) // Electric Sky
            else -> Color(0xFF94A3B8) // Slate Gray
        }

        val secondaryAccent = when {
            isPrayerBreak -> Color(0xFF059669) // Deep Green
            status.state == "resting" -> Color(0xFF0D9488) // Deep Teal
            status.state == "focusing" -> Color(0xFF6366F1) // Indigo
            else -> Color(0xFF64748B)
        }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Brush.verticalGradient(listOf(Color(0xFF090D16), Color(0xFF0F172A), Color(0xFF1E293B))))
                .nestedScroll(nestedScrollConnection)
        ) {
            // Floating Pull-to-Refresh Indicator (Isolated scope for zero lag)
            Box(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .zIndex(10f)
            ) {
                PullRefreshIndicatorHeader(
                    pullOffsetState = animatedPullOffsetState,
                    isRefreshing = isRefreshing,
                    primaryAccent = primaryAccent,
                    refreshTrigger = refreshTrigger
                )
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(bottom = 76.dp)
            ) {
                // Fixed Sticky Top App Header Bar
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .zIndex(5f),
                    color = Color(0xFF090D16).copy(alpha = 0.92f)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(38.dp)
                                    .background(
                                        Brush.linearGradient(listOf(primaryAccent, secondaryAccent)),
                                        CircleShape
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                if (isPrayerBreak) {
                                    Text("🕌", fontSize = 18.sp)
                                } else {
                                    Icon(
                                        imageVector = if (status.state == "resting") Icons.Default.Favorite else Icons.Default.Check,
                                        contentDescription = null,
                                        tint = Color.Black,
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text(
                                    "FocusGrow",
                                    fontSize = 20.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color.White,
                                    letterSpacing = 0.5.sp
                                )
                                val isEn = SyncManager.currentLanguage == "en"
                                Text(
                                    if (isPrayerBreak) (if (isEn) "🕌 Prayer Break Time" else "🕌 Waktu Istirahat Sholat") else if (status.state == "resting") "☕ Recharge & Stretch" else "Cross-Platform Sync",
                                    fontSize = 11.sp,
                                    color = Color.White.copy(alpha = 0.5f)
                                )
                            }
                        }

                        // Sync button & Connection badge
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconButton(
                                onClick = {
                                    if (!isRefreshing) {
                                        isRefreshing = true
                                        SyncService.triggerManualSync {
                                            isRefreshing = false
                                        }
                                    }
                                },
                                modifier = Modifier.size(34.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Refresh,
                                    contentDescription = "Sync",
                                    tint = if (isRefreshing) primaryAccent else Color.White.copy(alpha = 0.75f),
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(4.dp))

                            Surface(
                                shape = RoundedCornerShape(20.dp),
                                color = Color.White.copy(alpha = 0.06f),
                                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(8.dp)
                                            .background(if (status.isOnline) Color(0xFF10B981) else Color(0xFF38BDF8), CircleShape)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = if (status.isOnline) "WIFI PC" else "CLOUD",
                                        color = Color.White.copy(alpha = 0.8f),
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        letterSpacing = 1.sp
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.width(6.dp))

                            // Service ON/OFF Toggle Switch
                            Switch(
                                checked = SyncManager.isServiceActive,
                                onCheckedChange = { enabled ->
                                    SyncManager.isServiceActive = enabled
                                    if (enabled) {
                                        FocusBlockerService.isServiceDisabled = false
                                        val intent = Intent(context, SyncService::class.java)
                                        context.startService(intent)
                                        android.widget.Toast.makeText(context, if (SyncManager.currentLanguage == "en") "Sync Service Enabled" else "Layanan Sync Diaktifkan", android.widget.Toast.LENGTH_SHORT).show()
                                    } else {
                                        FocusBlockerService.isServiceDisabled = true
                                        FocusBlockerService.instance?.hideAllOverlays()
                                        val intent = Intent(context, SyncService::class.java).apply {
                                            action = "ACTION_STOP_SERVICE"
                                        }
                                        context.startService(intent)
                                        context.stopService(intent)
                                        val manager = context.getSystemService(android.content.Context.NOTIFICATION_SERVICE) as? android.app.NotificationManager
                                        manager?.cancelAll()
                                        android.widget.Toast.makeText(context, if (SyncManager.currentLanguage == "en") "Sync Service Stopped" else "Layanan Sync Dimatikan", android.widget.Toast.LENGTH_SHORT).show()
                                    }
                                },
                                modifier = Modifier.scale(0.75f),
                                colors = SwitchDefaults.colors(
                                    checkedThumbColor = Color.White,
                                    checkedTrackColor = Color(0xFF10B981),
                                    uncheckedThumbColor = Color(0xFF94A3B8),
                                    uncheckedTrackColor = Color.White.copy(alpha = 0.12f)
                                )
                            )
                        }
                    }
                }

                // Scrollable Content Below Header
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .padding(horizontal = 20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    item {
                        Spacer(modifier = Modifier.height(12.dp))
                    }

                when (selectedTab) {
                    0 -> {
                        // TAB 0: FOKUS (Hero Circular Timer + Break Alert + Quick glance)
                        item {
                            // Hero Circular Timer
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier.size(250.dp)
                            ) {
                                val progress = if (status.maxPeriodSec > 0) {
                                    (status.remainingSec.toFloat() / status.maxPeriodSec.toFloat()).coerceIn(0f, 1f)
                                } else 0f

                                val context = LocalContext.current
                                val imageLoader = remember {
                                    ImageLoader.Builder(context)
                                        .components {
                                            if (android.os.Build.VERSION.SDK_INT >= 28) {
                                                add(ImageDecoderDecoder.Factory())
                                            } else {
                                                add(GifDecoder.Factory())
                                            }
                                        }
                                        .build()
                                }

                                val gifModel: Any? = remember(status.customGif) {
                                    if (status.customGif.startsWith("data:")) {
                                        try {
                                            val commaIdx = status.customGif.indexOf(',')
                                            val base64Str = if (commaIdx != -1) status.customGif.substring(commaIdx + 1) else status.customGif
                                            android.util.Base64.decode(base64Str, android.util.Base64.DEFAULT)
                                        } catch (e: Exception) {
                                            null
                                        }
                                    } else if (status.customGif.startsWith("http")) {
                                        status.customGif
                                    } else {
                                        null
                                    }
                                }

                                // Background Custom Animated GIF inside gauge if synced from PC
                                if (gifModel != null) {
                                    AsyncImage(
                                        model = gifModel,
                                        imageLoader = imageLoader,
                                        contentDescription = "Ambient GIF",
                                        contentScale = ContentScale.Crop,
                                        modifier = Modifier
                                            .size(195.dp)
                                            .clip(CircleShape)
                                            .alpha(status.gifOpacity.coerceIn(0.2f, 0.95f))
                                    )
                                }

                                Canvas(modifier = Modifier.fillMaxSize().padding(14.dp)) {
                                    drawArc(
                                        color = Color.White.copy(alpha = 0.06f),
                                        startAngle = 0f,
                                        sweepAngle = 360f,
                                        useCenter = false,
                                        style = Stroke(width = 12.dp.toPx(), cap = StrokeCap.Round)
                                    )
                                    drawArc(
                                        brush = Brush.sweepGradient(listOf(primaryAccent, secondaryAccent, primaryAccent)),
                                        startAngle = -90f,
                                        sweepAngle = 360f * progress,
                                        useCenter = false,
                                        style = Stroke(width = 14.dp.toPx(), cap = StrokeCap.Round)
                                    )
                                }

                                // Semi-transparent scrim to ensure timer numbers are always crisp & legible
                                Box(
                                    modifier = Modifier
                                        .size(195.dp)
                                        .background(
                                            Color.Black.copy(alpha = if (gifModel != null) 0.42f else 0f),
                                            CircleShape
                                        ),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text(
                                            text = status.formattedTime,
                                            fontSize = 52.sp,
                                            fontWeight = FontWeight.Black,
                                            color = Color.White,
                                            letterSpacing = (-1).sp
                                        )

                                        Spacer(modifier = Modifier.height(4.dp))

                                        Surface(
                                            color = primaryAccent.copy(alpha = 0.2f),
                                            shape = RoundedCornerShape(16.dp),
                                            border = BorderStroke(1.dp, primaryAccent.copy(alpha = 0.4f))
                                        ) {
                                            val isEn = SyncManager.currentLanguage == "en"
                                            val stateLabel = when {
                                                isPrayerBreak -> if (isEn) "🕌 PRAYER BREAK" else "🕌 WAKTU SHOLAT"
                                                status.state == "resting" -> if (isEn) "☕ BREAK TIME" else "☕ WAKTU ISTIRAHAT"
                                                status.state == "focusing" -> if (status.isPaused) (if (isEn) "⏸ PAUSED" else "⏸ DIJEDA") else (if (isEn) "🎯 FOCUS ACTIVE" else "🎯 FOKUS AKTIF")
                                                else -> "STANDBY / IDLE"
                                            }
                                            Text(
                                                text = stateLabel,
                                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 5.dp),
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.ExtraBold,
                                                color = primaryAccent,
                                                letterSpacing = 1.sp
                                            )
                                        }

                                        if (status.state != "idle") {
                                            Spacer(modifier = Modifier.height(6.dp))
                                            val isEn = SyncManager.currentLanguage == "en"
                                            Text(
                                                text = if (isPrayerBreak) (if (isEn) "15-Min Prayer Break" else "Istirahat Sholat 15 Menit") else (if (isEn) "Session ${status.currentPeriod} of ${status.totalPeriods}" else "Sesi ${status.currentPeriod} dari ${status.totalPeriods}"),
                                                color = Color.White.copy(alpha = 0.75f),
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Medium
                                            )
                                        }
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(24.dp))

                            // Break Advice Card (Prayer Break vs Regular Resting)
                            AnimatedVisibility(
                                visible = isBreakMode,
                                enter = fadeIn() + expandVertically(),
                                exit = fadeOut() + shrinkVertically()
                            ) {
                                val isEn = SyncManager.currentLanguage == "en"
                                if (isPrayerBreak) {
                                    Surface(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(bottom = 16.dp),
                                        shape = RoundedCornerShape(20.dp),
                                        color = Color(0xFF10B981).copy(alpha = 0.12f),
                                        border = BorderStroke(1.dp, Color(0xFF10B981).copy(alpha = 0.4f))
                                    ) {
                                        Column(modifier = Modifier.padding(18.dp)) {
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Text("🕌", fontSize = 20.sp)
                                                Spacer(modifier = Modifier.width(8.dp))
                                                Text(
                                                    if (isEn) "Prayer Time Has Arrived!" else "Waktu Sholat Telah Tiba!",
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 14.sp,
                                                    color = Color(0xFF10B981)
                                                )
                                            }
                                            Spacer(modifier = Modifier.height(8.dp))
                                            Text(
                                                if (isEn) "• 15-minute prayer break in progress\n• Perform wudhu and offer prayer\n• Social & game apps temporarily blocked for focused worship!" else "• Istirahat sholat 15 menit sedang berlangsung\n• Segera ambil wudhu dan laksanakan sholat berjamaah\n• Aplikasi sosmed & game diblokir sementara agar ibadah lebih khusyuk!",
                                                fontSize = 12.sp,
                                                color = Color.White.copy(alpha = 0.88f),
                                                lineHeight = 18.sp
                                            )
                                        }
                                    }
                                } else {
                                    Surface(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(bottom = 16.dp),
                                        shape = RoundedCornerShape(20.dp),
                                        color = Color(0xFF14B8A6).copy(alpha = 0.1f),
                                        border = BorderStroke(1.dp, Color(0xFF14B8A6).copy(alpha = 0.35f))
                                    ) {
                                        Column(modifier = Modifier.padding(18.dp)) {
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Icon(
                                                    Icons.Default.Notifications,
                                                    contentDescription = null,
                                                    tint = Color(0xFF14B8A6),
                                                    modifier = Modifier.size(18.dp)
                                                )
                                                Spacer(modifier = Modifier.width(8.dp))
                                                Text(
                                                    if (isEn) "Time to Walk Outside & Stretch!" else "Waktunya Jalan Keluar & Stretching!",
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 14.sp,
                                                    color = Color(0xFF14B8A6)
                                                )
                                            }
                                            Spacer(modifier = Modifier.height(8.dp))
                                            Text(
                                                if (isEn) "• Get fresh air outside & drink water\n• Stretch your neck, shoulders, and back\n• Phone will vibrate and sound alarm when break ends!" else "• Hirup udara segar di luar rumah & minum air putih\n• Regangkan otot leher, bahu, dan punggung\n• HP akan bergetar dan membunyikan alarm saat waktu break habis!",
                                                fontSize = 12.sp,
                                                color = Color.White.copy(alpha = 0.85f),
                                                lineHeight = 18.sp
                                            )
                                        }
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            // Prayer Schedule Card
                            PrayerScheduleCard(status = status)

                            Spacer(modifier = Modifier.height(16.dp))

                            // Quick Glance Productivity Card
                            val isEn0 = SyncManager.currentLanguage == "en"
                            ModernCard(title = if (isEn0) "Focus Summary" else "Ringkasan Fokus", icon = Icons.Default.Info) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                                ) {
                                    StatBox(
                                        label = if (isEn0) "Focus Streak" else "Streak Fokus",
                                        value = "${status.streakDays} " + (if (isEn0) "Days" else "Hari"),
                                        subtitle = if (isEn0) "Consistency" else "Konsistensi",
                                        icon = "🔥",
                                        modifier = Modifier.weight(1f)
                                    )
                                    StatBox(
                                        label = if (isEn0) "Today's Focus" else "Fokus Hari Ini",
                                        value = "${status.completedMinutes} " + (if (isEn0) "mins" else "mnt"),
                                        subtitle = if (isEn0) "Goal ${status.dailyGoalHours.toInt()} hrs" else "Target ${status.dailyGoalHours.toInt()} jam",
                                        icon = "⏱️",
                                        modifier = Modifier.weight(1f)
                                    )
                                }
                            }
                        }
                    }

                    1 -> {
                        // TAB 1: STATISTIK
                        item {
                            val isEn1 = SyncManager.currentLanguage == "en"
                            ModernCard(title = if (isEn1) "Daily Productivity Statistics" else "Statistik Produktivitas Harian", icon = Icons.Default.DateRange) {
                                Column {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                                    ) {
                                        StatBox(
                                            label = if (isEn1) "Focus Streak" else "Streak Fokus",
                                            value = "${status.streakDays} " + (if (isEn1) "Days" else "Hari"),
                                            subtitle = if (isEn1) "Consistency" else "Konsistensi",
                                            icon = "🔥",
                                            modifier = Modifier.weight(1f)
                                        )
                                        StatBox(
                                            label = if (isEn1) "Today's Focus" else "Fokus Hari Ini",
                                            value = "${status.completedMinutes} " + (if (isEn1) "mins" else "mnt"),
                                            subtitle = if (isEn1) "Goal ${status.dailyGoalHours.toInt()} hrs" else "Target ${status.dailyGoalHours.toInt()} jam",
                                            icon = "⏱️",
                                            modifier = Modifier.weight(1f)
                                        )
                                    }

                                    Spacer(modifier = Modifier.height(14.dp))

                                    // Goal Progress Bar
                                    val goalTotalMins = max(1, (status.dailyGoalHours * 60).toInt())
                                    val goalProgress = (status.completedMinutes.toFloat() / goalTotalMins.toFloat()).coerceIn(0f, 1f)

                                    Column {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text(if (isEn1) "Daily Goal Progress" else "Pencapaian Target Harian", fontSize = 11.sp, color = Color.White.copy(alpha = 0.6f))
                                            Text("${(goalProgress * 100).toInt()}%", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = primaryAccent)
                                        }
                                        Spacer(modifier = Modifier.height(6.dp))
                                        ClipProgressBar(progress = goalProgress, color = primaryAccent)
                                    }

                                    Spacer(modifier = Modifier.height(12.dp))
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text(if (isEn1) "Yesterday's focus time:" else "Waktu fokus kemarin:", fontSize = 11.sp, color = Color.White.copy(alpha = 0.5f))
                                        Text("${status.yesterdayHours} " + (if (isEn1) "hrs" else "jam"), fontSize = 12.sp, color = Color.White, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            ModernCard(title = if (isEn1) "Achievements & Evaluation" else "Pencapaian & Evaluasi", icon = Icons.Default.CheckCircle) {
                                Column {
                                    Text(
                                        if (isEn1) "Consistency is key. You have maintained focus for ${status.streakDays} consecutive days!" else "Konsistensi adalah kunci. Anda telah mempertahankan fokus selama ${status.streakDays} hari berturut-turut!",
                                        fontSize = 12.sp,
                                        color = Color.White.copy(alpha = 0.8f),
                                        lineHeight = 18.sp
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        if (isEn1) "Daily Goal: ${status.dailyGoalHours} hours (${(status.dailyGoalHours * 60).toInt()} mins)" else "Target harian: ${status.dailyGoalHours} jam (${(status.dailyGoalHours * 60).toInt()} menit)",
                                        fontSize = 11.sp,
                                        color = Color(0xFF38BDF8),
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            // App Screen Time Tracker (Daily, Weekly, Monthly)
                            AppUsageSection(
                                context = context,
                                isEn = isEn1,
                                primaryAccent = primaryAccent,
                                selectedRange = usageTimeRange,
                                onRangeSelected = { usageTimeRange = it },
                                usageResult = usageResult,
                                isLoading = isLoadingUsage,
                                showAll = showAllUsageApps,
                                onToggleShowAll = { showAllUsageApps = !showAllUsageApps },
                                onRefresh = {
                                    if (SyncManager.hasUsageStatsPermission(context)) {
                                        isLoadingUsage = true
                                        val isEn = SyncManager.currentLanguage == "en"
                                        scope.launch {
                                            val res = withContext(Dispatchers.IO) {
                                                AppUsageTracker.getUsageStats(context, usageTimeRange, isEn)
                                            }
                                            usageResult = res
                                            isLoadingUsage = false
                                        }
                                    }
                                }
                            )
                        }
                    }

                    2 -> {
                        // TAB 2: APLIKASI TERBLOKIR
                        val isEn2 = SyncManager.currentLanguage == "en"

                        item {
                            ModernCard(title = if (isEn2) "Blocked Apps During Focus" else "Aplikasi Terblokir Saat Fokus", icon = Icons.Default.List) {
                                var showAppPicker by remember { mutableStateOf(false) }
                                var installedApps by remember { mutableStateOf<List<Pair<String, String>>>(emptyList()) }
                                var isLoadingApps by remember { mutableStateOf(false) }

                                LaunchedEffect(showAppPicker) {
                                    if (showAppPicker && installedApps.isEmpty()) {
                                        isLoadingApps = true
                                        val apps = withContext(Dispatchers.IO) {
                                            val mainIntent = Intent(Intent.ACTION_MAIN, null).apply {
                                                addCategory(Intent.CATEGORY_LAUNCHER)
                                            }
                                            val resolveInfos = packageManager.queryIntentActivities(mainIntent, 0)
                                            resolveInfos.mapNotNull { resolveInfo ->
                                                val pkg = resolveInfo.activityInfo.packageName
                                                if (pkg == context.packageName) null
                                                else {
                                                    val label = resolveInfo.loadLabel(packageManager).toString()
                                                    pkg to label
                                                }
                                            }.distinctBy { it.first }.sortedBy { it.second.lowercase(Locale.ROOT) }
                                        }
                                        installedApps = apps
                                        isLoadingApps = false
                                    }
                                }

                                Button(
                                    onClick = { showAppPicker = true },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(44.dp),
                                    shape = RoundedCornerShape(12.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(0.08f))
                                ) {
                                    Icon(Icons.Default.Add, null, modifier = Modifier.size(16.dp), tint = Color(0xFF38BDF8))
                                    Spacer(Modifier.width(8.dp))
                                    Text(if (isEn2) "ADD APP TO BLOCK LIST" else "TAMBAH APLIKASI UNTUK DIBLOKIR", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Color.White)
                                }

                                if (showAppPicker) {
                                    var search by remember { mutableStateOf("") }
                                    val filtered = remember(search, installedApps) {
                                        if (search.isBlank()) installedApps
                                        else installedApps.filter {
                                            it.second.contains(search, true) || it.first.contains(search, true)
                                        }
                                    }

                                    AlertDialog(
                                        onDismissRequest = { showAppPicker = false },
                                        title = { Text(if (SyncManager.currentLanguage == "en") "Select App to Block" else "Pilih Aplikasi untuk Diblokir", fontWeight = FontWeight.Bold, color = Color.White) },
                                        text = {
                                            Column {
                                                OutlinedTextField(
                                                    value = search,
                                                    onValueChange = { search = it },
                                                    placeholder = { Text(if (SyncManager.currentLanguage == "en") "Search app name..." else "Cari nama aplikasi...") },
                                                    modifier = Modifier.fillMaxWidth(),
                                                    shape = RoundedCornerShape(12.dp)
                                                )
                                                Spacer(Modifier.height(10.dp))
                                                Box(
                                                    modifier = Modifier
                                                        .fillMaxWidth()
                                                        .height(300.dp),
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    if (isLoadingApps) {
                                                        Column(
                                                            modifier = Modifier.fillMaxWidth(),
                                                            horizontalAlignment = Alignment.CenterHorizontally,
                                                            verticalArrangement = Arrangement.Center
                                                        ) {
                                                            CircularProgressIndicator(color = Color(0xFF38BDF8), modifier = Modifier.size(36.dp))
                                                            Spacer(Modifier.height(12.dp))
                                                            Text(
                                                                if (SyncManager.currentLanguage == "en") "Loading apps..." else "Memuat daftar aplikasi...",
                                                                color = Color.Gray,
                                                                fontSize = 12.sp
                                                            )
                                                        }
                                                    } else {
                                                        LazyColumn(modifier = Modifier.fillMaxSize()) {
                                                            items(filtered, key = { it.first }) { (pkg, name) ->
                                                                ListItem(
                                                                    headlineContent = { Text(name, color = Color.White, fontWeight = FontWeight.SemiBold) },
                                                                    supportingContent = { Text(pkg, fontSize = 10.sp, color = Color.Gray) },
                                                                    modifier = Modifier.clickable {
                                                                        SyncManager.addApp(pkg)
                                                                        showAppPicker = false
                                                                    },
                                                                    colors = ListItemDefaults.colors(containerColor = Color.Transparent)
                                                                )
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        },
                                        confirmButton = {
                                            TextButton(onClick = { showAppPicker = false }) {
                                                Text(if (SyncManager.currentLanguage == "en") "CANCEL" else "BATAL", color = Color(0xFF38BDF8))
                                            }
                                        },
                                        containerColor = Color(0xFF1E293B)
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(12.dp))
                        }

                        // Render restricted apps list
                        items(SyncManager.restrictedApps, key = { it }) { pkg ->
                            val appName = remember(pkg) {
                                try {
                                    val info = packageManager.getApplicationInfo(pkg, 0)
                                    packageManager.getApplicationLabel(info).toString()
                                } catch (e: Exception) {
                                    pkg
                                }
                            }
                            val limitMins = SyncManager.getAppLimit(pkg)
                            val cooldownMins = SyncManager.getAppCooldown(pkg)
                            FilterItem(
                                name = appName,
                                pkg = pkg,
                                limitMins = limitMins,
                                cooldownMins = cooldownMins,
                                onConfigure = { selectedAppForConfig = pkg to appName },
                                onDelete = { SyncManager.removeApp(pkg) }
                            )
                        }
                    }

                    3 -> {
                        // TAB 3: RIWAYAT
                        item {
                            val isEn3 = SyncManager.currentLanguage == "en"
                            ModernCard(title = if (isEn3) "Session History & Logs" else "Riwayat & Catatan Sesi", icon = Icons.Default.Info) {
                                Column {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(if (isEn3) "Yesterday" else "Kemarin", fontSize = 13.sp, color = Color.White.copy(alpha = 0.7f))
                                        Text("${status.yesterdayHours} " + (if (isEn3) "Hours Completed" else "Jam Selesai"), fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color(0xFF38BDF8))
                                    }
                                    Spacer(modifier = Modifier.height(10.dp))
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(if (isEn3) "Today" else "Hari Ini", fontSize = 13.sp, color = Color.White.copy(alpha = 0.7f))
                                        Text("${status.completedMinutes} " + (if (isEn3) "Minutes Completed" else "Menit Selesai"), fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color(0xFF10B981))
                                    }
                                    Spacer(modifier = Modifier.height(10.dp))
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(if (isEn3) "Active Streak" else "Streak Aktif", fontSize = 13.sp, color = Color.White.copy(alpha = 0.7f))
                                        Text("${status.streakDays} " + (if (isEn3) "Days Streak" else "Hari Beruntun"), fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF59E0B))
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            PrayerScheduleCard(status = status)

                            Spacer(modifier = Modifier.height(16.dp))

                            ModernCard(title = if (isEn3) "Cross-Platform Sync" else "Sinkronisasi Cross-Platform", icon = Icons.Default.CheckCircle) {
                                Text(
                                    if (isEn3) "All focus time, history, and browsing session permissions are synced in real-time across PC Desktop, Chrome Extension, and Android via Firebase Cloud." else "Semua waktu fokus, riwayat, dan izin sesi browsing disinkronkan secara real-time antara PC Desktop, Chrome Extension, dan HP Android melalui Firebase Cloud.",
                                    fontSize = 12.sp,
                                    color = Color.White.copy(alpha = 0.75f),
                                    lineHeight = 18.sp
                                )
                            }
                        }
                    }

                    4 -> {
                        // TAB 4: PENGATURAN
                        item {
                            ModernCard(title = if (SyncManager.currentLanguage == "en") "Desktop PC Connection" else "Koneksi PC Desktop", icon = Icons.Default.Settings) {
                                Column {
                                    var showQrScanner by remember { mutableStateOf(false) }
                                    val context = LocalContext.current

                                    val cameraPermissionLauncher = rememberLauncherForActivityResult(
                                        contract = ActivityResultContracts.RequestPermission()
                                    ) { isGranted ->
                                        if (isGranted) {
                                            showQrScanner = true
                                        } else {
                                            android.widget.Toast.makeText(context, "Izin kamera diperlukan untuk scan QR Code", android.widget.Toast.LENGTH_SHORT).show()
                                        }
                                    }

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        OutlinedTextField(
                                            value = ipInput,
                                            onValueChange = {
                                                ipInput = it
                                                SyncManager.setPcIp(it)
                                            },
                                            label = { Text("IP Address PC (Wi-Fi Lokal)") },
                                            placeholder = { Text("192.168.1.13") },
                                            modifier = Modifier.weight(1f),
                                            shape = RoundedCornerShape(14.dp),
                                            singleLine = true,
                                            colors = OutlinedTextFieldDefaults.colors(
                                                unfocusedTextColor = Color.White,
                                                focusedTextColor = Color.White,
                                                unfocusedContainerColor = Color.White.copy(0.03f),
                                                focusedContainerColor = Color.White.copy(0.06f),
                                                focusedBorderColor = Color(0xFF38BDF8),
                                                unfocusedBorderColor = Color.White.copy(0.12f)
                                            )
                                        )

                                        Spacer(modifier = Modifier.width(8.dp))

                                        Surface(
                                            onClick = {
                                                if (ContextCompat.checkSelfPermission(context, android.Manifest.permission.CAMERA) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                                                    showQrScanner = true
                                                } else {
                                                    cameraPermissionLauncher.launch(android.Manifest.permission.CAMERA)
                                                }
                                            },
                                            shape = RoundedCornerShape(14.dp),
                                            color = Color(0xFF10B981).copy(alpha = 0.18f),
                                            border = BorderStroke(1.dp, Color(0xFF10B981).copy(alpha = 0.5f)),
                                            modifier = Modifier.size(52.dp)
                                        ) {
                                            Box(
                                                contentAlignment = Alignment.Center,
                                                modifier = Modifier.fillMaxSize()
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Default.Search,
                                                    contentDescription = "Scan QR",
                                                    tint = Color(0xFF10B981),
                                                    modifier = Modifier.size(22.dp)
                                                )
                                            }
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(12.dp))

                                    Button(
                                        onClick = {
                                            SyncManager.setPcIp(ipInput)
                                            val intent = Intent(context, SyncService::class.java)
                                            context.stopService(intent)
                                            context.startService(intent)
                                            android.widget.Toast.makeText(context, "Menghubungkan ulang ke IP: $ipInput", android.widget.Toast.LENGTH_SHORT).show()
                                        },
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(46.dp),
                                        shape = RoundedCornerShape(12.dp),
                                        colors = ButtonDefaults.buttonColors(
                                            containerColor = Color(0xFF38BDF8),
                                            contentColor = Color(0xFF0F172A)
                                        )
                                    ) {
                                        Icon(Icons.Default.Refresh, null, modifier = Modifier.size(16.dp))
                                        Spacer(Modifier.width(8.dp))
                                        Text("SIMPAN & RECONNECT", fontWeight = FontWeight.ExtraBold, fontSize = 12.sp)
                                    }

                                    if (showQrScanner) {
                                        QrScannerDialog(
                                            onDismiss = { showQrScanner = false },
                                            onIpScanned = { scannedIp ->
                                                showQrScanner = false
                                                ipInput = scannedIp
                                                SyncManager.setPcIp(scannedIp)
                                                val intent = Intent(context, SyncService::class.java)
                                                context.stopService(intent)
                                                context.startService(intent)
                                                android.widget.Toast.makeText(context, "Terhubung ke PC: $scannedIp", android.widget.Toast.LENGTH_SHORT).show()
                                            }
                                        )
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            // App Language Card
                            ModernCard(
                                title = if (SyncManager.currentLanguage == "en") "App Language" else "Bahasa Aplikasi",
                                icon = Icons.Default.Settings
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    val currentLang = SyncManager.currentLanguage

                                    Surface(
                                        onClick = { SyncManager.setLanguage("id") },
                                        shape = RoundedCornerShape(12.dp),
                                        color = if (currentLang == "id") Color(0xFF38BDF8).copy(alpha = 0.2f) else Color.White.copy(alpha = 0.04f),
                                        border = BorderStroke(1.dp, if (currentLang == "id") Color(0xFF38BDF8) else Color.White.copy(alpha = 0.1f)),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(vertical = 12.dp, horizontal = 12.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.Center
                                        ) {
                                            Text("🇮🇩", fontSize = 16.sp)
                                            Spacer(Modifier.width(8.dp))
                                            Text("Indonesia", fontSize = 12.sp, fontWeight = if (currentLang == "id") FontWeight.Bold else FontWeight.Medium, color = Color.White)
                                        }
                                    }

                                    Surface(
                                        onClick = { SyncManager.setLanguage("en") },
                                        shape = RoundedCornerShape(12.dp),
                                        color = if (currentLang == "en") Color(0xFF38BDF8).copy(alpha = 0.2f) else Color.White.copy(alpha = 0.04f),
                                        border = BorderStroke(1.dp, if (currentLang == "en") Color(0xFF38BDF8) else Color.White.copy(alpha = 0.1f)),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(vertical = 12.dp, horizontal = 12.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.Center
                                        ) {
                                            Text("🇬🇧", fontSize = 16.sp)
                                            Spacer(Modifier.width(8.dp))
                                            Text("English", fontSize = 12.sp, fontWeight = if (currentLang == "en") FontWeight.Bold else FontWeight.Medium, color = Color.White)
                                        }
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            // Permissions Card
                            val isOverlayActive = remember(context) { Settings.canDrawOverlays(context) }
                            val isAccessibilityActive = remember(context) {
                                try {
                                    val am = context.getSystemService(android.content.Context.ACCESSIBILITY_SERVICE) as? android.view.accessibility.AccessibilityManager
                                    val enabledServices = am?.getEnabledAccessibilityServiceList(android.accessibilityservice.AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
                                    enabledServices?.any { it.resolveInfo.serviceInfo.packageName == context.packageName } ?: false
                                } catch (e: Exception) {
                                    false
                                }
                            }
                            val isUsageAccessActive = remember(context) { SyncManager.hasUsageStatsPermission(context) }

                            ModernCard(
                                title = if (SyncManager.currentLanguage == "en") "System Permissions" else "Perizinan Sistem",
                                icon = Icons.Default.CheckCircle
                            ) {
                                Column {
                                    PermissionRow(
                                        title = if (SyncManager.currentLanguage == "en") "1. Pop-up / Overlay Display Permission" else "1. Izin Tampilan Pop-up / Overlay",
                                        isGranted = isOverlayActive
                                    ) {
                                        val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).apply {
                                            data = android.net.Uri.parse("package:${context.packageName}")
                                        }
                                        context.startActivity(intent)
                                    }

                                    Spacer(modifier = Modifier.height(10.dp))

                                    PermissionRow(
                                        title = if (SyncManager.currentLanguage == "en") "2. Accessibility (Instant 0ms Blocker)" else "2. Aksesibilitas (Pemblokir Instan 0ms)",
                                        isGranted = isAccessibilityActive
                                    ) {
                                        try {
                                            val componentName = ComponentName(context, FocusBlockerService::class.java)
                                            val intent = Intent("android.settings.ACCESSIBILITY_DETAILS_SETTINGS").apply {
                                                putExtra(Intent.EXTRA_COMPONENT_NAME, componentName.flattenToString())
                                                putExtra(":settings:fragment_args_key", componentName.flattenToString())
                                                putExtra(":settings:show_fragment_args", Bundle().apply {
                                                    putString(":settings:fragment_args_key", componentName.flattenToString())
                                                })
                                            }
                                            context.startActivity(intent)
                                        } catch (e: Exception) {
                                            try {
                                                val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                                                    putExtra(":settings:fragment_args_key", "downloaded_services")
                                                }
                                                context.startActivity(intent)
                                            } catch (e2: Exception) {
                                                context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                                            }
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(10.dp))

                                    PermissionRow(
                                        title = if (SyncManager.currentLanguage == "en") "3. Usage Access (Bank-Safe / Hybrid)" else "3. Akses Penggunaan (Bebas Blokir Bank / Hybrid)",
                                        isGranted = isUsageAccessActive
                                    ) {
                                        try {
                                            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
                                                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                                            }
                                            context.startActivity(intent)
                                        } catch (e: Exception) {
                                            context.startActivity(Intent(Settings.ACTION_SETTINGS))
                                        }
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            // Exit App & Stop Service Button
                            Button(
                                onClick = {
                                    val intent = Intent(context, SyncService::class.java)
                                    context.stopService(intent)
                                    val manager = context.getSystemService(android.content.Context.NOTIFICATION_SERVICE) as? android.app.NotificationManager
                                    manager?.cancelAll()
                                    (context as? android.app.Activity)?.finishAffinity()
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(44.dp),
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color(0xFFEF4444).copy(alpha = 0.15f),
                                    contentColor = Color(0xFFEF4444)
                                ),
                                border = BorderStroke(1.dp, Color(0xFFEF4444).copy(alpha = 0.4f))
                            ) {
                                Icon(Icons.Default.Close, null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(8.dp))
                                Text(
                                    if (SyncManager.currentLanguage == "en") "EXIT APP & STOP ALL SERVICES" else "KELUAR APLIKASI & HENTIKAN LAYANAN",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp
                                )
                            }
                        }
                    }
                }

                item {
                    Spacer(modifier = Modifier.height(40.dp))
                }
            } // Close LazyColumn
        } // Close outer Column

        // Modern Bottom Navigation Bar matching Tachiyomi / Mihon style
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
        ) {
            ModernBottomNavBar(
                selectedTab = selectedTab,
                onTabSelected = { selectedTab = it },
                primaryColor = primaryAccent
            )
        }

        // App Limit & Cooldown Configuration Modal
        if (selectedAppForConfig != null) {
            val targetPkg = selectedAppForConfig!!.first
            val targetName = selectedAppForConfig!!.second
            var inputLimit by remember(targetPkg) { mutableIntStateOf(SyncManager.getAppLimit(targetPkg)) }
            var inputCooldown by remember(targetPkg) { mutableIntStateOf(SyncManager.getAppCooldown(targetPkg)) }

            AlertDialog(
                onDismissRequest = { selectedAppForConfig = null },
                title = {
                    Column {
                        Text(
                            text = if (SyncManager.currentLanguage == "en") "App Focus Limit" else "Pengaturan Limit & Cooldown",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = targetName,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color(0xFF38BDF8)
                        )
                        Text(
                            text = targetPkg,
                            fontSize = 11.sp,
                            color = Color.Gray
                        )
                    }
                },
                text = {
                    Column(modifier = Modifier.padding(top = 8.dp)) {
                        // Limit Section
                        Text(
                            text = if (SyncManager.currentLanguage == "en") "Session Limit (minutes):" else "Durasi Pemakaian (menit):",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Button(
                                onClick = { if (inputLimit > 1) inputLimit -= 1 },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E293B)),
                                modifier = Modifier.size(40.dp),
                                contentPadding = PaddingValues(0.dp),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text("-", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            }
                            Text(
                                text = "$inputLimit min",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF38BDF8)
                            )
                            Button(
                                onClick = { if (inputLimit < 120) inputLimit += 1 },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E293B)),
                                modifier = Modifier.size(40.dp),
                                contentPadding = PaddingValues(0.dp),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text("+", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        // Cooldown Section
                        Text(
                            text = if (SyncManager.currentLanguage == "en") "Cooldown Duration (minutes):" else "Durasi Cooldown (menit):",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Button(
                                onClick = { if (inputCooldown > 5) inputCooldown -= 5 },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E293B)),
                                modifier = Modifier.size(40.dp),
                                contentPadding = PaddingValues(0.dp),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text("-5", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            }
                            Text(
                                text = "$inputCooldown min",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFFEF4444)
                            )
                            Button(
                                onClick = { if (inputCooldown < 360) inputCooldown += 5 },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E293B)),
                                modifier = Modifier.size(40.dp),
                                contentPadding = PaddingValues(0.dp),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text("+5", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = if (SyncManager.currentLanguage == "en")
                                "After $inputLimit min of usage, the app will be blocked for $inputCooldown min."
                            else
                                "Setelah $inputLimit menit pemakaian, aplikasi akan diblokir selama $inputCooldown menit.",
                            fontSize = 11.sp,
                            color = Color.Gray,
                            lineHeight = 15.sp
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            SyncManager.saveAppConfig(targetPkg, inputLimit, inputCooldown)
                            selectedAppForConfig = null
                            android.widget.Toast.makeText(context, if (SyncManager.currentLanguage == "en") "Saved!" else "Tersimpan!", android.widget.Toast.LENGTH_SHORT).show()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0284C7))
                    ) {
                        Text(if (SyncManager.currentLanguage == "en") "Save" else "Simpan", color = Color.White)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { selectedAppForConfig = null }) {
                        Text(if (SyncManager.currentLanguage == "en") "Cancel" else "Batal", color = Color.Gray)
                    }
                },
                containerColor = Color(0xFF0F172A)
            )
        }
    }
}

    @Composable
    fun ModernBottomNavBar(
        selectedTab: Int,
        onTabSelected: (Int) -> Unit,
        primaryColor: Color
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding(),
            color = Color(0xFF0D111C),
            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(64.dp)
                    .padding(horizontal = 4.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceAround,
                verticalAlignment = Alignment.CenterVertically
            ) {
                val isEn = SyncManager.currentLanguage == "en"
                val items = listOf(
                    Triple(if (isEn) "Focus" else "Fokus", Icons.Default.PlayArrow, 0),
                    Triple(if (isEn) "Statistics" else "Statistik", Icons.Default.DateRange, 1),
                    Triple(if (isEn) "Apps" else "Aplikasi", Icons.Default.List, 2),
                    Triple(if (isEn) "History" else "Riwayat", Icons.Default.Info, 3),
                    Triple(if (isEn) "Settings" else "Pengaturan", Icons.Default.Settings, 4)
                )

                items.forEach { (label, icon, index) ->
                    val isSelected = selectedTab == index
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(16.dp))
                            .clickable { onTabSelected(index) }
                            .padding(vertical = 4.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(width = 50.dp, height = 28.dp)
                                .background(
                                    if (isSelected) primaryColor.copy(alpha = 0.22f) else Color.Transparent,
                                    RoundedCornerShape(14.dp)
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = icon,
                                contentDescription = label,
                                tint = if (isSelected) primaryColor else Color.White.copy(alpha = 0.45f),
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = label,
                            fontSize = 10.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                            color = if (isSelected) primaryColor else Color.White.copy(alpha = 0.45f),
                            maxLines = 1
                        )
                    }
                }
            }
        }
    }

    @Composable
    fun ModernCard(title: String, icon: androidx.compose.ui.graphics.vector.ImageVector, content: @Composable () -> Unit) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            color = Color.White.copy(alpha = 0.04f),
            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))
        ) {
            Column(modifier = Modifier.padding(18.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(icon, null, tint = Color(0xFF38BDF8), modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(title, color = Color(0xFF38BDF8), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
                Spacer(modifier = Modifier.height(14.dp))
                content()
            }
        }
    }

    @Composable
    fun StatBox(label: String, value: String, subtitle: String, icon: String, modifier: Modifier = Modifier) {
        Surface(
            modifier = modifier,
            shape = RoundedCornerShape(16.dp),
            color = Color.White.copy(alpha = 0.04f),
            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))
        ) {
            Column(modifier = Modifier.padding(14.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(icon, fontSize = 14.sp)
                    Spacer(Modifier.width(6.dp))
                    Text(label, color = Color.White.copy(alpha = 0.6f), fontSize = 11.sp)
                }
                Spacer(modifier = Modifier.height(6.dp))
                Text(value, fontSize = 18.sp, fontWeight = FontWeight.Black, color = Color.White)
                Spacer(modifier = Modifier.height(2.dp))
                Text(subtitle, fontSize = 10.sp, color = Color.White.copy(alpha = 0.4f))
            }
        }
    }

    @Composable
    fun ClipProgressBar(progress: Float, color: Color) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .background(Color.White.copy(alpha = 0.08f), RoundedCornerShape(3.dp))
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(progress)
                    .fillMaxHeight()
                    .background(color, RoundedCornerShape(3.dp))
            )
        }
    }

    @Composable
    fun PermissionRow(title: String, isGranted: Boolean, onClick: () -> Unit) {
        Surface(
            onClick = onClick,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            color = if (isGranted) Color(0xFF10B981).copy(alpha = 0.08f) else Color.White.copy(alpha = 0.03f),
            border = BorderStroke(1.dp, if (isGranted) Color(0xFF10B981).copy(alpha = 0.3f) else Color.White.copy(alpha = 0.06f))
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = title,
                    color = Color.White,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.weight(1f)
                )
                
                Spacer(modifier = Modifier.width(8.dp))

                if (isGranted) {
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = Color(0xFF10B981).copy(alpha = 0.2f),
                        border = BorderStroke(1.dp, Color(0xFF10B981).copy(alpha = 0.4f))
                    ) {
                        Text(
                            text = if (SyncManager.currentLanguage == "en") "ACTIVE" else "AKTIF",
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = Color(0xFF10B981),
                            maxLines = 1
                        )
                    }
                } else {
                    Icon(
                        imageVector = Icons.Default.ArrowForward,
                        contentDescription = null,
                        tint = Color(0xFF38BDF8),
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }
    }

    @Composable
    fun FilterItem(
        name: String,
        pkg: String,
        limitMins: Int,
        cooldownMins: Int,
        onConfigure: () -> Unit,
        onDelete: () -> Unit
    ) {
        val isEn = SyncManager.currentLanguage == "en"
        Surface(
            onClick = onConfigure,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp),
            color = Color.White.copy(0.04f),
            shape = RoundedCornerShape(14.dp),
            border = BorderStroke(1.dp, Color.White.copy(0.08f))
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(name, color = Color.White.copy(0.95f), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(pkg, color = Color.White.copy(0.4f), fontSize = 10.sp, maxLines = 1)
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = Color(0xFF38BDF8).copy(alpha = 0.15f),
                            border = BorderStroke(1.dp, Color(0xFF38BDF8).copy(alpha = 0.35f))
                        ) {
                            Text(
                                text = if (isEn) "Limit: ${limitMins}m" else "Batas: ${limitMins}m",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF38BDF8),
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = Color(0xFFF43F5E).copy(alpha = 0.15f),
                            border = BorderStroke(1.dp, Color(0xFFF43F5E).copy(alpha = 0.35f))
                        ) {
                            Text(
                                text = "Cooldown: ${cooldownMins}m",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFFF43F5E),
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onConfigure, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.Settings, contentDescription = "Configure", tint = Color.White.copy(0.6f), modifier = Modifier.size(16.dp))
                    }
                    IconButton(onClick = onDelete, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.Delete, contentDescription = "Delete", tint = Color(0xFFFF5252), modifier = Modifier.size(16.dp))
                    }
                }
            }
        }
    }

    fun translatePrayerName(name: String, isEn: Boolean): String {
        if (!isEn) return name
        return when (name.lowercase(java.util.Locale.ROOT)) {
            "subuh", "fajr" -> "Fajr"
            "dhuha", "sunrise" -> "Dhuha"
            "dzuhur", "dhuhr", "zuhur" -> "Dhuhr"
            "ashar", "asr" -> "Asr"
            "maghrib" -> "Maghrib"
            "isya", "isha" -> "Isha"
            else -> name
        }
    }

    @Composable
    fun PrayerScheduleCard(status: FocusStatus) {
        val emerald = Color(0xFF10B981)
        val isBreak = status.isPrayerBreak
        val isEn = SyncManager.currentLanguage == "en"

        ModernCard(title = if (isEn) "Today's Prayer Schedule" else "Jadwal Sholat Hari Ini", icon = Icons.Default.DateRange) {
            Column {
                // Header Banner: Next Prayer or Active Break
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    color = if (isBreak) emerald.copy(alpha = 0.18f) else Color.White.copy(alpha = 0.05f),
                    border = BorderStroke(1.dp, if (isBreak) emerald.copy(alpha = 0.45f) else Color.White.copy(alpha = 0.1f))
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(if (isBreak) "🕌" else "⏳", fontSize = 18.sp)
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text(
                                    text = if (isBreak) (if (isEn) "Active Prayer Break" else "Waktu Sholat Berlangsung") else (if (isEn) "Next Prayer" else "Sholat Berikutnya"),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isBreak) emerald else Color.White.copy(alpha = 0.6f),
                                    letterSpacing = 0.5.sp
                                )
                                Text(
                                    text = if (isBreak) (if (isEn) "15-Min Prayer Break" else "Istirahat Sholat 15 Menit") else if (status.prayerNextName.isNotEmpty()) "${translatePrayerName(status.prayerNextName, isEn)} • ${status.prayerNextTime}" else (if (isEn) "Syncing..." else "Sinkronisasi..."),
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color.White
                                )
                            }
                        }

                        if (isBreak) {
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = emerald
                            ) {
                                Text(
                                    if (isEn) "ACTIVE" else "AKTIF",
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Black,
                                    color = Color.Black
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Default prayer times if list is not populated yet
                val times = if (status.prayerTimes.isNotEmpty()) {
                    status.prayerTimes
                } else {
                    listOf(
                        PrayerScheduleItem("Subuh", "04:57"),
                        PrayerScheduleItem("Dhuha", "06:32"),
                        PrayerScheduleItem("Dzuhur", "12:17"),
                        PrayerScheduleItem("Ashar", "15:28"),
                        PrayerScheduleItem("Maghrib", "18:19"),
                        PrayerScheduleItem("Isya", "19:28")
                    )
                }

                // 2 rows of 3 items
                val firstRow = times.take(3)
                val secondRow = times.drop(3).take(3)

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    firstRow.forEach { item ->
                        val isNext = item.name.equals(status.prayerNextName, ignoreCase = true)
                        PrayerTimeChip(
                            item = item,
                            isNext = isNext,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    secondRow.forEach { item ->
                        val isNext = item.name.equals(status.prayerNextName, ignoreCase = true)
                        PrayerTimeChip(
                            item = item,
                            isNext = isNext,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        if (isEn) "Swipe down to refresh schedule" else "Usap ke bawah untuk menyegarkan jadwal",
                        fontSize = 10.sp,
                        color = Color.White.copy(alpha = 0.4f)
                    )
                    Text(
                        "WITA / GMT+8",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF10B981).copy(alpha = 0.75f)
                    )
                }
            }
        }
    }

    @Composable
    fun PrayerTimeChip(
        item: PrayerScheduleItem,
        isNext: Boolean,
        modifier: Modifier = Modifier
    ) {
        val emerald = Color(0xFF10B981)
        val isEn = SyncManager.currentLanguage == "en"
        Surface(
            modifier = modifier,
            shape = RoundedCornerShape(12.dp),
            color = if (isNext) emerald.copy(alpha = 0.18f) else Color.White.copy(alpha = 0.04f),
            border = BorderStroke(1.dp, if (isNext) emerald else Color.White.copy(alpha = 0.08f))
        ) {
            Column(
                modifier = Modifier.padding(vertical = 10.dp, horizontal = 4.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = translatePrayerName(item.name, isEn),
                    fontSize = 11.sp,
                    fontWeight = if (isNext) FontWeight.Bold else FontWeight.Medium,
                    color = if (isNext) emerald else Color.White.copy(alpha = 0.7f)
                )
                Spacer(modifier = Modifier.height(3.dp))
                Text(
                    text = item.time,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = Color.White
                )
                if (isNext) {
                    Spacer(modifier = Modifier.height(3.dp))
                    Box(
                        modifier = Modifier
                            .size(5.dp)
                            .background(emerald, CircleShape)
                    )
                }
            }
        }
    }

    @Composable
    fun PullRefreshIndicatorHeader(
    pullOffsetState: State<Float>,
    isRefreshing: Boolean,
    primaryAccent: Color,
    refreshTrigger: Float
) {
    val offset = pullOffsetState.value
    if (offset > 15f || isRefreshing) {
        val progress = (offset / refreshTrigger).coerceIn(0f, 1f)
        val rotationAngle = progress * 360f

        Surface(
            modifier = Modifier
                .statusBarsPadding()
                .padding(top = 12.dp)
                .size(50.dp)
                .graphicsLayer {
                    scaleX = if (isRefreshing) 1f else 0.5f + (progress * 0.5f)
                    scaleY = if (isRefreshing) 1f else 0.5f + (progress * 0.5f)
                    alpha = if (isRefreshing) 1f else (progress * 1.2f).coerceIn(0f, 1f)
                }
                .clip(CircleShape),
            color = Color(0xFF1E293B).copy(alpha = 0.95f),
            border = BorderStroke(1.5.dp, if (offset >= refreshTrigger || isRefreshing) primaryAccent else Color.White.copy(alpha = 0.2f)),
            shadowElevation = 8.dp
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier.fillMaxSize()
            ) {
                if (isRefreshing) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        strokeWidth = 3.dp,
                        color = primaryAccent
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = null,
                        tint = if (offset >= refreshTrigger) primaryAccent else Color.White.copy(alpha = 0.8f),
                        modifier = Modifier
                            .size(28.dp)
                            .graphicsLayer {
                                rotationZ = rotationAngle
                            }
                    )
                }
            }
        }
    }
}

    @Composable
    fun AppUsageSection(
        context: android.content.Context,
        isEn: Boolean,
        primaryAccent: Color,
        selectedRange: UsageTimeRange,
        onRangeSelected: (UsageTimeRange) -> Unit,
        usageResult: AppUsageResult?,
        isLoading: Boolean,
        showAll: Boolean,
        onToggleShowAll: () -> Unit,
        onRefresh: () -> Unit
    ) {
        val hasUsagePermission = remember(context) { SyncManager.hasUsageStatsPermission(context) }
        var isDropdownOpen by remember { mutableStateOf(false) }

        val rangeOptions = remember(isEn) {
            listOf(
                UsageTimeRange.TODAY to (if (isEn) "Today" else "Hari Ini"),
                UsageTimeRange.YESTERDAY to (if (isEn) "Yesterday" else "Kemarin"),
                UsageTimeRange.LAST_7_DAYS to (if (isEn) "Last 7 days" else "7 Hari Terakhir"),
                UsageTimeRange.LAST_30_DAYS to (if (isEn) "Last 30 days" else "30 Hari Terakhir"),
                UsageTimeRange.LAST_90_DAYS to (if (isEn) "Last 3 months (90 days)" else "3 Bulan Terakhir (90 Hari)")
            )
        }

        val currentLabel = rangeOptions.firstOrNull { it.first == selectedRange }?.second ?: (if (isEn) "Today" else "Hari Ini")
        val currentIndex = rangeOptions.indexOfFirst { it.first == selectedRange }.coerceAtLeast(0)

        ModernCard(
            title = if (isEn) "App Screen Time" else "Waktu Pemakaian Aplikasi",
            icon = Icons.Default.DateRange
        ) {
            Column {
                if (!hasUsagePermission) {
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                        color = Color(0xFFF59E0B).copy(alpha = 0.12f),
                        border = BorderStroke(1.dp, Color(0xFFF59E0B).copy(alpha = 0.35f))
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    Icons.Default.Warning,
                                    contentDescription = null,
                                    tint = Color(0xFFF59E0B),
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    if (isEn) "Usage Access Permission Required" else "Izin Akses Penggunaan Diperlukan",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFFF59E0B)
                                )
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                if (isEn) "Enable Usage Access so FocusGrow can display your daily, weekly, and monthly screen time statistics." else "Aktifkan Akses Penggunaan agar FocusGrow dapat menampilkan statistik waktu pemakaian aplikasi harian, mingguan, dan bulanan.",
                                fontSize = 11.sp,
                                color = Color.White.copy(alpha = 0.75f),
                                lineHeight = 16.sp
                            )
                            Spacer(modifier = Modifier.height(10.dp))
                            Button(
                                onClick = {
                                    try {
                                        val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
                                            flags = Intent.FLAG_ACTIVITY_NEW_TASK
                                        }
                                        context.startActivity(intent)
                                    } catch (e: Exception) {
                                        context.startActivity(Intent(Settings.ACTION_SETTINGS))
                                    }
                                },
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color(0xFFF59E0B),
                                    contentColor = Color.Black
                                ),
                                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp),
                                modifier = Modifier.height(34.dp)
                            ) {
                                Text(
                                    if (isEn) "Grant Permission" else "Buka Pengaturan Izin",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 11.sp
                                )
                            }
                        }
                    }
                } else {
                    // StayFree Style Date Navigator Bar (< [📅 Range ▼] > + Refresh)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            // Left Arrow (<) - go to older period
                            IconButton(
                                onClick = {
                                    if (currentIndex < rangeOptions.lastIndex) {
                                        onRangeSelected(rangeOptions[currentIndex + 1].first)
                                    }
                                },
                                enabled = currentIndex < rangeOptions.lastIndex,
                                modifier = Modifier.size(32.dp)
                            ) {
                                Icon(
                                    Icons.Default.ArrowBack,
                                    contentDescription = "Previous",
                                    tint = if (currentIndex < rangeOptions.lastIndex) Color.White.copy(alpha = 0.8f) else Color.White.copy(alpha = 0.2f),
                                    modifier = Modifier.size(18.dp)
                                )
                            }

                            Spacer(modifier = Modifier.width(2.dp))

                            // Dropdown Trigger Pill
                            Box {
                                Surface(
                                    onClick = { isDropdownOpen = true },
                                    shape = RoundedCornerShape(10.dp),
                                    color = Color.White.copy(alpha = 0.08f),
                                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.16f))
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text("📅", fontSize = 12.sp)
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text(
                                            text = currentLabel,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            color = Color.White
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Icon(
                                            Icons.Default.ArrowDropDown,
                                            contentDescription = null,
                                            tint = Color.White.copy(alpha = 0.6f),
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                }

                                DropdownMenu(
                                    expanded = isDropdownOpen,
                                    onDismissRequest = { isDropdownOpen = false },
                                    modifier = Modifier.background(Color(0xFF1E293B))
                                ) {
                                    rangeOptions.forEach { (range, label) ->
                                        DropdownMenuItem(
                                            text = {
                                                Text(
                                                    text = label,
                                                    fontSize = 12.sp,
                                                    fontWeight = if (selectedRange == range) FontWeight.Bold else FontWeight.Normal,
                                                    color = if (selectedRange == range) primaryAccent else Color.White
                                                )
                                            },
                                            onClick = {
                                                onRangeSelected(range)
                                                isDropdownOpen = false
                                            }
                                        )
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.width(2.dp))

                            // Right Arrow (>) - go to newer period
                            IconButton(
                                onClick = {
                                    if (currentIndex > 0) {
                                        onRangeSelected(rangeOptions[currentIndex - 1].first)
                                    }
                                },
                                enabled = currentIndex > 0,
                                modifier = Modifier.size(32.dp)
                            ) {
                                Icon(
                                    Icons.Default.ArrowForward,
                                    contentDescription = "Next",
                                    tint = if (currentIndex > 0) Color.White.copy(alpha = 0.8f) else Color.White.copy(alpha = 0.2f),
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }

                        IconButton(
                            onClick = onRefresh,
                            modifier = Modifier.size(34.dp)
                        ) {
                            Icon(
                                Icons.Default.Refresh,
                                contentDescription = "Refresh",
                                tint = if (isLoading) primaryAccent else Color.White.copy(alpha = 0.7f),
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // StayFree Style Analytics & Mini Chart Card
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        color = Color(0xFF131B2E),
                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            // Total Screen Time Header + Trend Badge
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(
                                        if (isEn) "Total Usage" else "Total Penggunaan",
                                        fontSize = 11.sp,
                                        color = Color.White.copy(alpha = 0.55f),
                                        fontWeight = FontWeight.Medium
                                    )
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(
                                        text = usageResult?.formattedTotalTime ?: "0m",
                                        fontSize = 22.sp,
                                        fontWeight = FontWeight.Black,
                                        color = Color.White,
                                        letterSpacing = (-0.5).sp
                                    )
                                }

                                // Trend Comparison Pill
                                val trend = usageResult?.trendPercentage
                                if (trend != null) {
                                    val isHigher = trend > 0
                                    val trendColor = if (isHigher) Color(0xFFF87171) else Color(0xFF34D399)
                                    val trendBg = if (isHigher) Color(0xFFEF4444).copy(alpha = 0.15f) else Color(0xFF10B981).copy(alpha = 0.15f)
                                    val trendText = if (isHigher) "+$trend%" else "$trend%"

                                    Surface(
                                        shape = RoundedCornerShape(12.dp),
                                        color = trendBg,
                                        border = BorderStroke(1.dp, trendColor.copy(alpha = 0.35f))
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(
                                                text = if (isHigher) "▲" else "▼",
                                                color = trendColor,
                                                fontSize = 10.sp
                                            )
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text(
                                                text = if (isEn) "$trendText vs prev" else "$trendText vs lalu",
                                                color = trendColor,
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold
                                            )
                                        }
                                    }
                                }
                            }

                            // Mini Bar Chart (StayFree Visual Distribution)
                            val bars = usageResult?.chartBars ?: emptyList()
                            if (bars.isNotEmpty()) {
                                Spacer(modifier = Modifier.height(18.dp))

                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(86.dp),
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                    verticalAlignment = Alignment.Bottom
                                ) {
                                    bars.forEach { bar ->
                                        Column(
                                            modifier = Modifier.weight(1f),
                                            horizontalAlignment = Alignment.CenterHorizontally,
                                            verticalArrangement = Arrangement.Bottom
                                        ) {
                                            // Top small duration if selected
                                            if (bar.isSelected && bar.durationMs > 0) {
                                                Text(
                                                    text = bar.formattedDuration,
                                                    fontSize = 8.sp,
                                                    color = primaryAccent,
                                                    fontWeight = FontWeight.Bold,
                                                    maxLines = 1
                                                )
                                                Spacer(modifier = Modifier.height(2.dp))
                                            }

                                            // Bar Fill
                                            val barHeightFraction = bar.relativeHeight.coerceIn(0.08f, 1f)
                                            Box(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .height((56 * barHeightFraction).dp)
                                                    .background(
                                                        if (bar.isSelected) {
                                                            Brush.verticalGradient(
                                                                listOf(primaryAccent, Color(0xFF818CF8))
                                                            )
                                                        } else {
                                                            Brush.verticalGradient(
                                                                listOf(Color(0xFF818CF8).copy(alpha = 0.5f), Color(0xFF6366F1).copy(alpha = 0.25f))
                                                            )
                                                        },
                                                        RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp)
                                                    )
                                            )

                                            Spacer(modifier = Modifier.height(6.dp))

                                            // Label (Day / Week / Month)
                                            Text(
                                                text = bar.label,
                                                fontSize = 9.sp,
                                                fontWeight = if (bar.isSelected) FontWeight.Bold else FontWeight.Normal,
                                                color = if (bar.isSelected) Color.White else Color.White.copy(alpha = 0.45f),
                                                maxLines = 1
                                            )
                                        }
                                    }
                                }
                            }

                            // Top Used App Sub-badge
                            val topApp = usageResult?.topAppName
                            if (!topApp.isNullOrBlank()) {
                                Spacer(modifier = Modifier.height(12.dp))
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text("🏆", fontSize = 11.sp)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = if (isEn) "Most used: $topApp" else "Paling sering: $topApp",
                                        fontSize = 11.sp,
                                        color = Color.White.copy(alpha = 0.65f),
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Loading State
                    if (isLoading) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 24.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(28.dp),
                                strokeWidth = 3.dp,
                                color = primaryAccent
                            )
                        }
                    } else if (usageResult == null || usageResult.items.isEmpty()) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 20.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                if (isEn) "No app usage detected for this period." else "Tidak ada pemakaian aplikasi yang terdeteksi untuk periode ini.",
                                fontSize = 11.sp,
                                color = Color.White.copy(alpha = 0.45f),
                                textAlign = TextAlign.Center
                            )
                        }
                    } else {
                        // StayFree Style Compact App List
                        val displayItems = if (showAll) usageResult.items else usageResult.items.take(8)

                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            color = Color.White.copy(alpha = 0.025f),
                            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.06f))
                        ) {
                            Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)) {
                                displayItems.forEachIndexed { index, item ->
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = 8.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        // App Icon
                                        AsyncImage(
                                            model = item.icon,
                                            contentDescription = item.appName,
                                            modifier = Modifier
                                                .size(36.dp)
                                                .clip(RoundedCornerShape(9.dp)),
                                            contentScale = ContentScale.Fit
                                        )

                                        Spacer(modifier = Modifier.width(12.dp))

                                        Column(modifier = Modifier.weight(1f)) {
                                            // Line 1: App Name & Duration
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text(
                                                    text = item.appName,
                                                    fontSize = 13.sp,
                                                    fontWeight = FontWeight.SemiBold,
                                                    color = Color.White,
                                                    maxLines = 1,
                                                    modifier = Modifier.weight(1f, fill = false)
                                                )
                                                Spacer(modifier = Modifier.width(8.dp))
                                                Text(
                                                    text = item.formattedTime,
                                                    fontSize = 12.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = Color.White.copy(alpha = 0.95f)
                                                )
                                            }

                                            Spacer(modifier = Modifier.height(6.dp))

                                            // Line 2: Progress bar + Percentage
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Box(
                                                    modifier = Modifier
                                                        .weight(1f)
                                                        .height(4.dp)
                                                        .background(Color.White.copy(alpha = 0.08f), RoundedCornerShape(2.dp))
                                                ) {
                                                    Box(
                                                        modifier = Modifier
                                                            .fillMaxWidth(item.relativePercentage)
                                                            .fillMaxHeight()
                                                            .background(
                                                                Brush.horizontalGradient(
                                                                    listOf(Color(0xFF818CF8), primaryAccent)
                                                                ),
                                                                RoundedCornerShape(2.dp)
                                                            )
                                                    )
                                                }

                                                Spacer(modifier = Modifier.width(10.dp))

                                                Text(
                                                    text = "${item.percentageOfTotal}%",
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.Medium,
                                                    color = Color.White.copy(alpha = 0.55f),
                                                    modifier = Modifier.width(42.dp),
                                                    textAlign = TextAlign.End
                                                )
                                            }
                                        }
                                    }

                                    if (index < displayItems.lastIndex) {
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(start = 48.dp)
                                                .height(0.5.dp)
                                                .background(Color.White.copy(alpha = 0.05f))
                                        )
                                    }
                                }

                                // Show More / Show Less Button
                                if (usageResult.items.size > 8) {
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Surface(
                                        onClick = onToggleShowAll,
                                        shape = RoundedCornerShape(8.dp),
                                        color = Color.White.copy(alpha = 0.04f),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Box(
                                            modifier = Modifier.padding(vertical = 8.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(
                                                text = if (showAll) {
                                                    if (isEn) "Show Less ▲" else "Tampilkan Lebih Sedikit ▲"
                                                } else {
                                                    if (isEn) "Show All (${usageResult.items.size} apps) ▼" else "Tampilkan Semua (${usageResult.items.size} aplikasi) ▼"
                                                },
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.SemiBold,
                                                color = primaryAccent
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

@Composable
fun FocusGrowTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Color(0xFF38BDF8),
            surface = Color(0xFF0F172A),
            background = Color(0xFF090D16)
        ),
        content = content
    )
}

@Composable
@androidx.annotation.OptIn(androidx.camera.core.ExperimentalGetImage::class)
fun QrScannerDialog(
    onDismiss: () -> Unit,
    onIpScanned: (String) -> Unit
) {
    var isProcessed by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val lifecycleOwner = context as androidx.lifecycle.LifecycleOwner

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black)
        ) {
            AndroidView(
                factory = { ctx ->
                    val previewView = PreviewView(ctx)
                    val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)

                    cameraProviderFuture.addListener({
                        val cameraProvider = cameraProviderFuture.get()

                        val preview = Preview.Builder().build().also {
                            it.setSurfaceProvider(previewView.surfaceProvider)
                        }

                        val barcodeScanner = BarcodeScanning.getClient()

                        val imageAnalysis = ImageAnalysis.Builder()
                            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                            .build()

                        imageAnalysis.setAnalyzer(ContextCompat.getMainExecutor(ctx)) { imageProxy ->
                            val mediaImage = imageProxy.image
                            if (mediaImage != null && !isProcessed) {
                                val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
                                barcodeScanner.process(image)
                                    .addOnSuccessListener { barcodes ->
                                        for (barcode in barcodes) {
                                            val rawValue = barcode.rawValue ?: continue
                                            val ipRegex = Regex("""(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})""")
                                            val match = ipRegex.find(rawValue)
                                            if (match != null) {
                                                val scannedIp = match.value
                                                isProcessed = true
                                                onIpScanned(scannedIp)
                                                break
                                            }
                                        }
                                    }
                                    .addOnCompleteListener {
                                        imageProxy.close()
                                    }
                            } else {
                                imageProxy.close()
                            }
                        }

                        try {
                            cameraProvider.unbindAll()
                            cameraProvider.bindToLifecycle(
                                lifecycleOwner,
                                CameraSelector.DEFAULT_BACK_CAMERA,
                                preview,
                                imageAnalysis
                            )
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }, ContextCompat.getMainExecutor(ctx))

                    previewView
                },
                modifier = Modifier.fillMaxSize()
            )

            // Viewfinder Frame Overlay
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.45f)),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(260.dp)
                            .border(2.dp, Color(0xFF10B981), RoundedCornerShape(20.dp))
                            .background(Color.Transparent)
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    Surface(
                        color = Color(0xFF1E293B).copy(alpha = 0.9f),
                        shape = RoundedCornerShape(20.dp),
                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.15f))
                    ) {
                        Text(
                            text = "Arahkan kamera ke QR Code di Desktop PC",
                            color = Color.White,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(horizontal = 18.dp, vertical = 10.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(32.dp))

                    Button(
                        onClick = onDismiss,
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(alpha = 0.15f))
                    ) {
                        Text("BATAL", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}
}

