package uz.sanjar97a.namozqazo;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CompassPlugin.class); // Qibla kompasi (native sensor)
        super.onCreate(savedInstanceState);
        // Telefonning katta shrift sozlamasi ilova dizaynini buzmasligi uchun matn o'lchami 100% da qoladi
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().getSettings().setTextZoom(100);
        }
    }
}
