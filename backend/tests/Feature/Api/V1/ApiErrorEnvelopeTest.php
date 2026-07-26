<?php

namespace Tests\Feature\Api\V1;

use App\Http\Middleware\AssignRequestId;
use Illuminate\Support\Facades\Route;
use RuntimeException;
use Tests\TestCase;

final class ApiErrorEnvelopeTest extends TestCase
{
    public function test_unknown_api_route_returns_the_safe_not_found_envelope(): void
    {
        $this->assertErrorEnvelope(
            method: 'getJson',
            uri: '/api/v1/does-not-exist',
            requestId: 'not-found-correlation',
            status: 404,
            code: 'NOT_FOUND',
            message: 'The requested resource was not found.',
        );
    }

    public function test_unsupported_api_method_returns_the_safe_method_not_allowed_envelope(): void
    {
        $this->assertErrorEnvelope(
            method: 'postJson',
            uri: '/api/v1/health',
            requestId: 'method-correlation',
            status: 405,
            code: 'METHOD_NOT_ALLOWED',
            message: 'The HTTP method is not allowed for this endpoint.',
        );
    }

    public function test_unhandled_api_exception_returns_a_safe_server_error_envelope(): void
    {
        Route::middleware('api')->get('/api/v1/test/unhandled', function (): never {
            throw new RuntimeException('Sensitive internal exception detail.');
        });

        $response = $this
            ->withHeader(AssignRequestId::HEADER, 'server-error-correlation')
            ->getJson('/api/v1/test/unhandled');

        $response
            ->assertStatus(500)
            ->assertHeader(AssignRequestId::HEADER, 'server-error-correlation')
            ->assertExactJson([
                'error' => [
                    'code' => 'INTERNAL_ERROR',
                    'message' => 'An unexpected server error occurred.',
                    'errors' => [],
                    'request_id' => 'server-error-correlation',
                ],
            ])
            ->assertDontSee('Sensitive internal exception detail.');
    }

    private function assertErrorEnvelope(
        string $method,
        string $uri,
        string $requestId,
        int $status,
        string $code,
        string $message,
    ): void {
        $response = $this
            ->withHeader(AssignRequestId::HEADER, $requestId)
            ->{$method}($uri);

        $response
            ->assertStatus($status)
            ->assertHeader('Content-Type', 'application/json')
            ->assertHeader(AssignRequestId::HEADER, $requestId)
            ->assertExactJson([
                'error' => [
                    'code' => $code,
                    'message' => $message,
                    'errors' => [],
                    'request_id' => $requestId,
                ],
            ]);
    }
}
