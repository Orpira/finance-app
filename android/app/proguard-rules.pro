# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# Capacitor bridge and plugin classes are discovered reflectively from the
# generated native configuration. Keep them stable when R8 minifies release
# builds.
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.plugins.** { *; }
-keep class com.financeapp.app.MainActivity { *; }
-keep class com.financeapp.app.FileDownloadPlugin { *; }

# Keep JavaScript bridge annotations and common metadata used by AndroidX,
# Capacitor and plugins.
-keepattributes *Annotation*
-keepattributes Signature
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Google Play services / Firebase classes may be present when google-services
# is configured later. These rules are intentionally conservative.
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# Local notification and AndroidX startup components can be referenced from
# manifest metadata or scheduled callbacks.
-keep class androidx.startup.** { *; }
-keep class androidx.work.** { *; }
-dontwarn androidx.work.**
