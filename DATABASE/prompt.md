# Database Synchronization & Team Setup Guide
**Target Database:** `grc_enrollment` (MariaDB / MySQL 10.4+)  
**SQL Dump File:** `DATABASE/grc_enrollment.sql`  
**Current Active Term:** Academic Term ID `6` (`2025-2026 · 2nd Semester`, `status = semester_ongoing`)  
**All Seeded User Passwords:** `password`

---

## 1. AI Agent Prompt (Copy & Paste for Antigravity / Cursor / Claude)

Kapag mag-uupdate ang iyong ka-team gamit ang AI coding assistant, kopyahin lamang ang prompt sa ibaba at i-paste sa chat window ng agent:

```markdown
Pakisuyo i-update at i-synchronize ang aking local MariaDB/MySQL database gamit ang updated SQL dump file na nasa `DATABASE/grc_enrollment.sql`.

Mga hakbang na dapat mong gawin:
1. Siguraduhin na tumatakbo ang MySQL/MariaDB server sa aking makina (default port 3306).
2. I-import ang `DATABASE/grc_enrollment.sql` sa database na `grc_enrollment`. Kung hindi pa nage-exist ang database, gumawa ng bago (`CREATE DATABASE IF NOT EXISTS grc_enrollment;`).
3. Kung gumagamit ng XAMPP default root user:
   `mysql -h 127.0.0.1 -P 3306 -u root grc_enrollment < DATABASE/grc_enrollment.sql`
   (O gamitin ang DB credentials na naka-configure sa aking `backend/.env`).
4. Sa loob ng `backend/`, patakbuhin ang cache clear:
   `php artisan config:clear`
   `php artisan cache:clear`
5. I-verify ang database status sa pamamagitan ng tinker:
   - Siguraduhin na si Academic Term ID 6 (`2025-2026 · 2nd`) ay naka-set sa `semester_ongoing`.
   - Siguraduhin na ang format ng mga student emails ay `Firstname.lastname@grc.com` (halimbawa: `ramon.castillo@grc.com`, `carlos.santos@grc.com`).
   - Siguraduhin na ang format ng mga professor emails ay `firstname.lastname.department@grc.com` (halimbawa: `henry.corales.coe@grc.com`, `maria.delossantos.ccs@grc.com`, `teodoro.canay.cbae@grc.com`, `roderick.ronidel.coa@grc.com`).
   - Siguraduhin na mayroong 2,300+ active enrollments at 27,000+ locked academic grades.
6. I-confirm na ang password para sa lahat ng users (Students, Professors, Program Chairs, Cashier, Registrar) ay: `password`.
```

---

## 2. Manual PowerShell / Command Prompt Import Instructions

Kung nais i-import nang direkta sa terminal (nang walang AI agent):

### Step 1: Buksan ang Terminal (PowerShell) sa project root (`GRC-ENROLLMENT`)
```powershell
# Siguraduhing tumatakbo ang Apache at MySQL sa XAMPP Control Panel.
```

### Step 2: Gumawa ng Database (kung bago o i-overwrite ang luma)
```powershell
# Gamit ang XAMPP default MySQL executable:
c:\xampp\mysql\bin\mysql.exe -u root -e "CREATE DATABASE IF NOT EXISTS grc_enrollment CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### Step 3: I-import ang Updated SQL Dump
```powershell
# Patakbuhin ang import command:
c:\xampp\mysql\bin\mysql.exe -u root grc_enrollment < DATABASE\grc_enrollment.sql
```
*(Tumatagal lamang ito ng humigit-kumulang 15 hanggang 30 segundo).*

### Step 4: I-clear ang Backend Cache
```powershell
cd backend
php artisan config:clear
php artisan cache:clear
php artisan route:clear
```

### Step 5: I-verify ang Import
```powershell
php artisan tinker --execute="
\$term = \App\Models\AcademicTerm::find(6);
echo 'Active Term: ' . (\$term ? \$term->name . ' (' . \$term->status->value . ')' : 'Not Found') . PHP_EOL;
echo 'Total Enrollments: ' . \App\Models\Enrollment::where('academic_term_id', 6)->count() . PHP_EOL;
echo 'Total Locked Grades: ' . \App\Models\AcademicGrade::where('academic_term_id', 6)->count() . PHP_EOL;
\$s = \App\Models\User::where('email', 'ramon.castillo@grc.com')->first();
echo 'Sample Student: ' . (\$s ? \$s->name . ' (' . \$s->email . ')' : 'Not Found') . PHP_EOL;
"
```

---

## 3. Reference Test Accounts & Login Directory

Lahat ng accounts ay may unified development password:
> **Password:** `password`  
> **Portal URL:** `http://localhost:3000/login`

### Administrative & Faculty Accounts
| Department / Role | Pangalan | Email Address | Password |
| :--- | :--- | :--- | :---: |
| **Program Chair (CCS)** | Mary Joy Dy | `chair.ccs@grc.test` | `password` |
| **Program Chair (COA)** | Seed Program Chair COA | `chair.coa@grc.test` | `password` |
| **Program Chair (CBAE)** | Seed Program Chair CBAE | `chair.cbae@grc.test` | `password` |
| **Program Chair (COE)** | Seed Program Chair COE | `chair.coe@grc.test` | `password` |
| **Faculty (COE)** | Henry Nieva Corrales | `henry.corales.coe@grc.com` | `password` |
| **Faculty (CCS)** | Maria Delos Santos | `maria.delossantos.ccs@grc.com` | `password` |
| **Faculty (CBAE)** | Teodoro Canay | `teodoro.canay.cbae@grc.com` | `password` |
| **Faculty (COA)** | Roderick R. Ronidel | `roderick.ronidel.coa@grc.com` | `password` |
| **Cashier / Accounting** | Seed Accounting Staff | `accounting.seed@grc.test` | `password` |
| **Registrar Head** | Seed Registrar Head | `registrar-head.seed@grc.test` | `password` |

*(Para sa kumpletong listahan ng 145 mga propesor sa bawat kolehiyo, sumangguni sa `Subject And Prerequisuite/Professor_Department_List.md`). Lahat ay gumagamit ng format na `firstname.lastname.department@grc.com` at password na `password`.*

### Sample Student Accounts (Format: `firstname.lastname@grc.com`)
| College | Year Level | Category | Pangalan | Email Address | Password |
| :--- | :---: | :--- | :--- | :--- | :---: |
| **CCS** | Year 1 | Regular | Juan Carlos M. Santos | `carlos.santos@grc.com` | `password` |
| **CCS** | Year 1 | Irregular | Mark Anthony L. Ramos | `anthony.ramos@grc.com` | `password` |
| **COA** | Year 1 | Regular | Eduardo R. Santos | `eduardo.santos@grc.com` | `password` |
| **COA** | Year 1 | Irregular | Glenn M. Fernandez | `glenn.fernandez@grc.com` | `password` |
| **CBAE** | Year 1 | Regular | Lito M. Castro | `lito.castro@grc.com` | `password` |
| **CBAE** | Year 4 | Regular | Ramon B. Castillo | `ramon.castillo@grc.com` | `password` |
| **COE** | Year 1 | Regular | Remedios C. Reyes | `remedios.reyes@grc.com` | `password` |
| **COE** | Year 1 | Irregular | Rolando S. Mendoza | `rolando.mendoza@grc.com` | `password` |

*(Para sa kumpletong listahan ng lahat ng 160 estudyante sa 4 na kolehiyo, sumangguni sa `TESTING_AUDIT_REPORT_2025_2026_2ND.md`).*

