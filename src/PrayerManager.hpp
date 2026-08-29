#pragma once

#include <windows.h>
#include <string>
#include <vector>
#include <cmath>
#include <ctime>
#include <algorithm>
#include <iomanip>
#include <sstream>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

struct PrayerTimes {
    double subuh, dhuha, dzuhur, ashar, maghrib, isya;
};

class PrayerManager {
private:
    double m_lat = -2.8554; // Default: Padang Batung approx
    double m_lng = 115.3283;
    int m_timezone = 8;     // WITA (GMT+8)

    // Kemenag RI / NU Standard
    double m_fajrAngle = 20.0;
    double m_ishaAngle = 18.0;

    double DegToRad(double degree) { return degree * M_PI / 180.0; }
    double RadToDeg(double radian) { return radian * 180.0 / M_PI; }

    double FixAngle(double angle) {
        angle = fmod(angle, 360.0);
        if (angle < 0) angle += 360.0;
        return angle;
    }

    double FixHour(double hour) {
        hour = fmod(hour, 24.0);
        if (hour < 0) hour += 24.0;
        return hour;
    }

    // Simplified calculation based on "PrayTimes" algorithms
    double CalculateTime(double angle, double dayOfYear, double lat, double declination, double eqTime, bool isSunrise = false) {
        double d = DegToRad(lat);
        double dec = DegToRad(declination);
        double h = isSunrise ? 0.833 : angle;
        double cosH = (sin(DegToRad(-h)) - sin(d) * sin(dec)) / (cos(d) * cos(dec));

        if (cosH > 1.0 || cosH < -1.0) return 0.0; // Never happens or always happens

        double H = RadToDeg(acos(cosH));
        double time = 12.0 - eqTime / 15.0;
        if (isSunrise) return time - H / 15.0;
        return time + (angle > 0 ? -H / 15.0 : H / 15.0); // Simplified
    }

public:
    PrayerManager() {}

    void SetLocation(double lat, double lng, int tz) {
        m_lat = lat;
        m_lng = lng;
        m_timezone = tz;
    }

    PrayerTimes GetTodayPrayerTimes() {
        time_t t = time(0);
        struct tm* now = localtime(&t);
        return GetPrayerTimes(now->tm_year + 1900, now->tm_mon + 1, now->tm_mday);
    }

    PrayerTimes GetPrayerTimes(int year, int month, int day) {
        // Julian Date calculation (simplified)
        if (month <= 2) { year -= 1; month += 12; }
        double A = floor(year / 100.0);
        double B = 2 - A + floor(A / 4.0);
        double JD = floor(365.25 * (year + 4716)) + floor(30.6001 * (month + 1)) + day + B - 1524.5;

        double D = JD - 2451545.0;
        double g = FixAngle(357.529 + 0.98560028 * D);
        double q = FixAngle(280.459 + 0.98564736 * D);
        double L = FixAngle(q + 1.915 * sin(DegToRad(g)) + 0.020 * sin(DegToRad(2 * g)));

        double e = 23.439 - 0.00000036 * D;
        double RA = RadToDeg(atan2(cos(DegToRad(e)) * sin(DegToRad(L)), cos(DegToRad(L)))) / 15.0;
        RA = FixHour(RA);

        double declination = RadToDeg(asin(sin(DegToRad(e)) * sin(DegToRad(L))));
        double eqTime = q / 15.0 - RA;

        auto calcBase = [&](double angle, bool isFajr) {
            double d = DegToRad(m_lat);
            double dec = DegToRad(declination);
            double h = DegToRad(angle);
            double cosH = (-sin(h) - sin(d) * sin(dec)) / (cos(d) * cos(dec));
            if (cosH > 1 || cosH < -1) return 0.0;
            double H = RadToDeg(acos(cosH)) / 15.0;
            double noon = 12 + m_timezone - m_lng / 15.0 - eqTime;
            return isFajr ? (noon - H) : (noon + H);
        };

        PrayerTimes pt;
        double noon = 12 + m_timezone - m_lng / 15.0 - eqTime;

        pt.dzuhur = noon + (2.0 / 60.0); // +2 mins for security (ihtiyat)
        pt.subuh = calcBase(m_fajrAngle, true) + (2.0 / 60.0);
        pt.isya = calcBase(m_ishaAngle, false) + (2.0 / 60.0);
        pt.maghrib = calcBase(0.833, false) + (2.0 / 60.0);

        // Ashar (Syafi'i)
        double d = DegToRad(m_lat);
        double dec = DegToRad(declination);
        double acotArc = atan(1.0 / (1.0 + tan(abs(d - dec))));
        double hAshar = RadToDeg(acotArc);
        double cosHAshar = (sin(DegToRad(hAshar)) - sin(d) * sin(dec)) / (cos(d) * cos(dec));
        double HAshar = RadToDeg(acos(cosHAshar)) / 15.0;
        pt.ashar = noon + HAshar + (2.0 / 60.0);

        double sunrise = calcBase(0.833, true);
        pt.dhuha = sunrise + (20.0 / 60.0); // Dhuha: 20 mins after sunrise

        return pt;
    }

    std::wstring FormatTime(double hour) const {
        int h = (int)floor(hour);
        int m = (int)floor((hour - h) * 60);
        wchar_t buf[16];
        swprintf_s(buf, L"%02d:%02d", h % 24, m);
        return buf;
    }
};
