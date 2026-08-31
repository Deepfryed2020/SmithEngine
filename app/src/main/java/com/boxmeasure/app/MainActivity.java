package com.boxmeasure.app;

import android.app.Activity;
import android.os.Bundle;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER = 41;
    private static final int EXPORT_FILE = 42;
    private static final int INVENTORY_FILE = 43;
    private static final int MAX_IMPORT_BYTES = 12 * 1024 * 1024;

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private Uri pendingCameraUri;
    private String pendingExportContent;
    private String pendingExportMime;
    private String pendingExportName;
    private String pendingImportName;
    private String pendingImportMime;
    private String pendingImportBase64;

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
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.clearCache(true);

        webView.addJavascriptInterface(new AndroidBridge(this), "AndroidBridge");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                view.evaluateJavascript(
                    "(function(){" +
                    "if(!document.getElementById('bm-bootstrap134-script')){" +
                    "var s=document.createElement('script');" +
                    "s.id='bm-bootstrap134-script';" +
                    "s.async=false;" +
                    "s.src='file:///android_asset/bootstrap134.js';" +
                    "document.head.appendChild(s);}" +
                    "})();",
                    null
                );
                view.postDelayed(() -> deliverPendingImport(0), 500);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;

                String[] accepts = params != null ? params.getAcceptTypes() : null;
                boolean wantsImage = isImageRequest(accepts);

                Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                picker.addCategory(Intent.CATEGORY_OPENABLE);
                picker.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                picker.setType(wantsImage ? "image/*" : "*/*");

                Intent chooser = Intent.createChooser(picker, wantsImage ? "Take or choose photo" : "Choose file");
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
        handleIncomingIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
        if (webView != null) webView.postDelayed(() -> deliverPendingImport(0), 100);
    }

    private boolean isImageRequest(String[] accepts) {
        if (accepts == null) return false;
        for (String raw : accepts) {
            if (raw == null) continue;
            String[] parts = raw.toLowerCase().split(",");
            for (String a : parts) {
                a = a.trim();
                if (a.startsWith("image/") || a.equals(".jpg") || a.equals(".jpeg") || a.equals(".png") || a.equals(".webp")) return true;
            }
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

    private void openNativeInventoryPicker() {
        Intent picker = new Intent(Intent.ACTION_GET_CONTENT);
        picker.addCategory(Intent.CATEGORY_OPENABLE);
        picker.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        picker.setType("*/*");
        try {
            startActivityForResult(Intent.createChooser(picker, "Choose inventory file — all files"), INVENTORY_FILE);
        } catch (Exception e) {
            Toast.makeText(this, "Could not open Files", Toast.LENGTH_LONG).show();
        }
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent == null) return;
        Uri uri = null;
        if (Intent.ACTION_SEND.equals(intent.getAction())) {
            try { uri = intent.getParcelableExtra(Intent.EXTRA_STREAM); } catch (Exception ignored) {}
        } else if (Intent.ACTION_VIEW.equals(intent.getAction())) {
            uri = intent.getData();
        }
        if (uri != null) preparePendingImport(uri);
    }

    private void preparePendingImport(Uri uri) {
        try {
            byte[] bytes = readImportBytes(uri);
            pendingImportName = queryDisplayName(uri);
            if (pendingImportName == null || pendingImportName.trim().isEmpty()) pendingImportName = "inventory-file";
            pendingImportMime = getContentResolver().getType(uri);
            if (pendingImportMime == null || pendingImportMime.trim().isEmpty()) pendingImportMime = "application/octet-stream";
            pendingImportBase64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
        } catch (Exception e) {
            clearPendingImport();
            Toast.makeText(this, "Could not read inventory file: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private byte[] readImportBytes(Uri uri) throws Exception {
        try (InputStream in = getContentResolver().openInputStream(uri); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            if (in == null) throw new IllegalStateException("No input stream");
            byte[] buf = new byte[16384];
            int total = 0;
            int n;
            while ((n = in.read(buf)) != -1) {
                total += n;
                if (total > MAX_IMPORT_BYTES) throw new IllegalArgumentException("File is larger than 12 MB");
                out.write(buf, 0, n);
            }
            return out.toByteArray();
        }
    }

    private String queryDisplayName(Uri uri) {
        Cursor c = null;
        try {
            c = getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null);
            if (c != null && c.moveToFirst()) {
                int i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (i >= 0) return c.getString(i);
            }
        } catch (Exception ignored) {
        } finally {
            if (c != null) c.close();
        }
        return uri.getLastPathSegment();
    }

    private void deliverPendingImport(int attempt) {
        if (webView == null || pendingImportBase64 == null) return;
        String script = "(function(){if(!window.__bm134Ready||!window.BoxMeasureNativeImport||!window.BoxMeasureNativeImport.receiveBase64)return false;" +
            "return window.BoxMeasureNativeImport.receiveBase64(" +
            JSONObject.quote(pendingImportName) + "," + JSONObject.quote(pendingImportMime) + "," + JSONObject.quote(pendingImportBase64) + ");})()";
        webView.evaluateJavascript(script, result -> {
            if ("true".equals(result)) {
                clearPendingImport();
            } else if (attempt < 24 && webView != null) {
                webView.postDelayed(() -> deliverPendingImport(attempt + 1), 250);
            }
        });
    }

    public class AndroidBridge {
        private final Context context;
        AndroidBridge(Context context) { this.context = context; }

        @JavascriptInterface
        public void openInventoryPicker() {
            runOnUiThread(() -> openNativeInventoryPicker());
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
                try { startActivityForResult(intent, EXPORT_FILE); }
                catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Could not open save dialog", Toast.LENGTH_LONG).show();
                    clearPendingExport();
                }
            });
        }

        @JavascriptInterface
        public String getVersion() {
            try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; }
            catch (Exception e) { return "1.3.4"; }
        }
    }

    private String sanitizeFileName(String name) {
        String n = (name == null || name.trim().isEmpty()) ? "BoxMeasure-export.txt" : name.trim();
        return n.replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == INVENTORY_FILE) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                preparePendingImport(data.getData());
                deliverPendingImport(0);
            }
            return;
        }

        if (requestCode == FILE_CHOOSER) {
            if (fileCallback == null) return;
            Uri chosen = null;
            if (resultCode == RESULT_OK) {
                if (data != null && data.getData() != null) chosen = data.getData();
                else if (pendingCameraUri != null) chosen = pendingCameraUri;
            }
            if (chosen != null) fileCallback.onReceiveValue(new Uri[]{chosen}); else fileCallback.onReceiveValue(null);
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

    private void clearPendingImport() {
        pendingImportName = null;
        pendingImportMime = null;
        pendingImportBase64 = null;
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
        if (webView != null && webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (fileCallback != null) { fileCallback.onReceiveValue(null); fileCallback = null; }
        cleanupPendingCamera();
        clearPendingImport();
        clearPendingExport();
        if (webView != null) { webView.destroy(); webView = null; }
        super.onDestroy();
    }
}
