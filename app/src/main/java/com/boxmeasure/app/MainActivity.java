package com.boxmeasure.app;

import android.app.Activity;
import android.os.Bundle;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER = 41;
    private static final int EXPORT_FILE = 42;

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private Uri pendingCameraUri;
    private String pendingExportContent;
    private String pendingExportMime;
    private String pendingExportName;

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
        webView.addJavascriptInterface(new AndroidBridge(this), "AndroidBridge");

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;

                String[] accepts = params != null ? params.getAcceptTypes() : null;
                String primaryType = choosePrimaryMime(accepts);
                boolean wantsImage = isImageRequest(accepts, primaryType);

                Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                picker.addCategory(Intent.CATEGORY_OPENABLE);
                picker.setType(primaryType);
                String[] mimeTypes = cleanMimeTypes(accepts);
                if (mimeTypes.length > 1) picker.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes);

                Intent chooser = Intent.createChooser(picker, wantsImage ? "Take or choose photo" : "Choose inventory file");

                if (wantsImage) {
                    Intent camera = buildCameraIntent();
                    if (camera != null) chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camera});
                } else {
                    cleanupPendingCamera();
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

    private String choosePrimaryMime(String[] accepts) {
        if (accepts != null) {
            for (String a : accepts) {
                if (a == null) continue;
                a = a.trim();
                if (a.isEmpty()) continue;
                if (a.startsWith(".")) {
                    if (a.equalsIgnoreCase(".csv")) return "text/csv";
                    if (a.equalsIgnoreCase(".txt")) return "text/plain";
                    continue;
                }
                if (a.contains("/")) return a;
            }
        }
        return "*/*";
    }

    private String[] cleanMimeTypes(String[] accepts) {
        List<String> out = new ArrayList<>();
        if (accepts != null) {
            for (String a : accepts) {
                if (a == null) continue;
                a = a.trim();
                if (a.contains("/") && !out.contains(a)) out.add(a);
                else if (a.equalsIgnoreCase(".csv") && !out.contains("text/csv")) out.add("text/csv");
            }
        }
        return out.toArray(new String[0]);
    }

    private boolean isImageRequest(String[] accepts, String primary) {
        if (primary != null && primary.startsWith("image/")) return true;
        if (accepts != null) {
            for (String a : accepts) if (a != null && a.toLowerCase().contains("image")) return true;
        }
        return false;
    }

    private Intent buildCameraIntent() {
        Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        try {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, "boxmeasure_" + System.currentTimeMillis() + ".jpg");
            values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
            pendingCameraUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
            if (pendingCameraUri == null || camera.resolveActivity(getPackageManager()) == null) {
                cleanupPendingCamera();
                return null;
            }
            camera.putExtra(MediaStore.EXTRA_OUTPUT, pendingCameraUri);
            camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            return camera;
        } catch (Exception ignored) {
            cleanupPendingCamera();
            return null;
        }
    }

    public class AndroidBridge {
        private final Context context;

        AndroidBridge(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public void copyText(String label, String text) {
            ClipboardManager clipboard = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
            if (clipboard != null) clipboard.setPrimaryClip(ClipData.newPlainText(label == null ? "BoxMeasure" : label, text == null ? "" : text));
            runOnUiThread(() -> Toast.makeText(context, "Copied", Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public void exportText(String suggestedName, String mimeType, String content) {
            pendingExportName = sanitizeFileName(suggestedName);
            pendingExportMime = (mimeType == null || mimeType.trim().isEmpty()) ? "text/plain" : mimeType;
            pendingExportContent = content == null ? "" : content;

            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(pendingExportMime);
                intent.putExtra(Intent.EXTRA_TITLE, pendingExportName);
                try {
                    startActivityForResult(intent, EXPORT_FILE);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Could not open save dialog", Toast.LENGTH_LONG).show();
                    clearPendingExport();
                }
            });
        }

        @JavascriptInterface
        public String getVersion() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (Exception e) {
                return "1.2.0";
            }
        }
    }

    private String sanitizeFileName(String name) {
        String n = (name == null || name.trim().isEmpty()) ? "BoxMeasure-export.txt" : name.trim();
        return n.replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == FILE_CHOOSER) {
            if (fileCallback == null) return;
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
            return;
        }

        if (requestCode == EXPORT_FILE) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null && pendingExportContent != null) {
                Uri uri = data.getData();
                try (OutputStream out = getContentResolver().openOutputStream(uri, "w")) {
                    if (out == null) throw new IllegalStateException("No output stream");
                    out.write(pendingExportContent.getBytes(StandardCharsets.UTF_8));
                    out.flush();
                    Toast.makeText(this, "Export saved", Toast.LENGTH_SHORT).show();
                } catch (Exception e) {
                    Toast.makeText(this, "Export failed: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            }
            clearPendingExport();
        }
    }

    private void clearPendingExport() {
        pendingExportContent = null;
        pendingExportMime = null;
        pendingExportName = null;
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
        cleanupPendingCamera();
        clearPendingExport();
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
