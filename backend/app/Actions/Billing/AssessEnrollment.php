<?php

namespace App\Actions\Billing;

use App\Domain\Billing\AssessmentComputation;
use App\Models\Assessment;
use App\Models\AssessmentItem;
use App\Models\Enrollment;
use RuntimeException;

/**
 * Computes and records what an enrollment was assessed to owe (PRD §5.3
 * process 3.3), reading `config('fees.*')` and handing primitives to the
 * pure `App\Domain\Billing\AssessmentComputation` — this Action is the
 * framework boundary that domain deliberately stays free of, the same
 * split `App\Domain\Academic\PrerequisiteEvaluator` draws against its own
 * caller.
 *
 * Called from exactly one place: `App\Actions\Enrollment\TransitionEnrollment`'s
 * `registrar_approve` branch, in the same transaction as the queue ticket
 * — never called standalone. Idempotent via `assessments.enrollment_id`'s
 * unique constraint (check-first, same pattern as `App\Actions\Enrollment\
 * ConfirmPayment`), though in practice `TransitionEnrollment`'s own
 * `REQUIRED_CURRENT_STATUS` guard already makes a second `registrar_approve`
 * on the same enrollment unreachable — this check is defensive, not a path
 * this slice's tests need to force open.
 *
 * An assessment is never recomputed once created — not on a later `void`
 * (which orphans it exactly the way `void` already orphans the enrollment's
 * `QueueTicket`, per that migration's own docblock), and not on a
 * post-payment add/drop (`App\Actions\Enrollment\TransitionEnrollmentChangeRequest`
 * never updates `enrollments.total_units`, so there is no reassessment/
 * adjustment-billing policy here — a PRD §17 gap, not an oversight of this
 * slice).
 */
final readonly class AssessEnrollment
{
    public function execute(Enrollment $enrollment): Assessment
    {
        $existing = Assessment::query()
            ->where('enrollment_id', $enrollment->id)
            ->with('items')
            ->first();

        if ($existing !== null) {
            return $existing;
        }

        $totalUnits = number_format($enrollment->total_units, 1, '.', '');
        $tuitionPerUnit = $this->resolveTuitionPerUnit();

        $computed = AssessmentComputation::compute($totalUnits, $tuitionPerUnit, $this->miscellaneousFees($enrollment));

        $assessment = Assessment::create([
            'enrollment_id' => $enrollment->id,
            'total_amount' => $computed->totalAmount,
            'currency' => $currency,
            'assessed_at' => now(),
        ]);

        foreach ($computed->lines as $line) {
            AssessmentItem::create([
                'assessment_id' => $assessment->id,
                'category' => $line->category,
                'label' => $line->label,
                'quantity' => $line->quantity,
                'unit_amount' => $line->unitAmount,
                'amount' => $line->amount,
            ]);
        }

        return $assessment->load('items');
    }

    /**
     * @return numeric-string
     */
    private function resolveTuitionPerUnit(): string
    {
        $raw = config($key);
        $value = is_scalar($raw) ? (string) $raw : '';

        if (! is_numeric($value)) {
            throw new RuntimeException("Config value '{$key}' must be numeric; got ".var_export($raw, true).'.');
        }

        return $value;
    }

    /**
     * @return list<array{label: string, amount: numeric-string}>
     */
    private function miscellaneousFees(Enrollment $enrollment): array
    {
        $programCode = $enrollment->student()->with('program:id,code')->firstOrFail()->program->code;
        $fees = [];

        if (! is_array($raw)) {
            return $fees;
        }

        foreach ($raw as $entry) {
            if (! is_array($entry)) {
                continue;
            }

            $label = $entry['label'] ?? null;
            $amount = $entry['amount'] ?? null;

            if (! is_string($label) || ! is_string($amount) || ! is_numeric($amount)) {
                continue;
            }

            $programCodes = $entry['program_codes'] ?? null;
            if (is_array($programCodes) && ! in_array($programCode, $programCodes, true)) {
                continue;
            }

            $fees[] = ['label' => $label, 'amount' => $amount];
        }

        return $fees;
    }
}
