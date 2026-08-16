<?php

use App\Http\Controllers\Api\V1\AcademicGradeController;
use App\Http\Controllers\Api\V1\AcademicRecordController;
use App\Http\Controllers\Api\V1\AcademicTermController;
use App\Http\Controllers\Api\V1\AcademicTermSectionPlanController;
use App\Http\Controllers\Api\V1\AcademicTermWorkflowController;
use App\Http\Controllers\Api\V1\AuditLogController;
use App\Http\Controllers\Api\V1\Auth\LoginController;
use App\Http\Controllers\Api\V1\Auth\LogoutController;
use App\Http\Controllers\Api\V1\Auth\MeController;
use App\Http\Controllers\Api\V1\CashierPaymentCandidateController;
use App\Http\Controllers\Api\V1\CashierTransactionController;
use App\Http\Controllers\Api\V1\ClassRosterController;
use App\Http\Controllers\Api\V1\CurrentCurriculumSubjectController;
use App\Http\Controllers\Api\V1\CurriculumController;
use App\Http\Controllers\Api\V1\CurriculumSubjectPlacementController;
use App\Http\Controllers\Api\V1\CurriculumMigrationController;
use App\Http\Controllers\Api\V1\Dashboard\EnrollmentSummaryController;
use App\Http\Controllers\Api\V1\Dashboard\InstitutionSummaryController;
use App\Http\Controllers\Api\V1\Dashboard\PolicySettingsController;
use App\Http\Controllers\Api\V1\Dashboard\ProgramChairAnalyticsSummaryController;
use App\Http\Controllers\Api\V1\Dashboard\StuckEnrollmentController;
use App\Http\Controllers\Api\V1\EligibleSubjectController;
use App\Http\Controllers\Api\V1\EnrollmentBlockController;
use App\Http\Controllers\Api\V1\EnrollmentChangeRequestController;
use App\Http\Controllers\Api\V1\EnrollmentController;
use App\Http\Controllers\Api\V1\EnrollmentDocumentController;
use App\Http\Controllers\Api\V1\EnrollmentWindowController;
use App\Http\Controllers\Api\V1\FacultyAvailabilityController;
use App\Http\Controllers\Api\V1\FacultyCurriculumSubjectPreferenceController;
use App\Http\Controllers\Api\V1\FacultyLoadReportController;
use App\Http\Controllers\Api\V1\FacultyMemberController;
use App\Http\Controllers\Api\V1\FacultyPreferenceCatalogController;
use App\Http\Controllers\Api\V1\FacultySpecializationController;
use App\Http\Controllers\Api\V1\FacultySubjectPreferenceController;
use App\Http\Controllers\Api\V1\FacultyTeachingHistoryController;
use App\Http\Controllers\Api\V1\GradeSlipController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\ItControl\AutomationRunController;
use App\Http\Controllers\Api\V1\ItControl\FacultyAccountController;
use App\Http\Controllers\Api\V1\ItControl\StudentAccountController as ItControlStudentAccountController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\PaymentController;
use App\Http\Controllers\Api\V1\ProgramController;
use App\Http\Controllers\Api\V1\ProspectusController;
use App\Http\Controllers\Api\V1\QueueTicketController;
use App\Http\Controllers\Api\V1\RoomCatalogEntryController;
use App\Http\Controllers\Api\V1\ScheduleGenerationRunController;
use App\Http\Controllers\Api\V1\ScheduleProposalController;
use App\Http\Controllers\Api\V1\SectionController;
use App\Http\Controllers\Api\V1\StudentAccountController;
use App\Http\Controllers\Api\V1\StudentProfileController;
use App\Http\Controllers\Api\V1\StudentSchedulePreferenceController;
use App\Http\Controllers\Api\V1\SubjectController;
use App\Http\Controllers\Api\V1\SubjectOfferingController;
use App\Http\Controllers\Api\V1\TransfereeCreditController;
use App\Http\Controllers\Api\V1\WithdrawalRequestController;
use App\Http\Middleware\EnsureUserIsActive;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->name('api.v1.')->group(function (): void {
    Route::get('/health', HealthController::class)
        ->middleware('throttle:60,1')
        ->name('health');

    Route::prefix('auth')->name('auth.')->group(function (): void {
        // Public. Per-account+IP throttling is applied inside the controller;
        // this coarse limiter is an additional flood guard.
        Route::post('/login', LoginController::class)
            ->middleware('throttle:30,1')
            ->name('login');

        Route::middleware(['auth:sanctum', EnsureUserIsActive::class])->group(function (): void {
            Route::post('/logout', LogoutController::class)->name('logout');
            Route::get('/me', MeController::class)->name('me');
        });
    });

    // Readable by every role; ProgramPolicy/AcademicTermPolicy plus each
    // model's visibleTo() scope decide which rows a given role receives.
    Route::middleware(['auth:sanctum', EnsureUserIsActive::class, 'throttle:60,1'])->group(function (): void {
        Route::get('/programs', ProgramController::class)->name('programs');
        Route::get('/academic-terms', [AcademicTermController::class, 'index'])->name('academic-terms.index');
        Route::patch('/academic-terms/{academicTerm}', [AcademicTermController::class, 'update'])->name('academic-terms.update');

        // GET is readable by every role (AcademicTermPolicy::view gates a
        // learner-scoped role to learner-visible terms, same as the term
        // list above); PATCH is Registrar Head only via
        // AcademicTermPolicy::update — no role: middleware, same pattern as
        // the term-transition route above it.
        Route::get('/academic-terms/{academicTerm}/enrollment-windows', [EnrollmentWindowController::class, 'index'])->name('academic-terms.enrollment-windows.index');
        Route::patch('/academic-terms/{academicTerm}/enrollment-schedule', [EnrollmentWindowController::class, 'update'])->name('academic-terms.enrollment-schedule.update');
        Route::get('/academic-term-workflows', [AcademicTermWorkflowController::class, 'index'])->name('academic-term-workflows.index');
        Route::patch('/academic-term-workflows/{workflow}', [AcademicTermWorkflowController::class, 'update'])->name('academic-term-workflows.update');
        Route::get('/subjects', SubjectController::class)->name('subjects');
        Route::get('/curricula', [CurriculumController::class, 'index'])->name('curricula.index');

        // Every transition (submit, dean_approve, dean_return,
        // executive_approve, executive_return) needs a *different* role, so
        // a single blanket `role:` middleware doesn't fit this one route —
        // CurriculumPolicy resolves the right ability per request, same
        // shape as schedule-proposals.update. See ADR 0011.
        Route::patch('/curricula/{curriculum}/transition', [CurriculumController::class, 'transition'])->name('curricula.transition');
        Route::get('/subject-offerings', [SubjectOfferingController::class, 'index'])->name('subject-offerings.index');
        Route::get('/academic-term-section-plans', [AcademicTermSectionPlanController::class, 'index'])->name('academic-term-section-plans.index');
        Route::get('/faculty-availabilities', [FacultyAvailabilityController::class, 'index'])->name('faculty-availabilities.index');
        Route::get('/faculty-specializations', [FacultySpecializationController::class, 'index'])->name('faculty-specializations.index');
        Route::get('/faculty-subject-preferences', [FacultySubjectPreferenceController::class, 'index'])->name('faculty-subject-preferences.index');
        Route::get('/room-options', RoomCatalogEntryController::class)->name('room-options.index');
        Route::get('/sections', [SectionController::class, 'index'])->name('sections.index');
        Route::get('/schedule-proposals', [ScheduleProposalController::class, 'index'])->name('schedule-proposals.index');
        Route::get('/schedule-proposals/{scheduleProposal}/sections', [ScheduleProposalController::class, 'sections'])->name('schedule-proposals.sections');
        Route::get('/notifications', [NotificationController::class, 'index'])->name('notifications.index');
        Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markRead'])->name('notifications.read');

        // Every transition (dean_approve, dean_return, executive_approve,
        // executive_return, publish, close) needs a *different* role, so a
        // single blanket `role:` middleware doesn't fit this one route —
        // ScheduleProposalPolicy resolves the right ability per request. See
        // ADR 0011.
        Route::patch('/schedule-proposals/{scheduleProposal}', [ScheduleProposalController::class, 'update'])->name('schedule-proposals.update');

        // Own-record only — no role gate beyond authentication, since the
        // Policy resolves "whose profile is this" the same way auth/me does.
        Route::get('/student-profile', [StudentProfileController::class, 'show'])->name('student-profile.show');

        // Student owns their account summary; Accounting Staff may look up
        // the served Student's account and record a balance-only receipt.
        // StudentProfilePolicy applies the narrower account-specific gate.
        Route::get('/student-account', [StudentAccountController::class, 'showOwn'])->name('student-account.show-own');
        Route::get('/students/{student}/account', [StudentAccountController::class, 'show'])->name('students.account.show');
        Route::post('/students/{student}/account-payments', [StudentAccountController::class, 'store'])->name('students.account-payments.store');

        // Own-record only, same shape as student-profile.show — no role
        // gate beyond authentication; StudentSchedulePreferencePolicy
        // resolves "student role only, and only their own row" for both
        // the GET and the upsert PUT.
        Route::get('/student-schedule-preferences', [StudentSchedulePreferenceController::class, 'show'])->name('student-schedule-preferences.show');
        Route::put('/student-schedule-preferences', [StudentSchedulePreferenceController::class, 'update'])->name('student-schedule-preferences.update');

        // Own computed view, not a stored resource — EligibleSubjectPolicy
        // resolves "student role only" the same way FacultyMemberPolicy
        // resolves "program chair only" for the faculty directory.
        Route::get('/eligible-subjects', EligibleSubjectController::class)->name('eligible-subjects.index');

        // Blocks a regular student may enrol into as a unit. Irregular
        // students use /eligible-subjects instead — this always returns []
        // for them, never an error.
        Route::get('/enrollment-blocks', EnrollmentBlockController::class)->name('enrollment-blocks.index');

        // Role-scoped read (Student own, Registrar Head all, Accounting
        // pending_payment only — Enrollment::scopeVisibleTo) and Student-only
        // submission.
        Route::get('/enrollments', [EnrollmentController::class, 'index'])->name('enrollments.index');
        Route::post('/enrollments', [EnrollmentController::class, 'store'])->name('enrollments.store');

        // Two Registrar Head checkpoints (registrar_approve/registrar_reject
        // at the approval queue, void at the payment-pending queue) share one
        // route the same way schedule-proposal transitions do — no single
        // `role:` middleware fits, so EnrollmentPolicy resolves the ability
        // per `action`. See ADR 0011.
        Route::patch('/enrollments/{enrollment}', [EnrollmentController::class, 'update'])->name('enrollments.update');

        // FR-FIN-007–009: Accounting-only, idempotent payment confirmation
        // + Digital COM generation. No `role:` middleware — EnrollmentPolicy
        // resolves `confirmPayment` the same way it resolves the other two
        // Registrar Head checkpoints.
        Route::post('/enrollments/{enrollment}/payment', [EnrollmentController::class, 'confirmPayment'])->name('enrollments.payment');

        // FR-FIN-010: Student own, Registrar Head all —
        // EnrollmentDocument::scopeVisibleTo.
        Route::get('/enrollment-documents', [EnrollmentDocumentController::class, 'index'])->name('enrollment-documents.index');

        // Accounting Staff's own payment history, plus Registrar Head
        // oversight — a narrower read than widening Enrollment::scopeVisibleTo,
        // since `payments` rows never disappear the way an enrollment does
        // once ConfirmPayment moves it out of pending_payment. No `role:`
        // middleware — PaymentPolicy::viewAny resolves both roles; no
        // per-row scoping distinguishes them further.
        Route::get('/payments', [PaymentController::class, 'index'])->name('payments.index');

        // A normalized, read-only Cashier history over enrollment-confirmation
        // and balance-payment receipts. `PaymentPolicy::viewAny` keeps this
        // to Accounting Staff and Registrar Head without changing /payments.
        Route::get('/cashier-transactions', [CashierTransactionController::class, 'index'])->name('cashier-transactions.index');

        // Exact, non-mutating candidate lookup for the Cashier workflow.
        // QueueTicketPolicy limits it to Accounting Staff; the UI separately
        // delegates any actual serving transition to the existing endpoint.
        Route::get('/cashier-payment-candidates', [CashierPaymentCandidateController::class, 'show'])->name('cashier-payment-candidates.show');

        // FR-FIN-004 / PRD §4.2 rule 7: Student-only, own `enrolled`
        // enrollment. No `role:` middleware — EnrollmentPolicy::withdraw
        // resolves the instance-level ownership check.
        Route::post('/enrollments/{enrollment}/withdraw', [EnrollmentController::class, 'withdraw'])->name('enrollments.withdraw');

        // Role-scoped read (Student own, Registrar Staff and Registrar Head
        // all — WithdrawalRequest::scopeVisibleTo); `decide` (approve/reject)
        // is Registrar Staff only per PRD §3.8's literal role assignment.
        // No `role:` middleware — WithdrawalRequestPolicy resolves both.
        Route::get('/withdrawal-requests', [WithdrawalRequestController::class, 'index'])->name('withdrawal-requests.index');
        Route::patch('/withdrawal-requests/{withdrawalRequest}', [WithdrawalRequestController::class, 'update'])->name('withdrawal-requests.update');

        // Phase 7: Student-only, own `enrolled` enrollment, only inside the
        // add/drop window (AddDropWindowResolver). No `role:` middleware —
        // EnrollmentPolicy::requestChange resolves the instance-level
        // ownership check, the same shape as `enrollments/{enrollment}/withdraw`.
        Route::post('/enrollments/{enrollment}/change-requests', [EnrollmentChangeRequestController::class, 'store'])->name('enrollments.change-requests.store');

        // Role-scoped read (Student own, Registrar Head and Registrar Staff
        // all — EnrollmentChangeRequest::scopeVisibleTo); `decide`
        // (approve/reject) is Registrar Head only — the opposite role
        // assignment from withdrawal-requests, per explicit user direction.
        // No `role:` middleware — EnrollmentChangeRequestPolicy resolves both.
        Route::get('/enrollment-change-requests', [EnrollmentChangeRequestController::class, 'index'])->name('enrollment-change-requests.index');
        Route::patch('/enrollment-change-requests/{enrollmentChangeRequest}', [EnrollmentChangeRequestController::class, 'update'])->name('enrollment-change-requests.update');

        // FR-FIN-003 / PRD §3.8, §10.3: Registrar Staff records, edits, and
        // decides transferee credits (Student and Registrar Head read only
        // — TransfereeCredit::scopeVisibleTo). No `role:` middleware —
        // TransfereeCreditPolicy resolves all three per request, the same
        // shape WithdrawalRequestController uses.
        Route::get('/transferee-credits', [TransfereeCreditController::class, 'index'])->name('transferee-credits.index');
        Route::post('/transferee-credits', [TransfereeCreditController::class, 'store'])->name('transferee-credits.store');
        Route::patch('/transferee-credits/{transfereeCredit}', [TransfereeCreditController::class, 'update'])->name('transferee-credits.update');

        // PRD §3.2 "View assigned teaching schedules and class rosters" —
        // Faculty own sections, Registrar Staff/Head all
        // (EnrollmentSubject::scopeVisibleTo). No `role:` middleware —
        // EnrollmentSubjectPolicy resolves the role-level boundary.
        Route::get('/class-rosters', [ClassRosterController::class, 'index'])->name('class-rosters.index');

        // Role-scoped read (Student own, Faculty own sections, Registrar
        // Head all — AcademicGrade::scopeVisibleTo). Writes carry no
        // `role:` middleware: create is Faculty-only (re-checked by
        // AcademicGradePolicy::create); the PATCH route serves a plain
        // content edit plus two further checkpoints (submit by Faculty,
        // lock by the Registrar Head), resolved the same way
        // EnrollmentController resolves registrar_approve/registrar_reject/
        // void. See ADR 0011.
        Route::get('/academic-grades', [AcademicGradeController::class, 'index'])->name('academic-grades.index');
        Route::post('/academic-grades', [AcademicGradeController::class, 'store'])->name('academic-grades.store');
        Route::patch('/academic-grades/{academicGrade}', [AcademicGradeController::class, 'update'])->name('academic-grades.update');

        // A student's full academic history, not a single grade record —
        // gated by AcademicRecordPolicy (view-academic-record), not by
        // role: middleware, matching /eligible-subjects' shape.
        Route::get('/prospectus', ProspectusController::class)->name('prospectus.show');
        Route::get('/grade-slip', GradeSlipController::class)->name('grade-slip.show');
        Route::get('/academic-record', AcademicRecordController::class)->name('academic-record.show');

        // First production consumer of the `role` middleware (ADR 0008):
        // only the Program Chair authors curricula, matching the frontend's
        // existing "curriculum"/"subjects-prerequisites" module ownership.
        // CurriculumPolicy re-checks the role as defense in depth.
        Route::middleware('role:program_chair')->group(function (): void {
            Route::get('/faculty-members', FacultyMemberController::class)->name('faculty-members.index');
            Route::patch('/faculty-members/{facultyMember}/workforce-profile', [FacultyMemberController::class, 'updateWorkforceProfile'])->name('faculty-members.workforce-profile.update');
            Route::post('/curricula', [CurriculumController::class, 'store'])->name('curricula.store');
            Route::patch('/curricula/{curriculum}', [CurriculumController::class, 'update'])->name('curricula.update');
            Route::get('/programs/{program}/current-curriculum-subjects', CurrentCurriculumSubjectController::class)->name('programs.current-curriculum-subjects.index');
            Route::post('/curricula/{curriculum}/subject-placements', CurriculumSubjectPlacementController::class)->name('curricula.subject-placements.store');
            Route::get('/curricula/{curriculum}/migration-preview', [CurriculumMigrationController::class, 'preview'])->name('curricula.migrations.preview');
            Route::post('/curricula/{curriculum}/migrations', [CurriculumMigrationController::class, 'store'])->name('curricula.migrations.store');

            // Sections are the chair's schedule plan, same ownership as
            // curriculum authorship.
            Route::post('/sections', [SectionController::class, 'store'])->name('sections.store');
            Route::patch('/sections/{section}', [SectionController::class, 'update'])->name('sections.update');

            // Submitting (creating) a proposal is single-role, unlike its
            // transitions.
            Route::post('/schedule-proposals', [ScheduleProposalController::class, 'store'])->name('schedule-proposals.store');

            // Process 1.1: planning-only data, no learner-visibility concept,
            // same ownership as curriculum authorship.
            Route::post('/subject-offerings', [SubjectOfferingController::class, 'store'])->name('subject-offerings.store');
            Route::patch('/academic-terms/{academicTerm}/section-plan', [AcademicTermSectionPlanController::class, 'store'])->name('academic-term-section-plans.store');
            Route::post('/academic-terms/{academicTerm}/section-plan/release', [AcademicTermSectionPlanController::class, 'release'])->name('academic-term-section-plans.release');
            Route::post('/academic-terms/{academicTerm}/section-plan/auto-assign', [AcademicTermSectionPlanController::class, 'autoAssign'])->name('academic-term-section-plans.auto-assign');
            Route::post('/academic-terms/{academicTerm}/section-plan/submit', [AcademicTermSectionPlanController::class, 'submit'])->name('academic-term-section-plans.submit');
            Route::post('/academic-terms/{academicTerm}/schedule-generation-runs', [ScheduleGenerationRunController::class, 'store'])->name('schedule-generation-runs.store');
            Route::get('/academic-terms/{academicTerm}/schedule-generation-runs/latest', [ScheduleGenerationRunController::class, 'latest'])->name('schedule-generation-runs.latest');
            Route::get('/schedule-generation-runs/{scheduleGenerationRun}', [ScheduleGenerationRunController::class, 'show'])->name('schedule-generation-runs.show');
            Route::get('/academic-terms/{academicTerm}/faculty-load-report', [FacultyLoadReportController::class, 'show'])->name('faculty-load-report.show');
            Route::put('/academic-terms/{academicTerm}/faculty-load-threshold', [FacultyLoadReportController::class, 'updateThreshold'])->name('faculty-load-threshold.update');
        });

        // Enrollment analytics are role-scoped by DashboardPolicy: Program
        // Chairs receive only their assigned college, while Registrar Head can
        // review all supported departments or a selected one. It must not live
        // in the Program Chair-only middleware group.
        Route::get('/dashboards/program-chair-analytics-summary', ProgramChairAnalyticsSummaryController::class)->name('dashboards.program-chair-analytics-summary');

        // A Faculty member writes only their own availability/preferences —
        // an own-record scope, not a role-exclusive resource like curricula.
        // The Policy re-checks professor_id === auth()->id() as defense in
        // depth (ADR 0008's pattern, applied to a new authorization shape).
        Route::middleware('role:faculty')->group(function (): void {
            Route::get('/faculty-preference-catalog', FacultyPreferenceCatalogController::class)->name('faculty-preference-catalog.index');
            Route::get('/faculty-curriculum-subject-preferences', [FacultyCurriculumSubjectPreferenceController::class, 'index'])->name('faculty-curriculum-subject-preferences.index');
            Route::post('/faculty-curriculum-subject-preferences', [FacultyCurriculumSubjectPreferenceController::class, 'store'])->name('faculty-curriculum-subject-preferences.store');
            Route::patch('/faculty-curriculum-subject-preferences/{facultyCurriculumPreference}', [FacultyCurriculumSubjectPreferenceController::class, 'update'])->name('faculty-curriculum-subject-preferences.update');
            Route::delete('/faculty-curriculum-subject-preferences/{facultyCurriculumPreference}', [FacultyCurriculumSubjectPreferenceController::class, 'destroy'])->name('faculty-curriculum-subject-preferences.destroy');
            Route::get('/faculty-teaching-history', [FacultyTeachingHistoryController::class, 'index'])->name('faculty-teaching-history.index');

            Route::post('/faculty-availabilities', [FacultyAvailabilityController::class, 'store'])->name('faculty-availabilities.store');
            Route::patch('/faculty-availabilities/{facultyAvailability}', [FacultyAvailabilityController::class, 'update'])->name('faculty-availabilities.update');
            Route::delete('/faculty-availabilities/{facultyAvailability}', [FacultyAvailabilityController::class, 'destroy'])->name('faculty-availabilities.destroy');

            Route::post('/faculty-specializations', [FacultySpecializationController::class, 'store'])->name('faculty-specializations.store');
            Route::delete('/faculty-specializations/{facultySpecialization}', [FacultySpecializationController::class, 'destroy'])->name('faculty-specializations.destroy');

            Route::post('/faculty-subject-preferences', [FacultySubjectPreferenceController::class, 'store'])->name('faculty-subject-preferences.store');
            Route::patch('/faculty-subject-preferences/{facultySubjectPreference}', [FacultySubjectPreferenceController::class, 'update'])->name('faculty-subject-preferences.update');
            Route::delete('/faculty-subject-preferences/{facultySubjectPreference}', [FacultySubjectPreferenceController::class, 'destroy'])->name('faculty-subject-preferences.destroy');
        });

        // PRD §3.2: "Create new student accounts and initial profiles" —
        // first production consumer of the admission_staff role.
        Route::middleware('role:admission_staff')->group(function (): void {
            Route::post('/student-profiles', [StudentProfileController::class, 'store'])->name('student-profiles.store');
        });

        Route::middleware('role:registrar_head')->group(function (): void {
            Route::get('/audit-logs', AuditLogController::class)
                ->name('audit-logs.index');
            Route::get('/dashboards/policy-settings', PolicySettingsController::class)
                ->name('dashboards.policy-settings');

            // PRD Process 1: only the Registrar Head creates academic terms.
            // AcademicTermPolicy re-checks the role as defense in depth.
            Route::post('/academic-terms', [AcademicTermController::class, 'store'])
                ->name('academic-terms.store');

            // Closing one cycle opens the next in the same transaction, so
            // the system never sits with no current term.
            Route::post('/academic-terms/{academicTerm}/archive-and-create-next', [AcademicTermController::class, 'archiveAndCreateNext'])
                ->name('academic-terms.archive-and-create-next');
        });

        Route::prefix('it-control')->name('it-control.')->middleware('role:it_admin')->group(function (): void {
            Route::get('/students', ItControlStudentAccountController::class)->name('students.index');
            Route::get('/faculty', FacultyAccountController::class)->name('faculty.index');
            Route::get('/automation-runs', [AutomationRunController::class, 'index'])->name('automation-runs.index');
            Route::post('/automation-runs', [AutomationRunController::class, 'store'])->name('automation-runs.store');
            Route::get('/automation-runs/{run}', [AutomationRunController::class, 'show'])->name('automation-runs.show');
        });

        // Phase 7c: aggregate-only counts, never row-level enrollment data,
        // for the two roles Enrollment::scopeVisibleTo()/EnrollmentPolicy
        // otherwise exclude entirely (see ADR 0017). stuck-enrollments is the
        // one PRD-authorized exception (§3.5's "stuck-student reports"),
        // scoped to Dean only and returning student_number, never a full
        // Enrollment or student record.
        Route::middleware('role:dean,executive_director')->group(function (): void {
            Route::get('/dashboards/enrollment-summary', EnrollmentSummaryController::class)
                ->name('dashboards.enrollment-summary');
        });
        Route::middleware('role:executive_director')->group(function (): void {
            Route::get('/dashboards/institution-summary', InstitutionSummaryController::class)
                ->name('dashboards.institution-summary');
        });
        Route::middleware('role:dean')->group(function (): void {
            Route::get('/stuck-enrollments', StuckEnrollmentController::class)
                ->name('stuck-enrollments.index');
        });

        // FR-FIN-006: both transitions are Accounting-only with no
        // per-ticket ownership dimension (unlike enrollments/academic
        // grades), so the coarse `role:` middleware fits here — re-checked
        // by QueueTicketPolicy as defense in depth.
        Route::middleware('role:accounting_staff')->group(function (): void {
            Route::get('/queue-tickets', [QueueTicketController::class, 'index'])->name('queue-tickets.index');
            Route::patch('/queue-tickets/{queueTicket}', [QueueTicketController::class, 'update'])->name('queue-tickets.update');
        });
    });
});
