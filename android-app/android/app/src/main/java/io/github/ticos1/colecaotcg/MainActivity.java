package io.github.ticos1.colecaotcg;

import android.os.Bundle;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin próprio: baixa e instala a atualização do app (precisa vir antes do super).
        registerPlugin(AtualizadorPlugin.class);
        super.onCreate(savedInstanceState);

        // Botão voltar do Android: volta para a tela anterior do app (histórico do site).
        // Só fecha o app quando não há mais para onde voltar.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() != null
                        && getBridge().getWebView() != null
                        && getBridge().getWebView().canGoBack()) {
                    getBridge().getWebView().goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });
    }
}
