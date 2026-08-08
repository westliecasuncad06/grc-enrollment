<?php

namespace App\Actions\Analytics;

use App\Domain\Analytics\HistoricalCohortResolver;
use App\Domain\Analytics\PredictionRunStatus;
use App\Domain\Analytics\PredictionType;
use App\Domain\Scheduling\ScheduleGenerationStatus;
use App\Models\CurriculumSubject;
use App\Models\PredictionRun;
use App\Models\ScheduleGenerationRun;
use App\Models\SectionDemandForecast;
use App\Models\SectionDemandObservation;
use App\Services\Analytics\SectionDemandPredictionClient;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Produces advisory, aggregate-only section demand forecasts. It deliberately
 * does not enroll a student or publish a schedule; Program Chairs retain the
 * final section and capacity decisions in the existing draft workflow.
 */
final class GenerateSectionDemandForecasts
{
    public function __construct(
        private readonly HistoricalCohortResolver $historicalCohortResolver,
        private readonly SectionDemandPredictionClient $predictionClient,
    ) {}

    public function execute(ScheduleGenerationRun $generationRun): void
    {
        $generationRun->loadMissing('academicTerm');
        $term = $generationRun->academicTerm;

        $generationRun->update([
            'status' => ScheduleGenerationStatus::Running,
            'started_at' => now(),
            'error_summary' => null,
        ]);

        $predictionRun = PredictionRun::create([
            'type' => PredictionType::SectionDemand,
            'academic_term_id' => $term->id,
            'model_version' => 'section-demand-rf-v1',
            'feature_schema_version' => 'v1',
            'status' => PredictionRunStatus::Running,
            'started_at' => now(),
        ]);
        $generationRun->update(['prediction_run_id' => $predictionRun->id]);

        try {
            $placements = CurriculumSubject::query()
                ->with('curriculum.program')
                ->where(function ($query) use ($term): void {
                    $query->where('semester', $term->semester)
                        ->orWhere('semester', 'like', '%'.$term->semester.'%');
                })
                ->whereHas('curriculum.program', fn ($programs) => $programs->where('college', $generationRun->college))
                ->get();

            if ($placements->isEmpty()) {
                $this->completeWithoutPlacements($generationRun, $predictionRun);

                return;
            }

            $observations = [];
            $targets = [];
            foreach ($placements as $placement) {
                $history = $this->historicalCohortResolver->resolve(
                    $term->school_year,
                    $term->semester,
                    $placement->year_level,
                );
                $targetKey = $placement->curriculum_id.':'.$placement->subject_id.':'.$placement->year_level;
                $targets[] = [
                    'target_key' => $targetKey,
                    'subject_id' => $placement->subject_id,
                    'year_level' => $placement->year_level,
                    'recommended_capacity' => 40,
                ];

                $rows = SectionDemandObservation::query()
                    ->where('program_id', $placement->curriculum->program_id)
                    ->where('curriculum_id', $placement->curriculum_id)
                    ->where('subject_id', $placement->subject_id)
                    ->where('year_level', $history->yearLevel)
                    ->whereHas('academicTerm', fn ($terms) => $terms
                        ->where('school_year', $history->schoolYear)
                        ->where('semester', $history->semester))
                    ->orderBy('id')
                    ->get();

                foreach ($rows as $row) {
                    $observations[] = [
                        'subject_id' => $row->subject_id,
                        'year_level' => $row->year_level,
                        'semester' => $history->semester,
                        'cohort_size' => $row->cohort_size,
                        'enrolled_count' => $row->enrolled_count,
                        'section_count' => $row->section_count,
                        'offered_capacity' => $row->offered_capacity,
                    ];
                }
            }

            $response = $this->predictionClient->predict($observations, $targets);
            $forecastByKey = collect($response['forecasts'] ?? [])->keyBy('target_key');
            $warnings = [];

            DB::transaction(function () use ($placements, $forecastByKey, $predictionRun, $term, &$warnings): void {
                foreach ($placements as $placement) {
                    $key = $placement->curriculum_id.':'.$placement->subject_id.':'.$placement->year_level;
                    $forecast = $forecastByKey->get($key);
                    if (! is_array($forecast)) {
                        $warnings[] = "No demand forecast returned for subject {$placement->subject_id}.";
                        continue;
                    }

                    // A forecast is term/subject advisory evidence. Multiple
                    // curriculum placements of the same subject share that
                    // aggregate output rather than duplicating student data.
                    SectionDemandForecast::updateOrCreate(
                        [
                            'prediction_run_id' => $predictionRun->id,
                            'academic_term_id' => $term->id,
                            'subject_id' => $placement->subject_id,
                        ],
                        [
                            'predicted_demand' => $forecast['predicted_demand'],
                            'suggested_section_count' => $forecast['suggested_section_count'],
                            'confidence_lower' => $forecast['confidence_lower'],
                            'confidence_upper' => $forecast['confidence_upper'],
                        ],
                    );
                }
            });

            $predictionRun->update([
                'status' => PredictionRunStatus::Succeeded,
                'metrics' => ['forecast_count' => $forecastByKey->count()],
                'completed_at' => now(),
            ]);
            $generationRun->update([
                'status' => ScheduleGenerationStatus::Succeeded,
                'warnings' => $warnings,
                'completed_at' => now(),
            ]);
        } catch (Throwable $exception) {
            report($exception);
            $predictionRun->update([
                'status' => PredictionRunStatus::Failed,
                'error_summary' => 'Demand forecast generation failed.',
                'completed_at' => now(),
            ]);
            $generationRun->update([
                'status' => ScheduleGenerationStatus::Failed,
                'error_summary' => 'Demand forecast generation failed. Review the service connection and retry.',
                'completed_at' => now(),
            ]);
        }
    }

    private function completeWithoutPlacements(ScheduleGenerationRun $generationRun, PredictionRun $predictionRun): void
    {
        $predictionRun->update([
            'status' => PredictionRunStatus::Succeeded,
            'metrics' => ['forecast_count' => 0],
            'completed_at' => now(),
        ]);
        $generationRun->update([
            'status' => ScheduleGenerationStatus::Succeeded,
            'warnings' => ['No current-term curriculum subjects were found for this college.'],
            'completed_at' => now(),
        ]);
    }
}
