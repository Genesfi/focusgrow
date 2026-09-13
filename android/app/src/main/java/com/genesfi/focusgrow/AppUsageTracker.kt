package com.genesfi.focusgrow

import android.app.usage.UsageStatsManager
import android.content.Context
import android.graphics.drawable.Drawable
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

enum class UsageTimeRange {
    TODAY,
    YESTERDAY,
    LAST_7_DAYS,
    LAST_30_DAYS,
    LAST_90_DAYS
}

data class UsageChartBar(
    val label: String,
    val durationMs: Long,
    val formattedDuration: String,
    val relativeHeight: Float, // 0f to 1f
    val isSelected: Boolean = false
)

data class AppUsageItem(
    val packageName: String,
    val appName: String,
    val icon: Drawable?,
    val usageTimeMs: Long,
    val formattedTime: String,
    val percentageOfTotal: Float, // e.g. 28.2f
    val relativePercentage: Float // 0f to 1f compared to top app
)

data class AppUsageResult(
    val totalTimeMs: Long,
    val formattedTotalTime: String,
    val topAppName: String?,
    val trendPercentage: Float?, // e.g. +12.5f or -8.3f
    val chartBars: List<UsageChartBar>,
    val items: List<AppUsageItem>
)

object AppUsageTracker {

    fun getUsageStats(context: Context, timeRange: UsageTimeRange, isEnglish: Boolean = false): AppUsageResult {
        val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
            ?: return AppUsageResult(0L, formatDuration(0L, isEnglish), null, null, emptyList(), emptyList())

        val cal = Calendar.getInstance()
        val now = cal.timeInMillis

        val (beginTime, endTime, prevBeginTime, prevEndTime) = calculateTimeBounds(cal, timeRange, now)

        val intervalType = when (timeRange) {
            UsageTimeRange.TODAY, UsageTimeRange.YESTERDAY -> UsageStatsManager.INTERVAL_DAILY
            UsageTimeRange.LAST_7_DAYS -> UsageStatsManager.INTERVAL_WEEKLY
            UsageTimeRange.LAST_30_DAYS, UsageTimeRange.LAST_90_DAYS -> UsageStatsManager.INTERVAL_MONTHLY
        }

        // Query and aggregate usage per package
        val aggregated = queryAggregated(usm, intervalType, beginTime, endTime)

        val pm = context.packageManager
        val items = mutableListOf<AppUsageItem>()
        var totalScreenTime = 0L

        val ignoredPackages = setOf(
            "com.android.systemui",
            "android",
            "com.google.android.googlequicksearchbox",
            "com.android.settings",
            context.packageName
        )

        for ((pkg, timeMs) in aggregated) {
            if (timeMs < 10_000L || ignoredPackages.contains(pkg)) continue

            try {
                val appInfo = pm.getApplicationInfo(pkg, 0)
                val appName = pm.getApplicationLabel(appInfo).toString()
                val icon = pm.getApplicationIcon(appInfo)

                totalScreenTime += timeMs
                items.add(
                    AppUsageItem(
                        packageName = pkg,
                        appName = appName,
                        icon = icon,
                        usageTimeMs = timeMs,
                        formattedTime = formatDuration(timeMs, isEnglish),
                        percentageOfTotal = 0f,
                        relativePercentage = 0f
                    )
                )
            } catch (_: Exception) {
                // Ignore uninstalled packages
            }
        }

        // Sort descending
        val sortedItems = items.sortedByDescending { it.usageTimeMs }
        val maxUsage = sortedItems.firstOrNull()?.usageTimeMs ?: 1L
        val safeTotal = if (totalScreenTime > 0L) totalScreenTime.toFloat() else 1f

        val finalItems = sortedItems.map { item ->
            val pctTotal = (item.usageTimeMs.toFloat() / safeTotal) * 100f
            val relPct = (item.usageTimeMs.toFloat() / maxUsage.toFloat()).coerceIn(0.04f, 1f)
            item.copy(
                percentageOfTotal = (pctTotal * 10f).toInt() / 10f, // 1 decimal place
                relativePercentage = relPct
            )
        }

        // Trend Comparison with previous period
        val prevAggregated = queryAggregated(usm, intervalType, prevBeginTime, prevEndTime)
        var prevTotal = 0L
        for ((pkg, timeMs) in prevAggregated) {
            if (timeMs >= 10_000L && !ignoredPackages.contains(pkg)) {
                prevTotal += timeMs
            }
        }

        val trendPercentage: Float? = if (prevTotal > 60_000L) {
            val diff = totalScreenTime - prevTotal
            val pct = (diff.toFloat() / prevTotal.toFloat()) * 100f
            (pct * 10f).toInt() / 10f
        } else null

        // Chart Bars
        val chartBars = generateChartBars(usm, timeRange, isEnglish, now)

        val topAppName = finalItems.firstOrNull()?.appName

        return AppUsageResult(
            totalTimeMs = totalScreenTime,
            formattedTotalTime = formatDuration(totalScreenTime, isEnglish),
            topAppName = topAppName,
            trendPercentage = trendPercentage,
            chartBars = chartBars,
            items = finalItems
        )
    }

    private fun queryAggregated(usm: UsageStatsManager, interval: Int, start: Long, end: Long): Map<String, Long> {
        val map = mutableMapOf<String, Long>()
        try {
            val statsList = usm.queryUsageStats(interval, start, end)
            if (!statsList.isNullOrEmpty()) {
                for (stat in statsList) {
                    if (stat.totalTimeInForeground > 0) {
                        map[stat.packageName] = (map[stat.packageName] ?: 0L) + stat.totalTimeInForeground
                    }
                }
            }
        } catch (_: Exception) {}

        if (map.isEmpty()) {
            try {
                val fallback = usm.queryAndAggregateUsageStats(start, end)
                for ((pkg, stat) in fallback) {
                    if (stat.totalTimeInForeground > 0) {
                        map[pkg] = stat.totalTimeInForeground
                    }
                }
            } catch (_: Exception) {}
        }
        return map
    }

    private data class TimeBounds(
        val beginTime: Long,
        val endTime: Long,
        val prevBeginTime: Long,
        val prevEndTime: Long
    )

    private fun calculateTimeBounds(cal: Calendar, timeRange: UsageTimeRange, now: Long): TimeBounds {
        cal.timeInMillis = now

        return when (timeRange) {
            UsageTimeRange.TODAY -> {
                cal.set(Calendar.HOUR_OF_DAY, 0)
                cal.set(Calendar.MINUTE, 0)
                cal.set(Calendar.SECOND, 0)
                cal.set(Calendar.MILLISECOND, 0)
                val begin = cal.timeInMillis

                // Prev: yesterday same time window
                cal.add(Calendar.DAY_OF_YEAR, -1)
                val prevBegin = cal.timeInMillis
                val prevEnd = prevBegin + (now - begin)

                TimeBounds(begin, now, prevBegin, prevEnd)
            }
            UsageTimeRange.YESTERDAY -> {
                cal.set(Calendar.HOUR_OF_DAY, 0)
                cal.set(Calendar.MINUTE, 0)
                cal.set(Calendar.SECOND, 0)
                cal.set(Calendar.MILLISECOND, 0)
                val todayStart = cal.timeInMillis

                cal.add(Calendar.DAY_OF_YEAR, -1)
                val begin = cal.timeInMillis
                val end = todayStart - 1

                // Prev: 2 days ago
                cal.add(Calendar.DAY_OF_YEAR, -1)
                val prevBegin = cal.timeInMillis
                val prevEnd = begin - 1

                TimeBounds(begin, end, prevBegin, prevEnd)
            }
            UsageTimeRange.LAST_7_DAYS -> {
                cal.add(Calendar.DAY_OF_YEAR, -7)
                cal.set(Calendar.HOUR_OF_DAY, 0)
                cal.set(Calendar.MINUTE, 0)
                cal.set(Calendar.SECOND, 0)
                val begin = cal.timeInMillis

                // Prev: 7 days prior
                cal.add(Calendar.DAY_OF_YEAR, -7)
                val prevBegin = cal.timeInMillis
                val prevEnd = begin - 1

                TimeBounds(begin, now, prevBegin, prevEnd)
            }
            UsageTimeRange.LAST_30_DAYS -> {
                cal.add(Calendar.DAY_OF_YEAR, -30)
                cal.set(Calendar.HOUR_OF_DAY, 0)
                cal.set(Calendar.MINUTE, 0)
                cal.set(Calendar.SECOND, 0)
                val begin = cal.timeInMillis

                cal.add(Calendar.DAY_OF_YEAR, -30)
                val prevBegin = cal.timeInMillis
                val prevEnd = begin - 1

                TimeBounds(begin, now, prevBegin, prevEnd)
            }
            UsageTimeRange.LAST_90_DAYS -> {
                cal.add(Calendar.DAY_OF_YEAR, -90)
                cal.set(Calendar.HOUR_OF_DAY, 0)
                cal.set(Calendar.MINUTE, 0)
                cal.set(Calendar.SECOND, 0)
                val begin = cal.timeInMillis

                cal.add(Calendar.DAY_OF_YEAR, -90)
                val prevBegin = cal.timeInMillis
                val prevEnd = begin - 1

                TimeBounds(begin, now, prevBegin, prevEnd)
            }
        }
    }

    private fun generateChartBars(
        usm: UsageStatsManager,
        timeRange: UsageTimeRange,
        isEnglish: Boolean,
        now: Long
    ): List<UsageChartBar> {
        val cal = Calendar.getInstance()
        val bars = mutableListOf<UsageChartBar>()

        when (timeRange) {
            UsageTimeRange.TODAY, UsageTimeRange.YESTERDAY, UsageTimeRange.LAST_7_DAYS -> {
                // Show last 7 days bar chart
                val dayFormat = SimpleDateFormat("EEE", if (isEnglish) Locale.ENGLISH else Locale("id", "ID"))
                val rawBars = mutableListOf<Pair<String, Long>>()

                for (i in 6 downTo 0) {
                    cal.timeInMillis = now
                    cal.add(Calendar.DAY_OF_YEAR, -i)
                    cal.set(Calendar.HOUR_OF_DAY, 0)
                    cal.set(Calendar.MINUTE, 0)
                    cal.set(Calendar.SECOND, 0)
                    cal.set(Calendar.MILLISECOND, 0)
                    val start = cal.timeInMillis

                    val end = if (i == 0) now else {
                        cal.set(Calendar.HOUR_OF_DAY, 23)
                        cal.set(Calendar.MINUTE, 59)
                        cal.set(Calendar.SECOND, 59)
                        cal.timeInMillis
                    }

                    val label = if (i == 0) (if (isEnglish) "Today" else "Hari ini") else dayFormat.format(cal.time)

                    var dayTotal = 0L
                    val dayMap = queryAggregated(usm, UsageStatsManager.INTERVAL_DAILY, start, end)
                    for ((pkg, ms) in dayMap) {
                        if (ms >= 10_000L && pkg != "com.android.systemui" && pkg != "android") {
                            dayTotal += ms
                        }
                    }
                    rawBars.add(label to dayTotal)
                }

                val maxBar = rawBars.maxOfOrNull { it.second } ?: 1L
                val safeMax = if (maxBar > 0) maxBar.toFloat() else 1f

                rawBars.forEachIndexed { idx, (label, dur) ->
                    bars.add(
                        UsageChartBar(
                            label = label,
                            durationMs = dur,
                            formattedDuration = formatDuration(dur, isEnglish),
                            relativeHeight = (dur.toFloat() / safeMax).coerceIn(0.08f, 1f),
                            isSelected = (timeRange == UsageTimeRange.TODAY && idx == 6) || (timeRange == UsageTimeRange.YESTERDAY && idx == 5)
                        )
                    )
                }
            }
            UsageTimeRange.LAST_30_DAYS -> {
                // 4 Weeks
                for (w in 3 downTo 0) {
                    cal.timeInMillis = now
                    cal.add(Calendar.DAY_OF_YEAR, -(w * 7 + 7))
                    val start = cal.timeInMillis
                    cal.timeInMillis = now
                    cal.add(Calendar.DAY_OF_YEAR, -(w * 7))
                    val end = cal.timeInMillis

                    val label = if (isEnglish) "W${4 - w}" else "M${4 - w}"
                    var weekTotal = 0L
                    val weekMap = queryAggregated(usm, UsageStatsManager.INTERVAL_WEEKLY, start, end)
                    for ((pkg, ms) in weekMap) {
                        if (ms >= 10_000L && pkg != "com.android.systemui" && pkg != "android") {
                            weekTotal += ms
                        }
                    }
                    bars.add(
                        UsageChartBar(
                            label = label,
                            durationMs = weekTotal,
                            formattedDuration = formatDuration(weekTotal, isEnglish),
                            relativeHeight = 0.5f,
                            isSelected = (w == 0)
                        )
                    )
                }
                val maxBar = bars.maxOfOrNull { it.durationMs } ?: 1L
                val safeMax = if (maxBar > 0) maxBar.toFloat() else 1f
                for (i in bars.indices) {
                    bars[i] = bars[i].copy(relativeHeight = (bars[i].durationMs.toFloat() / safeMax).coerceIn(0.08f, 1f))
                }
            }
            UsageTimeRange.LAST_90_DAYS -> {
                // 3 Months
                val monthFormat = SimpleDateFormat("MMM", if (isEnglish) Locale.ENGLISH else Locale("id", "ID"))
                for (m in 2 downTo 0) {
                    cal.timeInMillis = now
                    cal.add(Calendar.DAY_OF_YEAR, -(m * 30 + 30))
                    val start = cal.timeInMillis
                    cal.timeInMillis = now
                    cal.add(Calendar.DAY_OF_YEAR, -(m * 30))
                    val end = cal.timeInMillis

                    val label = monthFormat.format(cal.time)
                    var monthTotal = 0L
                    val monthMap = queryAggregated(usm, UsageStatsManager.INTERVAL_MONTHLY, start, end)
                    for ((pkg, ms) in monthMap) {
                        if (ms >= 10_000L && pkg != "com.android.systemui" && pkg != "android") {
                            monthTotal += ms
                        }
                    }
                    bars.add(
                        UsageChartBar(
                            label = label,
                            durationMs = monthTotal,
                            formattedDuration = formatDuration(monthTotal, isEnglish),
                            relativeHeight = 0.5f,
                            isSelected = (m == 0)
                        )
                    )
                }
                val maxBar = bars.maxOfOrNull { it.durationMs } ?: 1L
                val safeMax = if (maxBar > 0) maxBar.toFloat() else 1f
                for (i in bars.indices) {
                    bars[i] = bars[i].copy(relativeHeight = (bars[i].durationMs.toFloat() / safeMax).coerceIn(0.08f, 1f))
                }
            }
        }
        return bars
    }

    fun formatDuration(ms: Long, isEnglish: Boolean): String {
        val totalSec = ms / 1000
        val hours = totalSec / 3600
        val minutes = (totalSec % 3600) / 60
        val seconds = totalSec % 60

        val hrUnit = if (isEnglish) "h" else "j"
        val minUnit = if (isEnglish) "m" else "m"
        val secUnit = "s"

        return when {
            hours > 0 -> "${hours}${hrUnit} ${minutes}${minUnit}"
            minutes > 0 && seconds > 0 -> "${minutes}${minUnit} ${seconds}${secUnit}"
            minutes > 0 -> "${minutes}${minUnit}"
            seconds > 0 -> "${seconds}${secUnit}"
            else -> "0${minUnit}"
        }
    }
}
