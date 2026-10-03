# Database Synchronization & Team Setup Guide
**Target Database:** `grc_enrollment` (MariaDB / MySQL 10.4+)  
**SQL Dump File:** `DATABASE/grc_enrollment.sql.gz` (ito ang naka-commit sa git; i-extract muna sa `DATABASE/grc_enrollment.sql` bago i-import, tingnan ang Step 3)  
**Current Active Term:** Academic Term ID `6` (`2025-2026 · 2nd Semester`, `status = semester_ongoing`)  
**Presentation state (huling na-export 2026-10-03):** 2025-2026 · 2nd ang kasalukuyan; CCS, COE, COA at CBAE ay published; sarado na ang enrollment (May/June); **lahat ng 26,023 na grades ng term 6 ay naka-lock**; 2,089 naka-enroll at 67 withdrawn; wala pang term, section o account na lampas sa 2025-2026 · 2nd; walang laman ang `personal_access_tokens` (kailangang mag-sign in ulit ang lahat).  
**All Seeded User Passwords:** `password`

---

## 1. AI Agent Prompt (Copy & Paste for Antigravity / Cursor / Claude)

Kapag mag-uupdate ang iyong ka-team gamit ang AI coding assistant, kopyahin lamang ang prompt sa ibaba at i-paste sa chat window ng agent:

```markdown
Pakisuyo i-update at i-synchronize ang aking local MariaDB/MySQL database gamit ang updated SQL dump na nasa `DATABASE/grc_enrollment.sql.gz`.

Mga hakbang na dapat mong gawin:
0. Sa project root, `git pull origin main` para ang code at ang dump ay parehong pinakabago.
1. Siguraduhin na tumatakbo ang MySQL/MariaDB server sa aking makina (default port 3306).
2. I-extract ang `DATABASE/grc_enrollment.sql.gz` papunta sa `DATABASE/grc_enrollment.sql` (halimbawa: `python -c "import gzip,shutil;shutil.copyfileobj(gzip.open('DATABASE/grc_enrollment.sql.gz'),open('DATABASE/grc_enrollment.sql','wb'))"`). Pagkatapos, i-import ito sa database na `grc_enrollment`. Kung hindi pa nage-exist ang database, gumawa ng bago (`CREATE DATABASE IF NOT EXISTS grc_enrollment;`).
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
   - Siguraduhin na ang term 6 ay may 2,089 na `enrolled` na enrollments (at 67 `withdrawn`) at 26,023 na `locked` na academic grades, at na walang academic term na lampas sa 2025-2026 · 2nd.
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

### Step 3: I-extract at i-import ang Updated SQL Dump
```powershell
# Ang naka-commit sa git ay ang .gz. Mag-git pull muna para pinakabago, tapos i-extract:
git pull origin main
python -c "import gzip,shutil;shutil.copyfileobj(gzip.open('DATABASE/grc_enrollment.sql.gz'),open('DATABASE/grc_enrollment.sql','wb'))"

# Pagkatapos, patakbuhin ang import command:
c:\xampp\mysql\bin\mysql.exe -u root grc_enrollment < DATABASE\grc_enrollment.sql
```
*(Tumatagal ito ng 1 hanggang 2 minuto. Nasubukan ang import na ito sa MariaDB ng XAMPP noong 2026-10-03: walang error at pareho ang bilang ng laman ng lahat ng talahanayan. Ang `personal_access_tokens` ay walang laman sa dump, kaya kailangang mag-sign in ulit ang lahat.)*

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
echo 'Active Term: ' . (\$term ? \$term->school_year . ' ' . \$term->semester . ' (' . \$term->status->value . ')' : 'Not Found') . PHP_EOL;
echo 'Enrolled (term 6): ' . \App\Models\Enrollment::where('academic_term_id', 6)->where('status', 'enrolled')->count() . ' (dapat 2089)' . PHP_EOL;
echo 'Locked Grades (term 6): ' . \App\Models\AcademicGrade::where('academic_term_id', 6)->where('status', 'locked')->count() . ' (dapat 26023)' . PHP_EOL;
echo 'Terms after 2025-2026: ' . \App\Models\AcademicTerm::where('school_year', '>', '2025-2026')->count() . ' (dapat 0)' . PHP_EOL;
\$s = \App\Models\User::where('email', 'ramon.castillo@grc.com')->first();
echo 'Sample Student: ' . (\$s ? \$s->name . ' (' . \$s->email . ')' : 'Not Found') . PHP_EOL;
"
```

---

## 2.5 Kapag Walang Internet (Local / Offline na Paggamit)

Para makapag-presentation kahit walang internet, patakbuhin ang lahat sa laptop: i-import ang database (Step 3), tapos sa `backend/` `php artisan serve`, at sa `frontend/` `npm run dev`, at buksan ang `http://localhost:3000/login`. Ang `backend/.env` ay dapat nakaturo sa lokal na database (`DB_HOST=127.0.0.1`) at ang `frontend` ay sa `http://127.0.0.1:8000`.

**Gumagana offline:** pag-login ng mga seed account sa ibaba (Registrar Head, Cashier, Program Chairs, Faculty, Students, Queue Kiosk) gamit ang `password`, ang buong flow ng enrollment, Registrar approval, Cashier at queue, grades, COR/prospectus at ang printing.

**Hindi gagana offline** (kailangan ng internet o ng email):
- **Super Admin** (`westliecasuncad06@gmail.com`) at anumang account na ginawa pagkatapos ng 2026-09-29: kailangan ng OTP na ipinapadala sa email.
- **Google Sign-In**, **Forgot Password**, at ang **account setup / invitation emails**. Sa lokal na `backend/.env`, ilagay ang `MAIL_MAILER=log` para hindi mag-error ang pagpapadala; makikita ang laman ng email (kasama ang OTP code) sa `backend/storage/logs/laravel.log`.

---

## 3. Reference Test Accounts & Login Directory

Lahat ng accounts ay may unified development password:
> **Password:** `password`  
> **Portal URL:** `http://localhost:3000/login`

### Administrative & Faculty Accounts
| Department / Role | Pangalan | Email Address | Password |
| :--- | :--- | :--- | :---: |
| **Super Admin** | Westlie Casuncad | `westliecasuncad06@gmail.com` | *(Setup via Forgot Password / OTP)* |
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

