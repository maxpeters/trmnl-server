<?php

namespace App\Console\Commands;

use Database\Seeders\ExampleRecipesSeeder;
use Illuminate\Console\Command;
use Illuminate\Contracts\Console\PromptsForMissingInput;

class ExampleRecipesSeederCommand extends Command implements PromptsForMissingInput
{
    protected $signature = 'recipes:seed {user_id}';

    protected $description = 'Seed example recipes';

    public function handle(ExampleRecipesSeeder $seeder): void
    {
        $user_id = $this->argument('user_id');
        $seeder->run($user_id);
    }
}
