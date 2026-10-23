package com.sfdxb7.murmur;

import android.util.Log;
import org.unifiedpush.android.connector.FailedReason;
import org.unifiedpush.android.connector.PushService;
import org.unifiedpush.android.connector.data.PushEndpoint;
import org.unifiedpush.android.connector.data.PushMessage;

/** Where UnifiedPush delivers: new endpoints go to Murmur, messages (already decrypted) become notifications. See MurmurPush. */
public class PushServiceImpl extends PushService {

    @Override
    public void onNewEndpoint(PushEndpoint endpoint, String instance) {
        MurmurPush.subscribe(this, endpoint);
    }

    @Override
    public void onMessage(PushMessage message, String instance) {
        if (message.getDecrypted()) MurmurPush.show(this, message.getContent());
    }

    @Override
    public void onRegistrationFailed(FailedReason reason, String instance) {
        Log.w("MurmurPush", "Push registration failed: " + reason);
    }

    @Override
    public void onUnregistered(String instance) {
        Log.i("MurmurPush", "Push registration ended");
    }
}
