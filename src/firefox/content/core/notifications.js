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

export function createProgressNotification() {
  // Find or create the container for notifications
  let container = document.querySelector(".magnet-notification-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "magnet-notification-container";
    document.body.appendChild(container);
  }

  // Create the notification element
  const notification = document.createElement("div");
  notification.className = "magnet-notification show";
  notification.style.backgroundColor = "#4CAF50";
  container.appendChild(notification);

  return notification;
}

export function sanitizeFilename(filename) {
  // Replace any of the invalid characters with an underscore
  return filename.replace(/[<>:"/\\|?*]/g, "_");
}

// Function to download torrents and package them into a ZIP file
// torrents: Array of torrent objects with url and filename
// zipName: Name of the output ZIP file
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
