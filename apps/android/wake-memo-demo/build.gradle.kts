plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

android {
  namespace = "ai.openclaw.wakememo"
  compileSdk = 36

  defaultConfig {
    applicationId = "ai.openclaw.wakememo"
    minSdk = 31
    targetSdk = 36
    versionCode = 1
    versionName = "0.1.0"

    val key = (project.findProperty("PICOVOICE_ACCESS_KEY") as String?) ?: ""
    buildConfigField("String", "PICOVOICE_ACCESS_KEY", "\"$key\"")
  }

  buildTypes {
    release {
      isMinifyEnabled = false
    }
  }

  buildFeatures {
    buildConfig = true
  }

  androidResources {
    noCompress += "onnx"
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlinOptions {
    jvmTarget = "17"
  }
}

dependencies {
  implementation("ai.picovoice:porcupine-android:4.0.0")
  // ONNX Runtime for OpenWakeWord models
  implementation("com.microsoft.onnxruntime:onnxruntime-android:1.17.0")

  implementation("androidx.core:core-ktx:1.17.0")
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("androidx.activity:activity-ktx:1.12.2")
}
