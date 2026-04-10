<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('devices', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable();
            $table->string('mac_address');
            $table->integer('default_refresh_interval')->default(900);
            $table->string('friendly_id')->nullable();
            $table->string('api_key')->nullable();
            $table->integer('last_rssi_level')->nullable();
            $table->double('last_battery_voltage')->nullable();
            $table->string('last_firmware_version')->nullable();
            $table->string('current_screen_image')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('devices');
    }
};
