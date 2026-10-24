package com.sfdxb7.murmur;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {

    /** Sent by the "Change address" shortcut (res/xml/shortcuts.xml). */
    static final String CHANGE_ADDRESS = "com.sfdxb7.murmur.CHANGE_ADDRESS";
    /** Sent by a tapped notification, with the chat to open as "href" (MurmurPush). */
    static final String OPEN = "com.sfdxb7.murmur.OPEN";
    /** Sent by the "update available" notification (MurmurUpdate). */
    static final String UPDATE = "com.sfdxb7.murmur.UPDATE";

    private boolean pushSynced = false;
    /** A notification's chat, to open once Murmur has loaded beneath it. */
    private String pendingHref = null;

    /**
     * One step up in Murmur: an open sheet or dialog closes first; a chat goes to its agent's
     * chats, Settings' pages to Settings, any other screen Home. Answers "home" when already there.
     */
    private static final String UP =
        "(() => {" +
        "  if (document.querySelector('[role=\"dialog\"][data-state=\"open\"], [role=\"alertdialog\"][data-state=\"open\"]')) {" +
        "    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 'closed' }" +
        "  const p = location.pathname;" +
        "  const up = /^\\/chat\\/[^/]+\\/.+/.test(p) ? p.replace(/^\\/chat\\/([^/]+)\\/.*$/, '/chats/$1')" +
        "    : /^\\/settings\\/.+/.test(p) ? '/settings' : p === '/' ? null : '/';" +
        "  if (!up) return 'home';" +
        "  history.replaceState(null, '', up); dispatchEvent(new PopStateEvent('popstate')); return 'up'" +
        "})()";

    /** Out of the app, as Android's own Back would. */
    private void leave(OnBackPressedCallback callback) {
        callback.setEnabled(false);
        getOnBackPressedDispatcher().onBackPressed();
        callback.setEnabled(true);
    }

    /**
     * Opens a chat inside Murmur without reloading it, with its agent's chat list beneath
     * (as Murmur's own back arrow goes), so Back steps to that list and then Home.
     */
    private static void goTo(WebView webView, String href) {
        String list = href.matches("^/chat/[^/]+/.+") ? href.replaceFirst("^/chat/([^/]+)/.*$", "/chats/$1") : null;
        String js = (list != null ? "history.pushState(null, '', " + org.json.JSONObject.quote(list) + "); " : "")
            + "history.pushState(null, '', " + org.json.JSONObject.quote(href) + "); dispatchEvent(new PopStateEvent('popstate'))";
        webView.evaluateJavascript(js, null);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Back goes up Murmur's own screens, as its back arrow does (UP below), rather than through
        // the WebView's history: entries a page adds without a tap, like a notification's chat, are
        // skipped by Back in Chromium. Only from Home does it leave the app, as Android would.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = bridge.getWebView();
                String url = webView.getUrl();
                String server = MurmurPush.server(MainActivity.this);
                // Off Murmur (a sign-in page an app opened, say): that page's own history first.
                if (server == null || url == null || !url.startsWith(server + "/")) {
                    if (url != null && !url.startsWith("https://localhost") && webView.canGoBack()) webView.goBack();
                    else leave(this);
                    return;
                }
                webView.evaluateJavascript(UP, (result) -> {
                    if (result == null || "\"home\"".equals(result) || "null".equals(result)) leave(this);
                });
            }
        });
        // Only Murmur itself opens in the app, where its pages reach the app's native side: any other
        // page (a link in a reply, an app's sign-in) goes to the browser. The bundled setup page may
        // open whatever address the person typed, which then becomes Murmur's (MurmurPush.rememberServer).
        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String scheme = url.getScheme();
                String server = MurmurPush.server(MainActivity.this);
                String from = view.getUrl();
                boolean ours = !request.isForMainFrame()
                    || "data".equals(scheme) || "blob".equals(scheme)
                    || "localhost".equals(url.getHost())
                    || (from != null && from.startsWith("https://localhost"))
                    || (server != null && url.toString().startsWith(server + "/"));
                if (ours) return super.shouldOverrideUrlLoading(view, request);
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (Exception e) {
                    // Nothing to open it with: stay put.
                }
                return true;
            }
        });
        // Once Murmur itself has loaded (signed in or not), keep its address and set up push once per launch.
        bridge.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                MurmurPush.rememberServer(MainActivity.this, webView.getUrl());
                String server = MurmurPush.server(MainActivity.this);
                if (pendingHref != null && server != null && webView.getUrl().startsWith(server + "/")) {
                    goTo(webView, pendingHref);
                    pendingHref = null;
                }
                if (!pushSynced && MurmurPush.server(MainActivity.this) != null && !webView.getUrl().startsWith("https://localhost")) {
                    pushSynced = true;
                    MurmurPush.sync(MainActivity.this);
                }
            }
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        MurmurPush.onScreen = true;
        MurmurUpdate.check(this);
    }

    @Override
    public void onPause() {
        super.onPause();
        MurmurPush.onScreen = false;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (bridge == null || intent == null) return;
        if (UPDATE.equals(intent.getAction())) MurmurUpdate.install(this);
        // Back to the bundled page (www/index.html), which shows its form instead of opening the saved address.
        if (CHANGE_ADDRESS.equals(intent.getAction())) {
            bridge.getWebView().loadUrl(bridge.getLocalUrl() + "/?change");
        }
        // A notification's chat, on the Murmur it came from.
        String server = MurmurPush.server(this);
        String href = intent.getStringExtra("href");
        if (OPEN.equals(intent.getAction()) && server != null && href != null && href.startsWith("/")) {
            WebView webView = bridge.getWebView();
            String at = webView.getUrl();
            if (at != null && at.startsWith(server + "/")) {
                // Already open: go there the way Murmur's own links do, without reloading it.
                goTo(webView, href);
            } else {
                // Not open yet: Murmur first, then the chat on top of it, so Back has somewhere to go.
                pendingHref = href;
                webView.loadUrl(server + "/");
            }
        }
    }
}
