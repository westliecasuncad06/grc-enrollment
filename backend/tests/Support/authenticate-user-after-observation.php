<?php

use App\Actions\Auth\AuthenticateUser;
use App\Domain\Identity\Exceptions\InvalidCredentialsException;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;

require dirname(__DIR__, 2).'/vendor/autoload.php';

$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$credentials = json_decode((string) fgets(STDIN), true, flags: JSON_THROW_ON_ERROR);
$email = $credentials['email'];
$password = $credentials['password'];

$observed = false;
DB::listen(static function (QueryExecuted $query) use (&$observed): void {
    if ($observed || preg_match('/\bfrom\s+[`"]?users[`"]?/i', $query->sql) !== 1) {
        return;
    }

    $observed = true;
    fwrite(STDOUT, "OBSERVED\n");
    fflush(STDOUT);
    fgets(STDIN);
});

try {
    $app->make(AuthenticateUser::class)->handle($email, $password, 'observed-login');
    fwrite(STDOUT, "AUTHENTICATED\n");
} catch (InvalidCredentialsException) {
    fwrite(STDOUT, "REJECTED\n");
}
