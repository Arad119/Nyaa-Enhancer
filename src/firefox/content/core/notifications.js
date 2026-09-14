export function showNotification(message, isSuccess = true) {
  // Create or find the container for notifications
  // This container is fixed to the bottom-right corner of the screen
  let container = document.querySelector(".magnet-notification-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "magnet-notification-container";
    document.body.appendChild(container);
  }

  // Create the notification element
  const notification = document.createElement("div");
  notification.className = "magnet-notification";
  notification.textContent = message;
  // Set color based on success/failure
  notification.style.backgroundColor = isSuccess ? "#4CAF50" : "#f44336";

  container.appendChild(notification);

  // Force firefox to process the element before animation
  notification.offsetHeight;

  // Show the notification with a slide-in animation
  notification.classList.add("show");

  // Remove the notification after 3 seconds
  setTimeout(() => {
    notification.classList.remove("show");
    // Wait for fade-out animation before removing
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function getNotificationContainer() {
  let container = document.querySelector(".magnet-notification-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "magnet-notification-container";
    document.body.appendChild(container);
  }
  return container;
}

export function createProgressNotification() {
  const notification = document.createElement("div");
  notification.className = "magnet-notification show";
  notification.style.backgroundColor = "#4CAF50";
  getNotificationContainer().appendChild(notification);
  return notification;
}

export function createCancellableProgressNotification({ onCancel } = {}) {
  const notification = document.createElement("div");
  notification.className = "magnet-notification magnet-notification--progress show";
  notification.style.backgroundColor = "#4CAF50";

  const row = document.createElement("div");
  row.className = "magnet-notification__row";

  const text = document.createElement("span");
  text.className = "magnet-notification__text";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "magnet-notification__cancel";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", () => {
    if (cancelButton.disabled) return;
    cancelButton.disabled = true;
    onCancel?.();
  });

  row.append(text, cancelButton);
  notification.appendChild(row);
  getNotificationContainer().appendChild(notification);

  return {
    notification,
    setText(value) {
      text.textContent = value;
    },
    setStatus(kind) {
      setProgressNotificationStatus(notification, kind);
    },
    setCancelEnabled(enabled) {
      cancelButton.disabled = !enabled;
    },
    setCancelVisible(visible) {
      cancelButton.hidden = !visible;
    },
    dismiss(delayMs = 3000) {
      dismissProgressNotification(notification, delayMs);
    },
  };
}

export function sanitizeFilename(filename) {
  // Replace any of the invalid characters with an underscore
  return filename.replace(/[<>:"/\\|?*]/g, "_");
}

export function dismissProgressNotification(notification, delayMs = 3000) {
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.remove(), 300);
  }, delayMs);
}

export function setProgressNotificationStatus(notification, kind) {
  if (kind === "error") notification.style.backgroundColor = "#f44336";
  else if (kind === "warning") notification.style.backgroundColor = "#ff9800";
  else notification.style.backgroundColor = "#4CAF50";
}
