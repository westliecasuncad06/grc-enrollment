<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $category
 * @property string $label
 * @property string $amount
 * @property array<string>|null $program_codes
 * @property bool $is_active
 * @property int $sort_order
 * @property \Carbon\CarbonImmutable|null $created_at
 * @property \Carbon\CarbonImmutable|null $updated_at
 */
final class FeeSchedule extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'program_codes' => 'array',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }
}
