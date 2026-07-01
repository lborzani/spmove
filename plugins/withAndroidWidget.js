const {
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// ─── Kotlin source files ──────────────────────────────────────────────────────

const LINE_STATUS_WIDGET_KT = `package com.lborzani.spmove

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.graphics.Color
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray

class LineStatusWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        updateWidgets(context, appWidgetManager, appWidgetIds)
    }

    companion object {

        private data class RowIds(val row: Int, val num: Int, val name: Int, val status: Int)

        private val ROW_IDS = listOf(
            RowIds(R.id.row_0, R.id.num_0, R.id.name_0, R.id.status_0),
            RowIds(R.id.row_1, R.id.num_1, R.id.name_1, R.id.status_1),
            RowIds(R.id.row_2, R.id.num_2, R.id.name_2, R.id.status_2),
            RowIds(R.id.row_3, R.id.num_3, R.id.name_3, R.id.status_3),
            RowIds(R.id.row_4, R.id.num_4, R.id.name_4, R.id.status_4),
        )

        fun updateWidgets(context: Context, mgr: AppWidgetManager, ids: IntArray) {
            val views = buildViews(context)
            ids.forEach { mgr.updateAppWidget(it, views) }
        }

        private fun buildViews(context: Context): RemoteViews {
            val prefs = context.getSharedPreferences("spmove_widget", Context.MODE_PRIVATE)
            val linesJson = prefs.getString("lines_json", null)
            val summary = prefs.getString("summary", "Abra o app para carregar") ?: "Abra o app para carregar"
            val overallColor = prefs.getString("overall_color", "#4CAF50") ?: "#4CAF50"

            val views = RemoteViews(context.packageName, R.layout.widget_layout)

            views.setTextViewText(R.id.widget_summary, summary)
            runCatching {
                views.setInt(R.id.widget_status_dot, "setBackgroundColor", Color.parseColor(overallColor))
            }

            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            if (launchIntent != null) {
                val pi = PendingIntent.getActivity(
                    context, 0, launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(R.id.widget_root, pi)
            }

            ROW_IDS.forEach { views.setViewVisibility(it.row, View.GONE) }

            if (linesJson != null) {
                runCatching {
                    val arr = JSONArray(linesJson)
                    val count = minOf(arr.length(), ROW_IDS.size)
                    for (i in 0 until count) {
                        val line = arr.getJSONObject(i)
                        val row = ROW_IDS[i]
                        views.setViewVisibility(row.row, View.VISIBLE)
                        views.setTextViewText(row.num, line.getString("num"))
                        views.setTextViewText(row.name, line.getString("name"))
                        views.setTextViewText(row.status, line.getString("statusLabel"))
                        runCatching {
                            views.setTextColor(row.num, Color.parseColor(line.getString("color")))
                        }
                        runCatching {
                            views.setTextColor(row.status, Color.parseColor(line.getString("statusColor")))
                        }
                    }
                }
            }

            return views
        }
    }
}
`;

const WIDGET_MODULE_KT = `package com.lborzani.spmove

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class WidgetModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "WidgetModule"

    private fun prefs() =
        reactApplicationContext.getSharedPreferences("spmove_widget", Context.MODE_PRIVATE)

    @ReactMethod
    fun updateWidget(linesJson: String, summary: String, overallColor: String) {
        prefs().edit()
            .putString("lines_json", linesJson)
            .putString("summary", summary)
            .putString("overall_color", overallColor)
            .apply()
        triggerUpdate()
    }

    @ReactMethod
    fun configure(backendUrl: String, apiKey: String, favoritesJson: String) {
        prefs().edit()
            .putString("backend_url", backendUrl)
            .putString("api_key", apiKey)
            .putString("favorites_json", favoritesJson)
            .apply()
    }

    @ReactMethod
    fun scheduleRefresh() {
        triggerUpdate()
    }

    private fun triggerUpdate() {
        val ctx = reactApplicationContext
        val mgr = AppWidgetManager.getInstance(ctx)
        val ids = mgr.getAppWidgetIds(ComponentName(ctx, LineStatusWidget::class.java))
        if (ids.isNotEmpty()) {
            LineStatusWidget.updateWidgets(ctx, mgr, ids)
        }
    }
}
`;

const WIDGET_PACKAGE_KT = `package com.lborzani.spmove

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class WidgetPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(WidgetModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
`;

// ─── XML resource files ───────────────────────────────────────────────────────

const WIDGET_LAYOUT_XML = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:background="#1A1C20"
    android:padding="12dp">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:gravity="center_vertical"
        android:layout_marginBottom="6dp">

        <View
            android:id="@+id/widget_status_dot"
            android:layout_width="7dp"
            android:layout_height="7dp"
            android:background="#4CAF50" />

        <TextView
            android:id="@+id/widget_app_name"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:layout_marginStart="6dp"
            android:text="SPMove"
            android:textColor="#FFFFFF"
            android:textSize="11sp"
            android:textStyle="bold"
            android:letterSpacing="0.05" />

        <TextView
            android:id="@+id/widget_summary"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="Carregando..."
            android:textColor="#888888"
            android:textSize="10sp" />
    </LinearLayout>

    <LinearLayout android:id="@+id/row_0" android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="horizontal" android:gravity="center_vertical" android:paddingVertical="2dp" android:visibility="gone">
        <TextView android:id="@+id/num_0" android:layout_width="18dp" android:layout_height="wrap_content" android:gravity="center" android:textColor="#FFFFFF" android:textSize="10sp" android:textStyle="bold" />
        <TextView android:id="@+id/name_0" android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:layout_marginStart="8dp" android:textColor="#CCCCCC" android:textSize="11sp" android:maxLines="1" android:ellipsize="end" />
        <TextView android:id="@+id/status_0" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textSize="10sp" android:textStyle="bold" />
    </LinearLayout>

    <LinearLayout android:id="@+id/row_1" android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="horizontal" android:gravity="center_vertical" android:paddingVertical="2dp" android:visibility="gone">
        <TextView android:id="@+id/num_1" android:layout_width="18dp" android:layout_height="wrap_content" android:gravity="center" android:textColor="#FFFFFF" android:textSize="10sp" android:textStyle="bold" />
        <TextView android:id="@+id/name_1" android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:layout_marginStart="8dp" android:textColor="#CCCCCC" android:textSize="11sp" android:maxLines="1" android:ellipsize="end" />
        <TextView android:id="@+id/status_1" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textSize="10sp" android:textStyle="bold" />
    </LinearLayout>

    <LinearLayout android:id="@+id/row_2" android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="horizontal" android:gravity="center_vertical" android:paddingVertical="2dp" android:visibility="gone">
        <TextView android:id="@+id/num_2" android:layout_width="18dp" android:layout_height="wrap_content" android:gravity="center" android:textColor="#FFFFFF" android:textSize="10sp" android:textStyle="bold" />
        <TextView android:id="@+id/name_2" android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:layout_marginStart="8dp" android:textColor="#CCCCCC" android:textSize="11sp" android:maxLines="1" android:ellipsize="end" />
        <TextView android:id="@+id/status_2" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textSize="10sp" android:textStyle="bold" />
    </LinearLayout>

    <LinearLayout android:id="@+id/row_3" android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="horizontal" android:gravity="center_vertical" android:paddingVertical="2dp" android:visibility="gone">
        <TextView android:id="@+id/num_3" android:layout_width="18dp" android:layout_height="wrap_content" android:gravity="center" android:textColor="#FFFFFF" android:textSize="10sp" android:textStyle="bold" />
        <TextView android:id="@+id/name_3" android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:layout_marginStart="8dp" android:textColor="#CCCCCC" android:textSize="11sp" android:maxLines="1" android:ellipsize="end" />
        <TextView android:id="@+id/status_3" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textSize="10sp" android:textStyle="bold" />
    </LinearLayout>

    <LinearLayout android:id="@+id/row_4" android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="horizontal" android:gravity="center_vertical" android:paddingVertical="2dp" android:visibility="gone">
        <TextView android:id="@+id/num_4" android:layout_width="18dp" android:layout_height="wrap_content" android:gravity="center" android:textColor="#FFFFFF" android:textSize="10sp" android:textStyle="bold" />
        <TextView android:id="@+id/name_4" android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:layout_marginStart="8dp" android:textColor="#CCCCCC" android:textSize="11sp" android:maxLines="1" android:ellipsize="end" />
        <TextView android:id="@+id/status_4" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textSize="10sp" android:textStyle="bold" />
    </LinearLayout>

</LinearLayout>
`;

const WIDGET_INFO_XML = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp"
    android:minHeight="110dp"
    android:targetCellWidth="4"
    android:targetCellHeight="2"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/widget_layout"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen" />
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function writeFileIfChanged(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  if (existing !== content) fs.writeFileSync(filePath, content, 'utf8');
}

// ─── Sub-plugins ─────────────────────────────────────────────────────────────

/** Writes all Kotlin source files and XML resources into android/ */
const withWidgetFiles = (config) => {
  return withDangerousMod(config, [
    'android',
    (mod) => {
      const root = mod.modRequest.platformProjectRoot; // android/
      const pkg = 'com/lborzani/spmove';
      const javaDir = path.join(root, 'app/src/main/java', pkg);
      const resDir = path.join(root, 'app/src/main/res');

      writeFileIfChanged(path.join(javaDir, 'LineStatusWidget.kt'), LINE_STATUS_WIDGET_KT);
      writeFileIfChanged(path.join(javaDir, 'WidgetModule.kt'), WIDGET_MODULE_KT);
      writeFileIfChanged(path.join(javaDir, 'WidgetPackage.kt'), WIDGET_PACKAGE_KT);
      writeFileIfChanged(path.join(resDir, 'layout/widget_layout.xml'), WIDGET_LAYOUT_XML);
      writeFileIfChanged(path.join(resDir, 'xml/widget_info.xml'), WIDGET_INFO_XML);

      return mod;
    },
  ]);
};

/** Adds the <receiver> declaration to AndroidManifest.xml */
const withWidgetManifest = (config) => {
  return withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application[0];

    const alreadyAdded = (app.receiver ?? []).some(
      (r) => r.$?.['android:name'] === '.LineStatusWidget',
    );

    if (!alreadyAdded) {
      app.receiver = [
        ...(app.receiver ?? []),
        {
          $: { 'android:name': '.LineStatusWidget', 'android:exported': 'true' },
          'intent-filter': [
            { action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }] },
          ],
          'meta-data': [
            {
              $: {
                'android:name': 'android.appwidget.provider',
                'android:resource': '@xml/widget_info',
              },
            },
          ],
        },
      ];
    }

    return mod;
  });
};

/** Appends widget keep-rules to proguard-rules.pro */
const withWidgetProguard = (config) => {
  return withDangerousMod(config, [
    'android',
    (mod) => {
      const proguardPath = path.join(mod.modRequest.platformProjectRoot, 'app/proguard-rules.pro');
      if (fs.existsSync(proguardPath)) {
        let contents = fs.readFileSync(proguardPath, 'utf8');
        const keepRules = [
          '# Android widget — AppWidgetProvider and bridge module must survive R8',
          '-keep class com.lborzani.spmove.LineStatusWidget { *; }',
          '-keep class com.lborzani.spmove.WidgetModule { *; }',
          '-keep class com.lborzani.spmove.WidgetPackage { *; }',
        ].join('\n');
        if (!contents.includes('-keep class com.lborzani.spmove.LineStatusWidget')) {
          contents = contents.trimEnd() + '\n\n' + keepRules + '\n';
          fs.writeFileSync(proguardPath, contents, 'utf8');
        }
      }
      return mod;
    },
  ]);
};

/** Injects WidgetPackage() registration into MainApplication.kt */
const withWidgetMainApplication = (config) => {
  return withMainApplication(config, (mod) => {
    let { contents } = mod.modResults;

    const importLine = 'import com.lborzani.spmove.WidgetPackage';
    if (!contents.includes(importLine)) {
      contents = contents.replace(
        /(import expo\.modules\.ExpoReactHostFactory)/,
        `${importLine}\n$1`,
      );
    }

    if (!contents.includes('add(WidgetPackage())')) {
      if (contents.includes('PackageList(this).packages.apply {')) {
        // Expo SDK 50+ template already has an .apply { } block — insert inside it
        contents = contents.replace(
          /PackageList\(this\)\.packages\.apply \{/,
          `PackageList(this).packages.apply {\n          add(WidgetPackage())`,
        );
      } else {
        // Older template: bare .packages call — wrap it
        contents = contents.replace(
          /PackageList\(this\)\.packages/,
          `PackageList(this).packages.apply {\n          add(WidgetPackage())\n        }`,
        );
      }
    }

    mod.modResults.contents = contents;
    return mod;
  });
};

// ─── Main export ──────────────────────────────────────────────────────────────

const withAndroidWidget = (config) => {
  config = withWidgetFiles(config);
  config = withWidgetManifest(config);
  config = withWidgetMainApplication(config);
  config = withWidgetProguard(config);
  return config;
};

module.exports = withAndroidWidget;
