<?php

namespace App\Actions\Billing;

use App\Domain\Billing\StudentAccountBalance;
use App\Domain\Billing\StudentAccountBalanceEntry;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Models\Assessment;
use App\Models\Enrollment;
use App\Models\Payment;
use App\Models\StudentProfile;
use Carbon\CarbonInterface;

/**
 * The authoritative account view for a Student. It derives outstanding
 * balance from nonterminal assessments less the original enrollment payment
 * and every separately allocated account payment. No editable balance is
 * stored, so the Cashier and Student always see the same audit-backed total.
 */
final class BuildStudentAccountBalance
{
    public function execute(StudentProfile $student): StudentAccountBalance
    {
        /** @var list<Enrollment> $enrollments */
        $enrollments = $student->enrollments()
            ->whereNotIn('status', EnrollmentStatus::terminalValues())
            ->has('assessment')
            ->with(['academicTerm', 'assessment', 'payment', 'accountPayments'])
            ->get()
            ->sortBy(fn (Enrollment $enrollment): array => [
                $this->termOrder($enrollment),
                $enrollment->id,
            ])
            ->values()
            ->all();

        $totalAssessed = '0.00';
        $totalPaid = '0.00';
        $outstandingBalance = '0.00';
        $priorBalance = '0.00';
        $hasPromissoryNoteOnFile = false;
        $entries = [];
        $currentEnrollmentId = $enrollments === [] ? null : $enrollments[array_key_last($enrollments)]->id;

        foreach ($enrollments as $enrollment) {
            $assessment = $enrollment->getRelation('assessment');

            if (! $assessment instanceof Assessment || $assessment->total_amount === null) {
                continue;
            }

            $assessmentAmount = $assessment->total_amount;
            $payment = $enrollment->getRelation('payment');
            $confirmedPaymentAmount = $payment instanceof Payment && $payment->amount !== null
                ? $payment->amount
                : '0.00';
            $accountPaymentAmount = '0.00';

            foreach ($enrollment->accountPayments as $accountPayment) {
                $accountPaymentAmount = bcadd($accountPaymentAmount, $accountPayment->amount, 2);
            }
            $paidForEnrollment = bcadd($confirmedPaymentAmount, $accountPaymentAmount, 2);
            $computedOutstanding = bcsub($assessmentAmount, $paidForEnrollment, 2);
            $entryOutstanding = bccomp($computedOutstanding, '0.00', 2) === -1
                ? '0.00'
                : $computedOutstanding;

            $totalAssessed = bcadd($totalAssessed, $assessmentAmount, 2);
            $totalPaid = bcadd($totalPaid, $paidForEnrollment, 2);
            $outstandingBalance = bcadd($outstandingBalance, $entryOutstanding, 2);

            if ($enrollment->id !== $currentEnrollmentId) {
                $priorBalance = bcadd($priorBalance, $entryOutstanding, 2);
            }

            if (bccomp($entryOutstanding, '0.00', 2) !== 1) {
                continue;
            }

            $promissoryNoteOnFile = $payment instanceof Payment && $payment->promissory_note_on_file;
            $hasPromissoryNoteOnFile = $hasPromissoryNoteOnFile || $promissoryNoteOnFile;
            $entries[] = new StudentAccountBalanceEntry(
                enrollmentId: $enrollment->id,
                academicTermId: $enrollment->academic_term_id,
                academicTermLabel: $enrollment->academicTerm->school_year.' · '.$enrollment->academicTerm->semester,
                assessmentAmount: $assessmentAmount,
                confirmedPaymentAmount: $confirmedPaymentAmount,
                accountPaymentAmount: $accountPaymentAmount,
                outstandingBalance: $entryOutstanding,
                promissoryNoteOnFile: $promissoryNoteOnFile,
            );
        }

        return new StudentAccountBalance(
            totalAssessed: $totalAssessed,
            totalPaid: $totalPaid,
            priorBalance: $priorBalance,
            outstandingBalance: $outstandingBalance,
            hasPromissoryNoteOnFile: $hasPromissoryNoteOnFile,
            entries: $entries,
        );
    }

    private function termOrder(Enrollment $enrollment): int
    {
        $termStart = $enrollment->academicTerm->starts_at;

        if ($termStart instanceof CarbonInterface) {
            return $termStart->getTimestamp();
        }

        $assessment = $enrollment->getRelation('assessment');

        return $assessment instanceof Assessment
            ? $assessment->assessed_at->getTimestamp()
            : PHP_INT_MAX;
    }
}
