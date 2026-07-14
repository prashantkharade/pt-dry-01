allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
// Some plugins (e.g. flutter_secure_storage) pin an older compileSdk (android-34)
// that isn't installed in this machine's SDK (and the SDK lives in a write-
// protected folder, so it can't be auto-installed). Bump any such subproject to
// android-35, which is present, so no extra SDK platform download is required.
// Registered BEFORE evaluationDependsOn below so the hook is in place before the
// subprojects get force-evaluated.
subprojects {
    afterEvaluate {
        val androidExt = project.extensions.findByName("android") ?: return@afterEvaluate
        try {
            val current = androidExt.javaClass
                .getMethod("getCompileSdkVersion")
                .invoke(androidExt) as? String
            if (current == "android-34" || current == "android-33") {
                androidExt.javaClass
                    .getMethod("compileSdkVersion", String::class.java)
                    .invoke(androidExt, "android-35")
            }
        } catch (e: Exception) {
            logger.warn("compileSdk override skipped for ${project.name}: ${e.message}")
        }
    }
}

subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
