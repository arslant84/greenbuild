import { appIcon } from "./app-icon/app-icon";
import { APPLE_ICON_SIZE } from "./app-icon/sizes";

// Next's apple-icon convention: Safari uses it when the app is added to the home screen (task 56).
export const size = { width: APPLE_ICON_SIZE, height: APPLE_ICON_SIZE };
export const contentType = "image/png";

export default function AppleIcon() {
  return appIcon(APPLE_ICON_SIZE);
}
