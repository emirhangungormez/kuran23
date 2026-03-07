# Kuran Rehberi (kuran.emirhangungormez.com.tr)

Bu proje, React ve Vite üzerine inşa edilmiş modern bir Kuran-ı Kerim okuma ve dinleme platformudur. Kullanıcılara zengin bir deneyim sunmak için gelişmiş ses yönetimi, kişiselleştirilebilir ayarlar ve geniş bir meal kütüphanesi sunar.

## 🛠️ Teknoloji Yığını
- **Core:** React 18 + Vite
- **Styling:** Vanilla CSS (Custom tokens, Modern Glassmorphism)
- **State Management:** Zustand (Player) & Context API (Settings, Auth, Bookmarks)
- **Data Fetching:** TanStack Query (React Query)
- **Backend:** PHP (Diyanet Proxy, Local Cache, User Persistence)

## 🏗️ Mimari ve Teknik Detaylar

### 1. Ses Yönetimi (Audio Service)
Uygulama, tüm sayfalarda kesintisiz oynatma sağlayan merkezi bir **Global Player** yapısı kullanır.
- **Store:** `src/stores/usePlayerStore.js` (Zustand) üzerinden kontrol edilir.
- **Audio Instance:** Tek bir `Audio()` nesnesi singleton olarak yönetilir.
- **Kaynaklar (audio.js):**
    - **Arapça:** [EveryAyah.com](https://everyayah.com) (Ayet bazlı) veya [MP3Quran.net](https://mp3quran.net) (Sure bazlı).
    - **Türkçe (Diyanet):** [webdosya.diyanet.gov.tr](https://webdosya.diyanet.gov.tr) (Ayet bazlı, `tr_seyfullahkartal` veya `tr_mehmeteminay`).
    - **Türkçe (AçıkKuran):** [audio.acikkuran.com](https://audio.acikkuran.com) (Sure bazlı MP3 dosyaları).

### 2. API ve Veri Akışı
Uygulama dayanıklılık (resilience) için kademeli bir veri çekme stratejisi (Fallback) izler:
- **Local API:** `/api/*.php` - Veritabanı ile senkronize yerel veriler.
- **Fallback 1 (AcıkKuran API):** Yerel API 404/Hata verirse doğrudan `api.acikkuran.com` adresine yönlenir.
- **Fallback 2 (Mock Data):** İnternet veya API'ler kapalıyken `src/data/quranData.js` içindeki temel verileri kullanır.

### 3. Kullanıcı Ayarları (Settings Context)
Kullanıcıların Font boyutu, Tema (Aydınlık/Karanlık), Okuyucu ve Meal tercihleri `SettingsContext` üzerinden yönetilir.
- Veriler `localStorage`'da saklanır ve giriş yapmış kullanıcılar için PHP backend (`/api/sync.php`) üzerinden veritabanı ile senkronize edilir.

## 📁 Proje Yapısı
- `/src/components`: Tekrar kullanılabilir UI bileşenleri (Player, Nav vb.)
- `/src/pages`: Sayfa tasarımları (Sure, Ayet, Profil, Cüz vb.)
- `/src/services`: API iletişimi ve Ses URL üretimi
- `/src/stores`: Zustand tabanlı global player state
- `/api`: PHP tabanlı backend servisleri ve Diyanet proxy katmanı

## 🚀 Çalıştırma
```bash
npm install
npm run dev
```

---
*Geliştirme Notu: Proje tasarımı Apple Glassmorphism estetiği ve Apple Human Interface Guidelines'dan ilham alınarak hazırlanmıştır.*