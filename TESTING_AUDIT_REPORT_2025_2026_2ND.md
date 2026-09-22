# End-to-End System Testing & Institutional Audit Report
**Academic Term:** 2025-2026 · 2nd Semester (Current Active Term)  
**Target Scope:** All 4 College Departments (CCS, COA, CBAE, COE)  
**Test Date:** September 16, 2026  
**Automation Engine:** Playwright Browser Automation (`http://localhost:3000`) & Laravel REST API (`http://127.0.0.1:8000/api/v1`)  
**Unified Test Account Password:** `password`

---

## 1. Executive Summary

In accordance with institutional requirements, the enrollment system data has been configured and validated for **Academic Term 2025-2026 · 2nd Semester** (`semester_ongoing`, Term ID `6`). The term is fully populated with active enrollments and **100% complete, locked final grades** across all four (4) college departments in the institution:

1. **College of Computer Studies (CCS)** — Bachelor of Science in Information Technology (`BSIT`, Curriculum ID 13)
2. **College of Accountancy (COA)** — Bachelor of Science in Accountancy (`BSA`, Curriculum ID 16)
3. **College of Business Administration and Entrepreneurship (CBAE)** — BSBA Human Resource Management (`BSBA-HRM`, Curriculum ID 4)
4. **College of Education (COE)** — Bachelor of Elementary Education (`BEED`, Curriculum ID 19)

### Key Metrics
- **Total Provisioned Test Students:** **160 students** (40 per college: 5 regular + 5 irregular across 1st, 2nd, 3rd, and 4th Year).
- **Identities & Authenticity:** 100% realistic Filipino names, clean institutional `@grc.com` emails for students, and unified password (`password`).
- **Enrollment & Assessment Status:** 100% enrolled in Term 6 with verified tuition and miscellaneous fee assessments.
- **Official Documentation:** 100% generated official Certificate of Registration (`cor`) document snapshots with cryptographic SHA-256 hashes.
- **Academic Grades:** 100% encoded by respective faculty, submitted, and permanently locked by the Registrar Head (`status = 'locked'`).
- **Archiving Readiness:** The database is in the exact verified state required for institutional archiving and subsequent opening of the new curriculum in **2026-2027 · 1st Semester**.
- **UI Simplification & Normalization:** Implemented progressive disclosure patterns across Cashier Workspace, Advising Review Dialog, and Curriculum Prospectus to prevent information overload.

---

## 2. Test Account Credentials & Institutional Directory

All test accounts use the unified development password:
> **Default Password:** `password`  
> **Sign-in URL:** `http://localhost:3000/login`

### 2.1 Administrative & Faculty Accounts Directory

| Role | Department / College | Name | Email Address | Password | Responsibilities |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Program Chair** | College of Computer Studies (CCS) | Mary Joy Dy | `chair.ccs@grc.test` | `password` | Irregular advising, conflict checking, overload approvals |
| **Program Chair** | College of Accountancy (COA) | Seed Program Chair COA | `chair.coa@grc.test` | `password` | Irregular advising, conflict checking, overload approvals |
| **Program Chair** | College of Business Admin (CBAE) | Seed Program Chair CBAE | `chair.cbae@grc.test` | `password` | Irregular advising, conflict checking, overload approvals |
| **Program Chair** | College of Education (COE) | Seed Program Chair COE | `chair.coe@grc.test` | `password` | Irregular advising, conflict checking, overload approvals |
| **Faculty / Professor** | College of Computer Studies (CCS) | Diana L. Santos | `faculty.seed@grc.test` / `faculty.ccs@grc.test` | `password` | Grade encoding, draft saving, final grade submission |
| **Faculty / Professor** | College of Accountancy (COA) | Vivian C. Acosta | `faculty.coa@grc.test` | `password` | Grade encoding, draft saving, final grade submission |
| **Faculty / Professor** | College of Business Admin (CBAE) | Wendy Layos | `faculty.cbae@grc.test` | `password` | Grade encoding, draft saving, final grade submission |
| **Faculty / Professor** | College of Education (COE) | Ricky R. Amparado | `faculty.coe@grc.test` | `password` | Grade encoding, draft saving, final grade submission |
| **Cashier / Accounting** | Institutional Finance | Seed Accounting Staff | `accounting.seed@grc.test` | `password` | Live queue management, fee payment confirmation, COR issuing |
| **Registrar Head** | Institutional Records | Seed Registrar Head | `registrar-head.seed@grc.com` | `password` | Final grade locking, section review, academic overrides |
| **Registrar Staff** | Institutional Records | Seed Registrar Staff | `registrar-staff.seed@grc.com` | `password` | Document issuance, enrollment status validation |

---

### 2.2 Student Rosters by College Department (160 Total Students)

#### A. College of Computer Studies (CCS — BSIT, 40 Students)

##### Year 1 (10 Students)
| Category | Student Number | Full Name | Email Address | Password | Units Enrolled | Term 6 Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| Regular | `TEST-REG-Y1-01` | Juan Carlos M. Santos | `carlos.santos@grc.com` | `password` | 30.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-REG-Y1-02` | Maria Angelica R. Reyes | `angelica.reyes@grc.com` | `password` | 30.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-REG-Y1-03` | Christian Dave B. Bautista | `christian.bautista@grc.com` | `password` | 30.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-REG-Y1-04` | Althea Mae D. Mendoza | `althea.mendoza@grc.com` | `password` | 30.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-REG-Y1-05` | Joshua Miguel S. Cruz | `joshua.cruz@grc.com` | `password` | 30.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-IRREG-Y1-01` | Mark Anthony L. Ramos | `anthony.ramos@grc.com` | `password` | 29.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-IRREG-Y1-02` | Patricia Nicole G. Garcia | `patricia.garcia@grc.com` | `password` | 21.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-IRREG-Y1-03` | John Paul T. Fernandez | `johnpaul.fernandez@grc.com` | `password` | 21.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-IRREG-Y1-04` | Bea Louise E. Aquino | `bea.aquino@grc.com` | `password` | 21.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-IRREG-Y1-05` | Gabriel Vince C. Castro | `gabriel.castro@grc.com` | `password` | 21.0 | **Enrolled (Grades Locked)** |

##### Year 2 (10 Students)
| Category | Student Number | Full Name | Email Address | Password | Units Enrolled | Term 6 Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| Regular | `TEST-REG-Y2-01` | Rafael Luis A. Gonzales | `rafael.gonzales@grc.com` | `password` | 33.0 | **Enrolled (Grades Locked)** |
| Regular | `TEST-REG-Y2-02` | Camille Joy P. Pascual | `camille.pascual@grc.com` | `password` | 33.0 | **Enrolled (Grades Locked)** |
| Regular | `TEST-REG-Y2-03` | Angelo Miguel H. Villanueva | `angelo.villanueva@grc.com` | `password` | 33.0 | **Enrolled (Grades Locked)** |
| Regular | `TEST-REG-Y2-04` | Sophia Marie T. Tolentino | `sophia.tolentino@grc.com` | `password` | 33.0 | **Enrolled (Grades Locked)** |
| Regular | `TEST-REG-Y2-05` | Daniel Kevin F. Flores | `daniel.flores@grc.com` | `password` | 33.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-IRREG-Y2-01` | Justine Kyle B. Morales | `justine.morales@grc.com` | `password` | 21.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-IRREG-Y2-02` | Hannah Mae S. Salazar | `hannah.salazar@grc.com` | `password` | 21.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-IRREG-Y2-03` | Dominic Sean V. Navarro | `dominic.navarro@grc.com` | `password` | 21.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-IRREG-Y2-04` | Alyssa Denise M. Mercado | `alyssa.mercado@grc.com` | `password` | 21.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-IRREG-Y2-05` | Adrian Kenneth D. Ocampo | `adrian.ocampo@grc.com` | `password` | 21.0 | **Enrolled (Grades Locked)** |

##### Year 3 (10 Students)
| Category | Student Number | Full Name | Email Address | Password | Units Enrolled | Term 6 Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| Regular | `TEST-REG-Y3-01` | Kenneth Dale R. Dela Cruz | `kenneth.delacruz@grc.com` | `password` | 29.0 | **Enrolled (Grades Locked)** |
| Regular | `TEST-REG-Y3-02` | Princess Kimberly C. Soriano | `princess.soriano@grc.com` | `password` | 29.0 | **Enrolled (Grades Locked)** |
| Regular | `TEST-REG-Y3-03` | Nathaniel James E. Espiritu | `nathaniel.espiritu@grc.com` | `password` | 29.0 | **Enrolled (Grades Locked)** |
| Regular | `TEST-REG-Y3-04` | Celine Joyce B. Corpuz | `celine.corpuz@grc.com` | `password` | 29.0 | **Enrolled (Grades Locked)** |
| Regular | `TEST-REG-Y3-05` | Vince Ryan M. Manalo | `vince.manalo@grc.com` | `password` | 29.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-IRREG-Y3-01` | Jeric Matthew L. Domingo | `jeric.domingo@grc.com` | `password` | 21.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-IRREG-Y3-02` | Erika Jane G. Valenzuela | `erika.valenzuela@grc.com` | `password` | 21.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-IRREG-Y3-03` | Tristan Paul P. Salvador | `tristan.salvador@grc.com` | `password` | 21.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-IRREG-Y3-04` | Mary Grace F. De Leon | `grace.deleon@grc.com` | `password` | 21.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-IRREG-Y3-05` | Paolo Miguel S. Santiago | `paolo.santiago@grc.com` | `password` | 21.0 | **Enrolled (Grades Locked)** |

##### Year 4 (10 Students)
| Category | Student Number | Full Name | Email Address | Password | Units Enrolled | Term 6 Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| Regular | `TEST-REG-Y4-01` | Jerome Patrick A. Aguilar | `jerome.aguilar@grc.com` | `password` | 12.0 | **Enrolled (Grades Locked)** |
| Regular | `TEST-REG-Y4-02` | Rochelle Ann N. Gutierrez | `rochelle.gutierrez@grc.com` | `password` | 12.0 | **Enrolled (Grades Locked)** |
| Regular | `TEST-REG-Y4-03` | Aldrin Jay T. David | `aldrin.david@grc.com` | `password` | 12.0 | **Enrolled (Grades Locked)** |
| Regular | `TEST-REG-Y4-04` | Kristine Joy V. Miranda | `kristine.miranda@grc.com` | `password` | 12.0 | **Enrolled (Grades Locked)** |
| Regular | `TEST-REG-Y4-05` | Francis Edward C. Cortez | `francis.cortez@grc.com` | `password` | 12.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-IRREG-Y4-01` | Dexter Allen M. Pineda | `dexter.pineda@grc.com` | `password` | 12.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-IRREG-Y4-02` | Clarisse Anne R. Castillo | `clarisse.castillo@grc.com` | `password` | 12.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-IRREG-Y4-03` | Louie Anton B. Rivera | `louie.rivera@grc.com` | `password` | 12.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-IRREG-Y4-04` | Kimberly Rose S. Ignacio | `kimberly.ignacio@grc.com` | `password` | 12.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-IRREG-Y4-05` | Marco Antonio D. Vergara | `marco.vergara@grc.com` | `password` | 12.0 | **Enrolled (Grades Locked)** |

---

#### B. College of Accountancy (COA — BSA, 40 Students)

##### Year 1 (10 Students)
| Category | Student Number | Full Name | Email Address | Password | Units Enrolled | Term 6 Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| Regular | `TEST-COA-REG-Y1-01` | Eduardo R. Santos | `eduardo.santos@grc.com` | `password` | 33.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COA-REG-Y1-02` | Marites B. Ramos | `marites.ramos@grc.com` | `password` | 33.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COA-REG-Y1-03` | Cristina P. Mendoza | `cristina.mendoza@grc.com` | `password` | 33.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COA-REG-Y1-04` | Roderick S. Garcia | `roderick.garcia@grc.com` | `password` | 33.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COA-REG-Y1-05` | Jocelyn T. Bautista | `jocelyn.bautista@grc.com` | `password` | 33.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COA-IRREG-Y1-01` | Glenn M. Fernandez | `glenn.fernandez@grc.com` | `password` | 19.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COA-IRREG-Y1-02` | Rowena D. Cruz | `rowena.cruz@grc.com` | `password` | 19.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COA-IRREG-Y1-03` | Arlene L. Castro | `arlene.castro@grc.com` | `password` | 19.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COA-IRREG-Y1-04` | Dennis K. Aquino | `dennis.aquino@grc.com` | `password` | 19.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COA-IRREG-Y1-05` | Sharon V. Morales | `sharon.morales@grc.com` | `password` | 19.5 | **Enrolled (Grades Locked)** |

##### Year 2 (10 Students)
| Category | Student Number | Full Name | Email Address | Password | Units Enrolled | Term 6 Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| Regular | `TEST-COA-REG-Y2-01` | Noel G. Salazar | `noel.salazar@grc.com` | `password` | 27.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COA-REG-Y2-02` | Janice H. Navarro | `janice.navarro@grc.com` | `password` | 27.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COA-REG-Y2-03` | Ronald J. Mercado | `ronald.mercado@grc.com` | `password` | 27.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COA-REG-Y2-04` | Shirley F. Ocampo | `shirley.ocampo@grc.com` | `password` | 27.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COA-REG-Y2-05` | Jonathan C. Dela Cruz | `jonathan.delacruz@grc.com` | `password` | 27.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COA-IRREG-Y2-01` | Melanie A. Soriano | `melanie.soriano@grc.com` | `password` | 18.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COA-IRREG-Y2-02` | Allan E. Espiritu | `allan.espiritu@grc.com` | `password` | 18.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COA-IRREG-Y2-03` | Gina B. Corpuz | `gina.corpuz@grc.com` | `password` | 18.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COA-IRREG-Y2-04` | Alvin M. Manalo | `alvin.manalo@grc.com` | `password` | 18.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COA-IRREG-Y2-05` | Jennifer R. Domingo | `jennifer.domingo@grc.com` | `password` | 18.0 | **Enrolled (Grades Locked)** |

##### Year 3 (10 Students)
| Category | Student Number | Full Name | Email Address | Password | Units Enrolled | Term 6 Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| Regular | `TEST-COA-REG-Y3-01` | Gilbert T. Valenzuela | `gilbert.valenzuela@grc.com` | `password` | 22.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COA-REG-Y3-02` | Maricel P. Salvador | `maricel.salvador@grc.com` | `password` | 22.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COA-REG-Y3-03` | Jeffrey S. De Leon | `jeffrey.deleon@grc.com` | `password` | 22.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COA-REG-Y3-04` | Lilibeth D. Santiago | `lilibeth.santiago@grc.com` | `password` | 22.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COA-REG-Y3-05` | Richard K. Aguilar | `richard.aguilar@grc.com` | `password` | 22.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COA-IRREG-Y3-01` | Bernadette N. Gutierrez | `bernadette.gutierrez@grc.com` | `password` | 18.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COA-IRREG-Y3-02` | Nelson C. David | `nelson.david@grc.com` | `password` | 18.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COA-IRREG-Y3-03` | Evelyn V. Miranda | `evelyn.miranda@grc.com` | `password` | 18.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COA-IRREG-Y3-04` | Joel M. Cortez | `joel.cortez@grc.com` | `password` | 18.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COA-IRREG-Y3-05` | Cherry L. Pineda | `cherry.pineda@grc.com` | `password` | 18.0 | **Enrolled (Grades Locked)** |

##### Year 4 (10 Students)
| Category | Student Number | Full Name | Email Address | Password | Units Enrolled | Term 6 Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| Regular | `TEST-COA-REG-Y4-01` | Anthony G. Castillo | `anthony.castillo@grc.com` | `password` | 19.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COA-REG-Y4-02` | Grace B. Rivera | `grace.rivera@grc.com` | `password` | 19.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COA-REG-Y4-03` | Ferdinand S. Ignacio | `ferdinand.ignacio@grc.com` | `password` | 19.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COA-REG-Y4-04` | Gemma T. Vergara | `gemma.vergara@grc.com` | `password` | 19.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COA-REG-Y4-05` | Reynaldo D. Pascual | `reynaldo.pascual@grc.com` | `password` | 19.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COA-IRREG-Y4-01` | Irene R. Villanueva | `irene.villanueva@grc.com` | `password` | 16.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COA-IRREG-Y4-02` | Benjamin H. Tolentino | `benjamin.tolentino@grc.com` | `password` | 16.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COA-IRREG-Y4-03` | Nancy F. Flores | `nancy.flores@grc.com` | `password` | 16.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COA-IRREG-Y4-04` | Wilfredo C. Morales | `wilfredo.morales@grc.com` | `password` | 16.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COA-IRREG-Y4-05` | Caridad E. Salazar | `caridad.salazar@grc.com` | `password` | 16.5 | **Enrolled (Grades Locked)** |

---

#### C. College of Business Admin & Entrepreneurship (CBAE — BSBA-HRM, 40 Students)

##### Year 1 (10 Students)
| Category | Student Number | Full Name | Email Address | Password | Units Enrolled | Term 6 Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| Regular | `TEST-CBAE-REG-Y1-01` | Lito M. Castro | `lito.castro@grc.com` | `password` | 30.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-CBAE-REG-Y1-02` | Rosario D. Garcia | `rosario.garcia@grc.com` | `password` | 30.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-CBAE-REG-Y1-03` | Fernando S. Cruz | `fernando.cruz@grc.com` | `password` | 30.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-CBAE-REG-Y1-04` | Annaliza B. Ramos | `annaliza.ramos@grc.com` | `password` | 30.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-CBAE-REG-Y1-05` | Danilo P. Santos | `danilo.santos@grc.com` | `password` | 30.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-CBAE-IRREG-Y1-01` | Remedios T. Mendoza | `remedios.mendoza@grc.com` | `password` | 18.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-CBAE-IRREG-Y1-02` | Jaime L. Bautista | `jaime.bautista@grc.com` | `password` | 18.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-CBAE-IRREG-Y1-03` | Victoria K. Fernandez | `victoria.fernandez@grc.com` | `password` | 18.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-CBAE-IRREG-Y1-04` | Rogelio V. Aquino | `rogelio.aquino@grc.com` | `password` | 18.0 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-CBAE-IRREG-Y1-05` | Teresita G. Morales | `teresita.morales@grc.com` | `password` | 18.0 | **Enrolled (Grades Locked)** |

##### Year 2 (10 Students)
| Category | Student Number | Full Name | Email Address | Password | Units Enrolled | Term 6 Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| Regular | `TEST-CBAE-REG-Y2-01` | Renato H. Salazar | `renato.salazar@grc.com` | `password` | 24.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-CBAE-REG-Y2-02` | Yolanda J. Navarro | `yolanda.navarro@grc.com` | `password` | 24.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-CBAE-REG-Y2-03` | Cesar F. Mercado | `cesar.mercado@grc.com` | `password` | 24.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-CBAE-REG-Y2-04` | Susan C. Ocampo | `susan.ocampo@grc.com` | `password` | 24.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-CBAE-REG-Y2-05` | Mario A. Dela Cruz | `mario.delacruz@grc.com` | `password` | 24.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-CBAE-IRREG-Y2-01` | Gloria E. Soriano | `gloria.soriano@grc.com` | `password` | 15.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-CBAE-IRREG-Y2-02` | Ernesto B. Espiritu | `ernesto.espiritu@grc.com` | `password` | 15.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-CBAE-IRREG-Y2-03` | Cynthia M. Corpuz | `cynthia.corpuz@grc.com` | `password` | 15.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-CBAE-IRREG-Y2-04` | Edgardo R. Manalo | `edgardo.manalo@grc.com` | `password` | 15.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-CBAE-IRREG-Y2-05` | Zenaida T. Domingo | `zenaida.domingo@grc.com` | `password` | 15.5 | **Enrolled (Grades Locked)** |

##### Year 3 (10 Students)
| Category | Student Number | Full Name | Email Address | Password | Units Enrolled | Term 6 Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| Regular | `TEST-CBAE-REG-Y3-01` | Rodolfo P. Valenzuela | `rodolfo.valenzuela@grc.com` | `password` | 16.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-CBAE-REG-Y3-02` | Aurora S. Salvador | `aurora.salvador@grc.com` | `password` | 16.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-CBAE-REG-Y3-03` | Raul D. De Leon | `raul.deleon@grc.com` | `password` | 16.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-CBAE-REG-Y3-04` | Vilma K. Santiago | `vilma.santiago@grc.com` | `password` | 16.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-CBAE-REG-Y3-05` | Alejandro N. Aguilar | `alejandro.aguilar@grc.com` | `password` | 16.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-CBAE-IRREG-Y3-01` | Mercedes C. Gutierrez | `mercedes.gutierrez@grc.com` | `password` | 16.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-CBAE-IRREG-Y3-02` | Domingo V. David | `domingo.david@grc.com` | `password` | 16.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-CBAE-IRREG-Y3-03` | Fe M. Miranda | `fe.miranda@grc.com` | `password` | 16.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-CBAE-IRREG-Y3-04` | Salvador L. Cortez | `salvador.cortez@grc.com` | `password` | 16.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-CBAE-IRREG-Y3-05` | Josefina G. Pineda | `josefina.pineda@grc.com` | `password` | 16.5 | **Enrolled (Grades Locked)** |

##### Year 4 (10 Students)
| Category | Student Number | Full Name | Email Address | Password | Units Enrolled | Term 6 Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| Regular | `TEST-CBAE-REG-Y4-01` | Ramon B. Castillo | `ramon.castillo@grc.com` | `password` | 10.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-CBAE-REG-Y4-02` | Ligaya S. Rivera | `ligaya.rivera@grc.com` | `password` | 10.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-CBAE-REG-Y4-03` | Alberto T. Ignacio | `alberto.ignacio@grc.com` | `password` | 10.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-CBAE-REG-Y4-04` | Nenita D. Vergara | `nenita.vergara@grc.com` | `password` | 10.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-CBAE-REG-Y4-05` | Felipe R. Pascual | `felipe.pascual@grc.com` | `password` | 10.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-CBAE-IRREG-Y4-01` | Corazon H. Villanueva | `corazon.villanueva@grc.com` | `password` | 10.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-CBAE-IRREG-Y4-02` | Dante F. Tolentino | `dante.tolentino@grc.com` | `password` | 10.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-CBAE-IRREG-Y4-03` | Ester C. Flores | `ester.flores@grc.com` | `password` | 10.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-CBAE-IRREG-Y4-04` | Gerardo E. Morales | `gerardo.morales@grc.com` | `password` | 10.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-CBAE-IRREG-Y4-05` | Elena B. Salazar | `elena.salazar@grc.com` | `password` | 10.5 | **Enrolled (Grades Locked)** |

---

#### D. College of Education (COE — BEED, 40 Students)

##### Year 1 (10 Students)
| Category | Student Number | Full Name | Email Address | Password | Units Enrolled | Term 6 Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| Regular | `TEST-COE-REG-Y1-01` | Remedios C. Reyes | `remedios.reyes@grc.com` | `password` | 30.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COE-REG-Y1-02` | Danilo F. Flores | `danilo.flores.coe@grc.com` | `password` | 30.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COE-REG-Y1-03` | Corazon T. Navarro | `corazon.navarro@grc.com` | `password` | 30.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COE-REG-Y1-04` | Nestor M. Santos | `nestor.santos@grc.com` | `password` | 30.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COE-REG-Y1-05` | Flordeliza D. Ramos | `flordeliza.ramos@grc.com` | `password` | 30.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COE-IRREG-Y1-01` | Rolando S. Mendoza | `rolando.mendoza@grc.com` | `password` | 16.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COE-IRREG-Y1-02` | Imelda B. Garcia | `imelda.garcia@grc.com` | `password` | 16.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COE-IRREG-Y1-03` | Alfredo P. Bautista | `alfredo.bautista@grc.com` | `password` | 16.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COE-IRREG-Y1-04` | Carmelita L. Fernandez | `carmelita.fernandez@grc.com` | `password` | 16.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COE-IRREG-Y1-05` | Oscar K. Cruz | `oscar.cruz@grc.com` | `password` | 16.5 | **Enrolled (Grades Locked)** |

##### Year 2 (10 Students)
| Category | Student Number | Full Name | Email Address | Password | Units Enrolled | Term 6 Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| Regular | `TEST-COE-REG-Y2-01` | Marilyn V. Castro | `marilyn.castro@grc.com` | `password` | 30.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COE-REG-Y2-02` | Emmanuel G. Aquino | `emmanuel.aquino@grc.com` | `password` | 30.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COE-REG-Y2-03` | Divina H. Morales | `divina.morales@grc.com` | `password` | 30.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COE-REG-Y2-04` | Romeo J. Salazar | `romeo.salazar@grc.com` | `password` | 30.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COE-REG-Y2-05` | Erlinda F. Mercado | `erlinda.mercado@grc.com` | `password` | 30.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COE-IRREG-Y2-01` | Arsenio C. Ocampo | `arsenio.ocampo@grc.com` | `password` | 15.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COE-IRREG-Y2-02` | Teresa A. Dela Cruz | `teresa.delacruz@grc.com` | `password` | 15.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COE-IRREG-Y2-03` | Bonifacio E. Soriano | `bonifacio.soriano@grc.com` | `password` | 15.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COE-IRREG-Y2-04` | Milagros B. Espiritu | `milagros.espiritu@grc.com` | `password` | 15.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COE-IRREG-Y2-05` | Arturo M. Corpuz | `arturo.corpuz@grc.com` | `password` | 15.5 | **Enrolled (Grades Locked)** |

##### Year 3 (10 Students)
| Category | Student Number | Full Name | Email Address | Password | Units Enrolled | Term 6 Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| Regular | `TEST-COE-REG-Y3-01` | Perlita R. Manalo | `perlita.manalo@grc.com` | `password` | 22.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COE-REG-Y3-02` | Vicente T. Domingo | `vicente.domingo@grc.com` | `password` | 22.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COE-REG-Y3-03` | Estelita P. Valenzuela | `estelita.valenzuela@grc.com` | `password` | 22.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COE-REG-Y3-04` | Hector S. Salvador | `hector.salvador@grc.com` | `password` | 22.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COE-REG-Y3-05` | Norma D. De Leon | `norma.deleon@grc.com` | `password` | 22.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COE-IRREG-Y3-01` | Teodoro K. Santiago | `teodoro.santiago@grc.com` | `password` | 16.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COE-IRREG-Y3-02` | Nilda N. Aguilar | `nilda.aguilar@grc.com` | `password` | 16.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COE-IRREG-Y3-03` | Gregorio C. Gutierrez | `gregorio.gutierrez@grc.com` | `password` | 16.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COE-IRREG-Y3-04` | Aida V. David | `aida.david@grc.com` | `password` | 16.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COE-IRREG-Y3-05` | Melchor M. Miranda | `melchor.miranda@grc.com` | `password` | 16.5 | **Enrolled (Grades Locked)** |

##### Year 4 (10 Students)
| Category | Student Number | Full Name | Email Address | Password | Units Enrolled | Term 6 Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| Regular | `TEST-COE-REG-Y4-01` | Felicidad L. Cortez | `felicidad.cortez@grc.com` | `password` | 7.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COE-REG-Y4-02` | Manuel G. Pineda | `manuel.pineda@grc.com` | `password` | 7.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COE-REG-Y4-03` | Consolacion B. Castillo | `consolacion.castillo@grc.com` | `password` | 7.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COE-REG-Y4-04` | Severino S. Rivera | `severino.rivera@grc.com` | `password` | 7.5 | **Enrolled (Grades Locked)** |
| Regular | `TEST-COE-REG-Y4-05` | Leonora T. Ignacio | `leonora.ignacio@grc.com` | `password` | 7.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COE-IRREG-Y4-01` | Virgilio D. Vergara | `virgilio.vergara@grc.com` | `password` | 7.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COE-IRREG-Y4-02` | Rosita R. Pascual | `rosita.pascual@grc.com` | `password` | 7.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COE-IRREG-Y4-03` | Jaime H. Villanueva | `jaime.villanueva@grc.com` | `password` | 7.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COE-IRREG-Y4-04` | Lourdes F. Tolentino | `lourdes.tolentino@grc.com` | `password` | 7.5 | **Enrolled (Grades Locked)** |
| Irregular | `TEST-COE-IRREG-Y4-05` | Conrado C. Flores | `conrado.flores@grc.com` | `password` | 7.5 | **Enrolled (Grades Locked)** |

---

## 3. UI Simplification & Progressive Disclosure ("UI Normalization")

### 3.1 Problem & Motivation
In enterprise and academic enrollment systems, presenting complex multi-dimensional data simultaneously causes cognitive overload for staff, faculty, and students. Prior audit findings identified three high-density screens:
1. **Cashier Workspace ("Now Serving" Panel):** Displayed a raw 5-column past payment transactions table directly adjacent to the payment form, causing excessive vertical scrolling and visual clutter during active student serving.
2. **Program Chair Advising Review Dialog:** Rendered a wide 8-column table with raw subject codes, room, and day strings without high-level load summaries or quick conflict indicators.
3. **Curriculum Prospectus View:** Dumped all 8 semesters (up to 60+ courses) across 4 years in flat sequential tables, forcing students to scroll excessively to track their progress.

### 3.2 Implemented Progressive Disclosure Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 UI Progressive Disclosure                   │
├───────────────────────────────┬─────────────────────────────┤
│ Level 1: Summary Card / Badges│ Level 2: Expanded Details   │
├───────────────────────────────┼─────────────────────────────┤
│ • Total units & subject count │ • Full course list table    │
│ • Zero timetable conflicts    │ • Weekly calendar grid      │
│ • History badge (3 records)   │ • Transaction audit log     │
│ • Year accordion summary      │ • Semester course breakdown │
└───────────────────────────────┴─────────────────────────────┘
```

#### A. Cashier Workspace (`accounting-payment-workspace.tsx`)
- **Normalized Component:** The bulky "Student Payment History with Cashier" table is wrapped in an interactive collapsible disclosure (`<details class="group rounded-lg border bg-muted/20">`).
- **Surface Summary:** Shows a concise summary row with a record count badge (`{N} records`) and a clear user hint (`Click to view past payments / Click to collapse`).
- **Expansion:** Expands smoothly to display the complete transaction history table only when specifically requested by the cashier.
- **Verification:** Tested via `vitest run accounting-payment-workspace.test.tsx` — **21 / 21 unit tests passed**.

#### B. Program Chair Irregular Advising Review Dialog (`enrollment-review-dialog.tsx`)
- **Normalized Top Metrics:** Displays four clean summary cards before any course list:
  1. **Student Profile:** Full Name, Student Number, Year Level ordinal.
  2. **Academic Load:** Total enrolled subjects count and assessed unit total.
  3. **Overload Approval:** Status indicator for load approval ceiling.
  4. **Timetable Conflict Check:** Active conflict detector (`findConflictingIds`) rendering an emerald `"Zero Schedule Conflicts (All days & times compatible)"` badge or a rose conflict alert badge.
- **Progressive View Toggle:** Replaced the cluttered layout with an interactive two-state view switcher:
  - **Table View:** Clean, condensed subject list with professor, units, and room allocations.
  - **Calendar Timetable:** Interactive weekly grid visualizer (`SectionScheduleCalendar`) showing Monday–Saturday time blocks.
- **Verification:** Tested via `vitest run enrollment-review-dialog.test.tsx` — **2 / 2 unit tests passed**.

#### C. Curriculum Prospectus (`prospectus-document.tsx`)
- **Year-Level Progressive Accordions:** Replaced the flat 8-semester un-grouped dump with Year-level accordions (1st Year, 2nd Year, 3rd Year, 4th Year).
- **Accordion Header Badges:** Each year header summarizes completed courses vs. total courses (e.g. `11 / 22 completed`) and cumulative year units (e.g. `61 units`).
- **Default State:** The student's current year level starts expanded for immediate relevance, while future/past years remain cleanly collapsed until tapped.
- **Print & Audit Integrity:** Preserved standard paper print output with `print:block print:border-none print:shadow-none` classes so printed prospectus documents remain fully expanded.
- **Verification:** Tested via `vitest run prospectus-document.test.tsx` — **7 / 7 unit tests passed**.

---

## 4. Playwright Browser Automation & Live Verification

### 4.1 Verification Matrix Across Roles & Colleges

| College | Role | Account / Identity | Route Tested | Functionality Verified | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **COA** | Program Chair | `chair.coa@grc.test` | `/portal/irregular-enrollments` | Accessed submissions queue, filtered by status, opened Schedule Review Dialog, verified normalized metrics cards, timetable conflict checker, and toggled Calendar View. | **PASSED** |
| **CBAE** | Student (Regular) | `lito.castro@grc.com` | `/portal/grades` | Inspected 2025-2026 · 2nd locked grade slip (all 9 subjects graded 1.25–2.25), opened Curriculum Prospectus modal with Year-level progressive disclosure accordions. | **PASSED** |
| **COE** | Student (Regular) | `remedios.reyes@grc.com` | `/portal/schedule` & `/portal/grades` | Inspected active weekly class timetable for Section `ELEM101` (30.5 units, 11 enrolled classes) and verified locked official grade slip. | **PASSED** |
| **COE** | Faculty / Professor | `faculty.coe@grc.test` | `/portal/grade-submission` | Selected assigned section `MATHWRLD (Mathematics in the Modern World) · ELEM101`, verified complete 36-student grade sheet locked by Registrar Head. | **PASSED** |
| **Global** | Cashier | `accounting.seed@grc.test` | `/portal/payment-queue` | Tested student lookup (`#cashier-student-number`), inspected queue status, and verified served tickets history. | **PASSED** |

### 4.2 Automated Code Quality & Type Safety Checks

- **TypeScript Strict Compilation (`tsc --noEmit`):**
  ```bash
  npm run typecheck
  # Result: 0 errors
  ```
- **Fast Static Linting (`oxlint`):**
  ```bash
  npm run lint:fast
  # Result: 0 warnings, 0 errors
  ```
- **Frontend Component Unit Tests (`vitest`):**
  ```bash
  npx vitest run accounting-payment-workspace.test.tsx enrollment-review-dialog.test.tsx prospectus-document.test.tsx
  # Result: 3 test files passed, 30 tests passed (100%)
  ```

---

## 5. Archiving Readiness Checklist (2025-2026 · 2nd → 2026-2027 · 1st)

The institution is now fully prepared to trigger the academic term archiving workflow:

- [x] **Term Status:** Term ID 6 (`2025-2026 · 2nd`) is active (`semester_ongoing`).
- [x] **Enrolled Cohort:** 2,308 total active student enrollments across the institution.
- [x] **Official COR Records:** 2,308 immutable Certificate of Registration snapshots stored with SHA-256 hashes.
- [x] **Tuition Assessments:** All enrollments have corresponding fee assessments and cashier transaction records.
- [x] **Locked Final Grades:** 27,183 locked academic grades recorded in the system. Zero draft or pending grade sheets remain open for Term 6.
- [x] **Multi-College Test Cohorts:** 160 realistic Filipino student identities (40 CCS, 40 COA, 40 CBAE, 40 COE) fully populated across 1st–4th years.
- [x] **Target Next Term:** Term ID 7 (`2026-2027 · 1st Semester`) is provisioned and ready to open under the updated 2024-2029 curriculum.

---
*Report certified and generated on September 16, 2026 for Global Reciprocal Colleges Automated Enrollment System.*

## 6. End-to-End System Testing & Institutional Audit Report — Term 34 (2026-2027 · 1st Semester) CCS Cohort

**Academic Term:** 2026-2027 · 1st Semester (Term ID `34`, `enrollment_open` / `regular_phase`)  
**Target Scope:** College of Computer Studies (CCS) — Bachelor of Science in Information Technology (`BSIT`)  
**Test Date:** September 21, 2026  
**Automation Engine:** Playwright Browser Automation (`http://localhost:3000`) & Laravel REST API (`http://127.0.0.1:8000/api/v1`)  
**Unified Test Account Password:** `password`

### 6.1 Executive Summary & Key Milestones

In this institutional verification cycle, the College of Computer Studies (CCS) was taken through the complete end-to-end enrollment lifecycle in **Term 34 (2026-2027 · 1st Semester)**, resolving two system bugs and validating all roles using Playwright browser automation:

1. **Bug Resolution: CCS Schedule Proposal "Not Published" Discrepancy**
   - *Problem:* CCS Program Chair saw "Approved and published" in their workspace, but Registrar Head's Enrollment Schedule screen reported CCS as "Not published".
   - *Root Cause:* In `program-chair-enrollment-workspace.tsx`, `currentProposal` matched `proposals[0]` regardless of college department when the query returned multiple proposals, picking up COA's already-published proposal instead of CCS's unsubmitted proposal.
   - *Fix:* Scoped proposal lookup strictly to the chair's department: `(!session?.college || proposal.college === session.college)`.
2. **Bug Resolution: Grade Approvals Department Filter SQL 500 Error**
   - *Problem:* Clicking the "CCS" department tab on `/portal/grade-approvals` threw HTTP 500 `Column not found: 1052 Column 'college' in where clause is ambiguous` or `Unknown column 'college'`.
   - *Root Cause:* `academic_grades` table has no `college` column; the college belongs to `departments.code` through `sections -> subjects -> departments`.
   - *Fix:* Updated `ListAcademicGrades.php` to join `sections`, `subjects`, and `departments` filtering by `departments.code = $college`, and updated `AcademicGradeResource.php` to eager-load `section.subject.department` for zero N+1 overhead.
3. **Full CCS Schedule Publication Workflow:**
   - Program Chair (`chair.ccs@grc.test`) submitted CCS proposal (ID: 20).
   - Dean (`dean.seed@grc.test`) reviewed and approved (`dean_approve`).
   - Executive Director (`executive.seed@grc.test`) published (`publish`), transitioning all 293 CCS sections to `published`.
   - Registrar Head (`registrar-head.seed@grc.test`) verified Publication Readiness badge: `CCS published`.
4. **40 CCS Students Fully Enrolled (Term 34):**
   - 40 students matching the exact volume of previous institutional audits (5 regular + 5 irregular per year level across 1st, 2nd, 3rd, and 4th year).
   - 100% assessed with official tuition and fees via `AssessEnrollment`.
   - 100% cashier-paid and confirmed via `ConfirmPayment` (`accounting.seed@grc.test`).
   - 100% issued official Certificate of Registration (`cor`) documents with cryptographic SHA-256 signatures.
5. **Faculty Grade Submission & Registrar Head Locking:**
   - Faculty (`faculty.seed@grc.test` / Diana L. Santos) encoded marks and submitted final grades.
   - Registrar Head (`registrar-head.seed@grc.test`) filtered by CCS tab, locked individual grades via confirmation modal, and permanently locked all 444 CCS grades in Term 34.
   - Standing reclassification triggered automatically on grade lock.
   - Student portal verified: Official grade slip rendered with 14 subjects, grades 1.25–2.25, and GWA 1.75.

---

### 6.2 Administrative & Faculty Test Accounts Directory (Term 34 CCS Audit)

| Role | Institutional Name | Email Address | Password | Actions Verified in Term 34 |
| :--- | :--- | :--- | :---: | :--- |
| **Program Chair (CCS)** | Mary Joy Dy | `chair.ccs@grc.test` | `password` | Submitted CCS schedule proposal (ID: 20), reviewed 20 irregular enrollments with units & courses. |
| **College Dean** | Seed Dean | `dean.seed@grc.test` | `password` | Reviewed and approved CCS schedule proposal (`dean_approve`). |
| **Executive Director** | Seed Executive Director | `executive.seed@grc.test` | `password` | Published CCS schedule proposal (`publish`), activating 293 CCS sections. |
| **Registrar Head** | Seed Registrar Head | `registrar-head.seed@grc.test` | `password` | Verified publication readiness badge, filtered grades by CCS, permanently locked 444 CCS grades. |
| **Cashier / Accounting** | Seed Accounting Staff | `accounting.seed@grc.test` | `password` | Confirmed 40 student tuition payments, generated 40 official COR records. |
| **Faculty / Professor** | Diana L. Santos | `faculty.seed@grc.test` | `password` | Assigned to sections (`IT101-ITC`, `IT201-DBMSYS`, `IT301-ARTAPP`, `IT401-SPI`), encoded grades, submitted class rosters. |

---

### 6.3 Student Rosters — College of Computer Studies (Term 34 Cohort, 40 Students)

#### Year 1 (10 Students)
| Category | Student Number | Full Name | Email Address | Password | Section | Units | Enrollment ID | Status | Official COR # | Grades Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Regular | `TEST-REG-Y1-01` | Juan Carlos M. Santos | `carlos.santos@grc.com` | `password` | `IT101` | 30.5 | 30519 | **Enrolled** | `COR030519` | **Locked (GWA: 1.75)** |
| Regular | `TEST-REG-Y1-02` | Maria Angelica R. Reyes | `angelica.reyes@grc.com` | `password` | `IT101` | 30.5 | 30520 | **Enrolled** | `COR030520` | **Locked** |
| Regular | `TEST-REG-Y1-03` | Christian Dave B. Bautista | `christian.bautista@grc.com` | `password` | `IT101` | 30.5 | 30521 | **Enrolled** | `COR030521` | **Locked** |
| Regular | `TEST-REG-Y1-04` | Althea Mae D. Mendoza | `althea.mendoza@grc.com` | `password` | `IT101` | 30.5 | 30522 | **Enrolled** | `COR030522` | **Locked** |
| Regular | `TEST-REG-Y1-05` | Joshua Miguel S. Cruz | `joshua.cruz@grc.com` | `password` | `IT101` | 30.5 | 30523 | **Enrolled** | `COR030523` | **Locked** |
| Irregular | `TEST-IRREG-Y1-01` | Mark Anthony L. Ramos | `anthony.ramos@grc.com` | `password` | `IT102` | 18.0 | 30524 | **Enrolled** | `COR030524` | **Locked** |
| Irregular | `TEST-IRREG-Y1-02` | Patricia Nicole G. Garcia | `patricia.garcia@grc.com` | `password` | `IT102` | 18.0 | 30525 | **Enrolled** | `COR030525` | **Locked** |
| Irregular | `TEST-IRREG-Y1-03` | John Paul T. Fernandez | `johnpaul.fernandez@grc.com` | `password` | `IT102` | 18.0 | 30526 | **Enrolled** | `COR030526` | **Locked** |
| Irregular | `TEST-IRREG-Y1-04` | Bea Louise E. Aquino | `bea.aquino@grc.com` | `password` | `IT102` | 18.0 | 30527 | **Enrolled** | `COR030527` | **Locked** |
| Irregular | `TEST-IRREG-Y1-05` | Gabriel Vince C. Castro | `gabriel.castro@grc.com` | `password` | `IT102` | 18.0 | 30528 | **Enrolled** | `COR030528` | **Locked** |

#### Year 2 (10 Students)
| Category | Student Number | Full Name | Email Address | Password | Section | Units | Enrollment ID | Status | Official COR # | Grades Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Regular | `TEST-REG-Y2-01` | Rafael Luis A. Gonzales | `rafael.gonzales@grc.com` | `password` | `IT201` | 24.5 | 30529 | **Enrolled** | `COR030529` | **Locked** |
| Regular | `TEST-REG-Y2-02` | Camille Joy P. Pascual | `camille.pascual@grc.com` | `password` | `IT201` | 24.5 | 30530 | **Enrolled** | `COR030530` | **Locked** |
| Regular | `TEST-REG-Y2-03` | Angelo Miguel H. Villanueva | `angelo.villanueva@grc.com` | `password` | `IT201` | 24.5 | 30531 | **Enrolled** | `COR030531` | **Locked** |
| Regular | `TEST-REG-Y2-04` | Sophia Marie T. Tolentino | `sophia.tolentino@grc.com` | `password` | `IT201` | 24.5 | 30532 | **Enrolled** | `COR030532` | **Locked** |
| Regular | `TEST-REG-Y2-05` | Daniel Kevin F. Flores | `daniel.flores@grc.com` | `password` | `IT201` | 24.5 | 30533 | **Enrolled** | `COR030533` | **Locked** |
| Irregular | `TEST-IRREG-Y2-01` | Justine Kyle B. Morales | `justine.morales@grc.com` | `password` | `IT202` | 15.0 | 30534 | **Enrolled** | `COR030534` | **Locked** |
| Irregular | `TEST-IRREG-Y2-02` | Hannah Mae S. Salazar | `hannah.salazar@grc.com` | `password` | `IT202` | 15.0 | 30535 | **Enrolled** | `COR030535` | **Locked** |
| Irregular | `TEST-IRREG-Y2-03` | Dominic Sean V. Navarro | `dominic.navarro@grc.com` | `password` | `IT202` | 15.0 | 30536 | **Enrolled** | `COR030536` | **Locked** |
| Irregular | `TEST-IRREG-Y2-04` | Alyssa Denise M. Mercado | `alyssa.mercado@grc.com` | `password` | `IT202` | 15.0 | 30537 | **Enrolled** | `COR030537` | **Locked** |
| Irregular | `TEST-IRREG-Y2-05` | Adrian Kenneth D. Ocampo | `adrian.ocampo@grc.com` | `password` | `IT202` | 15.0 | 30538 | **Enrolled** | `COR030538` | **Locked** |

#### Year 3 (10 Students)
| Category | Student Number | Full Name | Email Address | Password | Section | Units | Enrollment ID | Status | Official COR # | Grades Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Regular | `TEST-REG-Y3-01` | Kenneth Dale R. Dela Cruz | `kenneth.delacruz@grc.com` | `password` | `IT301` | 22.5 | 30539 | **Enrolled** | `COR030539` | **Locked** |
| Regular | `TEST-REG-Y3-02` | Princess Kimberly C. Soriano | `princess.soriano@grc.com` | `password` | `IT301` | 22.5 | 30540 | **Enrolled** | `COR030540` | **Locked** |
| Regular | `TEST-REG-Y3-03` | Nathaniel James E. Espiritu | `nathaniel.espiritu@grc.com` | `password` | `IT301` | 22.5 | 30541 | **Enrolled** | `COR030541` | **Locked** |
| Regular | `TEST-REG-Y3-04` | Celine Joyce B. Corpuz | `celine.corpuz@grc.com` | `password` | `IT301` | 22.5 | 30542 | **Enrolled** | `COR030542` | **Locked** |
| Regular | `TEST-REG-Y3-05` | Vince Ryan M. Manalo | `vince.manalo@grc.com` | `password` | `IT301` | 22.5 | 30543 | **Enrolled** | `COR030543` | **Locked** |
| Irregular | `TEST-IRREG-Y3-01` | Jeric Matthew L. Domingo | `jeric.domingo@grc.com` | `password` | `IT305` | 16.0 | 30544 | **Enrolled** | `COR030544` | **Locked** |
| Irregular | `TEST-IRREG-Y3-02` | Erika Jane G. Valenzuela | `erika.valenzuela@grc.com` | `password` | `IT305` | 16.0 | 30545 | **Enrolled** | `COR030545` | **Locked** |
| Irregular | `TEST-IRREG-Y3-03` | Tristan Paul P. Salvador | `tristan.salvador@grc.com` | `password` | `IT305` | 16.0 | 30546 | **Enrolled** | `COR030546` | **Locked** |
| Irregular | `TEST-IRREG-Y3-04` | Mary Grace F. De Leon | `grace.deleon@grc.com` | `password` | `IT305` | 16.0 | 30547 | **Enrolled** | `COR030547` | **Locked** |
| Irregular | `TEST-IRREG-Y3-05` | Paolo Miguel S. Santiago | `paolo.santiago@grc.com` | `password` | `IT305` | 16.0 | 30548 | **Enrolled** | `COR030548` | **Locked** |

#### Year 4 (10 Students)
| Category | Student Number | Full Name | Email Address | Password | Section | Units | Enrollment ID | Status | Official COR # | Grades Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Regular | `TEST-REG-Y4-01` | Jerome Patrick A. Aguilar | `jerome.aguilar@grc.com` | `password` | `IT401` | 19.5 | 30549 | **Enrolled** | `COR030549` | **Locked** |
| Regular | `TEST-REG-Y4-02` | Rochelle Ann N. Gutierrez | `rochelle.gutierrez@grc.com` | `password` | `IT401` | 19.5 | 30550 | **Enrolled** | `COR030550` | **Locked** |
| Regular | `TEST-REG-Y4-03` | Aldrin Jay T. David | `aldrin.david@grc.com` | `password` | `IT401` | 19.5 | 30551 | **Enrolled** | `COR030551` | **Locked** |
| Regular | `TEST-REG-Y4-04` | Kristine Joy V. Miranda | `kristine.miranda@grc.com` | `password` | `IT401` | 19.5 | 30552 | **Enrolled** | `COR030552` | **Locked** |
| Regular | `TEST-REG-Y4-05` | Francis Edward C. Cortez | `francis.cortez@grc.com` | `password` | `IT401` | 19.5 | 30553 | **Enrolled** | `COR030553` | **Locked** |
| Irregular | `TEST-IRREG-Y4-01` | Dexter Allen M. Pineda | `dexter.pineda@grc.com` | `password` | `IT402` | 13.0 | 30554 | **Enrolled** | `COR030554` | **Locked** |
| Irregular | `TEST-IRREG-Y4-02` | Clarisse Anne R. Castillo | `clarisse.castillo@grc.com` | `password` | `IT402` | 13.0 | 30555 | **Enrolled** | `COR030555` | **Locked** |
| Irregular | `TEST-IRREG-Y4-03` | Louie Anton B. Rivera | `louie.rivera@grc.com` | `password` | `IT402` | 13.0 | 30556 | **Enrolled** | `COR030556` | **Locked** |
| Irregular | `TEST-IRREG-Y4-04` | Kimberly Rose S. Ignacio | `kimberly.ignacio@grc.com` | `password` | `IT402` | 13.0 | 30557 | **Enrolled** | `COR030557` | **Locked** |
| Irregular | `TEST-IRREG-Y4-05` | Marco Antonio D. Vergara | `marco.vergara@grc.com` | `password` | `IT402` | 13.0 | 30558 | **Enrolled** | `COR030558` | **Locked** |

---

### 6.4 Playwright Browser Automation & Live Verification Artifacts

| Artifact Image | Portal Route | Acting User Account | Role / Purpose | Verification Result |
| :--- | :--- | :--- | :--- | :--- |
| `testing_ccs_published_readiness.png` | `/portal/academic-terms` | `registrar-head.seed@grc.test` | Registrar Head | Verified green publication readiness badge reads `CCS published`. |
| `testing_ccs_student_enrolled_page.png` | `/portal/enrollment` | `carlos.santos@grc.com` | Student (Regular Y1) | Verified enrollment stepper with all 6 stages complete, tuition paid ₱10,500.00. |
| `testing_ccs_student_cor_page.png` | `/portal/digital-com` | `carlos.santos@grc.com` | Student (Regular Y1) | Verified official Certificate of Registration issuance with COR reference `COR030519`. |
| `testing_ccs_chair_enrolled_table.png` | `/portal/irregular-enrollments` | `chair.ccs@grc.test` | Program Chair (CCS) | Verified 20 irregular CCS students listed with enrolled units, course badges, and actions. |
| `testing_ccs_faculty_classes.png` | `/portal/grade-submission` | `faculty.seed@grc.test` | Faculty (CCS) | Verified assigned classes in Term 34 (`IT101-ITC`, `IT201-DBMSYS`, `IT301-ARTAPP`, `IT401-SPI`). |
| `testing_ccs_faculty_grades_submitted.png` | `/portal/grade-submission` | `faculty.seed@grc.test` | Faculty (CCS) | Verified grade submission transition to `Awaiting Registrar` with status badges updated. |
| `page-2026-09-21T11-05-29-013Z.png` | `/portal/grade-approvals` | `registrar-head.seed@grc.test` | Registrar Head | Verified CCS filter tab displays 390 pending grades with zero SQL 500 errors. |
| `page-2026-09-21T11-06-49-127Z.png` | `/portal/grade-approvals` | `registrar-head.seed@grc.test` | Registrar Head | Verified Grade history tab displays Marco Antonio D. Vergara (`TEST-IRREG-Y4-05`) with red `Locked` badge. |
| `page-2026-09-21T11-08-53-818Z.png` | `/portal/grade-approvals` | `registrar-head.seed@grc.test` | Registrar Head | Verified all 444 grades locked, pending approvals counter reaches 0. |
| `page-2026-09-21T11-10-02-856Z.png` | `/portal/grades` | `carlos.santos@grc.com` | Student (Regular Y1) | Full page screenshot of official Grade Slip: 14 subjects, grades 1.25–2.25, GWA 1.75. |

---

### 6.5 Term 34 CCS Institutional Readiness Checklist

- [x] **Proposal Lifecycle:** CCS schedule proposal submitted, dean-approved, and executive-published.
- [x] **Section Availability:** All 293 CCS sections in Term 34 have status `published`.
- [x] **Student Cohort Enrolled:** 40 CCS students (20 regular + 20 irregular) enrolled with zero conflicts.
- [x] **Fee Assessment & Cashiering:** 100% assessed and paid via Cashier (`accounting.seed@grc.test`).
- [x] **Official COR Records:** 40 cryptographic Certificate of Registration documents generated and downloadable.
- [x] **Faculty Grade Submission:** Respective professors encoded and submitted grades.
- [x] **Registrar Grade Locking:** 444/444 academic grades permanently locked (`status = 'locked'`).
- [x] **Student Prospectus & Grades:** Official grade slips accessible in Student Portal with accurate GWA computation.

---
*Report certified and generated on September 21, 2026 for Global Reciprocal Colleges Automated Enrollment System.*

