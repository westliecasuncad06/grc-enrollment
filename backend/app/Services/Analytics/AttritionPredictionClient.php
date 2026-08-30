<?php

namespace App\Services\Analytics;

use Illuminate\Support\Facades\Http;
use UnexpectedValueException;

/** Laravel-only client for the private XGBoost attrition prediction-service contract. */
final class AttritionPredictionClient
{
    /**
     * @param  list<array{year_level: int, gpa: float, failed_units: int, dropped_units: int, is_irregular: int, consecutive_terms: int, attrited: int}>  $observations
     * @param  list<array{student_id: int, year_level: int, gpa: float, failed_units: int, dropped_units: int, is_irregular: int, consecutive_terms: int}>  $targets
     * @return array{model_version: string, feature_schema_version: string, strategy: string, metrics?: array{training_observation_count: int, validation_observation_count: int, accuracy: float|null}, predictions: list<array{student_id: int, risk_probability: float, risk_band: string, explanations: list<string>}>}
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
            ->post('/internal/v1/attrition/predict', [
                'data' => [
                    'feature_schema_version' => 'v1',
                    'observations' => $observations,
                    'targets' => $targets,
                ],
            ])
            ->throw()
            ->json('data');

        if (! is_array($data)) {
            throw new UnexpectedValueException('Attrition prediction service returned an invalid response.');
        }

        /** @var array{model_version: string, feature_schema_version: string, strategy: string, metrics?: array{training_observation_count: int, validation_observation_count: int, accuracy: float|null}, predictions: list<array{student_id: int, risk_probability: float, risk_band: string, explanations: list<string>}>} $data */
        return $data;
    }
}
