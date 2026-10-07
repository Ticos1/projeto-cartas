package io.github.ticos1.colecaotcg;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * Atualização do app pelo próprio app: baixa o APK novo com o gerenciador de downloads do
 * Android (com notificação e progresso) e abre o instalador.
 *
 * Só baixa de https://github.com/Ticos1/projeto-cartas/releases/ (os APKs publicados).
 */
@CapacitorPlugin(name = "Atualizador")
public class AtualizadorPlugin extends Plugin {

    private static final String PREFIXO_PERMITIDO = "https://github.com/Ticos1/projeto-cartas/releases/";
    private static final String TIPO_APK = "application/vnd.android.package-archive";

    private final Handler principal = new Handler(Looper.getMainLooper());
    private long idDownload = -1;
    private Runnable verificador = null;

    private boolean nomeValido(String nome) {
        return nome != null && nome.matches("[A-Za-z0-9._-]+\\.apk");
    }

    private File arquivoDe(String nome) {
        File pasta = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        return pasta == null ? null : new File(pasta, nome);
    }

    private boolean podeInstalarApps() {
        return Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls();
    }

    /** O Android deixa este app instalar APKs? (opção "Permitir desta fonte") */
    @PluginMethod
    public void podeInstalar(PluginCall call) {
        JSObject resposta = new JSObject();
        resposta.put("permitido", podeInstalarApps());
        call.resolve(resposta);
    }

    /** Abre a tela do Android onde o usuário liga "Permitir desta fonte" para este app. */
    @PluginMethod
    public void pedirPermissao(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 26) {
            Intent intencao = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            intencao.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intencao);
        }
        call.resolve();
    }

    /**
     * Começa o download. Eventos para o site:
     * "progresso" {baixado, total, percentual}, "baixado" {nome} e "erro" {mensagem}.
     */
    @PluginMethod
    public void baixar(PluginCall call) {
        String url = call.getString("url");
        String nome = call.getString("nome");
        if (url == null || !url.startsWith(PREFIXO_PERMITIDO)) {
            call.reject("Endereço não permitido.");
            return;
        }
        if (!nomeValido(nome)) {
            call.reject("Nome de arquivo inválido.");
            return;
        }
        File arquivo = arquivoDe(nome);
        if (arquivo == null) {
            call.reject("Sem armazenamento disponível.");
            return;
        }

        pararAcompanhamento();
        if (arquivo.exists()) {
            arquivo.delete();
        }

        DownloadManager.Request pedido = new DownloadManager.Request(Uri.parse(url));
        pedido.setTitle("Coleção TCG");
        pedido.setDescription("Baixando a atualização do app");
        pedido.setMimeType(TIPO_APK);
        pedido.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        pedido.setDestinationInExternalFilesDir(getContext(), Environment.DIRECTORY_DOWNLOADS, nome);

        DownloadManager gerente = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        idDownload = gerente.enqueue(pedido);
        acompanhar(gerente, nome);
        call.resolve();
    }

    private void acompanhar(final DownloadManager gerente, final String nome) {
        verificador = new Runnable() {
            @Override
            public void run() {
                if (idDownload < 0) {
                    return;
                }
                boolean continuar = true;
                Cursor c = gerente.query(new DownloadManager.Query().setFilterById(idDownload));
                try {
                    if (c != null && c.moveToFirst()) {
                        int status = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                        long baixado = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
                        long total = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));

                        JSObject progresso = new JSObject();
                        progresso.put("baixado", baixado);
                        progresso.put("total", total);
                        progresso.put("percentual", total > 0 ? (int) (baixado * 100 / total) : 0);
                        notifyListeners("progresso", progresso);

                        if (status == DownloadManager.STATUS_SUCCESSFUL) {
                            continuar = false;
                            JSObject pronto = new JSObject();
                            pronto.put("nome", nome);
                            notifyListeners("baixado", pronto);
                        } else if (status == DownloadManager.STATUS_FAILED) {
                            continuar = false;
                            JSObject erro = new JSObject();
                            erro.put("mensagem", "O download falhou.");
                            notifyListeners("erro", erro);
                        }
                    } else {
                        // O download sumiu da lista (por exemplo, cancelado pela notificação).
                        continuar = false;
                        JSObject erro = new JSObject();
                        erro.put("mensagem", "O download foi cancelado.");
                        notifyListeners("erro", erro);
                    }
                } finally {
                    if (c != null) {
                        c.close();
                    }
                }
                if (continuar) {
                    principal.postDelayed(this, 400);
                } else {
                    verificador = null;
                }
            }
        };
        principal.post(verificador);
    }

    /** Abre o instalador do Android com o APK já baixado. */
    @PluginMethod
    public void instalar(PluginCall call) {
        String nome = call.getString("nome");
        if (!nomeValido(nome)) {
            call.reject("Nome de arquivo inválido.");
            return;
        }
        File arquivo = arquivoDe(nome);
        if (arquivo == null || !arquivo.exists()) {
            call.reject("Arquivo não encontrado.");
            return;
        }
        if (!podeInstalarApps()) {
            call.reject("Sem permissão para instalar.");
            return;
        }
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", arquivo);
        Intent intencao = new Intent(Intent.ACTION_VIEW);
        intencao.setDataAndType(uri, TIPO_APK);
        intencao.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intencao);
        call.resolve();
    }

    /** Cancela o download em andamento. */
    @PluginMethod
    public void cancelar(PluginCall call) {
        pararAcompanhamento();
        if (idDownload >= 0) {
            DownloadManager gerente = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            gerente.remove(idDownload);
            idDownload = -1;
        }
        call.resolve();
    }

    private void pararAcompanhamento() {
        if (verificador != null) {
            principal.removeCallbacks(verificador);
            verificador = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        pararAcompanhamento();
    }
}
