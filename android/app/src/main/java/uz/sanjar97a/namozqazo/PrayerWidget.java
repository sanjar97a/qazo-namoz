package uz.sanjar97a.namozqazo;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;

/**
 * Bosh ekran vidjeti: bugungi namoz vaqtlari, hozirgi vaqt oltin rang bilan ajratiladi.
 * Vaqtlar ilova (JS) tomonidan 30 kun oldinga hisoblab qo'yiladi — vidjet internetsiz ishlaydi.
 * Har bir namoz vaqti kirganda va yarim tunda o'zini yangilaydi.
 */
public class PrayerWidget extends AppWidgetProvider {
    static final String PREFS = "prayer_widget";
    static final String ACTION_TICK = "uz.sanjar97a.namozqazo.WIDGET_TICK";
    private static final int[] COL = { R.id.w_col0, R.id.w_col1, R.id.w_col2, R.id.w_col3, R.id.w_col4, R.id.w_col5 };
    private static final int[] NAME = { R.id.w_n0, R.id.w_n1, R.id.w_n2, R.id.w_n3, R.id.w_n4, R.id.w_n5 };
    private static final int[] TIME = { R.id.w_t0, R.id.w_t1, R.id.w_t2, R.id.w_t3, R.id.w_t4, R.id.w_t5 };
    private static final String[] DAYS = { "Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba" };
    private static final String[] MONTHS = { "Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek" };

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) { updateAll(ctx); }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        String a = intent.getAction();
        if (ACTION_TICK.equals(a) || Intent.ACTION_TIME_CHANGED.equals(a) || Intent.ACTION_TIMEZONE_CHANGED.equals(a)
                || Intent.ACTION_DATE_CHANGED.equals(a) || Intent.ACTION_BOOT_COMPLETED.equals(a)) {
            updateAll(ctx);
        }
    }

    static void save(Context ctx, String data) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("data", data).apply();
    }

    private static String key(Calendar c) {
        return String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    private static String hm(long ms) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(ms);
        return String.format(Locale.US, "%02d:%02d", c.get(Calendar.HOUR_OF_DAY), c.get(Calendar.MINUTE));
    }

    static void updateAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, PrayerWidget.class));
        if (ids == null || ids.length == 0) return;

        long now = System.currentTimeMillis();
        Calendar today = Calendar.getInstance();
        String city = "Namoz vaqtlari";
        long[] t = null;
        try {
            SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String raw = sp.getString("data", null);
            if (raw != null) {
                JSONObject o = new JSONObject(raw);
                city = o.optString("city", city);
                JSONArray arr = o.getJSONObject("days").optJSONArray(key(today));
                if (arr != null && arr.length() == 6) {
                    t = new long[6];
                    for (int i = 0; i < 6; i++) t[i] = arr.getLong(i);
                }
            }
        } catch (Exception ignored) { t = null; }

        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.prayer_widget);
        v.setTextViewText(R.id.w_city, t == null ? "Ilovani bir marta oching" : city);
        v.setTextViewText(R.id.w_date, DAYS[today.get(Calendar.DAY_OF_WEEK) - 1] + ", " + today.get(Calendar.DAY_OF_MONTH) + " " + MONTHS[today.get(Calendar.MONTH)]);

        int cur = -1;
        long next = Long.MAX_VALUE;
        if (t != null) {
            for (int i = 0; i < 6; i++) if (t[i] <= now) cur = i;
            if (cur == -1) cur = 5; // tong otguncha — hali Xufton vaqti
            for (int i = 0; i < 6; i++) if (t[i] > now) { next = t[i]; break; }
        }
        for (int i = 0; i < 6; i++) {
            v.setTextViewText(TIME[i], t == null ? "--:--" : hm(t[i]));
            boolean on = i == cur;
            v.setInt(TIME[i], "setBackgroundResource", on ? R.drawable.widget_pill : 0);
            v.setTextColor(TIME[i], on ? Color.parseColor("#1E1503") : Color.WHITE);
            v.setTextColor(NAME[i], on ? Color.parseColor("#E9C46A") : Color.parseColor("#BFD6CB"));
            v.setInt(COL[i], "setBackgroundResource", 0);
        }

        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.w_root, pi);
        mgr.updateAppWidget(ids, v);

        // Keyingi yangilanish: keyingi namoz vaqti yoki yarim tun (qaysi biri oldin bo'lsa)
        Calendar mid = Calendar.getInstance();
        mid.add(Calendar.DAY_OF_MONTH, 1);
        mid.set(Calendar.HOUR_OF_DAY, 0); mid.set(Calendar.MINUTE, 0); mid.set(Calendar.SECOND, 5); mid.set(Calendar.MILLISECOND, 0);
        long at = Math.min(next == Long.MAX_VALUE ? Long.MAX_VALUE : next + 2000, mid.getTimeInMillis());
        schedule(ctx, at);
    }

    private static void schedule(Context ctx, long at) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Intent i = new Intent(ctx, PrayerWidget.class).setAction(ACTION_TICK);
        PendingIntent pi = PendingIntent.getBroadcast(ctx, 7, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        try {
            if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) am.setAndAllowWhileIdle(AlarmManager.RTC, at, pi);
            else am.setExactAndAllowWhileIdle(AlarmManager.RTC, at, pi);
        } catch (Exception e) {
            try { am.set(AlarmManager.RTC, at, pi); } catch (Exception ignored) {}
        }
    }

    @Override
    public void onDisabled(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        Intent i = new Intent(ctx, PrayerWidget.class).setAction(ACTION_TICK);
        PendingIntent pi = PendingIntent.getBroadcast(ctx, 7, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        if (am != null) am.cancel(pi);
    }
}
