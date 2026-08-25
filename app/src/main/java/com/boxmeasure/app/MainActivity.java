package com.boxmeasure.app;

import android.app.Activity;
import android.os.Bundle;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.provider.MediaStore;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER = 41;
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private Uri pendingCameraUri;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;

                Intent gallery = new Intent(Intent.ACTION_GET_CONTENT);
                gallery.addCategory(Intent.CATEGORY_OPENABLE);
                gallery.setType("image/*");

                Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                try {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Images.Media.DISPLAY_NAME, "boxmeasure_" + System.currentTimeMillis() + ".jpg");
                    values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                    pendingCameraUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                    if (pendingCameraUri != null) {
                        camera.putExtra(MediaStore.EXTRA_OUTPUT, pendingCameraUri);
                        camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                    }
                } catch (Exception ignored) {
                    pendingCameraUri = null;
                }

                Intent chooser = Intent.createChooser(gallery, "Take or choose photo");
                if (camera.resolveActivity(getPackageManager()) != null && pendingCameraUri != null) {
                    chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camera});
                }
                try {
                    startActivityForResult(chooser, FILE_CHOOSER);
                    return true;
                } catch (Exception e) {
                    cleanupPendingCamera();
                    fileCallback.onReceiveValue(null);
                    fileCallback = null;
                    return true;
                }
            }
        });

        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER || fileCallback == null) return;

        Uri chosen = null;
        if (resultCode == RESULT_OK) {
            if (data != null && data.getData() != null) chosen = data.getData();
            else if (pendingCameraUri != null) chosen = pendingCameraUri;
        }

        if (chosen != null) fileCallback.onReceiveValue(new Uri[]{chosen});
        else fileCallback.onReceiveValue(null);

        if (pendingCameraUri != null && (chosen == null || !pendingCameraUri.equals(chosen))) cleanupPendingCamera();
        pendingCameraUri = null;
        fileCallback = null;
    }

    private void cleanupPendingCamera() {
        if (pendingCameraUri != null) {
            try { getContentResolver().delete(pendingCameraUri, null, null); } catch (Exception ignored) {}
            pendingCameraUri = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (fileCallback != null) {
            fileCallback.onReceiveValue(null);
            fileCallback = null;
        }
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
