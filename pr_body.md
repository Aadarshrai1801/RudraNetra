## Summary of Changes

### 1. Single Unified Authentication & Seamless Routing
- **Unified Login Entrypoint (`http://localhost:3000/login`)**:
  - Replaced duplicate/competing login pages with a single enterprise entrypoint.
  - Eliminated manual organization switching dropdowns on the login screen; tenant identity is automatically resolved from authenticated user credentials.
  - **Allied Transport Login (`admin` / `password`)**:
    - Resolves `role: "admin"`, `company_id: 1` (`Allied Transport`).
    - Directs immediately to Allied Transport's fleet console at `http://localhost:3000/live` with all 312 fleet vehicles loaded.
  - **EKSC Logistics Dubai Login (`eksc_admin` / `password`)**:
    - Resolves `role: "admin"`, `company_id: 2` (`EKSC Logistics Dubai`).
    - Directs immediately to EKSC Dubai's fleet console at `http://localhost:3000/live` with its fleet vehicles loaded.
  - **SuperAdmin Login (`superadmin` / `password`)**:
    - Resolves `role: "superadmin"`, `company_name: "RudraNetra Global"`.
    - Seamlessly opens the SuperAdmin Console at `http://localhost:3001` passing SSO authentication parameters, automatically persisting superadmin credentials and cleaning URL parameters without requiring a secondary login.

### 2. Tenant Isolation & SuperAdmin Console Protection
- **No Console Switching for Organizational Accounts**:
  - Removed all SuperAdmin console links and buttons from the client portal header.
  - Organizational admins cannot navigate or switch into the SuperAdmin Console.
- **Strict Role-Based Access Control (403 Forbidden)**:
  - All `/api/v1/admin/*` endpoints strictly require `role == "superadmin"`. Any attempt by an organizational admin (`role: "admin"`) to query admin endpoints receives a strict `403 Forbidden`.
  - Visiting `http://localhost:3001` directly without an active superadmin session immediately redirects to `http://localhost:3000/login`.

### 3. Device & SIM Master Registry
- Connected `adminListDevicesHandler` directly to PostgreSQL `deps.Pool` to return all **330 telematics devices** with hardware models, telecommunications operators, serial numbers, and validity periods.
- Added client-side responsive pagination (25, 50, 100, All) in `DeviceMasterPage.tsx`.

### 4. Verification & Testing
- Executed comprehensive 54-case test suite (`tests/run_all_test_cases.mjs`) with **100% pass rate (54/54)** covering:
  - Auth, tenant isolation, and strict 403 Forbidden verification for organizational admins.
  - Telemetry, geofencing, trips, reports, devices, and admin suites.
- Verified TypeScript compilation and production builds across `@rudra-netra/client` and `@rudra-netra/admin` with zero errors.

---
**Branch:** `feature/superadmin-access-and-device-registry`  
**PR Creation Link:** [Open Pull Request on GitHub](https://github.com/Aadarshrai1801/RudraNetra/pull/new/feature/superadmin-access-and-device-registry)
