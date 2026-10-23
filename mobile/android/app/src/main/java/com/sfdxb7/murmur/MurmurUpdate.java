package com.sfdxb7.murmur;

import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.widget.Toast;
import androidx.core.app.NotificationCompat;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Updates for the app itself, with no store: twice a day at most, it asks
 * GitHub for this fork's latest release (android.yml publishes one per build,
 * tagged android-N, versionCode N0). A newer one gets a notification; tapping
 * it downloads murmur.apk and hands it to Android's installer, which asks the
 * person to confirm. Android only installs it over this app if it's signed with
 * the same release key, so a tampered download can't replace it.
 *
 * Most of Murmur needs no update here at all: the app shows Murmur from its
 * server, so the server's updates arrive on their own. Only the app's own
 * changes (notifications, the back gesture…) come this way.
 */
final class MurmurUpdate {

    private static final String TAG = "MurmurUpdate";
    private static final String RELEASES = "https://api.github.com/repos/sfdxb7/murmur/releases/latest";
    private static final String PREFS = "murmur";
    private static final String CHECKED = "update-checked";
    private static final long EVERY_MS = 12 * 60 * 60 * 1000L;
    private static final String CHANNEL = "updates";
    private static final int NOTE = 7;
    private static final ExecutorService NETWORK = Executors.newSingleThreadExecutor();

    private MurmurUpdate() {}

    /** On every start: asks GitHub, unless it did in the last 12 hours. */
    static void check(Context context) {
        long last = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong(CHECKED, 0);
        if (System.currentTimeMillis() - last < EVERY_MS) return;
        NETWORK.execute(() -> {
            try {
                Release release = latest();
                context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putLong(CHECKED, System.currentTimeMillis()).apply();
                if (release != null && release.versionCode > installed(context)) announce(context, release);
            } catch (Exception e) {
                Log.i(TAG, "Couldn't check for an update: " + e.getMessage());
            }
        });
    }

    /** From the notification: download the newest release and open Android's installer on it. */
    static void install(Activity activity) {
        // Android asks once whether Murmur may install apps; until then, its settings page.
        if (Build.VERSION.SDK_INT >= 26 && !activity.getPackageManager().canRequestPackageInstalls()) {
            Toast.makeText(activity, "Allow Murmur to install updates, then tap the update again.", Toast.LENGTH_LONG).show();
            activity.startActivity(
                new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.getPackageName()))
            );
            return;
        }
        Toast.makeText(activity, "Downloading the update…", Toast.LENGTH_SHORT).show();
        NETWORK.execute(() -> {
            try {
                Release release = latest();
                if (release == null) throw new Exception("no release");
                File apk = download(activity, release.apk);
                Uri uri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".fileprovider", apk);
                Intent installer = new Intent(Intent.ACTION_VIEW)
                    .setDataAndType(uri, "application/vnd.android.package-archive")
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                new Handler(Looper.getMainLooper()).post(() -> activity.startActivity(installer));
            } catch (Exception e) {
                Log.w(TAG, "Update failed: " + e.getMessage());
                new Handler(Looper.getMainLooper()).post(() ->
                    Toast.makeText(activity, "Couldn't download the update. Try again later.", Toast.LENGTH_LONG).show()
                );
            }
        });
    }

    private static final class Release {
        final int versionCode;
        final String apk;

        Release(int versionCode, String apk) {
            this.versionCode = versionCode;
            this.apk = apk;
        }
    }

    /** The latest release with an APK, or null. Its tag says its build: android-N is versionCode N0 (android.yml). */
    private static Release latest() throws Exception {
        JSONObject release = new JSONObject(read(RELEASES));
        String tag = release.optString("tag_name");
        if (!tag.matches("android-\\d+")) return null;
        JSONArray assets = release.optJSONArray("assets");
        for (int i = 0; assets != null && i < assets.length(); i++) {
            JSONObject asset = assets.getJSONObject(i);
            String url = asset.optString("browser_download_url");
            if ("murmur.apk".equals(asset.optString("name")) && url.startsWith("https://github.com/")) {
                return new Release(Integer.parseInt(tag.substring("android-".length()) + "0"), url);
            }
        }
        return null;
    }

    private static long installed(Context context) throws Exception {
        android.content.pm.PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
        return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
    }

    private static void announce(Context context, Release release) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(new NotificationChannel(CHANNEL, "App updates", NotificationManager.IMPORTANCE_DEFAULT));
        }
        Intent open = new Intent(context, MainActivity.class).setAction(MainActivity.UPDATE).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap = PendingIntent.getActivity(context, NOTE, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        manager.notify(
            NOTE,
            new NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_murmur)
                .setContentTitle("Murmur update available")
                .setContentText("Tap to install the new version of the app.")
                .setContentIntent(tap)
                .setAutoCancel(true)
                .build()
        );
    }

    private static String read(String url) throws Exception {
        HttpURLConnection connection = open(url, "application/vnd.github+json");
        try (InputStream in = connection.getInputStream()) {
            java.io.ByteArrayOutputStream text = new java.io.ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            for (int n; (n = in.read(chunk)) > 0; ) text.write(chunk, 0, n);
            return text.toString("UTF-8");
        } finally {
            connection.disconnect();
        }
    }

    private static File download(Context context, String url) throws Exception {
        File dir = new File(context.getCacheDir(), "updates");
        if (!dir.isDirectory() && !dir.mkdirs()) throw new Exception("no room for the download");
        File apk = new File(dir, "murmur.apk");
        HttpURLConnection connection = open(url, "application/octet-stream");
        try (InputStream in = connection.getInputStream(); FileOutputStream out = new FileOutputStream(apk)) {
            byte[] chunk = new byte[64 * 1024];
            for (int n; (n = in.read(chunk)) > 0; ) out.write(chunk, 0, n);
        } finally {
            connection.disconnect();
        }
        return apk;
    }

    private static HttpURLConnection open(String url, String accept) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(15_000);
        connection.setReadTimeout(60_000);
        connection.setRequestProperty("Accept", accept);
        int status = connection.getResponseCode();
        if (status >= 400) throw new Exception("GitHub answered " + status);
        return connection;
    }
}
