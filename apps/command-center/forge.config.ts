import type { ForgeConfig } from "@electron-forge/shared-types";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerDMG } from "@electron-forge/maker-dmg";

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: "OpenClaw Command Center",
    executableName: "openclaw-command-center",
    appBundleId: "ai.openclaw.command-center",
    icon: "./resources/icon",
    // Security: validate ASAR integrity
    asarUnpack: ["resources/**"],
  },
  makers: [
    new MakerSquirrel({
      name: "openclaw-command-center",
      setupIcon: "./resources/icon.ico",
    }),
    new MakerZIP({}, ["darwin"]),
    new MakerDMG({
      icon: "./resources/icon.icns",
    }),
    new MakerDeb({
      options: {
        name: "openclaw-command-center",
        maintainer: "OpenClaw",
        homepage: "https://github.com/openclaw/openclaw",
        icon: "./resources/icon.png",
        categories: ["Development", "Utility"],
      },
    }),
    new MakerRpm({
      options: {
        name: "openclaw-command-center",
        homepage: "https://github.com/openclaw/openclaw",
        icon: "./resources/icon.png",
        categories: ["Development", "Utility"],
      },
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/main/index.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/preload/index.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
      ],
    }),
  ],
};

export default config;
