package com.financeapp.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "FileDownload")
public class FileDownloadPlugin extends Plugin {
    @PluginMethod
    public void saveFile(PluginCall call) {
        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String base64Data = call.getString("base64Data");

        if (fileName == null || fileName.trim().isEmpty() || base64Data == null) {
            call.reject("Datos de archivo inválidos.");
            return;
        }

        try {
            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
            Uri uri = saveToDownloads(fileName, mimeType, bytes);
            JSObject result = new JSObject();

            result.put("uri", uri != null ? uri.toString() : "");
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("No se pudo guardar el archivo.", exception);
        }
    }

    private Uri saveToDownloads(String fileName, String mimeType, byte[] bytes)
        throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentResolver resolver = getContext().getContentResolver();
            ContentValues values = new ContentValues();

            values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
            values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
            values.put(
                MediaStore.Downloads.RELATIVE_PATH,
                Environment.DIRECTORY_DOWNLOADS
            );
            values.put(MediaStore.Downloads.IS_PENDING, 1);

            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);

            if (uri == null) {
                throw new IllegalStateException("No se pudo crear el archivo.");
            }

            try (OutputStream outputStream = resolver.openOutputStream(uri)) {
                if (outputStream == null) {
                    throw new IllegalStateException("No se pudo abrir el archivo.");
                }

                outputStream.write(bytes);
            }

            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            resolver.update(uri, values, null, null);

            return uri;
        }

        File downloadsDirectory = getContext().getExternalFilesDir(
            Environment.DIRECTORY_DOWNLOADS
        );

        if (downloadsDirectory == null) {
            throw new IllegalStateException("No se pudo abrir Descargas.");
        }

        if (!downloadsDirectory.exists() && !downloadsDirectory.mkdirs()) {
            throw new IllegalStateException("No se pudo crear Descargas.");
        }

        File file = new File(downloadsDirectory, fileName);

        try (FileOutputStream outputStream = new FileOutputStream(file)) {
            outputStream.write(bytes);
        }

        return Uri.fromFile(file);
    }
}
