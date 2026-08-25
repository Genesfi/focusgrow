# Optimasi Performa FocusGrow Windows Native

Rencana ini bertujuan untuk mengatasi masalah lag dan penurunan FPS pada aplikasi FocusGrow, terutama saat menjalankan aplikasi berat seperti After Effects.

## Analisis Masalah
Berdasarkan pengecekan kode, ditemukan beberapa bottleneck utama:
1. **Ekstraksi Ikon yang Berat**: `AppDetector::ExtractIconBase64` melakukan konversi HICON ke PNG Base64 setiap kali aplikasi dipindai. Ini melibatkan operasi GDI+ yang lambat dan dilakukan secara berulang tanpa cache.
2. **Pemindaian Sinkron di UI Thread**: `GetRunningApps()` dijalankan di UI thread utama. Setiap kali fokus jendela berubah, aplikasi "membeku" sejenak untuk memindai semua jendela yang terbuka.
3. **Overhead Pesan WebView**: Mengirimkan data JSON besar yang berisi banyak string Base64 ikon ke WebView2 melalui `PostWebMessageAsJson` membebani thread komunikasi dan proses rendering WebView.

## Proposed Changes

### [Component Name] Native Windows C++ (src/)

#### [MODIFY] [AppDetector.hpp](file:///F:/Android Project/FocusGrow/src/AppDetector.hpp)
- Implementasi **Icon Caching**: Menyimpan string Base64 ikon berdasarkan path executable agar tidak perlu diekstraksi ulang.
- Optimasi `GetRunningApps` untuk mengurangi redundansi.

#### [MODIFY] [main.cpp](file:///F:/Android Project/FocusGrow/src/main.cpp)
- Memindahkan pemanggilan `SendRunningAppsToUi` ke background thread atau menggunakan mekanisme asinkron.
- Menambahkan throttling agar pembaruan daftar aplikasi tidak terjadi terlalu sering dalam waktu singkat.
- Memastikan WebView2 diinisialisasi dengan opsi yang mendukung performa maksimal.

#### [MODIFY] [FocusEngine.hpp](file:///F:/Android Project/FocusGrow/src/FocusEngine.hpp)
- Mengatur agar callback `m_onAppListNeedsUpdate` tidak memblokir thread event sistem.

## Verification Plan

### Manual Verification
- Menjalankan aplikasi FocusGrow bersamaan dengan After Effects.
- Membuka dan menutup berbagai jendela untuk memastikan tidak ada "stutter" saat pergantian fokus.
- Memastikan ikon aplikasi tetap muncul dengan benar di UI dashboard.
- Memeriksa penggunaan CPU di Task Manager untuk memastikan thread pemindaian tidak membebani sistem.

> [!IMPORTANT]
> Perubahan ini akan secara signifikan mengurangi beban CPU saat aplikasi berjalan di background, sehingga After Effects bisa mendapatkan alokasi resource yang lebih baik.
