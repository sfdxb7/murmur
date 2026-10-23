package com.sfdxb7.murmur;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.CookieManager;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;
import org.unifiedpush.android.connector.ConstantsKt;
import org.unifiedpush.android.connector.UnifiedPush;
import org.unifiedpush.android.connector.data.PushEndpoint;

/**
 * Push notifications, with nothing to install but this app.
 *
 * Murmur's server pushes with standard Web Push, signed with its own key
 * (server/push.ts). UnifiedPush's embedded FCM distributor asks Google's push
 * service on the phone for a Web Push endpoint tied to that key, the way Chrome
 * does for websites: no Firebase project, no relay, nothing secret in the app.
 * The app then hands Murmur that endpoint as a browser would hand its
 * PushSubscription, signed in with the WebView's own Murmur cookie, and shows
 * what arrives (PushServiceImpl).
 */
final class MurmurPush {

    private static final String TAG = "MurmurPush";
    private static final String PREFS = "murmur";
    private static final String SERVER = "server";
    private static final String CHANNEL = "murmur";
    private static final ExecutorService NETWORK = Executors.newSingleThreadExecutor();

    /** Whether the app is on screen: then Murmur itself is, and a note would only interrupt. */
    static volatile boolean onScreen = false;

    private MurmurPush() {}

    /** Murmur's address, kept whenever the WebView has it open (www/index.html keeps its own copy, out of reach here). */
    static void rememberServer(Context context, String url) {
        if (url == null || !url.matches("^https?://.*") || url.startsWith("https://localhost")) return;
        URL parsed;
        try {
            parsed = new URL(url);
        } catch (Exception e) {
            return;
        }
        String origin = parsed.getProtocol() + "://" + parsed.getAuthority();
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(SERVER, origin).apply();
    }

    static String server(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(SERVER, null);
    }

    /**
     * Once Murmur is open and signed in: ask for permission to notify (Android 13+), fetch
     * Murmur's key and register with it. On every start, so a new key or endpoint catches up;
     * Murmur says "Notifications are on" only the first time it hears of an endpoint.
     */
    static void sync(Activity activity) {
        String server = server(activity);
        if (server == null) return;
        NETWORK.execute(() -> {
            String key;
            try {
                JSONObject answer = new JSONObject(call(server, "GET", "/murmur/push", null));
                key = answer.getString("key");
            } catch (Exception e) {
                // Signed out, offline, or a Murmur from before push: try again next start.
                Log.i(TAG, "No push key from Murmur: " + e.getMessage());
                return;
            }
            new Handler(Looper.getMainLooper()).post(() -> {
                if (Build.VERSION.SDK_INT >= 33 &&
                    ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(activity, new String[] { Manifest.permission.POST_NOTIFICATIONS }, 1);
                }
                // Another UnifiedPush app the person already uses (ntfy…) if they chose one; else the one built in.
                UnifiedPush.tryUseCurrentOrDefaultDistributor(activity, (found) -> {
                    if (!found) UnifiedPush.saveDistributor(activity, activity.getPackageName());
                    UnifiedPush.register(activity, ConstantsKt.INSTANCE_DEFAULT, null, key);
                    return kotlin.Unit.INSTANCE;
                });
            });
        });
    }

    /** Hands a new endpoint to Murmur, shaped like a browser's PushSubscription.toJSON(). */
    static void subscribe(Context context, PushEndpoint endpoint) {
        String server = server(context);
        if (server == null || endpoint.getPubKeySet() == null) return;
        NETWORK.execute(() -> {
            try {
                JSONObject keys = new JSONObject()
                    .put("p256dh", endpoint.getPubKeySet().getPubKey())
                    .put("auth", endpoint.getPubKeySet().getAuth());
                call(server, "POST", "/murmur/push/subscribe", new JSONObject().put("endpoint", endpoint.getUrl()).put("keys", keys).toString());
            } catch (Exception e) {
                Log.w(TAG, "Murmur didn't take the push endpoint: " + e.getMessage());
            }
        });
    }

    /** A note from Murmur ({title, body, tag, href}, as the service worker reads it too). */
    static void show(Context context, byte[] content) {
        if (onScreen) return;
        JSONObject note;
        try {
            note = new JSONObject(new String(content, StandardCharsets.UTF_8));
        } catch (Exception e) {
            return;
        }
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(new NotificationChannel(CHANNEL, "Agents", NotificationManager.IMPORTANCE_HIGH));
        }
        String tag = note.optString("tag", "murmur");
        Intent open = new Intent(context, MainActivity.class)
            .setAction(MainActivity.OPEN)
            .putExtra("href", note.optString("href", "/"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap = PendingIntent.getActivity(context, tag.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        // One per chat (the tag), so a newer note about it replaces the last.
        manager.notify(
            tag,
            0,
            new NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_murmur)
                .setContentTitle(note.optString("title", "Murmur"))
                .setContentText(note.optString("body", ""))
                .setStyle(new NotificationCompat.BigTextStyle().bigText(note.optString("body", "")))
                .setContentIntent(tap)
                .setAutoCancel(true)
                .build()
        );
    }

    /** One call to Murmur's server, signed in as the WebView is. */
    private static String call(String server, String method, String path, String body) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(server + path).openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(15_000);
        connection.setReadTimeout(15_000);
        String cookie = CookieManager.getInstance().getCookie(server);
        if (cookie != null) connection.setRequestProperty("Cookie", cookie);
        if (body != null) {
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            try (OutputStream out = connection.getOutputStream()) {
                out.write(body.getBytes(StandardCharsets.UTF_8));
            }
        }
        int status = connection.getResponseCode();
        try (InputStream in = status < 400 ? connection.getInputStream() : connection.getErrorStream()) {
            ByteArrayOutputStream text = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            for (int n; in != null && (n = in.read(chunk)) > 0; ) text.write(chunk, 0, n);
            if (status >= 400) throw new Exception(status + " " + text);
            return text.toString(StandardCharsets.UTF_8.name());
        } finally {
            connection.disconnect();
        }
    }
}
