<?php

namespace App\Models;

use App\Domain\Organization\CollegeCode;
use Illuminate\Database\Eloquent\Model;

/** @property int $id @property string $name @property CollegeCode $college */
final class RoomCatalogEntry extends Model
{
    /** @var list<string> */
    protected $fillable = ['name', 'college'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['college' => CollegeCode::class];
    }
}
