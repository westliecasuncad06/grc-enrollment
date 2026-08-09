<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('faculty_availabilities')->where('day_of_week', 7)->delete();

        Schema::table('faculty_availabilities', function (Blueprint $table): void {
            $table->dropUnique('faculty_availability_unique_slot');
            $table->dropForeign(['academic_term_id']);
            $table->dropColumn('academic_term_id');
            $table->unique(
                ['professor_id', 'day_of_week', 'starts_at_time'],
                'faculty_availability_unique_slot',
            );
        });
    }

    public function down(): void
    {
        Schema::table('faculty_availabilities', function (Blueprint $table): void {
            $table->dropUnique('faculty_availability_unique_slot');
            $table->foreignId('academic_term_id')->nullable()->after('professor_id');
        });

        $currentTermId = DB::table('academic_terms')
            ->whereNotIn('status', ['archived', 'semester_closed'])
            ->latest('id')
            ->value('id');

        if ($currentTermId !== null) {
            DB::table('faculty_availabilities')->update(['academic_term_id' => $currentTermId]);
        }

        Schema::table('faculty_availabilities', function (Blueprint $table): void {
            $table->foreign('academic_term_id')->references('id')->on('academic_terms')->cascadeOnDelete();
            $table->unique(
                ['professor_id', 'academic_term_id', 'day_of_week', 'starts_at_time'],
                'faculty_availability_unique_slot',
            );
        });
    }
};
