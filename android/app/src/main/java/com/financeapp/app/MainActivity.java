package com.financeapp.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String APPOINTMENT_ALARM_CHANNEL_ID = "appointment-alarms-v2";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(FileDownloadPlugin.class);
        super.onCreate(savedInstanceState);
        createAppointmentAlarmChannel();
    }

    private void createAppointmentAlarmChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager manager = getSystemService(NotificationManager.class);
        NotificationChannel channel = new NotificationChannel(
            APPOINTMENT_ALARM_CHANNEL_ID,
            "Alarmas de agenda",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Alarmas sonoras prioritarias para citas programadas");
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[] { 0, 500, 180, 500, 180, 800 });
        channel.enableLights(true);
        channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);

        Uri soundUri = Uri.parse(
            ContentResolver.SCHEME_ANDROID_RESOURCE
                + "://"
                + getPackageName()
                + "/"
                + R.raw.appointment_alarm
        );
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setUsage(AudioAttributes.USAGE_ALARM)
            .build();
        channel.setSound(soundUri, audioAttributes);
        manager.createNotificationChannel(channel);
    }
}
