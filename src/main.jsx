import React from "react"
import { createRoot } from "react-dom/client"
import { flushSync } from "react-dom"
import App from "./App"
import "./index.css"

flushSync(() => {
  createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
})

import("../app.js")
