import { Toaster } from "react-hot-toast";

// The one place toasts are shown. Mounted once in MainLayout, so a page only has to call showToast() (or toast.*) and
// the message appears, looking the same everywhere. A page that mounts its own Toaster would show every message twice.
const AppToaster = () => (
  <Toaster
    position="top-right"
    containerStyle={{ top: 76 }}   // below the 60px header, so it never covers the profile menu
    toastOptions={{
      duration: 5000,
      style: {
        background: "#ffffff",
        color: "#333333",
        padding: "16px",
        borderRadius: "8px",
        maxWidth: "500px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        border: "1px solid #e0e0e0",
        fontSize: "14px",
        fontWeight: "500",
      },
      success: { style: { background: "#f0fdf4", color: "#166534", border: "1px solid #86efac" }, icon: "✅" },
      error: { style: { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }, icon: "❌" },
    }}
  />
);

export default AppToaster;
