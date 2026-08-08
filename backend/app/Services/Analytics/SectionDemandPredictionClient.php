<?php

namespace App\Services\Analytics;

use Illuminate\Support\Facades\Http;
use UnexpectedValueException;

/** Laravel-only client for the private prediction-service contract. */
final class SectionDemandPredictionClient
{
    /**
     * @param  list<array{cohort_size: int, enrolled_count: int, section_count: int, offered_capacity: int, year_level: int, semester: string}>  $observations
     * @param  list<array{key: string, cohort_size: int, section_count: int, recommended_capacity: int, year_level: int, semester: string}>  $targets
     * @return array{model_version: string, feature_schema_version: string, strategy: string, forecasts: list<array{key: string, predicted_demand: float|int, confidence_lower: float|int, confidence_upper: float|int, suggested_section_count: int}>}
     */
    public function predict(array $observations, array $targets): array
    {
        /** @var string $baseUrl */
        $baseUrl = config('services.prediction.base_url');
        /** @var int $timeout */
        $timeout = config('services.prediction.timeout');

        $data = Http::baseUrl($baseUrl)
            ->acceptJson()
            ->timeout($timeout)
            ->post('/internal/v1/section-demand/predict', [
                'data' => [
                    'feature_schema_version' => 'v1',
                    'observations' => $observations,
                    'targets' => $targets,
                ],
            ])
            ->throw()
            ->json('data');

        if (! is_array($data)) {
            throw new UnexpectedValueException('Prediction service returned an invalid response.');
        }

        /** @var array{model_version: string, feature_schema_version: string, strategy: string, forecasts: list<array{key: string, predicted_demand: float|int, confidence_lower: float|int, confidence_upper: float|int, suggested_section_count: int}>} $data */
        return $data;
    }
}
