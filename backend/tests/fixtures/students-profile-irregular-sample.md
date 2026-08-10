# Students Profile (Irregular Derivation Fixture)

Dedicated local test roster for Task 4 (irregular-student derivation) -- deliberately larger than
students-profile-sample.md so the ~10% assertion window in
test_roughly_a_tenth_of_students_are_derived_as_irregular() has enough population to be
mathematically satisfiable, and deliberately keeps its year-2/year-3 cohorts on the same sparse
two-subject curriculum students-profile-sample.md's fixtures already register (FM101S/FM201S,
ACC101S/ACC301S) rather than BSIT's dense per-term curriculum.

**Post Task-3/4 crosscut fix:** `StudentRosterSeeder::gradeMarkFor()`'s baseline grade
distribution is now clean/passing-only (see that method's docblock) -- the only failing marks
anywhere in this fixture come from Task 4's own deliberate `IRREGULAR_SELECTION_STRIDE`-based
selection (every 10th eligible year-2/3/4 student). With 60 eligible students (30 FM201 year-2 +
30 ACC301 year-3), exactly 6 are forced irregular (indices 0, 10, 20, 30, 40, 50). The IT101
year-1 block is only here so test_no_first_year_student_is_irregular() has a population to assert
zero against; it is intentionally small (10 rows, not the pre-fix 100) so it merely pads the
denominator rather than needing to dilute away organic noise that no longer exists -- 6 irregular
out of 70 total (8.57%) lands inside the (0.07T, 0.13T) = (4, 9) window with real margin on both
sides. See the Task 4 report (and its appended crosscut-fix addendum) for the exact math.

## College of Business Administration and Entrepreneurship

### Year 2

#### FM201

| Student No. | Name | Email | Program | Section | Year | Category |
|---|---|---|---|---|---|---|
| 2025-06-02101 | Test Student 02101 | s2502101@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02102 | Test Student 02102 | s2502102@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02103 | Test Student 02103 | s2502103@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02104 | Test Student 02104 | s2502104@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02105 | Test Student 02105 | s2502105@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02106 | Test Student 02106 | s2502106@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02107 | Test Student 02107 | s2502107@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02108 | Test Student 02108 | s2502108@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02109 | Test Student 02109 | s2502109@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02110 | Test Student 02110 | s2502110@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02111 | Test Student 02111 | s2502111@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02112 | Test Student 02112 | s2502112@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02113 | Test Student 02113 | s2502113@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02114 | Test Student 02114 | s2502114@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02115 | Test Student 02115 | s2502115@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02116 | Test Student 02116 | s2502116@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02117 | Test Student 02117 | s2502117@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02118 | Test Student 02118 | s2502118@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02119 | Test Student 02119 | s2502119@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02120 | Test Student 02120 | s2502120@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02121 | Test Student 02121 | s2502121@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02122 | Test Student 02122 | s2502122@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02123 | Test Student 02123 | s2502123@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02124 | Test Student 02124 | s2502124@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02125 | Test Student 02125 | s2502125@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02126 | Test Student 02126 | s2502126@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02127 | Test Student 02127 | s2502127@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02128 | Test Student 02128 | s2502128@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02129 | Test Student 02129 | s2502129@grc.test | BSBA-FM | FM201 | 2 | Regular |
| 2025-06-02130 | Test Student 02130 | s2502130@grc.test | BSBA-FM | FM201 | 2 | Regular |

## College of Accountancy

### Year 3

#### ACC301

| Student No. | Name | Email | Program | Section | Year | Category |
|---|---|---|---|---|---|---|
| 2024-06-02201 | Test Student 02201 | s2402201@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02202 | Test Student 02202 | s2402202@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02203 | Test Student 02203 | s2402203@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02204 | Test Student 02204 | s2402204@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02205 | Test Student 02205 | s2402205@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02206 | Test Student 02206 | s2402206@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02207 | Test Student 02207 | s2402207@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02208 | Test Student 02208 | s2402208@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02209 | Test Student 02209 | s2402209@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02210 | Test Student 02210 | s2402210@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02211 | Test Student 02211 | s2402211@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02212 | Test Student 02212 | s2402212@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02213 | Test Student 02213 | s2402213@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02214 | Test Student 02214 | s2402214@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02215 | Test Student 02215 | s2402215@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02216 | Test Student 02216 | s2402216@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02217 | Test Student 02217 | s2402217@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02218 | Test Student 02218 | s2402218@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02219 | Test Student 02219 | s2402219@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02220 | Test Student 02220 | s2402220@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02221 | Test Student 02221 | s2402221@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02222 | Test Student 02222 | s2402222@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02223 | Test Student 02223 | s2402223@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02224 | Test Student 02224 | s2402224@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02225 | Test Student 02225 | s2402225@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02226 | Test Student 02226 | s2402226@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02227 | Test Student 02227 | s2402227@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02228 | Test Student 02228 | s2402228@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02229 | Test Student 02229 | s2402229@grc.test | BSA | ACC301 | 3 | Regular |
| 2024-06-02230 | Test Student 02230 | s2402230@grc.test | BSA | ACC301 | 3 | Regular |

## College of Computer Studies

### Year 1

#### IT101

| Student No. | Name | Email | Program | Section | Year | Category |
|---|---|---|---|---|---|---|
| 2026-06-02001 | Test Student 02001 | s2602001@grc.test | BSIT | IT101 | 1 | Regular |
| 2026-06-02002 | Test Student 02002 | s2602002@grc.test | BSIT | IT101 | 1 | Regular |
| 2026-06-02003 | Test Student 02003 | s2602003@grc.test | BSIT | IT101 | 1 | Regular |
| 2026-06-02004 | Test Student 02004 | s2602004@grc.test | BSIT | IT101 | 1 | Regular |
| 2026-06-02005 | Test Student 02005 | s2602005@grc.test | BSIT | IT101 | 1 | Regular |
| 2026-06-02006 | Test Student 02006 | s2602006@grc.test | BSIT | IT101 | 1 | Regular |
| 2026-06-02007 | Test Student 02007 | s2602007@grc.test | BSIT | IT101 | 1 | Regular |
| 2026-06-02008 | Test Student 02008 | s2602008@grc.test | BSIT | IT101 | 1 | Regular |
| 2026-06-02009 | Test Student 02009 | s2602009@grc.test | BSIT | IT101 | 1 | Regular |
| 2026-06-02010 | Test Student 02010 | s2602010@grc.test | BSIT | IT101 | 1 | Regular |

## Footer

**Total sections:** 3
**Total students:** 70

Regenerated by a one-off script for Task 4 -- see StudentRosterSeederTest for how it is consumed.
Category above is always Regular at generation time; it exists for human scanning only and
is not authoritative grade evidence.