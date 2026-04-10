<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Correct the typo in render_markup_view for all plugin UUIDs
        $pluginUuids = [
            '9e46c6cf-358c-4bfe-8998-436b3a207fec', // ÖBB Departures
            '3b046eda-34e9-4232-b935-c33b989a284b', // Weather
            '21464b16-5f5a-4099-a967-f5c915e3da54', // Zen Quotes
            '8d472959-400f-46ee-afb2-4a9f1cfd521f', // This Day in History
            '4349fdad-a273-450b-aa00-3d32f2de788d', // Home Assistant
        ];

        foreach ($pluginUuids as $uuid) {
            DB::table('plugins')
                ->where('uuid', $uuid)
                ->update([
                    'render_markup_view' => DB::raw("REPLACE(render_markup_view, 'receipts.', 'recipes.')"),
                ]);
        }
    }

    public function down(): void
    {
        // Revert the typo correction if needed
        $pluginUuids = [
            '9e46c6cf-358c-4bfe-8998-436b3a207fec', // ÖBB Departures
            '3b046eda-34e9-4232-b935-c33b989a284b', // Weather
            '21464b16-5f5a-4099-a967-f5c915e3da54', // Zen Quotes
            '8d472959-400f-46ee-afb2-4a9f1cfd521f', // This Day in History
            '4349fdad-a273-450b-aa00-3d32f2de788d', // Home Assistant
        ];

        foreach ($pluginUuids as $uuid) {
            DB::table('plugins')
                ->where('uuid', $uuid)
                ->update([
                    'render_markup_view' => DB::raw("REPLACE(render_markup_view, 'recipes.', 'receipts.')"),
                ]);
        }
    }
};
