<?php

namespace App\Http\Requests\Api\V1\QueueTicket;

use App\Domain\Enrollment\QueueTicketStatus;
use App\Models\QueueTicket;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * One `action` field drives both transitions (FR-FIN-006). §17 leaves
 * reset cadence, priority, and "how many tickets may be `serving` at once"
 * unconfirmed, so this class enforces only the two-step order
 * (`waiting` → `serving` → `served`) and nothing about which or how many
 * tickets an Accounting Staff member may advance.
 */
final class UpdateQueueTicketRequest extends FormRequest
{
    /**
     * @var array<string, QueueTicketStatus>
     */
    private const REQUIRED_CURRENT_STATUS = [
        'serve' => QueueTicketStatus::Waiting,
        'complete' => QueueTicketStatus::Serving,
    ];

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'action' => ['required', 'string', Rule::in(array_keys(self::REQUIRED_CURRENT_STATUS))],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $action = $this->input('action');

            if (! is_string($action) || ! isset(self::REQUIRED_CURRENT_STATUS[$action])) {
                return;
            }

            /** @var QueueTicket $ticket */
            $ticket = $this->route('queueTicket');
            $requiredStatus = self::REQUIRED_CURRENT_STATUS[$action];

            if ($ticket->status !== $requiredStatus) {
                $validator->errors()->add(
                    'action',
                    "This action requires the ticket to currently be '{$requiredStatus->value}'; ".
                    "it is currently '{$ticket->status->value}'.",
                );
            }
        });
    }
}
