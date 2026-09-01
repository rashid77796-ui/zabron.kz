import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { seedData } from "@/lib/store";

seedData();

createRoot(document.getElementById("root")!).render(<App />);
