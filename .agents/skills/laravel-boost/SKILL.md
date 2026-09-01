---
name: laravel-boost
description: Accelerated Laravel development following clean architecture, modern Artisan workflows, Eloquent query optimization, Form Request validation, API Resources, and robust Pest/PHPUnit test scaffolding.
---

# Laravel Boost Skill

This skill provides best practices, conventions, patterns, and code recipes for building and maintaining robust, high-performance Laravel APIs and backend services.

---

## 1. Architectural Guidelines

Follow clean vertical-slice or Action-oriented service patterns:

- **Routing**: Group and version all REST endpoints under `/api/v1/...` with clear route grouping, middleware, and explicit resource naming.
- **Authentication**: Use Laravel Sanctum bearer tokens (`auth:sanctum`). Never introduce session or CSRF cookies to stateless APIs.
- **Controllers**: Keep controllers lean. A controller should only:
  1. Authorize via Form Request or `$this->authorize(...)`.
  2. Invoke an Action or Service class.
  3. Return an API Resource (`JsonResource`) with appropriate HTTP status code.
- **Actions / Services**: Encapsulate business logic into single-responsibility Action classes (e.g., `app/Actions/Academic/RecordAcademicGrade.php`).
- **Data Integrity**: Wrap all multi-table mutations in `DB::transaction(function () { ... })`.
- **Database Migrations**: Every migration must be fully reversible (`down()` method accurately rolls back schema changes).

---

## 2. Standard Recipes & Patterns

### A. Route Definition (`routes/api.php`)
```php
use App\Http\Controllers\Api\V1\Academic\GradeController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->middleware(['auth:sanctum'])->group(function () {
    Route::prefix('grades')->group(function () {
        Route::get('/', [GradeController::class, 'index'])->name('api.v1.grades.index');
        Route::post('/', [GradeController::class, 'store'])->name('api.v1.grades.store');
        Route::get('/{grade}', [GradeController::class, 'show'])->name('api.v1.grades.show');
        Route::put('/{grade}', [GradeController::class, 'update'])->name('api.v1.grades.update');
    });
});
```

### B. Form Request Validation & Authorization
```php
namespace App\Http\Requests\Api\V1\Academic;

use Illuminate\Foundation\Http\FormRequest;

class StoreGradeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('recordGrades', [Grade::class, $this->input('section_id')]);
    }

    public function rules(): array
    {
        return [
            'student_id' => ['required', 'integer', 'exists:students,id'],
            'section_id' => ['required', 'integer', 'exists:sections,id'],
            'subject_id' => ['required', 'integer', 'exists:subjects,id'],
            'grade_value' => ['required', 'numeric', 'between:1.00,5.00'],
            'remarks'     => ['nullable', 'string', 'max:255'],
        ];
    }
}
```

### C. Eloquent Optimization & Avoiding N+1
- Always eager load relationships on collection endpoints:
  ```php
  $sections = Section::query()
      ->with([
          'subject:id,code,title,units',
          'instructor:id,name,email',
          'room:id,name,building',
      ])
      ->where('academic_term_id', $termId)
      ->paginate(25);
  ```
- Use `loadMissing()` when a model may already have relationships populated:
  ```php
  $enrollment->loadMissing(['student.profile', 'items.section.subject']);
  ```
- Use `select()` or specific column constraints in queries to minimize hydration overhead for large result sets.

### D. Single-Responsibility Action with DB Transaction
```php
namespace App\Actions\Academic;

use App\Models\Grade;
use Illuminate\Support\Facades\DB;

class RecordAcademicGrade
{
    public function execute(array $data, int $actorId): Grade
    {
        return DB::transaction(function () use ($data, $actorId) {
            $grade = Grade::updateOrCreate(
                [
                    'student_id' => $data['student_id'],
                    'subject_id' => $data['subject_id'],
                    'academic_term_id' => $data['academic_term_id'],
                ],
                [
                    'section_id' => $data['section_id'],
                    'grade_value' => $data['grade_value'],
                    'recorded_by' => $actorId,
                    'status' => 'submitted',
                ]
            );

            // Audit log or downstream event dispatch
            activity()
                ->performedOn($grade)
                ->causedBy($actorId)
                ->log('Grade recorded');

            return $grade;
        });
    }
}
```

---

## 3. Pest / PHPUnit Test Scaffolding

Maintain comprehensive feature and unit test coverage with explicit assertions.

### Feature Test Template (Pest / PHPUnit)
```php
namespace Tests\Feature\Api\V1;

use App\Models\User;
use App\Models\Student;
use App\Models\Subject;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GradeEndpointTest extends TestCase
{
    use RefreshDatabase;

    public function test_authorized_faculty_can_record_grades(): void
    {
        $faculty = User::factory()->faculty()->create();
        $student = Student::factory()->create();
        $subject = Subject::factory()->create(['college' => $faculty->college]);

        $payload = [
            'student_id' => $student->id,
            'subject_id' => $subject->id,
            'grade_value' => 1.75,
        ];

        $response = $this->actingAs($faculty, 'sanctum')
            ->postJson(route('api.v1.grades.store'), $payload);

        $response->assertStatus(201)
            ->assertJsonPath('data.grade_value', 1.75);

        $this->assertDatabaseHas('grades', [
            'student_id' => $student->id,
            'subject_id' => $subject->id,
            'grade_value' => 1.75,
        ]);
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $response = $this->postJson(route('api.v1.grades.store'), []);
        $response->assertUnauthorized();
    }
}
```

---

## 4. Useful Artisan & Quality Commands

```bash
# Code Style & Linting
./vendor/bin/pint --test
./vendor/bin/pint --dirty

# Static Analysis
./vendor/bin/phpstan analyse --memory-limit=2G

# Testing
php artisan test --filter=GradeEndpointTest
php artisan test --coverage --min=80

# Database & Cache Optimization
php artisan route:list --path=api/v1
php artisan optimize:clear
php artisan migrate:status
```

