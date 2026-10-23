package com.sfdxb7.murmur;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** Sent by the "Change address" shortcut (res/xml/shortcuts.xml). */
    static final String CHANGE_ADDRESS = "com.sfdxb7.murmur.CHANGE_ADDRESS";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Back steps through Murmur's own screens (its router listens for popstate);
        // only from the first one does it leave the app, as Android would.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = bridge.getWebView();
                if (webView.canGoBack()) {
                    webView.goBack();
                    return;
                }
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Back to the bundled page (www/index.html), which shows its form instead of opening the saved address.
        if (bridge != null && intent != null && CHANGE_ADDRESS.equals(intent.getAction())) {
            bridge.getWebView().loadUrl(bridge.getLocalUrl() + "/?change");
        }
    }
}
