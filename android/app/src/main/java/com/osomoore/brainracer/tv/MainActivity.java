package com.osomoore.brainracer.tv;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;

public class MainActivity extends Activity {
    private static final String DEFAULT_URL = "https://osomoore.github.io/BrainRacer/";
    private static final String PREFS = "brainracer";
    private static final String PREF_URL = "url";
    private static final long STALE_MS = 10L * 60L * 1000L;

    private WebView webView;
    private String baseUrl = DEFAULT_URL;
    private boolean errorShowing = false;
    private long pausedAt = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setTextZoom(100);
        WebView.setWebContentsDebuggingEnabled(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false; // keep all navigation in the WebView
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                if (url != null && !url.startsWith("data:") && !url.equals("about:blank")) {
                    errorShowing = false;
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showError();
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse resp) {
                if (request.isForMainFrame() && resp.getStatusCode() >= 400) showError();
            }
        });
        webView.setWebChromeClient(new WebChromeClient());

        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.requestFocus();

        // Belt-and-braces: swallow predictive-back on API 33+ (see onBackPressed).
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, new OnBackInvokedCallback() {
                        @Override
                        public void onBackInvoked() { /* intentionally nothing */ }
                    });
        }

        baseUrl = loadSavedUrl();
        handleUrlExtra(getIntent());
        load();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (handleUrlExtra(intent)) load();
    }

    private String loadSavedUrl() {
        String u = getSharedPreferences(PREFS, MODE_PRIVATE).getString(PREF_URL, null);
        return (u == null || u.isEmpty()) ? DEFAULT_URL : u;
    }

    /** Applies the "url" intent extra. Returns true if the base URL changed. */
    private boolean handleUrlExtra(Intent intent) {
        if (intent == null) return false;
        String extra = intent.getStringExtra("url");
        if (extra == null || extra.isEmpty()) return false;
        SharedPreferences.Editor ed = getSharedPreferences(PREFS, MODE_PRIVATE).edit();
        String next;
        if (extra.equals("default")) {
            ed.remove(PREF_URL);
            next = DEFAULT_URL;
        } else {
            ed.putString(PREF_URL, extra);
            next = extra;
        }
        ed.apply();
        boolean changed = !next.equals(baseUrl);
        baseUrl = next;
        return changed;
    }

    private String freshUrl() {
        return Uri.parse(baseUrl).buildUpon()
                .appendQueryParameter("v", String.valueOf(System.currentTimeMillis()))
                .build().toString();
    }

    private void load() {
        errorShowing = false;
        webView.loadUrl(freshUrl());
    }

    private void showError() {
        errorShowing = true;
        String html = "<html><body style='margin:0;background:#0b1e4a;color:#fff;font-family:sans-serif;"
                + "display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;text-align:center'>"
                + "<div style='font-size:72px;font-weight:bold'>Can't reach BrainRacer</div>"
                + "<div style='font-size:40px;margin:40px;color:#ffd23f;word-break:break-all'>"
                + TextUtils.htmlEncode(baseUrl) + "</div>"
                + "<div style='font-size:52px'>Press A or OK to try again</div>"
                + "</body></html>";
        webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
    }

    @Override
    protected void onPause() {
        super.onPause();
        pausedAt = System.currentTimeMillis();
        webView.onPause();
        webView.pauseTimers();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        webView.resumeTimers();
        if (pausedAt != 0 && System.currentTimeMillis() - pausedAt > STALE_MS) load();
        pausedAt = 0;
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }
    }

    // Back / gamepad B: B is a real in-game button (red answer / back) that the page reads via
    // the Gamepad API. Android maps an unhandled B to KEYCODE_BACK, which would exit the app (or
    // flip some browsers into mouse mode). The focused WebView already got the event before the
    // Activity sees it, so here we only consume the leftover Back/B so nothing else acts on it.
    @Override
    public void onBackPressed() { /* intentionally nothing */ }

    // Gamepad Home/Guide: many controllers send BUTTON_MODE, which Android may turn into a
    // Home/Menu fallback when unhandled. Consuming it keeps kids in the game. A true
    // KEYCODE_HOME is handled by the system before apps see it, so that one can't be blocked here.
    private static boolean isBackish(int k) {
        return k == KeyEvent.KEYCODE_BACK || k == KeyEvent.KEYCODE_BUTTON_B
                || k == KeyEvent.KEYCODE_BUTTON_MODE;
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (isBackish(keyCode)) return true;
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public boolean onKeyLongPress(int keyCode, KeyEvent event) {
        if (isBackish(keyCode)) return true;
        return super.onKeyLongPress(keyCode, event);
    }

    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        if (isBackish(keyCode)) return true;
        if (errorShowing && (keyCode == KeyEvent.KEYCODE_BUTTON_A
                || keyCode == KeyEvent.KEYCODE_DPAD_CENTER
                || keyCode == KeyEvent.KEYCODE_ENTER
                || keyCode == KeyEvent.KEYCODE_BUTTON_START)) {
            load();
            return true;
        }
        return super.onKeyUp(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
