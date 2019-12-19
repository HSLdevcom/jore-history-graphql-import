export const messageTypes = {
  ERROR: "error",
  INFO: "info",
};

export async function reportError(err) {
  const message =
    typeof err === "string" ? err : typeof err.message === "string" ? err.message : "";

  if (message) {
    return onMonitorEvent(message, messageTypes.ERROR);
  }
}

export async function onMonitorEvent(
  message = "Something happened.",
  type = messageTypes.ERROR,
) {
  // TODO
}
