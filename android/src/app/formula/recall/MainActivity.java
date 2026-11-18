package app.formula.recall;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.view.View;
import android.webkit.*;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.UUID;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.net.ssl.HttpsURLConnection;

public final class MainActivity extends Activity {
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;
    private String exportContent;
    private SharedPreferences prefs;
    private SharedPreferences progress;
    private static final int PICK_PHOTO = 201, SAVE_BACKUP = 202;
    private static final String ORIGIN = "https://appassets.androidplatform.net/";

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        prefs = getSharedPreferences("settings", MODE_PRIVATE);
        progress = getSharedPreferences("progress", MODE_PRIVATE);
        getWindow().setStatusBarColor(Color.rgb(250, 247, 240));
        getWindow().setNavigationBarColor(Color.rgb(246, 240, 229));
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | (Build.VERSION.SDK_INT >= 26 ? View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : 0));
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(250, 247, 240));
        web.setOnApplyWindowInsetsListener((v, insets) -> {
            v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        setContentView(web);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setTextZoom(100);
        settings.setMediaPlaybackRequiresUserGesture(true);
        CookieManager.getInstance().setAcceptCookie(false);
        WebView.setWebContentsDebuggingEnabled(true); // Local demo build, for Android runtime verification.
        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (!"appassets.androidplatform.net".equals(u.getHost())) return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
                String path = u.getPath();
                if (path == null || path.contains("..")) return null;
                path = path.substring(1);
                try {
                    String mime = path.endsWith(".html") ? "text/html" : path.endsWith(".mjs") || path.endsWith(".js") ? "application/javascript" : path.endsWith(".css") ? "text/css" : path.endsWith(".svg") ? "image/svg+xml" : path.endsWith(".woff2") ? "font/woff2" : path.endsWith(".woff") ? "font/woff" : "application/octet-stream";
                    return new WebResourceResponse(mime, "UTF-8", getAssets().open(path));
                } catch (IOException error) {
                    return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream("Not found".getBytes(StandardCharsets.UTF_8)));
                }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                return !r.getUrl().toString().startsWith(ORIGIN);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                boolean jsonFile = false;
                for (String accepted : params.getAcceptTypes()) {
                    if (accepted.contains("json") || accepted.contains("text/plain") || accepted.contains(".txt")) jsonFile = true;
                }
                Intent gallery = new Intent(Intent.ACTION_GET_CONTENT);
                gallery.setType(jsonFile ? "*/*" : "image/*"); gallery.addCategory(Intent.CATEGORY_OPENABLE);
                // JSON providers use different MIME labels. Validate the selected
                // file's size and strict JSON content in the app after selection.
                gallery.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, !jsonFile && params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                Intent chooser = Intent.createChooser(gallery, jsonFile ? "选择 JSON 或 TXT 文件" : "拍照或选择照片");
                cameraUri = null;
                Intent camera = new Intent("android.media.action.IMAGE_CAPTURE");
                if (!jsonFile && camera.resolveActivity(getPackageManager()) != null) {
                    cameraUri = Uri.parse("content://app.formula.recall.photos/capture-" + UUID.randomUUID() + ".jpg");
                    camera.putExtra("output", cameraUri);
                    camera.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    camera.setClipData(ClipData.newRawUri("photo", cameraUri));
                    chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camera});
                }
                try { startActivityForResult(chooser, PICK_PHOTO); }
                catch (Exception ex) { fileCallback.onReceiveValue(null); fileCallback = null; }
                return true;
            }
        });
        web.loadUrl(ORIGIN + "index.html");
    }

    @Override public void onBackPressed() { web.evaluateJavascript("window.onAndroidBack && window.onAndroidBack()", null); }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == PICK_PHOTO && fileCallback != null) {
            Uri[] uris = null;
            if (result == RESULT_OK) {
                if (data != null && data.getClipData() != null) {
                    ClipData clip = data.getClipData(); uris = new Uri[Math.min(8, clip.getItemCount())];
                    for (int i = 0; i < uris.length; i++) uris[i] = clip.getItemAt(i).getUri();
                } else if (data != null && data.getData() != null) uris = new Uri[]{data.getData()};
                else if (cameraUri != null) uris = new Uri[]{cameraUri};
            }
            fileCallback.onReceiveValue(uris); fileCallback = null; cameraUri = null;
        }
        if (request == SAVE_BACKUP && result == RESULT_OK && data != null && exportContent != null) {
            try (OutputStream output = getContentResolver().openOutputStream(data.getData())) {
                output.write(exportContent.getBytes(StandardCharsets.UTF_8));
                Toast.makeText(this, "备份已保存", Toast.LENGTH_SHORT).show();
            } catch (IOException ex) { Toast.makeText(this, "备份保存失败", Toast.LENGTH_SHORT).show(); }
            finally { exportContent = null; }
        }
    }
    private SecretKey storageKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (!store.containsAlias("liushi-api")) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder("liushi-api", KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            generator.generateKey();
        }
        return ((KeyStore.SecretKeyEntry)store.getEntry("liushi-api", null)).getSecretKey();
    }
    private String getApiKey() throws Exception {
        String encrypted = prefs.getString("key", ""); if (encrypted.isEmpty()) return "";
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, storageKey(), new GCMParameterSpec(128, Base64.decode(prefs.getString("iv", ""), Base64.NO_WRAP)));
        return new String(cipher.doFinal(Base64.decode(encrypted, Base64.NO_WRAP)), StandardCharsets.UTF_8);
    }
    private void respond(String id, boolean success, String payload) {
        runOnUiThread(() -> web.evaluateJavascript("window.onNativeResult(" + JSONObject.quote(id) + "," + success + "," + JSONObject.quote(payload) + ")", null));
    }
    private final class Bridge {
        @JavascriptInterface public String loadProgress() { return progress.getString("state", ""); }
        @JavascriptInterface public void saveProgress(String json) throws IOException {
            if (json == null || json.length() > 12 * 1024 * 1024) throw new IOException("Progress data is too large");
            if (!progress.edit().putString("state", json).commit()) throw new IOException("Unable to persist progress");
        }
        @JavascriptInterface public String getSettings() {
            JSONObject data = new JSONObject();
            try { data.put("endpoint", prefs.getString("endpoint", "")); data.put("model", prefs.getString("model", "")); data.put("hasKey", !prefs.getString("key", "").isEmpty()); }
            catch (Exception ignored) {}
            return data.toString();
        }
        @JavascriptInterface public void saveSettings(String input) throws Exception {
            JSONObject data = new JSONObject(input);
            SharedPreferences.Editor edit = prefs.edit().putString("endpoint", data.optString("endpoint")).putString("model", data.optString("model"));
            String key = data.optString("key");
            if (!key.isEmpty()) {
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, storageKey());
                edit.putString("key", Base64.encodeToString(cipher.doFinal(key.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP));
                edit.putString("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP));
            }
            if (!edit.commit()) throw new IOException("Unable to persist settings");
        }
        @JavascriptInterface public void recognize(String id, String payload) {
            new Thread(() -> {
                HttpsURLConnection connection = null;
                try {
                    JSONObject input = new JSONObject(payload);
                    URL endpoint = new URL(prefs.getString("endpoint", ""));
                    if (!"https".equals(endpoint.getProtocol()) || !endpoint.getPath().endsWith("/chat/completions")) throw new IOException("请配置有效的 HTTPS 视觉接口");
                    String apiKey = getApiKey(); if (apiKey.isEmpty()) throw new IOException("请先填写 API Key");
                    JSONArray messages = new JSONArray();
                    if (input.has("messages")) {
                        JSONArray source = input.getJSONArray("messages");
                        if (source.length() < 1 || source.length() > 20) throw new IOException("对话消息数量无效");
                        int total = 0;
                        for (int i = 0; i < source.length(); i++) {
                            JSONObject m = source.getJSONObject(i);
                            String role = m.getString("role"), content = m.getString("content");
                            if (!role.equals("system") && !role.equals("user") && !role.equals("assistant")) throw new IOException("对话角色无效");
                            total += content.length();
                            if (content.isEmpty() || content.length() > 40000 || total > 256000) throw new IOException("对话内容过长，请缩短后重试");
                            messages.put(new JSONObject().put("role", role).put("content", content));
                        }
                    } else {
                        messages.put(new JSONObject().put("role", "user").put("content", input.getString("prompt")));
                    }
                    JSONObject last = messages.getJSONObject(messages.length() - 1);
                    if (!last.getString("role").equals("user")) throw new IOException("对话必须以用户消息结尾");
                    if (input.has("image")) {
                        String data = input.getString("image");
                        if (!data.matches("(?s)^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=\\r\\n]+$") || data.length() > 8 * 1024 * 1024) throw new IOException("图片格式或大小无效");
                        JSONObject image = new JSONObject().put("type", "image_url").put("image_url", new JSONObject().put("url", data));
                        JSONObject text = new JSONObject().put("type", "text").put("text", last.getString("content"));
                        last.put("content", new JSONArray().put(text).put(image));
                    }
                    JSONObject body = new JSONObject().put("model", prefs.getString("model", "")).put("messages", messages).put("temperature", 0.1).put("max_tokens", 7000).put("response_format", new JSONObject().put("type", "json_object"));
                    connection = (HttpsURLConnection) endpoint.openConnection();
                    connection.setConnectTimeout(20000); connection.setReadTimeout(90000); connection.setInstanceFollowRedirects(false);
                    connection.setRequestMethod("POST"); connection.setDoOutput(true);
                    connection.setRequestProperty("Authorization", "Bearer " + apiKey);
                    connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                    try (OutputStream out = connection.getOutputStream()) { out.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
                    int status = connection.getResponseCode();
                    if (status < 200 || status >= 300) throw new IOException("识别服务返回 HTTP " + status + "，请检查接口、模型与 Key");
                    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                    try (InputStream in = connection.getInputStream()) { byte[] buffer = new byte[8192]; int count; while ((count = in.read(buffer)) != -1) { bytes.write(buffer, 0, count); if (bytes.size() > 2 * 1024 * 1024) throw new IOException("识别结果过大"); } }
                    JSONObject response = new JSONObject(bytes.toString("UTF-8"));
                    JSONObject choice = response.getJSONArray("choices").getJSONObject(0);
                    JSONObject message = choice.getJSONObject("message");
                    String content = message.isNull("content") ? "" : message.getString("content").trim();
                    String finishReason = choice.optString("finish_reason", "");
                    if (content.isEmpty()) throw new IOException("模型返回为空，请重试、减少单张内容或改用 JSON 导入");
                    if (input.has("image") && !input.has("messages")) {
                        // Preserve the raw photo reply so the UI can validate each
                        // item and recover whole objects from an interrupted reply.
                        respond(id, true, new JSONObject().put("modelOutput", content).put("finishReason", finishReason).toString());
                        return;
                    }
                    if (finishReason.equals("length") || finishReason.equals("aborted") || finishReason.equals("insufficient_system_resource")) throw new IOException("模型回复未完成，原草稿已保留，请缩短指令后重试");
                    if (content.startsWith("```")) content = content.replaceFirst("^```(?:json)?\\s*", "").replaceFirst("\\s*```$", "");
                    try { new JSONObject(content); }
                    catch (org.json.JSONException malformed) { throw new IOException("模型返回的 JSON 格式有误，原草稿已保留，可重试或手动编辑"); }
                    respond(id, true, content);
                } catch (Exception ex) { respond(id, false, ex instanceof org.json.JSONException ? "识别服务返回格式异常，请重试" : ex.getMessage() == null ? "识别失败，请重试" : ex.getMessage()); }
                finally { if (connection != null) connection.disconnect(); }
            }, "photo-recognition").start();
        }
        @JavascriptInterface public void clearPhotos() {
            File[] files = getCacheDir().listFiles((dir, name) -> name.startsWith("capture-") && name.endsWith(".jpg"));
            if (files != null) for (File file : files) file.delete();
        }
        @JavascriptInterface public void copyText(String text) {
            if (text == null || text.length() > 64000) return;
            runOnUiThread(() -> { ClipboardManager clipboard = (ClipboardManager)getSystemService(CLIPBOARD_SERVICE); clipboard.setPrimaryClip(ClipData.newPlainText("Carmanline 识别提示词", text)); });
        }
        @JavascriptInterface public void exportBackup(String json) {
            exportContent = json;
            runOnUiThread(() -> { Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT); intent.setType("application/json"); intent.addCategory(Intent.CATEGORY_OPENABLE); intent.putExtra(Intent.EXTRA_TITLE, "Carmanline复习备份.json"); startActivityForResult(intent, SAVE_BACKUP); });
        }
        @JavascriptInterface public void closeApp() { runOnUiThread(() -> finish()); }
    }
}
