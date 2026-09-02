package com.boxmeasure.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.content.FileProvider;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

public final class MainActivity extends Activity {
    private static final int FILE_REQUEST = 1380;
    private static final int EXPORT_REQUEST = 1381;
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private Uri captureUri;
    private String pendingExport;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        webView = new WebView(this);
        setContentView(webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setDatabaseEnabled(true);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new Chrome());
        webView.addJavascriptInterface(new OcrBridge(), "AndroidOcr");
        webView.addJavascriptInterface(new ExportBridge(), "AndroidBridge");
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }

    private final class Chrome extends WebChromeClient {
        @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            Intent gallery = new Intent(Intent.ACTION_GET_CONTENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE);
            Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            try {
                File dir = new File(getCacheDir(), "captures");
                if (!dir.exists()) dir.mkdirs();
                File image = File.createTempFile("boxmeasure-sheet-", ".jpg", dir);
                captureUri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".files", image);
                camera.putExtra(MediaStore.EXTRA_OUTPUT, captureUri);
                camera.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } catch (Exception error) { camera = null; }
            Intent chooser = Intent.createChooser(gallery, "Choose or photograph sheet");
            if (camera != null) chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camera});
            startActivityForResult(chooser, FILE_REQUEST);
            return true;
        }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == EXPORT_REQUEST) {
            if (result == RESULT_OK && data != null && data.getData() != null && pendingExport != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData())) { if (out != null) out.write(pendingExport.getBytes(java.nio.charset.StandardCharsets.UTF_8)); }
                catch (Exception ignored) { }
            }
            pendingExport = null; return;
        }
        if (request != FILE_REQUEST || fileCallback == null) return;
        Uri selected = null;
        if (result == RESULT_OK) selected = data != null && data.getData() != null ? data.getData() : captureUri;
        fileCallback.onReceiveValue(selected == null ? null : new Uri[]{selected});
        fileCallback = null;
    }

    private final class OcrBridge {
        @JavascriptInterface public void recognizePaper(String dataUrl, String sourceName) {
            runOnUiThread(() -> recognize(dataUrl, sourceName));
        }
    }

    private final class ExportBridge {
        @JavascriptInterface public void exportText(String name, String mime, String content) {
            runOnUiThread(() -> {
                pendingExport = content;
                Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime).putExtra(Intent.EXTRA_TITLE, name);
                startActivityForResult(save, EXPORT_REQUEST);
            });
        }
    }

    private void recognize(String dataUrl, String sourceName) {
        js("paperOcrProgress", "30", quote("Decoding and normalising page…"));
        try {
            int comma = dataUrl.indexOf(',');
            byte[] bytes = Base64.decode(comma >= 0 ? dataUrl.substring(comma + 1) : dataUrl, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (bitmap == null) throw new IllegalArgumentException("Image could not be decoded");
            js("paperOcrProgress", "48", quote("Reading table text and numbers…"));
            TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
            recognizer.process(InputImage.fromBitmap(bitmap, 0))
                    .addOnSuccessListener(text -> {
                        try {
                            JSONObject result = parseTable(text, bitmap.getWidth(), bitmap.getHeight(), sourceName);
                            js("paperOcrComplete", quote(result.toString()));
                        } catch (Exception error) { js("paperOcrFailed", quote(error.getMessage())); }
                        recognizer.close();
                    })
                    .addOnFailureListener(error -> { js("paperOcrFailed", quote(error.getMessage())); recognizer.close(); });
        } catch (Exception error) { js("paperOcrFailed", quote(error.getMessage())); }
    }

    private static final class Token {
        String text; Rect box;
        Token(String text, Rect box) { this.text = text; this.box = box; }
        float cy() { return box.exactCenterY(); }
        float cx() { return box.exactCenterX(); }
    }

    private JSONObject parseTable(Text result, int width, int height, String sourceName) throws Exception {
        List<Token> tokens = new ArrayList<>();
        for (Text.TextBlock block : result.getTextBlocks()) for (Text.Line line : block.getLines()) {
            Rect box = line.getBoundingBox();
            if (box != null && box.top > height * .08f) tokens.add(new Token(line.getText().trim(), box));
        }
        Collections.sort(tokens, Comparator.comparingDouble(Token::cy));
        List<List<Token>> rows = new ArrayList<>();
        float rowTolerance = Math.max(12f, height * .012f);
        for (Token token : tokens) {
            List<Token> target = null;
            for (List<Token> row : rows) {
                float mean = 0; for (Token x : row) mean += x.cy(); mean /= row.size();
                if (Math.abs(mean - token.cy()) <= rowTolerance) { target = row; break; }
            }
            if (target == null) { target = new ArrayList<>(); rows.add(target); }
            target.add(token);
        }
        JSONArray output = new JSONArray(); int rowNumber = 0;
        for (List<Token> row : rows) {
            Collections.sort(row, Comparator.comparingDouble(Token::cx));
            String[] cells = new String[10]; for (int i=0;i<cells.length;i++) cells[i]="";
            for (Token token : row) {
                float x = token.cx() / width;
                int column = x < .105 ? 0 : x < .19 ? 1 : x < .47 ? 2 : x < .555 ? 3 : x < .64 ? 4 : x < .72 ? 5 : x < .80 ? 6 : x < .88 ? 7 : x < .955 ? 8 : 9;
                cells[column] = (cells[column] + " " + token.text).trim();
            }
            if (!looksLikeInventoryRow(cells)) continue;
            JSONObject item = new JSONObject();
            item.put("rowNumber", ++rowNumber); item.put("location", cleanLocation(cells[0])); item.put("sku", digits(cells[1]));
            item.put("description", cells[2]); item.put("packageLevel", cells[3].toLowerCase(Locale.ROOT).contains("unit") ? "Unit" : "Carton");
            item.put("grossWeightKg", decimal(cells[4])); item.put("lengthCm", decimal(cells[5])); item.put("widthCm", decimal(cells[6])); item.put("heightCm", decimal(cells[7]));
            item.put("netWeight", cells[8]); item.put("notes", cells[9]);
            JSONObject confidence = new JSONObject();
            confidence.put("location", cleanLocation(cells[0]).matches("[A-Z]-?\\d{1,3}-?[A-Z]") ? .94 : .48);
            confidence.put("sku", digits(cells[1]).length() >= 5 ? .94 : .45);
            confidence.put("grossWeightKg", decimal(cells[4]).isEmpty() ? .35 : .78);
            confidence.put("lengthCm", decimal(cells[5]).isEmpty() ? .35 : .78);
            confidence.put("widthCm", decimal(cells[6]).isEmpty() ? .35 : .78);
            confidence.put("heightCm", decimal(cells[7]).isEmpty() ? .35 : .78);
            item.put("cellConfidence", confidence);
            boolean ready = !decimal(cells[4]).isEmpty() && !decimal(cells[5]).isEmpty() && !decimal(cells[6]).isEmpty() && !decimal(cells[7]).isEmpty();
            item.put("confidence", ready ? .78 : .48); output.put(item);
        }
        JSONObject response = new JSONObject(); response.put("sourceName", sourceName); response.put("rows", output); return response;
    }

    private boolean looksLikeInventoryRow(String[] cells) {
        return cleanLocation(cells[0]).matches("[A-Z]-?\\d{1,3}-?[A-Z]") || digits(cells[1]).length() >= 5;
    }
    private String cleanLocation(String value) { return value.toUpperCase(Locale.ROOT).replaceAll("\\s+", "").replace('–','-'); }
    private String digits(String value) { return value.replaceAll("[^0-9]", ""); }
    private String decimal(String value) {
        String cleaned = value.replace(',', '.').replaceAll("[^0-9.]", "");
        int dot = cleaned.indexOf('.'); if (dot >= 0) cleaned = cleaned.substring(0,dot+1) + cleaned.substring(dot+1).replace(".","");
        return cleaned;
    }
    private String quote(String value) { return JSONObject.quote(value == null ? "Unknown error" : value); }
    private void js(String function, String... args) { runOnUiThread(() -> webView.evaluateJavascript(function + "(" + String.join(",", args) + ")", null)); }
}
