# Walkthrough - Optimasi Performa FocusGrow

Saya telah mengimplementasikan serangkaian optimasi untuk mengatasi masalah lag dan stuttering pada aplikasi FocusGrow.

## Perubahan Utama

### 1. Sistem Caching Ikon dan Nama Proses
- **Icon Cache**: Ikon aplikasi (yang dikonversi ke Base64) sekarang disimpan dalam `std::map`. Ini menghilangkan beban berat GDI+ yang sebelumnya terjadi setiap kali aplikasi dipindai.
- **PID Cache**: Nama proses sekarang di-cache per scan, mengurangi pemanggilan sistem `OpenProcess` yang redundan.

### 2. Pemindaian Asinkron (Background Thread)
- Proses `GetRunningApps()` yang sebelumnya memblokir UI thread, kini dipindahkan ke **background thread**.
- Pengiriman data ke WebView dilakukan secara aman menggunakan pesan Windows (`WM_WEBVIEW_POST_JSON`) untuk memastikan interaksi dengan WebView2 tetap sinkron di thread yang tepat.

### 3. Throttling dan Pencegahan Konkurensi
- Pembaruan daftar aplikasi dibatasi maksimal sekali setiap **3 detik**.
- Ditambahkan flag `isScanning` untuk mencegah beberapa proses pemindaian berjalan bersamaan jika sistem sedang sangat sibuk.

## Hasil yang Diharapkan
- **FPS Stabil**: Tidak ada lagi stuttering saat berpindah fokus jendela (Alt+Tab).
- **Penggunaan CPU Rendah**: Beban ekstraksi ikon yang sebelumnya tinggi telah dihilangkan.
- **After Effects Lebih Lancar**: Karena FocusGrow tidak lagi membebani sistem secara sinkron, After Effects akan mendapatkan resource yang lebih stabil.

## Verifikasi yang Dilakukan
- Menambahkan mutex untuk keamanan thread pada cache global.
- Memastikan alokasi memori pesan antar thread dikelola dengan benar (`new std::wstring` -> `delete msgPtr`).
