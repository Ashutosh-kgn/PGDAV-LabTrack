# PGDAV LabTrack

**PGDAV LabTrack** is a laboratory equipment management and tracking portal built for institutional labs. It streamlines equipment inventory management, QR code tagging, student borrowing requests, active loan monitoring, and maintenance logging.

---

## 🚀 Key Features

* **Role-Based Access Control**:
  * **Super Admin**: Direct provisioning of Lab Assistants, equipment management across all labs, student account approvals, and comprehensive audit history.
  * **Lab Assistant**: Department-scoped inventory tracking, quick issuance to students, QR generation, borrowing request processing, and maintenance ticketing.
  * **Student**: Self-registration, equipment catalog browsing by laboratory, loan requests, and real-time request status tracking.
* **Smart QR Code Tagging**:
  * Python serverless backend and client-side QR generation for equipment labels.
  * Integrated in-browser camera QR code scanner with auto-identification.
* **Department Taxonomy**:
  * Computer Science Lab
  * Commerce Lab
  * Statistics Lab
  * Environmental Science Lab
* **Universal Date Formatting**: Standardized `DD-MM-YYYY` across all tables, pickers, and CSV exports.

---

## 🛠️ Tech Stack

* **Frontend**: HTML5, CSS3, Modern JavaScript (ES6+ Modules)
* **Backend & Database**: Firebase Authentication, Google Cloud Firestore
* **QR Services**: Python 3 (`qrcode`, `Pillow`), HTML5-QRCode
* **Hosting**: Optimized for **Vercel** with static CDN and Python Serverless API (`vercel.json`)

---

## 📦 Deployment to Vercel

1. Push this repository to GitHub.
2. Sign in to [Vercel](https://vercel.com/) and click **Import Project**.
3. Select this repository and click **Deploy**.
4. In the **Firebase Console**, add your Vercel domain under **Authentication → Settings → Authorized domains**.

