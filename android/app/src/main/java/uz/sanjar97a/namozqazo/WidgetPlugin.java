package uz.sanjar97a.namozqazo;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** JS -> vidjet: namoz vaqtlarini saqlash va vidjetni bosh ekranga qo'shish so'rovi. */
@CapacitorPlugin(name = "PrayerWidget")
public class WidgetPlugin extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        String data = call.getString("data");
        if (data != null) PrayerWidget.save(getContext(), data);
        PrayerWidget.updateAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void pin(PluginCall call) {
        JSObject r = new JSObject();
        AppWidgetManager mgr = AppWidgetManager.getInstance(getContext());
        ComponentName cn = new ComponentName(getContext(), PrayerWidget.class);
        boolean ok = false;
        if (Build.VERSION.SDK_INT >= 26 && mgr.isRequestPinAppWidgetSupported()) {
            ok = mgr.requestPinAppWidget(cn, null, null);
        }
        r.put("ok", ok);
        r.put("count", mgr.getAppWidgetIds(cn).length);
        call.resolve(r);
    }
}
