<?php

namespace App\Console\Commands;

use App\Models\Firmware;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Register a locally built .bin as a Firmware row that the device-config
 * UI can then assign to a device. Complements the existing
 * FirmwarePollJob / FirmwareDownloadJob flow, which is hard-wired to the
 * upstream trmnl.com /api/firmware/latest endpoint.
 *
 * Usage:
 *   php artisan trmnl:firmware:register /abs/path/firmware.bin
 *       --tag=bwr-dev-2026-04-10
 *       [--latest]
 *       [--replace]
 */
class FirmwareRegisterCommand extends Command
{
    protected $signature = 'trmnl:firmware:register
        {file : Absolute path to the compiled firmware.bin}
        {--tag= : Version tag (defaults to bwr-dev-<timestamp>)}
        {--latest : Mark this firmware as "latest" (clears the flag on others)}
        {--replace : Overwrite an existing row with the same version_tag instead of failing}';

    protected $description = 'Register a locally built firmware .bin so it appears in the device-config UI';

    public function handle(): int
    {
        $file = $this->argument('file');

        if (! is_file($file) || ! is_readable($file)) {
            $this->error("File not found or not readable: {$file}");

            return self::FAILURE;
        }

        $tag = $this->option('tag') ?: 'bwr-dev-'.date('Ymd-His');

        $existing = Firmware::where('version_tag', $tag)->first();
        if ($existing && ! $this->option('replace')) {
            $this->error("A firmware with version_tag '{$tag}' already exists. Re-run with --replace to overwrite it.");

            return self::FAILURE;
        }

        if (! Storage::disk('public')->exists('firmwares')) {
            Storage::disk('public')->makeDirectory('firmwares');
        }

        $storageLocation = "firmwares/FW{$tag}.bin";
        Storage::disk('public')->put($storageLocation, file_get_contents($file));

        $attributes = [
            'url' => null,
            'storage_location' => $storageLocation,
            'latest' => (bool) $this->option('latest'),
        ];

        if ($existing) {
            $existing->update($attributes);
            $firmware = $existing;
        } else {
            $firmware = Firmware::create(array_merge(['version_tag' => $tag], $attributes));
        }

        if ($firmware->latest) {
            Firmware::where('id', '!=', $firmware->id)->update(['latest' => false]);
        }

        $this->info("Registered firmware '{$firmware->version_tag}' (id={$firmware->id}).");
        $this->line("  storage_location: {$firmware->storage_location}");
        $this->line('  size:             '.number_format(filesize($file)).' bytes');
        $this->line('  latest:           '.($firmware->latest ? 'yes' : 'no'));
        $this->newLine();
        $this->line('Assign it to a device from the Device configure page, or run:');
        $this->line("  php artisan trmnl:firmware:update  # then pick '{$firmware->version_tag}'");

        return self::SUCCESS;
    }
}
