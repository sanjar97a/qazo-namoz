package uz.sanjar97a.namozqazo;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Qibla uchun kompas: Android rotation-vector sensoridan magnit shimolga nisbatan yo'nalish.
 * JS'ga "heading" hodisasi: { heading: 0..360 (magnit shimoldan, soat yo'nalishida), accuracy: 0..3 }.
 * Haqiqiy shimolga o'tkazish (magnit og'ish) JS tomonida WMM2025 bilan qilinadi.
 */
@CapacitorPlugin(name = "Compass")
public class CompassPlugin extends Plugin implements SensorEventListener {
    private SensorManager sm;
    private Sensor rotation;
    private Sensor magnetic;
    private boolean running = false;
    private int accuracy = -1;
    private long lastEmit = 0;
    private final float[] rot = new float[9];
    private final float[] remapped = new float[9];
    private final float[] orient = new float[3];

    @PluginMethod
    public void start(PluginCall call) {
        sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sm == null) { call.reject("nosensor"); return; }
        rotation = sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        if (rotation == null) rotation = sm.getDefaultSensor(Sensor.TYPE_GEOMAGNETIC_ROTATION_VECTOR);
        magnetic = sm.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
        if (rotation == null) { call.reject("nosensor"); return; }
        register();
        running = true;
        JSObject r = new JSObject();
        r.put("ok", true);
        call.resolve(r);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        running = false;
        if (sm != null) sm.unregisterListener(this);
        call.resolve();
    }

    private void register() {
        sm.registerListener(this, rotation, SensorManager.SENSOR_DELAY_GAME);
        if (magnetic != null) sm.registerListener(this, magnetic, SensorManager.SENSOR_DELAY_UI);
    }

    @Override
    protected void handleOnPause() {
        if (running && sm != null) sm.unregisterListener(this);
        super.handleOnPause();
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (running && sm != null) register();
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_MAGNETIC_FIELD) return; // faqat aniqlik uchun
        long now = System.currentTimeMillis();
        if (now - lastEmit < 50) return;
        lastEmit = now;
        SensorManager.getRotationMatrixFromVector(rot, event.values);
        float[] m = rot;
        // Telefon tik (vertikal) ushlansa — orqa kamera yo'nalishi bo'yicha hisoblash
        if (Math.abs(rot[8]) < 0.5f) {
            SensorManager.remapCoordinateSystem(rot, SensorManager.AXIS_X, SensorManager.AXIS_Z, remapped);
            m = remapped;
        }
        SensorManager.getOrientation(m, orient);
        double heading = (Math.toDegrees(orient[0]) + 360.0) % 360.0;
        JSObject d = new JSObject();
        d.put("heading", heading);
        d.put("accuracy", accuracy);
        d.put("flat", Math.abs(rot[8]) >= 0.5f);
        notifyListeners("heading", d);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int acc) {
        if (sensor.getType() == Sensor.TYPE_MAGNETIC_FIELD || accuracy < 0) accuracy = acc;
    }
}
