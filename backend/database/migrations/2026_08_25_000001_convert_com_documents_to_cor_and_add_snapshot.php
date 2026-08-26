<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('enrollment_documents', function (Blueprint $table): void {
            $table->json('snapshot')->nullable()->after('content_hash');
        });

        DB::table('enrollment_documents')
            ->where('document_type', 'com')
            ->orderBy('id')
            ->each(function (object $document): void {
                DB::table('enrollment_documents')
                    ->where('id', $document->id)
                    ->update([
                        'document_type' => 'cor',
                        'document_number' => preg_replace('/^COM/', 'COR', $document->document_number),
                    ]);
            });
    }

    public function down(): void
    {
        DB::table('enrollment_documents')
            ->where('document_type', 'cor')
            ->orderBy('id')
            ->each(function (object $document): void {
                DB::table('enrollment_documents')
                    ->where('id', $document->id)
                    ->update([
                        'document_type' => 'com',
                        'document_number' => preg_replace('/^COR/', 'COM', $document->document_number),
                    ]);
            });

        Schema::table('enrollment_documents', function (Blueprint $table): void {
            $table->dropColumn('snapshot');
        });
    }
};
