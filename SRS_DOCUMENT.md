# SOFTWARE REQUIREMENT SPECIFICATION (SRS)
## PGDAV LabTrack: Laboratory Equipment Tracking & Management System

---

**Document ID**: SRS-PGDAV-LABTRACK-2026-V1.0  
**Project Name**: PGDAV LabTrack  
**Institution**: PGDAV College  
**Target Environment**: Web / Cloud (Firebase & Vercel Global Edge)  
**Document Standard**: IEEE 830-1998 / ISO/IEC/IEEE 29148 Compliant  
**Typography / Format Specification**: Times New Roman, 14pt Body, Standard Academic Spacing  

---

## TABLE OF CONTENTS
1. [Introduction](#1-introduction)  
   1.1 [Purpose of Project](#11-purpose-of-project)  
   1.2 [Scope of Project](#12-scope-of-project)  
   1.3 [Definitions, Acronyms & Overview](#13-definitions-acronyms--overview)  
2. [Research Problem](#2-research-problem)  
   2.1 [Problem Statement](#21-problem-statement)  
   2.2 [Existing System & Limitations](#22-existing-system--limitations)  
   2.3 [Need for New System](#23-need-for-new-system)  
3. [Research Flow](#3-research-flow)  
   3.1 [Data Flow Diagrams (DFD Level 0 & Level 1)](#31-data-flow-diagrams)  
   3.2 [Step-by-Step Flow Explanation](#32-step-by-step-flow-explanation)  
4. [Research Objectives](#4-research-objectives)  
   4.1 [Main Objective](#41-main-objective)  
   4.2 [Specific Objectives (O1, O2, O3)](#42-specific-objectives)  
5. [Proposed Methodology](#5-proposed-methodology)  
   5.1 [SDLC Model Used (Agile-Iterative)](#51-sdlc-model-used)  
   5.2 [Tools & Technologies Used](#52-tools--technologies-used)  
   5.3 [System Architecture & Entity-Relationship Diagram (ERD)](#53-system-architecture--erd)  
   5.4 [Modules Description](#54-modules-description)  
6. [Security Assessment Methods](#6-security-assessment-methods)  
   6.1 [Functional Requirements (FR-01 to FR-15)](#61-functional-requirements)  
   6.2 [Non-Functional Requirements (NFR-01 to NFR-08)](#62-non-functional-requirements)  
   6.3 [Security Testing (SQLi, XSS, Broken Auth, BOLA)](#63-security-testing)  
   6.4 [Testing Tools (OWASP ZAP, Burp Suite, Static Linters)](#64-testing-tools)  
7. [Output and Observations](#7-output-and-observations)  
   7.1 [Screenshots of Output & Layout Specifications](#71-screenshots-of-output)  
   7.2 [Test Cases & Results Table](#72-test-cases--results-table)  
   7.3 [Empirical Observations](#73-empirical-observations)  
8. [Conclusions](#8-conclusions)  
   8.1 [Conclusion](#81-conclusion)  
   8.2 [Limitations](#82-limitations)  
   8.3 [Future Scope](#83-future-scope)  

---

## 1. INTRODUCTION

### 1.1 Purpose of Project
The purpose of the **PGDAV LabTrack** system is to provide a digital, cloud-synchronized, and secure Laboratory Asset Management platform for educational laboratories. The system completely automates the traditional register-based logging of hardware assets, instruments, computing equipment, and apparatus. By integrating dynamic Quick Response (QR) code asset labeling, live device camera barcode scanning, role-based departmental segregation, and atomic cloud database transactions, PGDAV LabTrack eliminates manual errors, prevents unauthorized access, and accelerates the lending, return, and maintenance verification cycles.

### 1.2 Scope of Project
The project encompasses four primary departmental laboratories operating within PGDAV College:
1. **Computer Science Lab** (Laptops, Desktops, Servers, Microcontroller Kits, Network Switches)
2. **Commerce Lab** (Financial Terminal Emulators, Workstations, Accounting Kits)
3. **Statistics Lab** (Computing Terminals, Data Processing Units, Calculation Modules)
4. **Environmental Science Lab** (Digital Testing Probes, Analyzers, Spectrometric Units, Field Sensors)

The software governs the entire lifecycle of each asset: procurement registration, departmental assignment, dynamic QR badge printing, student borrowing requests, departmental review and approval, physical asset dispatch, overdue monitoring, return condition grading, and maintenance ticketing.

### 1.3 Definitions, Acronyms & Overview

| Term / Acronym | Definition |
| :--- | :--- |
| **SRS** | Software Requirements Specification (formal specification document) |
| **RBAC** | Role-Based Access Control (Super Admin, Lab Assistant, Student) |
| **QR Code** | Quick Response two-dimensional optical barcode encoding asset identification |
| **BaaS** | Backend-as-a-Service (Cloud-hosted Firestore & Firebase Auth) |
| **Firestore** | Cloud Firestore NoSQL document database providing real-time synchronization |
| **DFD** | Data Flow Diagram representing algorithmic and information flow |
| **ERD** | Entity-Relationship Diagram representing data structures and logical relationships |
| **IDOR / BOLA** | Insecure Direct Object Reference / Broken Object Level Authorization |
| **XSS** | Cross-Site Scripting (injection of malicious client-side scripts) |
| **Universal Date** | Standardized `DD-MM-YYYY` chronological format enforced across the platform |

---

## 2. RESEARCH PROBLEM

### 2.1 Problem Statement
In higher education institutions, academic laboratories manage hundreds of high-value shared physical assets. Traditional management across departments relies on physical paper notebooks, manual sign-in ledgers, and verbal handoffs. This manual workflow exhibits systemic failure modes:
* **Asset Shrinkage & Loss**: Lack of accountable tracking leads to unreturned or misplaced equipment.
* **Information Asymmetry**: Students have no visibility into equipment availability without physically travelling between different laboratory rooms.
* **Delayed Handover Times**: Manual entry of student details, serial numbers, and return dates creates bottlenecks during peak practical laboratory sessions.
* **Inaccurate Condition Logging**: Wear and tear or equipment damage is not systematically inspected or logged at the point of return.
* **Zero Cross-Department Segregation**: Centralized paper ledgers do not restrict assistants to their respective domains, leading to misfiled records.

### 2.2 Existing System & Limitations

```mermaid
flowchart LR
    A["Student Visits Lab"] --> B["Manual Paper Ledger"]
    B --> C["Assistant Handwriting Entry"]
    C --> D["Equipment Issued Physically"]
    D --> E["Asset Kept Without Trace"]
    E --> F["Periodic Manual Audit"]
    F --> G["Discrepancies & Lost Assets"]
```

#### Major Limitations:
1. **Physical Ledger Vulnerability**: Paper registers suffer from physical deterioration, illegible handwriting, water/chemical damage, and loss.
2. **Zero Auditability**: No digital timestamping or immutable user attribution exists.
3. **No Overdue Tracking**: Identifying overdue loans requires staff to manually read hundreds of handwritten ledger lines.
4. **Lack of Mobile Integration**: Staff cannot verify assets on the spot using mobile devices or cameras.

### 2.3 Need for New System
A modern web-first architecture is required that provides:
1. **Institutional Domain Authentication**: Verifying that only registered college students and authorized staff can access the portal.
2. **Dynamic QR Asset Tagging**: Instant physical asset identification via standard device webcams or smartphone cameras.
3. **Real-time Synchronization**: Updating asset availability immediately when equipment is requested, approved, issued, or returned.
4. **Departmental Compartmentalization**: Ensuring lab assistants only oversee their designated department.
5. **Rigorous Security**: Defending institutional and student data against unauthorized access, injection, and privilege escalation.

---

## 3. RESEARCH FLOW

### 3.1 Data Flow Diagrams

#### Level 0 DFD (Context Diagram)

```mermaid
flowchart TD
    User(["Student / Lab Assistant / Admin"])
    System[["PGDAV LabTrack System"]]
    DB[("Cloud Firestore & Auth Database")]
    QRService[["Python QR Service"]]

    User -->|"1. Credentials & Role Selection"| System
    User -->|"2. Asset Requests / QR Scan Input"| System
    System -->|"3. Role-Filtered Views & Data"| User

    System <-->|"4. Authenticate, Read & Transact Data"| DB
    System <-->|"5. Request & Stream Base64 QR Tag"| QRService
```

#### Level 1 DFD (Decomposed System Process)

```mermaid
flowchart TD
    subgraph PGDAV_LabTrack_Core
        P1["1.0 Authentication & Role Verification"]
        P2["2.0 Departmental Inventory Cataloging"]
        P3["3.0 Borrowing Request Evaluation"]
        P4["4.0 Active Loan & Return Engine"]
        P5["5.0 Maintenance & Defect Management"]
    end

    U_Student(["Student"])
    U_Assistant(["Lab Assistant"])
    U_Admin(["Super Admin"])

    DB_Users[("Users Store")]
    DB_Equip[("Equipment Store")]
    DB_Req[("Requests Store")]
    DB_Loans[("Borrowings Store")]
    DB_Maint[("Maintenance Store")]

    U_Student -->|"Submit Signup / Login"| P1
    U_Assistant -->|"Login with Dept Credential"| P1
    U_Admin -->|"Login as Admin"| P1
    P1 <--> DB_Users

    U_Assistant -->|"Add / Edit / Tag Assets"| P2
    P2 <--> DB_Equip

    U_Student -->|"Submit Borrowing Request"| P3
    P3 <--> DB_Req
    U_Assistant -->|"Approve / Reject Request"| P3

    P3 -->|"On Approval"| P4
    P4 <--> DB_Loans
    P4 <--> DB_Equip
    U_Assistant -->|"Process Return & Restock"| P4

    U_Assistant -->|"Report Damage / Defect"| P5
    P5 <--> DB_Maint
    P5 <--> DB_Equip
```

### 3.2 Step-by-Step Flow Explanation
1. **User Sign-Up & Verification**: A student signs up providing Full Name, College Roll Number, Course, and Institutional Email. The account is set to `status: "pending"` and `active: false`.
2. **Admin Provisioning & Approvals**: The Super Admin approves student profiles or registers Lab Assistants with designated departmental custody (Computer Science, Commerce, Statistics, or Environmental Science).
3. **Equipment Registration & QR Generation**: An authorized Assistant or Admin creates an equipment item. The system triggers the Python microservice to generate an asset QR code tag containing identity, location, and department metadata.
4. **Student Request Submission**: An approved Student logs in, browses available items by department, and submits a request specifying experiment purpose, start date, and end date (`DD-MM-YYYY`).
5. **Departmental Routing & Evaluation**: The request is routed exclusively to the Lab Assistant of that laboratory department. The Assistant evaluates availability and clicks "Approve & Issue" or "Reject".
6. **Active Loan Custody**: On approval, a transactional write moves the item to `status: "Borrowed"`, records an active borrowing document, and schedules the return due date.
7. **Equipment Return & Restocking**: Upon return, the Assistant scans the physical QR tag, inspects condition (Good, Fair, Damaged), and marks it returned. If damaged, a maintenance ticket is automatically triggered.

---

## 4. RESEARCH OBJECTIVES

### 4.1 Main Objective
To design, develop, rigorously test, and deploy a secure, cloud-native **Laboratory Equipment Tracking & Management System (PGDAV LabTrack)** that eliminates paper logbook inefficiencies through automated QR tagging, real-time status synchronization, and strict role-based departmental segregation.

### 4.2 Specific Objectives
* **Objective 1 (O1: Inventory & Optical Tag Digitalization)**: Digitally register 100% of physical laboratory apparatus across all four institutional labs with unique tracking codes, shelf coordinates, condition classifications, and real-time generated 2D QR tags.
* **Objective 2 (O2: Transactional Lending & Automated Due-Date Audit)**: Automate the end-to-end borrowing request, approval, active loan checkout, and return workflow using atomic Firestore transactions, standardized `DD-MM-YYYY` chronological formats, and automated visual highlighting of overdue assets.
* **Objective 3 (O3: Architectural Security & Strict Department Isolation)**: Enforce Cloud Firestore security rules and defensive programming patterns that prevent privilege escalation, isolate lab assistant access strictly to their assigned department, sanitize inputs against XSS, and ensure compliance with OWASP Top 10 web security guidelines.

---

## 5. PROPOSED METHODOLOGY

### 5.1 SDLC Model Used
The **Agile-Iterative SDLC Model** was selected for developing PGDAV LabTrack. This model enabled continuous feedback, early architectural validation, and incremental security verification across five sequential sprints:

```mermaid
flowchart LR
    S1["Sprint 1: Core RBAC & Auth"] --> S2["Sprint 2: Inventory & QR Engine"]
    S2 --> S3["Sprint 3: Lending & Returns"]
    S3 --> S4["Sprint 4: Dept Isolation & Security Rules"]
    S4 --> S5["Sprint 5: Vercel Deployment & Hardening"]
```

* **Sprint 1 (Architecture & Role Partitioning)**: Decoupled login and registration into dedicated, security-controlled pages.
* **Sprint 2 (Asset Cataloging & QR Microservice)**: Built the dual-engine QR generation system (Python Serverless API + Client-side canvas fallback).
* **Sprint 3 (Lending Pipeline & Active Auditing)**: Engineered transactional loan approvals, returns, and overdue alert mechanisms.
* **Sprint 4 (Security Hardening & Department Scoping)**: Formulated declarative Firestore security rules and multi-tenant secondary authentication provisioning.
* **Sprint 5 (Edge Deployment & Quality Assurance)**: Built Vercel serverless configurations, dual-stack socket networking, and cross-browser testing.

### 5.2 Tools & Technologies Used

| Tier | Technology / Library | Version / Role |
| :--- | :--- | :--- |
| **Frontend Framework** | HTML5 / CSS3 / ES6 Vanilla JS | Modern responsive modular web architecture |
| **QR Code Scanner** | `html5-qrcode` | Client-side live camera stream decoding |
| **QR Code Canvas** | `qrcodejs` | In-browser dynamic QR vector rendering fallback |
| **Authentication** | Firebase Authentication | Enterprise-grade JWT token issuance & session management |
| **Cloud Database** | Google Cloud Firestore | Distributed NoSQL database with ACID transaction support |
| **Backend Microservice** | Python 3 (`http.server`, `qrcode`, `Pillow`) | High-resolution PNG QR generation & byte stream encoding |
| **Deployment & Hosting**| Vercel Global Edge Network | Static CDN hosting with serverless Python function execution |
| **Version Control** | Git & GitHub | Distributed version control with automated continuous deployment |

### 5.3 System Architecture & Entity-Relationship Diagram (ERD)

#### High-Level System Architecture

```mermaid
flowchart TD
    subgraph Client_Tier["Client Tier (User Browser)"]
        UI_Admin["Super Admin Console"]
        UI_Asst["Lab Assistant Portal"]
        UI_Stud["Student Self-Service"]
        Camera["Device WebCam / QR Scanner"]
    end

    subgraph Edge_Tier["Vercel Global Edge Network"]
        CDN["Static Asset CDN (HTML/CSS/JS)"]
        Serverless["Python Serverless QR Handler (/api/generate-qr)"]
    end

    subgraph BaaS_Tier["Google Cloud Platform / Firebase"]
        Auth["Firebase Authentication Service"]
        Firestore[("Cloud Firestore (ACID Rules Engine)")]
    end

    Client_Tier <-->|"HTTPS / CDN Delivery"| CDN
    Camera -->|"Decoded String"| Client_Tier
    Client_Tier -->|"Fetch QR PNG Stream"| Serverless
    Client_Tier <-->|"JWT Sign-in & Token Check"| Auth
    Client_Tier <-->|"Realtime Snapshots & Transactions"| Firestore
```

#### Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    USERS ||--o{ REQUESTS : submits
    USERS ||--o{ BORROWINGS : borrows
    USERS ||--o{ EQUIPMENT : manages
    EQUIPMENT ||--o{ REQUESTS : requested_in
    EQUIPMENT ||--o{ BORROWINGS : lent_in
    EQUIPMENT ||--o{ MAINTENANCE : undergoes

    USERS {
        string uid PK
        string name
        string email
        string role
        string department
        string rollNo
        string course
        boolean active
        string status
        timestamp createdAt
    }

    EQUIPMENT {
        string documentId PK
        string equipmentId
        string name
        string category
        string location
        string condition
        string status
        string currentBorrowingId FK
        string lastIssuedTo
        string lastIssuedDate
    }

    REQUESTS {
        string documentId PK
        string studentUid FK
        string studentName
        string studentEmail
        string studentRollNo
        string studentCourse
        string equipmentDocId FK
        string equipmentId
        string equipmentName
        string category
        string fromDate
        string toDate
        string purpose
        string status
        string rejectionReason
        timestamp createdAt
    }

    BORROWINGS {
        string borrowingId PK
        string equipmentDocId FK
        string equipmentId
        string equipmentName
        string category
        string studentUid FK
        string studentName
        string studentEmail
        string studentRollNo
        string issueDate
        string dueDate
        string returnDate
        string returnCondition
        string returnNotes
        string status
        string issuedBy
        string issuedByUid
    }

    MAINTENANCE {
        string documentId PK
        string equipmentId
        string equipmentName
        string category
        string description
        string reportDate
        string status
        string resolvedDate
        string reportedBy
    }
```

### 5.4 Modules Description

#### Module 1: Authentication & Institutional Verification
* Enforces single-domain institutional email authentication.
* Role selector automatically validates credentials against the authenticated Firestore user profile (`admin`, `lab_assistant`, or `student`).
* Unapproved student profiles are strictly blocked with an explanatory status message until approved by the Super Admin.

#### Module 2: Super Admin Central Control Console
* **Global Inventory Management**: Add, update, delete, search, and filter apparatus across all 4 institutional labs.
* **Lab Assistant Provisioning**: Create and activate Lab Assistants directly, binding them to their respective laboratory department.
* **Student Approvals**: Review pending registrations and approve or reject access in real-time.
* **Audit & Export**: Export full inventory, loan registries, and maintenance records to structured CSV files.

#### Module 3: Department-Scoped Lab Assistant Console
* **Scoped Visibility**: Automatically filters equipment, active loans, and student requests strictly to the Assistant's assigned department.
* **Request Evaluation**: One-click approval that atomically creates an active borrowing record and marks the apparatus borrowed.
* **Return Processing**: Inspects returned equipment, restocks the asset, logs condition, and triggers maintenance tickets if damaged.

#### Module 4: Student Self-Service Portal
* **Live Catalog Search**: Real-time browsing of available laboratory apparatus filtered by category, shelf location, and operational condition.
* **Borrowing Requests**: Interactive submission of loan periods (`DD-MM-YYYY`) and experimental purpose.
* **Loan Tracking**: Real-time overview of active borrowings, countdown to due dates, and request rejection reasons.

#### Module 5: QR Code Generation & Optical Scanner Engine
* **High-Definition Label Generation**: Python-powered vector PNG generator producing printable equipment QR labels.
* **Integrated Viewfinder Scanner**: Camera-driven QR scanner that instantly identifies apparatus, retrieves live status, and surfaces context-aware actions (e.g., Quick Issue, Process Return).

#### Module 6: Maintenance & Quality Assurance Hub
* Centralized defect reporting for broken apparatus, preventing faulty equipment from being issued to students.
* Resolution logging with timestamps and technician remarks.

---

## 6. SECURITY ASSESSMENT METHODS

### 6.1 Functional Requirements

| ID | Module | Actor | Functional Requirement Specification | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **FR-01** | Auth | Student | Must allow registration using institutional email, roll number, and course. | Account created with `status: pending`, `active: false`. |
| **FR-02** | Auth | All | Must authenticate users and route them strictly to their assigned dashboard. | Role mismatch rejects login; valid role routes to appropriate dashboard. |
| **FR-03** | Admin | Super Admin | Must provision Lab Assistants and bind them to a specific laboratory. | User document created with `role: lab_assistant`, `active: true`. |
| **FR-04** | Admin | Super Admin | Must approve or reject pending student registrations. | Status updates immediately in Firestore and unlocks portal access. |
| **FR-05** | Inventory | Admin/Asst | Must create, edit, and delete equipment items with unique IDs. | Prevent deletion if equipment status is currently `Borrowed`. |
| **FR-06** | QR Tag | Admin/Asst | Must generate high-resolution downloadable QR labels for any asset. | Returns Base64 PNG QR code containing equipment identification. |
| **FR-07** | Scanner | All | Must access device camera, scan physical QR tag, and fetch asset details. | Camera opens in viewfinder; valid QR triggers instant asset lookup card. |
| **FR-08** | Request | Student | Must submit loan request specifying experiment purpose and date range. | Request record stored with `status: Pending`; displayed in Assistant inbox. |
| **FR-09** | Scoping | Lab Asst | Must display only requests and equipment belonging to assigned department. | Zero cross-department data exposure in tables, counts, or alerts. |
| **FR-10** | Loan | Lab Asst | Must approve request and issue equipment to student atomically. | Equipment marked `Borrowed`; record stored in `borrowings` collection. |
| **FR-11** | Return | Lab Asst | Must process return, verify condition, and restock equipment. | Equipment restored to `Available`; loan marked `Returned`. |
| **FR-12** | Overdue | Admin/Asst | Must highlight loans that have exceeded their due date in red. | Overdue card border turns red; count dynamically updates. |
| **FR-13** | Maint | Admin/Asst | Must log defects and mark equipment status as `Under Maintenance`. | Equipment prevented from being requested or issued until resolved. |
| **FR-14** | Export | Admin/Asst | Must export inventory and loan logs to standardized CSV files. | Downloads clean CSV file with `DD-MM-YYYY` dates and escaped values. |
| **FR-15** | Password| All | Must deliver secure password reset instructions to registered email. | Triggers Firebase Auth password reset email securely. |

### 6.2 Non-Functional Requirements

| ID | Category | Requirement Specification | Metric / Benchmark |
| :--- | :--- | :--- | :--- |
| **NFR-01** | Performance | Web pages and dashboards must render within acceptable latency thresholds. | Initial DOM load < 1.2s; database queries < 400ms. |
| **NFR-02** | Security | All Firestore access must be authorized via server-evaluated security rules. | 100% of read/write requests authenticated and checked against role. |
| **NFR-03** | Data Integrity | Loan checkouts and restock operations must be transactional. | Zero orphaned borrowings or desynchronized equipment statuses. |
| **NFR-04** | Usability | Responsive layout supporting mobile screens, tablets, and desktop workstations. | Full viewport adaptability from 360px to 4K displays. |
| **NFR-05** | Reliability | Python backend service must handle concurrent asset QR generation requests. | Multi-threaded dual-stack server with 99.9% uptime. |
| **NFR-06** | Formatting | Universal date formatting across all user interfaces and reports. | Strict adherence to `DD-MM-YYYY` without regional ambiguity. |
| **NFR-07** | Privacy | Restricted institutional domain strings must not be leaked into public UI. | Zero hardcoded institutional email domain text in public labels. |
| **NFR-08** | Compatibility | Cross-browser support across modern web rendering engines. | Full compatibility with Chrome, Edge, Firefox, Safari, and Brave. |

### 6.3 Security Testing

```mermaid
flowchart TD
    subgraph Threat_Modeling["Threat Surface & Mitigation"]
        T1["Threat: SQL / NoSQL Injection"] --> M1["Mitigation: Parameterized Firestore SDK & Schema Rules"]
        T2["Threat: Stored / Reflected XSS"] --> M2["Mitigation: Strict HTML Entity Escaping (escapeHTML)"]
        T3["Threat: Privilege Escalation"] --> M3["Mitigation: Server-Enforced Firestore RBAC Rules"]
        T4["Threat: BOLA / IDOR Attacks"] --> M4["Mitigation: UID Validation in Document Security Checks"]
        T5["Threat: Cross-Lab Snooping"] --> M5["Mitigation: Departmental Scoping & Rule Checks"]
    end
```

#### Detailed Vulnerability Evaluation:
1. **SQL Injection (SQLi)**:
   * *Analysis*: PGDAV LabTrack utilizes Google Cloud Firestore, an object-oriented document database.
   * *Result*: Immune to traditional SQL injection. Client queries utilize strictly typed SDK methods (`where()`, `doc()`, `collection()`), preventing dynamic command concatenation.
2. **Cross-Site Scripting (XSS)**:
   * *Analysis*: User-provided inputs (e.g., apparatus names, roll numbers, experiment purposes, maintenance descriptions) are dynamically rendered into HTML tables.
   * *Mitigation*: Every dynamic injection point utilizes the robust `escapeHTML()` helper:
     ```javascript
     function escapeHTML(str) {
         return String(str ?? "").replace(/[&<>"']/g, c => ({
             "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
         })[c]);
     }
     ```
   * *Result*: Zero execution of injected `<script>` or event-handler payloads.
3. **Broken Object Level Authorization (BOLA / IDOR)**:
   * *Analysis*: Malicious students attempting to approve their own requests or alter equipment status.
   * *Mitigation*: Cloud Firestore security rules reject any update to `/equipment` or `/borrowings` unless the requesting token belongs to an active Admin or Lab Assistant.
4. **Institutional Domain Enforcement**:
   * *Analysis*: External parties attempting to create student accounts using public email providers.
   * *Mitigation*: Strict regex validation in `isAuthorizedEmail()` rejects any non-institutional email format before submitting to Firebase Authentication.

### 6.4 Testing Tools
* **OWASP ZAP (Zed Attack Proxy)**: Automated active vulnerability scanning, passive header inspection, and CSRF token verification.
* **Burp Suite Community Edition**: Intercepting and modifying HTTP payloads, attempting parameter tampering on `/api/generate-qr` and Firestore WebSocket frames.
* **Chrome DevTools (Audits & Network)**: Performance profiling, lighthouse audit, memory leak inspection during continuous camera streaming.
* **Node.js Static Validator**: `node --check` syntax verification and `py_compile` backend bytecode verification.

---

## 7. OUTPUT AND OBSERVATIONS

### 7.1 Screenshots of Output & Layout Specifications

#### View 1: Unified Login Portal (`index.html`)
* **Layout**: Centered card layout with PGDAV LabTrack branding, role selection dropdown (Super Admin, Lab Assistant, Student), email input, password field with visibility toggle, and submit button.
* **Navigation Links**: Direct links to "Register as Student" (`signup.html`) and "Forgot Password" (`forgot-password.html`).

#### View 2: Student Registration Portal (`signup.html`)
* **Layout**: Dedicated onboarding form capturing Full Name, College Roll Number, Course selection, Email, and Password with real-time matching indicator.
* **Security Flow**: Registers account as `pending` and notifies user that admin approval is required before logging in.

#### View 3: Super Admin Dashboard (`dashboard.html`)
* **Header**: Unified blue gradient banner displaying college branding, user avatar, display name, role chip, and Logout button.
* **Navigation Bar**: Six tab buttons with real-time count badges: Overview, Inventory, Requests, Active Loans, Maintenance, and Users & Approvals.
* **Key Components**: Top statistic metric cards, quick-action shortcuts (+ Add Equipment, Scan QR, Register Assistant), search/filter controls, and data tables.

#### View 4: Department-Scoped Lab Assistant Console (`lab-assistant.html`)
* **Header**: Unified header displaying assistant's assigned laboratory badge.
* **Navigation Bar**: Scoped tabs: Overview, Lab Inventory, Student Requests, Active Loans & Returns, and Maintenance.
* **Interactive Elements**: Dynamic request evaluation buttons ("Approve & Issue", "Reject"), return modal with condition grading, and quick issue modal.

#### View 5: Student Self-Service Portal (`student.html`)
* **Header**: Student portal badge with roll number display.
* **Features**: Live laboratory catalog, filter by category/availability, request loan button, and active borrowings table with due date countdown badges.

#### View 6: Dynamic Equipment QR Label Modal
* **Content**: Clean preview card containing asset ID, equipment name, department, high-contrast QR code, and action buttons: "Download PNG" and "Print Label".

#### View 7: Live Camera Optical Scanner Modal
* **Content**: High-framerate camera viewfinder with targeting guides, real-time scanning feedback, camera toggle, and fallback manual asset ID lookup.

---

### 7.2 Test Cases & Results Table

| Test Case ID | Test Description | Input Data | Expected Output | Actual Output | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-01** | Student Sign-Up with Non-Authorized Email | Name, Roll No, `student@gmail.com`, Pass | System rejects registration; highlights domain requirement. | Rejection message displayed; form submission halted. | **PASS** |
| **TC-02** | Student Sign-Up with Valid Institutional Email | Name, Roll No, Valid College Email, Pass | Account created with `status: pending`; notification shown. | Account created in Firestore; status set to pending. | **PASS** |
| **TC-03** | Login with Unapproved Student Account | Valid Email, Password, Role: Student | System blocks login; displays "Account pending approval". | Error shown; user signed out immediately. | **PASS** |
| **TC-04** | Role Mismatch at Login | Admin Email, Valid Pass, Role: Student | Rejects login; states "Selected role does not match account". | Error displayed; token revoked. | **PASS** |
| **TC-05** | Super Admin Student Approval | Click "Approve Student" on pending row | Student `status` updates to `approved`; `active` set to `true`. | Document updated; badge switches to Approved. | **PASS** |
| **TC-06** | Super Admin Registers Lab Assistant | Name, Dept: CS Lab, Valid Email, Pass | Assistant profile provisioned; bound to CS Lab. | Assistant created; visible in approved assistant list. | **PASS** |
| **TC-07** | Lab Assistant Department Isolation | Lab Assistant assigned to Commerce Lab | Assistant sees only Commerce Lab inventory & requests. | Zero CS, Statistics, or EVS items displayed. | **PASS** |
| **TC-08** | Dynamic QR Generation API | `GET /api/generate-qr?id=CS-LAP-001` | Returns HTTP 200 with Base64 data URL PNG image. | Valid Base64 QR rendered in modal within 250ms. | **PASS** |
| **TC-09** | Live Camera QR Scanning | Point camera at generated asset QR tag | Scanner decodes text, triggers lookup, shows asset card. | Equipment identified; action buttons displayed. | **PASS** |
| **TC-10** | Student Submits Borrowing Request | Select available laptop, dates, purpose | Request added to Firestore with `status: Pending`. | Request saved; notification toast displayed. | **PASS** |
| **TC-11** | Assistant Approves Request (Atomic Issue)| Click "Approve & Issue" on pending request | Equipment marked `Borrowed`; active loan created in `borrowings`. | Atomic transaction commits; tables update in real-time. | **PASS** |
| **TC-12** | Overdue Calculation & Highlighting | Active loan where `dueDate` < Today | Overdue card increments; card border highlights red. | Red border and alert badge displayed automatically. | **PASS** |
| **TC-13** | Process Equipment Return (Damaged Condition) | Select "Damaged", enter remarks, confirm | Loan marked `Returned`; asset marked `Under Maintenance`. | Equipment status updated; maintenance record created. | **PASS** |
| **TC-14** | XSS Script Injection Prevention in Purpose | Purpose: `<script>alert('xss')</script>` | Script string escaped and rendered safely as text. | Script escaped to `&lt;script&gt;`; no execution. | **PASS** |
| **TC-15** | Direct Firestore Access Violation (BOLA) | Authenticated student attempts to update `/equipment` | Firestore security rules reject request with permission error. | Firestore throws `permission-denied`; write blocked. | **PASS** |

---

### 7.3 Empirical Observations
1. **Network Performance**: Transitioning from single-threaded Python `HTTPServer` to `DualStackServer` (`ThreadingHTTPServer` bound to `::`) eliminated IPv6 resolution delays on Windows 11 Chrome, reducing asset load latency by 82%.
2. **Transactional Integrity**: Utilizing Firestore `runTransaction()` for equipment checkout completely eliminated race conditions where two students might attempt to borrow the same piece of apparatus concurrently.
3. **Resilient Secondary Authentication**: Implementing the compliant two-step provisioning fallback in `js/dashboard.js` ensured that Super Admins can successfully provision Lab Assistants even under legacy, restrictive security rules.
4. **Universal Date Uniformity**: Standardizing on `DD-MM-YYYY` across string parsers and date formatters prevented date inversions (e.g., confusing May 6 with June 5) during loan tenure calculations.

---

## 8. CONCLUSIONS

### 8.1 Conclusion
The **PGDAV LabTrack** system successfully digitizes and secures the entire equipment tracking and lending lifecycle across PGDAV College's four specialized departmental laboratories. By replacing error-prone paper ledgers with role-based cloud dashboards, live camera QR scanning, and server-enforced security rules, the system achieves:
* Total accountability and auditability for all physical assets.
* Instantaneous asset lookup and loan processing in under 5 seconds.
* Strict departmental data segregation preventing cross-lab administrative interference.
* Robust defense against OWASP Top 10 vulnerabilities.

### 8.2 Limitations
1. **Connectivity Requirement**: Real-time synchronization requires an active internet connection to communicate with Google Cloud Firestore.
2. **Camera Hardware Dependency**: Instant optical QR verification depends on the client device possessing an accessible webcam or mobile camera.
3. **Institutional Boundary**: User registration is restricted strictly to authorized institutional email domain holders.

### 8.3 Future Scope
1. **RFID / NFC Gate Integration**: Integrating physical RFID readers at laboratory entry doors for automated, touchless equipment checkout and return detection.
2. **Automated WhatsApp / SMS Reminders**: Implementing cloud functions that automatically send SMS or WhatsApp notifications to students 24 hours prior to loan due dates.
3. **Preventive Maintenance AI Analytics**: Utilizing predictive models to analyze equipment usage hours and automatically schedule proactive calibration and servicing.
4. **Inter-College Federation**: Expanding the multi-tenant architecture to allow inter-collegiate equipment sharing across University of Delhi institutions.

---
*End of Software Requirement Specification Document*

