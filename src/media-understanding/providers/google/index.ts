import type { MediaUnderstandingProvider } from "../../types.js";
import { describeImageWithModel } from "../image.js";
import { describeGeminiVideo } from "./video.js";

export const googleProvider: MediaUnderstandingProvider = {
  id: "google",
  describeImage: describeImageWithModel,
  describeVideo: describeGeminiVideo,
};
