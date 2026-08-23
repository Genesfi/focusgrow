package com.genesfi.focusgrow

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        try {
            val intent = Intent(this, SyncService::class.java)
            startForegroundService(intent)
        } catch (e: Exception) { e.printStackTrace() }

        setContent {
            FocusGrowTheme {
                MainContent()
            }
        }
    }

    @Composable
    fun MainContent() {
        var ipInput by remember { mutableStateOf(SyncManager.pcIpAddress) }
        var newAppInput by remember { mutableStateOf("") }
        var newSiteInput by remember { mutableStateOf("") }
        val status = SyncManager.currentStatus

        Box(modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(Color(0xFF0F172A), Color(0xFF1E293B))))
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                item {
                    Spacer(modifier = Modifier.height(40.dp))
                    
                    // Header Area
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Image(
                            painter = painterResource(id = android.R.drawable.ic_menu_compass), // Placeholder hiasan
                            contentDescription = null,
                            modifier = Modifier.size(32.dp).clip(CircleShape)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            "FocusGrow",
                            fontSize = 24.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = Color.White,
                            letterSpacing = 1.sp
                        )
                    }

                    Spacer(modifier = Modifier.height(30.dp))

                    // Timer Gauge Modern
                    Box(contentAlignment = Alignment.Center, modifier = Modifier.size(240.dp)) {
                        val progress = if (status.maxPeriodSec > 0) 
                            status.remainingSec.toFloat() / status.maxPeriodSec.toFloat() 
                            else 0f

                        Canvas(modifier = Modifier.fillMaxSize().padding(10.dp)) {
                            drawArc(
                                color = Color.White.copy(alpha = 0.05f),
                                startAngle = 0f, sweepAngle = 360f, useCenter = false,
                                style = Stroke(width = 12.dp.toPx(), cap = StrokeCap.Round)
                            )
                            drawArc(
                                brush = Brush.sweepGradient(listOf(Color(0xFF0EA5E9), Color(0xFF6366F1), Color(0xFF0EA5E9))),
                                startAngle = -90f,
                                sweepAngle = 360f * progress,
                                useCenter = false,
                                style = Stroke(width = 14.dp.toPx(), cap = StrokeCap.Round)
                            )
                        }

                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                status.formattedTime,
                                fontSize = 52.sp,
                                fontWeight = FontWeight.Black,
                                color = Color.White
                            )
                            Surface(
                                color = if(status.state == "focusing") Color(0xFF0EA5E9).copy(0.2f) else Color.Gray.copy(0.2f),
                                shape = RoundedCornerShape(16.dp)
                            ) {
                                Text(
                                    status.state.uppercase(),
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if(status.state == "focusing") Color(0xFF38BDF8) else Color.LightGray,
                                    letterSpacing = 1.5.sp
                                )
                            }
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "Period ${status.currentPeriod} of ${status.totalPeriods}",
                        color = Color.White.copy(0.5f),
                        fontSize = 12.sp
                    )

                    Spacer(modifier = Modifier.height(32.dp))

                    // Connection Card
                    SyncCard("Connection Settings", Icons.Default.Settings) {
                        OutlinedTextField(
                            value = ipInput,
                            onValueChange = { ipInput = it; SyncManager.pcIpAddress = it },
                            label = { Text("PC IP Address") },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                unfocusedTextColor = Color.White, focusedTextColor = Color.White,
                                unfocusedContainerColor = Color.White.copy(0.03f),
                                focusedContainerColor = Color.White.copy(0.05f),
                                focusedBorderColor = Color(0xFF38BDF8)
                            )
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center, modifier = Modifier.fillMaxWidth()) {
                            Box(modifier = Modifier.size(8.dp).background(if (status.isOnline) Color(0xFF10B981) else Color(0xFF38BDF8), CircleShape))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(if (status.isOnline) "LOCAL SYNC" else "CLOUD SYNC", color = Color.White.copy(0.6f), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(
                            onClick = {
                                val intent = Intent(this@MainActivity, SyncService::class.java)
                                stopService(intent)
                                startForegroundService(intent)
                            },
                            modifier = Modifier.fillMaxWidth().height(48.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF38BDF8), contentColor = Color.Black)
                        ) {
                            Text("RECONNECT NOW", fontWeight = FontWeight.Bold)
                        }
                    }
                }

                item {
                    Spacer(modifier = Modifier.height(20.dp))
                    SyncCard("Restricted Apps", Icons.Default.List) {
                        var showAppPicker by remember { mutableStateOf(false) }
                        val installedApps = remember { 
                            packageManager.getInstalledApplications(android.content.pm.PackageManager.GET_META_DATA)
                                .filter { it.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM == 0 }
                                .map { it.packageName to it.loadLabel(packageManager).toString() }
                                .sortedBy { it.second }
                        }

                        Button(
                            onClick = { showAppPicker = true },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(0.1f))
                        ) {
                            Icon(Icons.Default.Add, null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(8.dp))
                            Text("ADD APP TO BLOCK")
                        }

                        if (showAppPicker) {
                            var q by remember { mutableStateOf("") }
                            val filtered = installedApps.filter { it.second.contains(q, true) || it.first.contains(q, true) }
                            AlertDialog(
                                onDismissRequest = { showAppPicker = false },
                                title = { Text("Select App", fontWeight = FontWeight.Bold) },
                                text = {
                                    Column {
                                        OutlinedTextField(q, { q = it }, placeholder = { Text("Search...") }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp))
                                        Spacer(Modifier.height(8.dp))
                                        Box(Modifier.height(300.dp)) {
                                            LazyColumn {
                                                items(filtered) { (p, n) ->
                                                    ListItem(
                                                        headlineContent = { Text(n, color = Color.White, fontWeight = FontWeight.SemiBold) },
                                                        supportingContent = { Text(p, fontSize = 10.sp, color = Color.Gray) },
                                                        modifier = Modifier.clickable { SyncManager.addApp(p); showAppPicker = false },
                                                        colors = ListItemDefaults.colors(containerColor = Color.Transparent)
                                                    )
                                                }
                                            }
                                        }
                                    }
                                },
                                confirmButton = { TextButton(onClick = { showAppPicker = false }) { Text("CANCEL") } },
                                containerColor = Color(0xFF1E293B), titleContentColor = Color.White
                            )
                        }
                    }
                }

                items(SyncManager.restrictedApps) { pkg ->
                    FilterItem(pkg) { SyncManager.removeApp(pkg) }
                }

                item {
                    Spacer(modifier = Modifier.height(24.dp))
                    // Glassmorphism Permission Buttons
                    PermissionButton("1. ALLOW OVERLAY", Icons.Default.Info) {
                        if (!android.provider.Settings.canDrawOverlays(this@MainActivity)) {
                            val intent = Intent(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION)
                            intent.data = android.net.Uri.parse("package:$packageName")
                            startActivity(intent)
                        }
                    }
                    Spacer(Modifier.height(10.dp))
                    PermissionButton("2. ENABLE FOCUS GUARD", Icons.Default.CheckCircle) {
                        startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                    }
                    Spacer(modifier = Modifier.height(50.dp))
                }
            }
        }
    }

    @Composable
    fun SyncCard(title: String, icon: androidx.compose.ui.graphics.vector.ImageVector, content: @Composable () -> Unit) {
        Card(
            colors = CardDefaults.cardColors(containerColor = Color.White.copy(0.05f)),
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier.fillMaxWidth(),
            border = BorderStroke(1.dp, Color.White.copy(0.1f))
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(icon, null, tint = Color(0xFF38BDF8), modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(title, color = Color(0xFF38BDF8), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
                Spacer(modifier = Modifier.height(16.dp))
                content()
            }
        }
    }

    @Composable
    fun PermissionButton(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, onClick: () -> Unit) {
        Button(
            onClick = onClick,
            modifier = Modifier.fillMaxWidth().height(56.dp),
            shape = RoundedCornerShape(18.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E293B)),
            border = BorderStroke(1.dp, Color.White.copy(0.1f))
        ) {
            Icon(icon, null, modifier = Modifier.size(18.dp), tint = Color(0xFF38BDF8))
            Spacer(Modifier.width(12.dp))
            Text(label, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
        }
    }

    @Composable
    fun FilterItem(text: String, onDelete: () -> Unit) {
        Surface(
            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
            color = Color.White.copy(0.03f),
            shape = RoundedCornerShape(12.dp)
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(text, color = Color.White.copy(0.7f), fontSize = 12.sp, modifier = Modifier.weight(1f))
                IconButton(onClick = onDelete, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.Default.Delete, null, tint = Color.Red.copy(0.4f), modifier = Modifier.size(18.dp))
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
            background = Color(0xFF0F172A)
        ),
        content = content
    )
}
