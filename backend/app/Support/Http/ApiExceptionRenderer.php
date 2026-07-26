<?php

namespace App\Support\Http;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

final class ApiExceptionRenderer
{
    public static function render(Throwable $exception, Request $request): ?JsonResponse
    {
        if (! $request->is('api/*')) {
            return null;
        }

        if ($exception instanceof ValidationException) {
            return ApiErrorResponse::make(
                $request,
                ApiErrorCode::ValidationFailed,
                'The submitted data is invalid.',
                422,
                $exception->errors(),
            );
        }

        if ($exception instanceof AuthenticationException) {
            return ApiErrorResponse::make(
                $request,
                ApiErrorCode::Unauthenticated,
                'Authentication is required.',
                401,
            );
        }

        if ($exception instanceof AuthorizationException) {
            return ApiErrorResponse::make(
                $request,
                ApiErrorCode::Forbidden,
                'You are not authorized to perform this action.',
                403,
            );
        }

        if ($exception instanceof NotFoundHttpException) {
            return ApiErrorResponse::make(
                $request,
                ApiErrorCode::NotFound,
                'The requested resource was not found.',
                404,
            );
        }

        if ($exception instanceof MethodNotAllowedHttpException) {
            return ApiErrorResponse::make(
                $request,
                ApiErrorCode::MethodNotAllowed,
                'The HTTP method is not allowed for this endpoint.',
                405,
                headers: $exception->getHeaders(),
            );
        }

        if ($exception instanceof HttpExceptionInterface) {
            return self::renderHttpException($exception, $request);
        }

        return ApiErrorResponse::make(
            $request,
            ApiErrorCode::ServerError,
            'An unexpected server error occurred.',
            500,
        );
    }

    private static function renderHttpException(
        HttpExceptionInterface $exception,
        Request $request,
    ): JsonResponse {
        [$code, $message] = match ($exception->getStatusCode()) {
            400 => [ApiErrorCode::BadRequest, 'The request could not be processed.'],
            401 => [ApiErrorCode::Unauthenticated, 'Authentication is required.'],
            403 => [ApiErrorCode::Forbidden, 'You are not authorized to perform this action.'],
            404 => [ApiErrorCode::NotFound, 'The requested resource was not found.'],
            409 => [ApiErrorCode::Conflict, 'The request conflicts with the current resource state.'],
            422 => [ApiErrorCode::ValidationFailed, 'The submitted data is invalid.'],
            429 => [ApiErrorCode::TooManyRequests, 'Too many requests. Please retry later.'],
            default => [ApiErrorCode::ServerError, 'An unexpected server error occurred.'],
        };

        $safeStatuses = [400, 401, 403, 404, 409, 422, 429];
        $status = in_array($exception->getStatusCode(), $safeStatuses, true)
            ? $exception->getStatusCode()
            : 500;

        return ApiErrorResponse::make(
            $request,
            $code,
            $message,
            $status,
            headers: $exception->getHeaders(),
        );
    }
}
